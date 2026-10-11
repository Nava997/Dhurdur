# GDPR & German Digital Law Compliance Report
## Dhurdur Salon — Barbershop Booking System

**Generated:** 2026-09-08  
**Scope:** Full audit of `C:\Users\Test\Desktop\New folder\completed\Dhurdur-salon`  
**Status:** Production-ready codebase — **legal pages exist but incomplete; critical security headers missing**

---

## Executive Summary

| Area | Status | Critical Issues |
|------|--------|-----------------|
| **Impressum (§5 DDG)** | ⚠️ Exists but **placeholders** | Missing: legal entity name, VAT ID, responsible person, real contact email |
| **Datenschutzerklärung (Art. 12–14 DSGVO)** | ⚠️ Exists but **English + placeholders** | Must be German; missing: hosting provider, retention periods, AVV status, transfer mechanisms |
| **Cookie Consent (TTDSG §25)** | ✅ **Excellent** | Granular, versioned, audit trail to Firestore — best practice |
| **Legal Basis Documentation** | ⚠️ **Partial** | Documented in code/comments but privacy policy incomplete |
| **Data Subject Rights (Art. 15–22)** | ✅ **Implemented** | Data export (Art. 20), Account deletion (Art. 17), Rectification via profile |
| **Data Retention / Storage Limitation** | ❌ **Missing** | No automated cleanup cron; retention periods undefined |
| **Security (Art. 32 DSGVO)** | ⚠️ **Good code, no headers** | CSP, HSTS, X-Frame-Options, etc. **completely missing** from `next.config.ts` |
| **Third-Party Processors (Art. 28)** | ⚠️ **AVVs needed** | Firebase, Firebase Storage, Twilio, Gmail, DeepL — no AVVs confirmed |
| **International Transfers (Art. 44–49)** | ⚠️ **Verify** | Firebase (region?), Firebase Storage (US), Twilio (US), Gmail (US), DeepL (DE/US) |
| **ePrivacy / TTDSG (§25)** | ✅ **Compliant** | Consent before analytics, necessary cookies exempt, easy withdrawal |
| **ROPA (Art. 30)** | ❌ **Missing** | No Record of Processing Activities documented |

---

## 1. Impressum (§5 DDG / §18 MStV) — `app/impressum/page.tsx`

### Current State
Page exists with correct structure, but **all operator details are placeholders**:

```tsx
// Lines 30–48: All bracketed placeholders
<Section title="Angaben gemäß § 5 DDG">
  <p>Dhurdur</p>
  <p>[Vollständiger Name des Inhabers/der Inhaberin bzw. Rechtsform]</p>
  <p>Obere Str. 30</p>
  <p>97421 Schweinfurt</p>
</Section>

<Section title="Kontakt">
  <p>Telefon: 01523 2163823</p>
  <p>E-Mail: [kontakt@ihre-domain.de]</p>
</Section>

<Section title="Umsatzsteuer-ID">
  <p>[Umsatzsteuer-Identifikationsnummer gemäß §27a UStG, falls vorhanden — sonst entfernen]</p>
</Section>

<Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
  <p>[Name und Anschrift der verantwortlichen Person]</p>
</Section>

<Section title="EU-Streitschlichtung">
  <p>... [Anpassen, falls dies nicht zutrifft.]</p>
</Section>
```

### Required Actions (Before Go-Live)
| Field | Requirement | Source |
|-------|-------------|--------|
| **Vollständiger Name / Rechtsform** | Mandatory (§5 DDG) — natural person or legal entity | Trade register / business registration |
| **Anschrift** | Complete postal address | Already has street/city — verify accuracy |
| **Kontakt (E-Mail + Telefon)** | Must be reachable "quickly and directly" — E-Mail mandatory | Add real contact email |
| **Umsatzsteuer-ID (USt-IdNr.)** | If VAT-registered (§27a UStG) — otherwise remove section | Finanzamt |
| **Verantwortlich für Inhalt (§18 MStV)** | Natural person with full name + address | Must match operator |
| **EU-Streitschlichtung (OS-Plattform)** | Link + statement on participation readiness | Current text is correct if not participating |

### Risk Level: **HIGH** — Missing/incomplete Impressum is the #1 cause of German *Abmahnungen* (cease-and-desist letters). Costs: typically €200–1,500 + legal fees.

---

## 2. Datenschutzerklärung (Art. 12–14, 24 DSGVO) — `app/privacy/page.tsx`

### Current State
Page exists but is **in English** (must be German for German market) and **all details are placeholders**.

### Section-by-Section Analysis

| Section | Status | Missing / To Verify |
|---------|--------|---------------------|
| **Who this covers** | ⚠️ Placeholder | Legal entity name, business address, privacy contact email |
| **What we collect** | ✅ Accurate to code | — |
| **How we use it** | ✅ Accurate to code | — |
| **Who we share it with** | ⚠️ Placeholder | **Must list actual providers & confirm AVVs**: Firebase (Auth, Firestore, Storage), Twilio, Gmail, DeepL |
| **How long we keep it** | ⚠️ Placeholder | **No retention periods defined** — must specify per data type |
| **Your rights** | ✅ Good | References profile export/delete — implemented in code |
| **Cookies** | ⚠️ Placeholder | References "Cookie Settings link in footer" — **link missing** |
| **Contact** | ⚠️ Placeholder | Legal name, address, email, phone, DPO if appointed |

### Critical Placeholders to Replace
```tsx
// Line 26: "Last updated — [add date before publishing]" → Actual date
// Lines 36–38: "[your domain]", "[Dhurdur — legal name / owner...]", "[privacy contact email]"
// Line 57: "[region, if configured]" → Firebase region (europe-west1? europe-west3?)
// Lines 66: "[Fill in: e.g. 'Account and booking data...']" → Actual retention policy
// Line 79: "[add a 'manage cookie settings' trigger...]" → Implement footer link
// Line 83: "[Dhurdur — legal name], [address], [email], [phone]" → Real data
```

### Language Issue: **CRITICAL**
- Privacy policy is in **English** but site targets German market (Schweinfurt)
- **Must provide German version** — Art. 12 DSGVO requires "concise, transparent, intelligible and easily accessible form, using clear and plain language" in the language of the data subject

### Risk Level: **HIGH** — Incomplete + wrong language violates Art. 12–14 DSGVO. Fines up to €20M / 4% global turnover.

---

## 3. Cookie & Consent Management (TTDSG §25, ePrivacy, Art. 6(1)(a) DSGVO)

### Implementation: `components/CookieConsent.tsx` + `app/api/consent-log/route.ts` ✅ **EXCELLENT**

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Essential cookies exempt from consent** | Session, security, language — locked "on" | ✅ Correct |
| **Non-essential (Analytics) requires opt-in** | Firebase Analytics blocked until consent | ✅ Correct |
| **Granular choice (Essential / Analytics)** | Two categories, toggle for Analytics | ✅ Correct |
| **No pre-ticked boxes** | Analytics default = false | ✅ Correct |
| **Consent stored with timestamp + version** | `localStorage` + optional Firestore audit log | ✅ Best practice |
| **Revocable anytime** | `resetConsent()` function exposed | ✅ Correct |
| **Link to privacy policy from banner** | Yes (`/privacy`) | ✅ Correct |
| **No dark patterns** | Equal prominence buttons | ✅ Correct |
| **Consent proof (Art. 7(1))** | Server-side log to `consentLogs` collection | ✅ Excellent |

### Gap: **Missing "Cookie-Einstellungen" link in footer**
- Banner text (line 263): *"You can withdraw or change your consent at any time via the 'Cookie Settings' link in the footer"*
- **No such link exists** in Navbar or any footer component
- Privacy policy (line 79) also references this missing link

**Fix:** Add to Navbar (desktop + mobile) or create a footer component:
```tsx
// In Navbar component (app/page.tsx lines 687–719, 744–802)
<button onClick={() => useCookieConsent().resetConsent()} className="text-xs underline hover:text-gold-400">
  Cookie-Einstellungen
</button>
```

---

## 4. Data Processing Activities — Code vs. Policy Alignment

| Processing Activity | Code Location | Legal Basis (Code) | Documented in Policy? |
|---------------------|---------------|-------------------|----------------------|
| **Account Registration** | `AppContext.tsx:540-552` | Contract (Art. 6(1)(b)) | ❌ Policy placeholder |
| **Email/Password Login** | `AppContext.tsx:532-538` | Contract | ❌ |
| **Google/Facebook OAuth** | `AppContext.tsx:520-530` | Contract + legitimate interest | ❌ |
| **Password Reset** | `AppContext.tsx:554-560` | Contract | ❌ |
| **Profile Update** | `ProfileView.tsx:63-75` | Contract | ❌ |
| **Booking (Appointments)** | `AppContext.tsx:653-679` | Contract | ❌ |
| **Reference Images (Firebase Storage)** | `lib/storage.ts:87-125` | Contract | ❌ |
| **Waitlist** | `AppContext.tsx:599-625` | Legitimate interest | ❌ |
| **SMS (Twilio)** | `api/sms/route.ts` | Contract + legitimate interest | ❌ |
| **Email (Nodemailer/Gmail)** | `api/email/route.ts` | Contract | ❌ |
| **Firebase Analytics** | `lib/firebase.ts:18` + `CookieConsent.tsx` | Consent (Art. 6(1)(a)) | ❌ |
| **DeepL Translation** | `api/translate*.ts` | Legitimate interest | ❌ |
| **Rate Limiting** | Not implemented (no middleware) | — | ❌ |
| **Audit Logging** | `lib/validation.ts:133-167` | Legitimate interest (security) | ❌ |
| **Password Breach Check (HIBP)** | `lib/password-breach.ts` | Security (Art. 32) | ❌ |

**All processing activities are implemented correctly in code — but none are properly documented in a German-language privacy policy.**

---

## 5. Third-Party Processors (Art. 28 DSGVO) — AVV Status

| Processor | Purpose | Data Transferred | Location | AVV Required? | Status |
|-----------|---------|------------------|----------|---------------|--------|
| **Firebase Auth** | Authentication | Email, name, UID, OAuth tokens | **Region not configured in code** | ✅ Yes | ⚠️ Verify region + AVV |
| **Firestore** | Database | All user/appointment data | **Region not configured in code** | ✅ Yes | ⚠️ Verify region + AVV |
| **Firebase Storage** | Reference images | User-uploaded photos | **Region not configured in code** | ✅ Yes | ⚠️ **Critical** — images may contain biometric data |
| **Firebase Analytics** | Analytics (consent-gated) | Pseudonymized usage data | Follows Firebase project region | ✅ Yes | ⚠️ Verify AVV + transfer |
| **Twilio** | SMS delivery | Phone numbers, message content | US | ✅ Yes | ⚠️ **Critical** — US provider |
| **Gmail (Nodemailer)** | Email delivery | Email content, recipients | US | ✅ Yes | ⚠️ **Critical** — US provider |
| **DeepL** | Translation | Text content (service names, UI) | DE (Pro) / US (Free) | ✅ Yes | ⚠️ Verify plan + location |

### Critical Actions
1. **Configure Firebase region** — `lib/firebase.ts` does NOT set region. Must verify in Firebase Console = `europe-west1` or `europe-west3`.
2. **Execute AVVs** with all above before go-live.
3. **Document transfer mechanisms** for US providers:
   - **Firebase Storage**: Check if bucket location = EU
   - **Twilio**: Check DPF certification or SCCs
   - **Gmail**: Google Ireland Ltd. (EU) for Workspace; SMTP may route via US
   - **DeepL**: DeepL SE (Germany) for Pro; Free tier may use US — verify plan
4. **Update Privacy Policy "Who we share it with" section** with actual provider names, regions, and confirmed transfer mechanism.

---

## 6. Data Retention & Deletion (Art. 5(1)(e), 17, 30)

### Current Implementation
| Feature | Status | Location |
|---------|--------|----------|
| **User-initiated deletion (Art. 17)** | ✅ Full | `AccountDeletion.tsx` — deletes Firestore data + Firebase Auth user |
| **Data export (Art. 20)** | ✅ Full | `DataExport.tsx` — JSON export of profile, appointments, alerts |
| **Rectification (Art. 16)** | ✅ Profile edit | `ProfileView.tsx:63-75` — name, email (with verification), phone |
| **Automated retention cleanup** | ❌ **Missing** | No cron job for old appointments, alerts, waitlist, consent logs |
| **Defined retention periods** | ❌ **Missing** | Not documented anywhere |

### Required Retention Policy (add to privacy policy + implement cron)
| Data Type | Recommended Retention | Legal Basis |
|-----------|----------------------|-------------|
| **User profile (active)** | Until deletion request | Art. 6(1)(b) |
| **User profile (deleted)** | 0 days (immediate) | Art. 17 |
| **Appointments (confirmed)** | 3 years (tax law §147 AO) | Legal obligation |
| **Appointments (cancelled/pending)** | 1 year | Legitimate interest |
| **Waitlist entries** | 6 months | Legitimate interest |
| **Alerts/Notifications** | 1 year | Legitimate interest |
| **Reference images (Storage)** | With appointment (3 years) | Contract |
| **Client notes (admin)** | 3 years (with appointment) | Contract |
| **Audit logs** | 1 year | Security (Art. 32) |
| **Consent logs** | 3 years | Art. 7(1) accountability |

### Action: Implement Vercel Cron for cleanup
```json
// vercel.json (create this file)
{
  "crons": [
    { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
  ]
}
```
Create `app/api/cron/cleanup/route.ts` with `CRON_SECRET` auth.

---

## 7. Security Measures (Art. 32 DSGVO) — ⚠️ **GOOD CODE, MISSING HEADERS**

### Implemented in Code ✅
| Measure | Implementation |
|---------|---------------|
| **Input Validation** | Zod schemas on all API routes (`validation.ts`) |
| **Header Injection Prevention** | Sanitization in email/SMS routes |
| **Password Handling** | Firebase Auth (scrypt) + client strength meter + HIBP breach check (`password-breach.ts`) |
| **Re-auth for sensitive actions** | Password confirmation for deletion/password change |
| **Audit Logging** | Structured JSON logs (`validation.ts:133-167`) — console only |
| **Admin Authorization** | Server-side role check (custom claims support in `firebaseAdmin.ts`) |
| **ID Token Verification** | All API routes verify Firebase ID token |
| **Ownership Checks** | SMS/email routes verify resource ownership |
| **EXIF Stripping** | `storage.ts` compresses/resizes images, strips metadata |

### **MISSING: Security Headers** ❌
`next.config.ts` is **empty** — no CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP, Expect-CT.

**This is a critical Art. 32 gap.** Add to `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob: https://images.unsplash.com https://firebasestorage.googleapis.com",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api-free.deepl.com https://api.deepl.com wss://*.firebaseio.com",
              "frame-src 'self' https://accounts.google.com https://www.facebook.com https://YOUR_PROJECT.firebaseapp.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Expect-CT', value: 'max-age=86400, enforce' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
```

### Minor Improvements
- Replace console-only audit logs with persistent logging (Cloud Logging, Datadog, Loki)
- Add rate limiting middleware (currently none — `middleware.ts` doesn't exist)
- Consider CSP nonce for stricter CSP

---

## 8. Data Subject Rights (Art. 15–22) — ✅ **WELL IMPLEMENTED**

| Right | Implementation | Location |
|-------|----------------|----------|
| **Access (Art. 15)** | Profile page shows all data | `ProfileView.tsx` |
| **Rectification (Art. 16)** | Edit profile (name, email, phone) | `ProfileView.tsx:63-75` |
| **Erasure (Art. 17)** | Full account + data deletion wizard | `AccountDeletion.tsx` — multi-step, re-auth |
| **Portability (Art. 20)** | JSON download of all user data | `DataExport.tsx` — profile, appointments, alerts |
| **Restriction (Art. 18)** | Not implemented (no "pause" feature) | — |
| **Objection (Art. 21)** | Analytics opt-out via cookie banner | `CookieConsent.tsx` |
| **Withdraw consent (Art. 7(3))** | `resetConsent()` + banner reopen | `CookieConsent.tsx` |

**Grade: A-** — Only Art. 18 (restriction) not implemented, which is rarely used for this type of service.

---

## 9. International Data Transfers (Art. 44–49)

### Current Transfers
| Provider | Data | Transfer Mechanism Needed | Verification |
|----------|------|---------------------------|--------------|
| **Firebase (Auth/Firestore/Storage/Analytics)** | Personal data + images | Google Ireland Ltd. (EU) — **DPF certified** | ⚠️ **Verify region = europe-west1/3** |
| **Firebase Storage** | Reference images (may contain biometric data) | Same as above | ⚠️ **Critical** — verify bucket location |
| **Twilio** | Phone + message content | Twilio Inc. (US) — **Check DPF/SCCs** | ⚠️ **Action required** |
| **Gmail (Nodemailer)** | Email content | Google Ireland Ltd. (EU) for Workspace; SMTP may route via US | ⚠️ Verify |
| **DeepL** | Translation text | DeepL SE (DE) for Pro; Free tier = US | ⚠️ Verify plan |

### Actions
1. **Confirm Firebase project region** = `europe-west1` or `europe-west3` (check Firebase Console → Project Settings).
2. **Confirm Firebase Storage bucket location** = EU region.
3. Check **Twilio DPF status**: https://www.dataprivacyframework.gov/s/participant-search
4. Upgrade **DeepL to Pro** (EU hosting) or execute SCCs.
5. **Self-host Google Fonts** if used (currently none detected — good).

---

## 10. Additional German Law Considerations

| Law | Requirement | Status |
|-----|-------------|--------|
| **§5 DDG (Impressum)** | Complete provider identification | ⚠️ Placeholders only |
| **§18 MStV** | Named responsible person | ⚠️ Placeholder |
| **TTDSG §25** | Cookie consent for analytics | ✅ Implemented |
| **PAngV (Preisangabenverordnung)** | Prices include VAT, per unit | ⚠️ Check prices in `servicesDB` — "€35" etc. need "inkl. MwSt." |
| **GOBD / AO §147** | Booking records = tax-relevant | ⚠️ Define 3-year retention for confirmed appointments |
| **Barrierefreiheit (BFSG 2025)** | WCAG 2.1 AA for public sites | ⚠️ Not audited — check contrast, ARIA, keyboard nav |
| **DL-InfoV** | Service info, prices, T&C | ⚠️ Add AGB/Terms page |
| **HTML lang attribute** | Must be `de` for German site | ❌ **`layout.tsx:17` has `lang="en"`** |

---

## 11. Priority Action Checklist

### 🔴 CRITICAL (Legal Risk: Abmahnung / Fines)
- [ ] **Fill all Impressum placeholders** in `app/impressum/page.tsx` with verified business data
- [ ] **Rewrite privacy policy in German** (`app/privacy/page.tsx`) — replace all placeholders with real data
- [ ] **Change `layout.tsx:17`** from `lang="en"` to `lang="de"`
- [ ] **Add security headers** to `next.config.ts` (CSP, HSTS, X-Frame-Options, etc.)
- [ ] **Add "Cookie-Einstellungen" link** to Navbar (desktop + mobile) calling `resetConsent()`
- [ ] **Execute AVVs** with Firebase, Firebase Storage, Twilio, Gmail, DeepL
- [ ] **Verify international transfer mechanisms** (DPF/SCCs) for US providers
- [ ] **Set real `NEXT_PUBLIC_ADMIN_EMAIL`** (not placeholder)
- [ ] **Configure `INTERNAL_API_SECRET`** for admin API protection
- [ ] **Add `vercel.json` with cleanup cron** + `CRON_SECRET`

### 🟠 HIGH (GDPR Compliance)
- [ ] **Document retention periods** in privacy policy + implement cleanup cron
- [ ] **Create ROPA (Verarbeitungsverzeichnis)** — spreadsheet with all processing activities
- [ ] **Verify Firebase region** = `europe-west1` or `europe-west3` in Firebase Console
- [ ] **Verify Firebase Storage bucket location** = EU
- [ ] **Verify DeepL plan** = Pro (EU hosting) or execute SCCs
- [ ] **Add rate limiting middleware** (create `middleware.ts` with Upstash Redis)
- [ ] **Persist audit logs** to logging service (not just console)
- [ ] **Add VAT notice** to prices ("inkl. MwSt.") — PAngV

### 🟡 MEDIUM (Best Practice)
- [ ] **Add AGB/Terms page** (DL-InfoV)
- [ ] **Accessibility audit** (WCAG 2.1 AA) — BFSG 2025
- [ ] **CSP nonce support** for stricter CSP
- [ ] **Email domain verification** (use own domain, not Gmail SMTP)
- [ ] **Consent log retention policy** (currently indefinite in Firestore)

### 🟢 LOW (Nice to Have)
- [ ] **Automated appointment cleanup** for cancelled bookings
- [ ] **Data processing agreement links** in privacy policy
- [ ] **Regular penetration testing**

---

## 12. File Reference Map (for your fixes)

| File | Purpose | Action Needed |
|------|---------|---------------|
| `app/impressum/page.tsx` | Legal notice | Fill all placeholders (lines 32, 39, 43, 47, 58) |
| `app/privacy/page.tsx` | Privacy policy | **Rewrite in German**, fill all placeholders (lines 26, 36–38, 57, 66, 79, 83) |
| `app/layout.tsx:17` | HTML lang | Change `lang="en"` → `lang="de"` |
| `next.config.ts` | Security headers | **Add full headers() config** (currently empty) |
| `components/CookieConsent.tsx:263` | Cookie banner | Footer link text matches — but **no footer link exists** |
| `app/page.tsx` (Navbar) | Navigation | Add Impressum, Privacy, Cookie Settings links |
| `lib/firebase.ts` | Firebase config | Verify region in Firebase Console (not set in code) |
| `lib/storage.ts` | Firebase Storage | Confirm bucket location = EU; AVV signed |
| `app/api/sms/route.ts` | Twilio SMS | Confirm AVV + DPF/SCCs |
| `app/api/email/route.ts` | Nodemailer/Gmail | Use verified domain, confirm AVV |
| `app/api/translate/route.ts` | DeepL | Confirm Pro plan (EU) or SCCs |
| `app/api/consent-log/route.ts` | Consent audit | Already good — ensure Firestore rules allow write |
| **NEW** `vercel.json` | Cron config | Add cleanup schedule |
| **NEW** `app/api/cron/cleanup/route.ts` | Retention cleanup | Create + secure with `CRON_SECRET` |
| `.env.example` | Env template | Add all required vars (see below) |

---

## 13. Required Environment Variables (add to `.env.example` + Vercel)

```bash
# Firebase (already in use)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_BASE64=          # Base64-encoded service account JSON

# Firebase Storage (reference images)
# Uses same Firebase project — verify bucket location = EU

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email (Nodemailer via Gmail — use App Password)
EMAIL_USER=your-salon@yourdomain.de       # Use verified domain!
EMAIL_PASS=your-gmail-app-password

# DeepL (Translation)
DEEPL_API_KEY=                            # Pro key for EU hosting

# Internal API Security
INTERNAL_API_SECRET=                      # openssl rand -hex 32

# Admin & Legal
NEXT_PUBLIC_ADMIN_EMAIL=info@yourdomain.de # Salon inbox (not placeholder!)

# Cron & Retention
CRON_SECRET=                              # openssl rand -hex 32
APPOINTMENT_RETENTION_MONTHS=36           # 3 years for tax law
ALERT_RETENTION_MONTHS=12
WAITLIST_RETENTION_MONTHS=6
CONSENT_LOG_RETENTION_MONTHS=36
```

---

## 14. Testing Checklist (Manual Verification)

### Legal Pages
- [ ] `/impressum` accessible from every page (Navbar/Footer)
- [ ] `/privacy` accessible from every page
- [ ] Privacy policy is in **German**
- [ ] No placeholder text remains
- [ ] Contact email works (test send)
- [ ] VAT ID format valid (DE + 9 digits) if applicable

### Cookie Consent
- [ ] Banner appears on first visit (incognito)
- [ ] "Necessary Only" → Firebase Analytics NOT loaded (check Network tab)
- [ ] "Accept All" → Firebase Analytics loads
- [ ] Consent persists across reloads
- [ ] "Cookie-Einstellungen" link in Navbar reopens banner
- [ ] Consent logged to Firestore `consentLogs` collection

### Data Rights
- [ ] Profile page shows all stored data (Art. 15)
- [ ] Profile edit saves changes (Art. 16) — email change sends verification
- [ ] Data export downloads valid JSON (Art. 20)
- [ ] Account deletion wizard works end-to-end (Art. 17) — deletes Firestore + Auth + Storage images
- [ ] Analytics opt-out works via cookie banner

### Security
- [ ] HTTPS enforced (no mixed content)
- [ ] Security headers present (check via securityheaders.com)
- [ ] Rate limiting active (create middleware + test)
- [ ] Input validation rejects malicious payloads
- [ ] CSP blocks inline scripts (check console for violations)
- [ ] Password breach check works (test "Password123" → should warn)
- [ ] Admin API requires valid ID token + admin role
- [ ] Reference images: EXIF stripped, compressed, stored in Firebase Storage

### Data Flows
- [ ] Booking → confirmation email + admin email + SMS (if opted in)
- [ ] Admin confirm → customer email + SMS + in-app alert
- [ ] Waitlist notify → SMS + email
- [ ] Password reset → email sent
- [ ] UI language change → DeepL translation cached in Firestore
- [ ] Reference image upload → Firebase Storage → download URL saved to appointment

---

## 15. Lawyer Review Recommendation

**Strongly recommended:** Have a German IT/recht lawyer (or **eRecht24**, **Trusted Shops**, **WBS Law**) review:
1. Final Impressum (once placeholders filled)
2. Final German Datenschutzerklärung (once rewritten + placeholders filled)
3. AVV contracts with all 6+ processors
4. International transfer documentation
5. Retention policy alignment with tax law (AO §147)

**Estimated cost:** €400–1,000 — far cheaper than an Abmahnung or DSGVO fine.

---

## 16. Summary

**The technical implementation is excellent — privacy-by-design, strong security code, full Art. 17/20 implementation, granular consent with audit trail, EXIF stripping on uploads.**  
**The legal documentation exists but is incomplete: Impressum has placeholders, Privacy Policy is in English with placeholders, and critical security headers are completely missing.**

### Before Go-Live You MUST:
1. **Fill all Impressum placeholders** with verified business data
2. **Rewrite privacy policy in German** documenting all 14+ processing activities
3. **Change `lang="en"` → `lang="de"`** in `layout.tsx`
4. **Add full security headers** to `next.config.ts` (currently empty!)
5. **Add "Cookie-Einstellungen" link** to Navbar (desktop + mobile)
6. **Sign AVVs** with Firebase, Firebase Storage, Twilio, Gmail, DeepL
7. **Verify Firebase region + Storage bucket** = EU
8. **Verify transfer mechanisms** for US providers (DPF/SCCs)
9. **Add retention cleanup cron** + document periods
10. **Create ROPA** (Art. 30)

Once these are done, the site will be fully compliant for a German barbershop operation. The codebase quality is significantly above average — the compliance gaps are primarily documentation, language, and configuration.

---

*This report is a technical audit, not legal advice. Consult a qualified German attorney for final legal sign-off.*