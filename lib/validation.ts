import { z } from 'zod';

/**
 * Validation schemas for all API routes
 * Using Zod for runtime validation and type inference
 */

// Common validation helpers
const e164PhoneRegex = /^\+[1-9]\d{1,14}$/;
const sanitizeString = (maxLength: number) => z.string().min(1).max(maxLength).transform(s => s.trim());
const emailSchema = z.string().email().max(254).toLowerCase().transform(s => s.trim());

// Email API validation
export const emailRequestSchema = z.object({
  email: emailSchema,
  subject: z.string().min(1).max(200).transform(s => s.trim()),
  message: z.string().min(1).max(10000).transform(s => s.trim()),
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;

// Translation API validation
export const translateRequestSchema = z.object({
  text: z.string().min(1).max(5000).transform(s => s.trim()),
  targetLang: z.enum(['en', 'de', 'es', 'fr', 'it', 'nl', 'tr', 'pl', 'ru', 'ar', 'zh', 'ja']),
});

export type TranslateRequest = z.infer<typeof translateRequestSchema>;

// UI Translation API validation (larger payloads)
export const translateUiRequestSchema = z.object({
  targetLang: z.enum(['en', 'es', 'fr', 'it', 'nl', 'tr', 'pl', 'ru', 'ar', 'zh', 'ja']),
  // Ignored by the server (it translates its own trusted dictionary); still
  // accepted so older cached clients don't fail validation.
  sourceDict: z.unknown().optional(),
});

export type TranslateUiRequest = z.infer<typeof translateUiRequestSchema>;

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

// Sanitization helpers for client-side forms
export const clientValidation = {
  phone: (phone: string): { valid: boolean; formatted?: string; error?: string } => {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
      return { valid: false, error: 'Phone number must start with country code (e.g., +49)' };
    }
    if (!e164PhoneRegex.test(cleaned)) {
      return { valid: false, error: 'Invalid phone number format' };
    }
    return { valid: true, formatted: cleaned };
  },

  email: (email: string): { valid: boolean; formatted?: string; error?: string } => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format' };
    }
    if (trimmed.length > 254) {
      return { valid: false, error: 'Email too long' };
    }
    return { valid: true, formatted: trimmed };
  },

  password: (password: string): { valid: boolean; strength: number; errors: string[] } => {
    const errors: string[] = [];
    let strength = 0;

    if (password.length < 8) errors.push('Mindestens 8 Zeichen');
    else strength++;

    if (!/[A-Z]/.test(password)) errors.push('Ein Großbuchstabe');
    else strength++;

    if (!/[a-z]/.test(password)) errors.push('Ein Kleinbuchstabe');
    else strength++;

    if (!/[0-9]/.test(password)) errors.push('Eine Zahl');
    else strength++;

    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Ein Sonderzeichen');
    else strength++;

    return { valid: errors.length === 0, strength, errors };
  },
};

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
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
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

// getInternalHeaders function for API calls
export function getInternalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
  };
}