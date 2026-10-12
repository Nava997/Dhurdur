import { z } from 'zod';

/**
 * Validation schemas for all API routes
 * Using Zod for runtime validation and type inference
 */

// Common validation helpers
const emailSchema = z.string().email().max(254).toLowerCase().transform(s => s.trim());

// Email API validation
export const emailRequestSchema = z.object({
  email: emailSchema,
  subject: z.string().min(1).max(200).transform(s => s.trim()),
  message: z.string().min(1).max(10000).transform(s => s.trim()),
});

// UI Translation API validation (larger payloads)
export const translateUiRequestSchema = z.object({
  targetLang: z.enum(['en', 'es', 'fr', 'it', 'nl', 'tr', 'pl', 'ru', 'ar', 'zh', 'ja']),
  // Ignored by the server (it translates its own trusted dictionary); still
  // accepted so older cached clients don't fail validation.
  sourceDict: z.unknown().optional(),
});

// Validation helper function
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Audit log types
export interface AuditLogEntry {
  timestamp: string;
  endpoint: string;
  userId?: string;
  userRole?: string;
  action: string;
  resourceId?: string;
  resourceType?: string;
  success: boolean;
  error?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Create audit log entry
export function createAuditLog(
  request: Request,
  userId: string | undefined,
  userRole: string | undefined,
  action: string,
  resourceId: string | undefined,
  resourceType: string | undefined,
  success: boolean,
  error?: string,
  metadata?: Record<string, unknown>
): AuditLogEntry {
  const url = new URL(request.url);
  return {
    timestamp: new Date().toISOString(),
    endpoint: url.pathname,
    userId,
    userRole,
    action,
    resourceId,
    resourceType,
    success,
    error,
    // x-real-ip first (set by Vercel); x-forwarded-for can be prefixed by the client.
    ip: request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    metadata,
  };
}

// Log audit entry (in production, send to logging service)
export function logAudit(entry: AuditLogEntry): void {
  // console.info, not console.log: next.config strips console.log in production builds.
  console.info('[AUDIT]', JSON.stringify(entry));
}
