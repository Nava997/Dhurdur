# GDPR / DSGVO Compliance — Dhurdur Salon

Status as of **2026-10-12**, after a full audit of the code, the live
configuration and the legal pages. This replaces the earlier report, which
predated the cleanup cron, the security headers and the Cloudinary move.

The website itself is now compliant **once the owner fills in the two
placeholders and completes the contracts listed under "Owner to-do"**. Those
items can't be done in code.

---

## Owner to-do (blocking)

| # | What | Why | Where |
|---|------|-----|-------|
| 1 | Enter the owner's legal name | § 5 DDG, Art. 13 DSGVO; the pages currently show a placeholder ("Oliver Hayes" was a template name) | `lib/legal.ts` → `OWNER_NAME` |
| 2 | Enter a working contact email | `info@`/`datenschutz@dhurdur.de` bounce: the domain `dhurdur.de` does not exist, and `durdur-sw.de` has no mail server | `lib/legal.ts` → `CONTACT_EMAIL` |
| 3 | Switch booking emails off consumer Gmail | A free `@gmail.com` account has no data processing agreement (Art. 28). Use Google Workspace or an EU mail host (e.g. the domain registrar INWX, IONOS, Strato) and sign their AVV | Vercel env: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`; then update `emailProvider` in `lib/legal.ts` |
| 4 | Accept the Cloudinary DPA | Cloudinary stores customer reference photos; the privacy policy states an AVV exists | Cloudinary console → Settings → Account → Data Processing Agreement |
| 5 | Accept the Google Cloud/Firebase data processing terms | Same reason, for Auth + Firestore | Firebase console → Project settings → Privacy → "Data Processing and Security Terms" |
| 6 | Get written consent from team members whose photos go on the site | Staff photos are employee personal data (§ 26 BDSG / KUG) | Paper/email consent, kept by the owner |
| 7 | Deploy | Code changes and the Frankfurt region only take effect after deploy | Push to `main` (Vercel) and `firebase deploy --only firestore:rules` |

Vercel's DPA is part of its standard terms; no action is needed beyond keeping the account.

---

## What was changed in this audit

| Finding | Risk | Fix |
|---|---|---|
| Cookie banner asked consent for **Firebase Analytics, which the site never loaded**; the consent log stored every visitor's browser/URL for no purpose | Misleading information (Art. 5(1)(a)), data minimisation (Art. 5(1)(c)) | Banner, footer link and `/api/consent-log` removed. The site only stores the login session, which is strictly necessary (§ 25(2) Nr. 2 TDDDG). The nightly cron purges the leftover `consentLogs` |
| **Unsplash images hotlinked**: every visitor's IP address went to Unsplash (USA) without disclosure | Unlawful transfer (Art. 6, 44) | All Unsplash images, including the URLs stored in the live translations, go through `/_next/image` (`lib/localImage.ts`); browsers only contact the site. CSP no longer allows Unsplash, Google Analytics/Tag Manager or Google Fonts |
| **API functions ran in Vercel's default US region** | Unnecessary third-country processing | `vercel.json` → `"regions": ["fra1"]` (Frankfurt, next to Firestore `europe-west3`) |
| Data export ran in the browser and **missed staff notes, account metadata and Cloudinary photos** | Incomplete Art. 15 access | New `/api/account/export` (server) returns all of it, plus the Art. 15(1) information block |
| The owner had **no tool to answer access/erasure requests by email** | Art. 12(3) one-month deadline can't be met | Admin → Clients: "Daten exportieren" and "Konto löschen" per customer (admins can't delete other admins) |
| Staff notes suggested recording **allergies** and claimed "never visible to client" | Art. 9 special-category data without consent; wrong statement about Art. 15 | Label and placeholder rewritten (no health data; notes are part of an access request) |
| Booking notes field had no guidance | Customers may volunteer health data | Hint under the field not to enter health details |
| **Abandoned reference photos were never deleted** | Storage limitation (Art. 5(1)(e)) | Cron deletes Cloudinary reference photos not attached to any booking after 7 days |
| No privacy notice at the point of collection | Art. 13 | Short notice with link on sign-up and booking forms |
| Privacy policy contained **false or unverifiable claims**: Analytics, backups, 1-year communication logs, "§ 147 AO" for bookings, server logs 30 days, AVV with Gmail, Cloudinary "Israel" | Art. 13 accuracy | Policy rewritten to match the code; every retention period maps to the cron; Art. 21 objection right highlighted; Art. 13(2)(e)/(f) added; TTDSG → TDDDG |
| Impressum linked the **EU ODR platform, which was shut down on 20 July 2025** | Outdated mandatory information | Link removed; VSBG statement kept |
| Impressum back link in English | — | German |
| Mailer hard-wired to Gmail | Blocks switching to a provider with an AVV | `EMAIL_HOST`/`EMAIL_PORT` support (falls back to Gmail) |
| Kleinunternehmer price note missing next to prices | PAngV / § 19 UStG transparency | Note under the price list |

---

## Verified infrastructure

| Component | Location | Checked how |
|---|---|---|
| Cloud Firestore | `europe-west3` (Frankfurt) | Firestore Admin API, 2026-10-12 |
| Firebase Storage bucket (unused, rules deny) | `EUROPE-CENTRAL2` | Storage API |
| Server functions | `fra1` after next deploy (was default `iad1`) | `vercel.json` |
| Cloudinary | USA (default data region) | Account configuration |
| Booking emails | Gmail (consumer account) | `EMAIL_USER` domain — see to-do 3 |

---

## Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

Controller: Dhurdur, Inh. *[see `lib/legal.ts`]*, Obere Str. 30, 97421 Schweinfurt. No DPO required (§ 38 BDSG).

| Processing | Data subjects | Data | Purpose / legal basis | Recipients | Third country | Deletion |
|---|---|---|---|---|---|---|
| Customer account | Customers | Name, email, phone (opt.), password hash, loyalty points | Account, booking — Art. 6(1)(b) | Firebase (Google Ireland) | Auth: USA (DPF/SCC) | On account deletion (immediate) |
| Online booking | Customers | Name, phone, service, stylist, date/time, notes, status | Appointment — Art. 6(1)(b); retention Art. 6(1)(f) | Firebase, Vercel, email provider | Email provider (see to-do 3) | 3 years after appointment date (cron) |
| Reference photos | Customers | Photo (EXIF stripped) | Desired look — Art. 6(1)(b) | Cloudinary | USA (DPF/SCC) | With booking; 7 days if unused; on account deletion |
| Notifications & emails | Customers | Email, message text | Booking communication — Art. 6(1)(b) | Email provider | See to-do 3 | In-app alerts after 30 days |
| Waitlist | Customers | Name, phone, date, stylist | Notify about free slots — Art. 6(1)(b) | Firebase | — | 6 months |
| Staff notes | Customers | Free-text service preferences | Service quality — Art. 6(1)(f) | Firebase | — | 3 years after last change; on account deletion |
| Password change | Customers | Hashed one-time code | Security — Art. 6(1)(b) | Firebase | — | Invalid after 10 min, deleted by next cron |
| Abuse protection | Visitors | SHA-256 of IP + bucket, counter | Security — Art. 6(1)(f) | Firebase | — | After the window, at the latest next day |
| Hosting & security logs | Visitors, customers | IP, time, URL, user agent; audit entries for sensitive actions | Operation, security — Art. 6(1)(f) | Vercel | USA (DPF/SCC) | Short-term, by Vercel |
| Website photos | Team members | Portrait photos | Salon presentation — consent (§ 26 BDSG) | Cloudinary | USA | When the admin deletes the photo |

**Technical and organisational measures (Art. 32):** TLS + HSTS; encryption at rest (Google, Cloudinary); Firestore rules (customers see only their own data, admin = verified allow-listed email or `role: admin`); server-only collections; fresh login required for account deletion; email-code confirmation for password changes; per-IP and per-user rate limits; CSP and security headers; EXIF stripping in the browser; nightly retention cron; audit logging of exports, deletions and password changes. Covered by `tests/rules.test.mjs` (33 tests) and `tests/api.emulator.mjs` (29 tests).

**Data breach procedure (Art. 33/34):** the owner reports to the BayLDA within 72 hours (online form at lda.bayern.de) and informs affected customers if there is a high risk. Rotate the Firebase service account key, Cloudinary API secret and `CRON_SECRET` in Vercel when credentials may be affected.

---

## Answering requests by email or phone

1. Confirm the person's identity, e.g. a reply from the email address on the account.
2. Admin Panel → **Kunden** → the customer's card:
   - Access/portability: **Daten exportieren** and send them the JSON file.
   - Erasure: **Konto löschen**.
3. Respond within one month (Art. 12(3)).
