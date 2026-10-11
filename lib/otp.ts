import 'server-only';
import { createHash } from 'crypto';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function hashOtp(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${code}`).digest('hex');
}
