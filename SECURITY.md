# Before this app touches real client data

Firestore/Storage security rules are included (`firestore.rules`,
`storage.rules`, `firebase.json`) but **they only protect anything once
deployed** to your actual Firebase project. Creating a new Firebase project
via the console gives you either fully-open "test mode" rules (30 days, then
fully locked) or fully-locked "production mode" rules — either way, not the
rules in this repo, until you push them:

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase use --add                     # select/create the Dhurdur Firebase project
firebase deploy --only firestore:rules,storage:rules
```

## What the rules actually protect

- `users/{userId}` — a client can only read their own profile and edit their
  contact details; loyalty points (`haircutCount`) and `role` are never
  client-writable. Admins can read/write any profile.
- `clientNotes/{userId}` — private staff notes about a client. **Admin
  only**, on both read and write. This is intentionally a separate
  collection from `users/{userId}` rather than a field on it, specifically
  so a client can never pull their own profile and see notes staff wrote
  about them.
- `appointments/{apptId}` — clients can create their own well-formed pending
  bookings, cancel them, and accept (exactly the proposed slot) or decline a
  proposed reschedule; only admins can confirm/edit/delete freely, or create
  a booking on someone else's behalf (walk-ins).
- `stylists`, `services`, `settings` — public read, admin write.
- `alerts` — owner or admin; clients may only add plain alerts for themselves.
- `waitlist` — managed by the salon; clients can only read their own entry.
- Firebase Storage — closed to everyone. Images live in Cloudinary, uploaded
  with short-lived per-folder signatures from `/api/cloudinary/sign`.

## Server-side checks

- `/api/email` (free-text e-mail) is admin-only. A client's booking e-mails
  and loyalty points come from `/api/appointments/notify`, which builds the
  e-mail from the stored appointment and runs each event once per booking.
- Every API route is rate-limited twice: per instance in `proxy.ts` and across
  instances via Firestore (`lib/rateLimit.ts`).

## Tests

- `npm run test:rules` — rules tests against the Firestore/Storage emulators.
- `tests/api.emulator.mjs` — end-to-end API tests; see the header of that file
  for how to start the emulators and dev server.

## Data subject requests (GDPR)

Wired into the client profile page (My Account → Data & Privacy):

- **Export** — `/api/account/export` returns the client's profile, account
  metadata, appointments, alerts, waitlist entries, staff notes and the list
  of their uploaded reference photos.
- **Delete** — `/api/account/delete` removes all of the above (including
  staff notes and Cloudinary photos) and the Firebase Auth account, after a
  typed confirmation and a fresh sign-in.

Retention is enforced nightly by `/api/cron/cleanup` (Vercel Cron, see
`vercel.json`).
