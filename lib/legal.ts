// Single source for the business details shown in the Impressum and the
// privacy policy. Every value here must be real and current — a wrong or
// unreachable entry makes both pages non-compliant (§ 5 DDG, Art. 13 DSGVO).

/** TODO(owner): legal name of the owner as registered with the Gewerbeamt. */
const OWNER_NAME = '[NAME DES INHABERS EINTRAGEN]';

/** Owner's mailbox (given by the site operator 2026-10-12). */
const CONTACT_EMAIL = 'durdurbarbershop@gmail.com';

export const LEGAL = {
  businessName: 'Dhurdur',
  ownerName: OWNER_NAME,
  street: 'Obere Str. 30',
  city: '97421 Schweinfurt',
  phone: '01523 2163823',
  email: CONTACT_EMAIL,
  /** Kleinunternehmer gem. § 19 UStG — confirmed by the site operator 2026-10-12. */
  smallBusiness: true,
  /** Provider that sends booking emails (keep in sync with EMAIL_HOST in Vercel). */
  emailProvider: 'Google Ireland Limited (Gmail), Gordon House, Barrow Street, Dublin 4, Irland',
  policyDate: '12.10.2026',
} as const;
