/**
 * Password Breach Check using HaveIBeenPwned API (k-anonymity model)
 * Checks if a password has been exposed in data breaches
 * 
 * Implementation follows HIBP k-anonymity protocol:
 * 1. SHA-1 hash the password
 * 2. Send first 5 chars of hash to API
 * 3. API returns list of matching suffixes with counts
 * 4. Check if our hash suffix is in the response
 */

/**
 * Checks if a password has been pwned using HIBP API
 * Returns count of times seen in breaches (0 = not found)
 */
export async function checkPasswordBreach(password: string): Promise<{ pwned: boolean; count: number; error?: string }> {
  try {
    // SHA-1 hash the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Split hash: first 5 chars for API, rest for local comparison
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);
    
    // Call HIBP API with k-anonymity
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Dhurdur-Security-Check',
        'Add-Padding': 'true', // Adds padding for privacy
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // Check if our suffix is in the response
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        return { pwned: true, count: parseInt(countStr, 10) };
      }
    }
    
    return { pwned: false, count: 0 };
  } catch (error) {
    // Fail open - if API unavailable, don't block user
    console.warn('Password breach check failed:', error);
    return { pwned: false, count: 0, error: 'Breach check unavailable' };
  }
}

/**
 * Client-side password strength + breach check
 * Returns combined result for UI
 */
export async function validatePasswordSecurity(password: string): Promise<{
  strength: number; // 0-5
  errors: string[];
  breached: boolean;
  breachCount: number;
}> {
  const errors: string[] = [];
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength++;
  else errors.push('Mindestens 8 Zeichen');
  
  // Uppercase
  if (/[A-Z]/.test(password)) strength++;
  else errors.push('Ein Großbuchstabe');
  
  // Lowercase
  if (/[a-z]/.test(password)) strength++;
  else errors.push('Ein Kleinbuchstabe');
  
  // Number
  if (/[0-9]/.test(password)) strength++;
  else errors.push('Eine Zahl');
  
  // Special char
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  else errors.push('Ein Sonderzeichen');
  
  // Breach check (only if password meets minimum criteria)
  let breached = false;
  let breachCount = 0;
  
  if (password.length >= 8) {
    const breachResult = await checkPasswordBreach(password);
    breached = breachResult.pwned;
    breachCount = breachResult.count;
    
    if (breached) {
      errors.push(`Passwort in ${breachCount} Datenlecks gefunden - bitte anderes wählen`);
      strength = Math.max(0, strength - 2); // Penalize breached passwords
    }
  }
  
  return { strength, errors, breached, breachCount };
}

/**
 * Server-side version for API routes
 */
export async function checkPasswordBreachServer(password: string): Promise<{ pwned: boolean; count: number }> {
  // Use Web Crypto API (available in Node.js 15+ and browsers)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'Dhurdur-Server-Check' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) return { pwned: false, count: 0 };
    
    const text = await response.text();
    for (const line of text.trim().split('\n')) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        return { pwned: true, count: parseInt(countStr, 10) };
      }
    }
  } catch {
    // Fail open
  }
  
  return { pwned: false, count: 0 };
}