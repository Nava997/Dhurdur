import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store (use Redis/Upstash in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration per endpoint
const RATE_LIMIT_CONFIG: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/email': { windowMs: 60 * 1000, maxRequests: 10 },     // 10 emails per minute
  '/api/translate-ui': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 UI translations per minute
  '/api/account/delete': { windowMs: 60 * 1000, maxRequests: 3 },
  '/api/consent-log': { windowMs: 60 * 1000, maxRequests: 10 },
  // Default for other API routes
  'default': { windowMs: 60 * 1000, maxRequests: 60 },        // 60 requests per minute
};

function getClientId(request: NextRequest): string {
  // IP only: keying on User-Agent too let anyone bypass the limit by
  // changing that header on every request. x-real-ip is set by Vercel.
  return request.headers.get('x-real-ip') ||
         request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         'unknown';
}

function getRateLimitKey(request: NextRequest): string {
  const clientId = getClientId(request);
  const path = request.nextUrl.pathname;
  return `${path}:${clientId}`;
}

function checkRateLimit(key: string, config: { windowMs: number; maxRequests: number }): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Prune expired entries lazily (timers aren't reliable in serverless proxies).
let lastCleanup = 0;
function cleanupExpired(now: number) {
  if (now - lastCleanup < 60 * 1000) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  }
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Only apply rate limiting to API routes
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for internal health checks
  if (path === '/api/health' || path === '/api/ready') {
    return NextResponse.next();
  }

  cleanupExpired(Date.now());
  const config = RATE_LIMIT_CONFIG[path] || RATE_LIMIT_CONFIG.default;
  const key = getRateLimitKey(request);
  const { allowed, remaining, resetTime } = checkRateLimit(key, config);

  // Add rate limit headers to all API responses
  const response = allowed ? NextResponse.next() : new NextResponse(
    JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );

  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

  if (!allowed) {
    response.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString());
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};