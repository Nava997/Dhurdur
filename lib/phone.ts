import { parsePhoneNumberFromString, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Phone number validation and formatting using libphonenumber-js
 * Provides E.164 formatting and country detection
 */

/**
 * Validates and formats a phone number to E.164 format
 */
export function validateAndFormatPhone(
  phone: string,
  defaultCountry: CountryCode = 'DE'
): { valid: boolean; formatted?: string; error?: string; country?: string } {
  try {
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    
    if (!phoneNumber) {
      return { valid: false, error: 'Ungültige Telefonnummer' };
    }
    
    if (!phoneNumber.isValid()) {
      return { valid: false, error: 'Telefonnummer ist nicht gültig' };
    }
    
    return {
      valid: true,
      formatted: phoneNumber.format('E.164'),
      country: phoneNumber.country,
    };
  } catch {
    return { valid: false, error: 'Fehler bei der Telefonnummer-Validierung' };
  }
}

/**
 * Validates a phone number without formatting
 */
export function validatePhone(phone: string, defaultCountry: CountryCode = 'DE'): boolean {
  return isValidPhoneNumber(phone, defaultCountry);
}

/**
 * Gets the country code from a phone number
 */
export function getPhoneCountry(phone: string, defaultCountry: CountryCode = 'DE'): string | undefined {
  try {
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    return phoneNumber?.country;
  } catch {
    return undefined;
  }
}

/**
 * Formats a phone number for display (national format)
 */
export function formatPhoneForDisplay(phone: string, defaultCountry: CountryCode = 'DE'): string {
  try {
    const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);
    return phoneNumber ? phoneNumber.format('NATIONAL') : phone;
  } catch {
    return phone;
  }
}

/**
 * Splits a phone number into country code and national number
 */
export function splitPhoneNumber(phone: string): { countryCode: string; nationalNumber: string } | null {
  try {
    const phoneNumber = parsePhoneNumberFromString(phone);
    if (!phoneNumber) return null;
    return {
      countryCode: `+${phoneNumber.countryCallingCode}`,
      nationalNumber: phoneNumber.nationalNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Supported countries for the dropdown
 */
export const SUPPORTED_COUNTRIES: { code: CountryCode; name: string; dialCode: string; flag: string }[] = [
  { code: 'DE', name: 'Deutschland', dialCode: '+49', flag: '🇩🇪' },
  { code: 'AT', name: 'Österreich', dialCode: '+43', flag: '🇦🇹' },
  { code: 'CH', name: 'Schweiz', dialCode: '+41', flag: '🇨🇭' },
  { code: 'US', name: 'USA', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'Vereinigtes Königreich', dialCode: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'Frankreich', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italien', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spanien', dialCode: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Niederlande', dialCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgien', dialCode: '+32', flag: '🇧🇪' },
  { code: 'PL', name: 'Polen', dialCode: '+48', flag: '🇵🇱' },
  { code: 'SE', name: 'Schweden', dialCode: '+46', flag: '🇸🇪' },
];