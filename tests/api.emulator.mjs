// End-to-end API security tests against a local dev server wired to the
// Firebase emulators. Nothing here touches the live project — keep
// CLOUDINARY_API_SECRET empty: the cron's orphan-photo cleanup compares the
// real Cloudinary folder against the (empty) emulator database.
//
//   1. firebase emulators:start --project avdar-salon --only auth,firestore,storage
//   2. NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//      FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
//      EMAIL_USER= EMAIL_PASS= DEEPL_API_KEY= CLOUDINARY_API_SECRET= \
//      CRON_SECRET=test-cron-secret-123 npx next dev -p 3100
//   3. node --test tests/api.emulator.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
const { initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');

const PROJECT = process.env.TEST_PROJECT_ID || 'avdar-salon';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3100';
const AUTH_URL = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;

initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();

let ipCounter = 1;
// Every test gets its own client IP so the rate limiters don't interfere.
const freshIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function api(path, { method = 'GET', token, body, headers = {}, ip = freshIp() } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'x-real-ip': ip,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
}

async function signIn(email, password) {
  const res = await fetch(`${AUTH_URL}/accounts:signInWithPassword?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function makeUser(uid, email, { verified = true, role = 'user', phone = '' } = {}) {
  await auth.createUser({ uid, email, password: 'Passw0rd!x', emailVerified: verified });
  await db.doc(`users/${uid}`).set({ id: uid, name: uid, email, phone, haircutCount: 0, role });
  return signIn(email, 'Passw0rd!x');
}

const T = {};
before(async () => {
  // Clean slate in the emulator.
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

  T.alice = await makeUser('alice', 'alice@example.com', { phone: '+491701111111' });
  T.bob = await makeUser('bob', 'bob@example.com');
  T.staff = await makeUser('staff', 'staff@example.com', { role: 'admin' });
  // Uses the admin allow-list address but never verified it.
  T.mallory = await makeUser('mallory', 'durdurbarbershop@gmail.com', { verified: false });

  const appt = (userId, extra = {}) => ({
    userId, name: `${userId} name`, phone: '+491709999999', services: ['Skin Fade'], totalDurationMins: 45,
    stylist: 'Oliver Hayes', date: '2030-01-10', time: '10:00', status: 'pending', sendsms: true,
    usedReward: false, specialRequests: 'secret note', ...extra,
  });
  await db.doc('appointments/a-alice').set(appt('alice'));
  await db.doc('appointments/a-bob').set(appt('bob', { status: 'confirmed', time: '13:00' }));
  await db.doc('appointments/a-old').set(appt('bob', { date: '2020-01-01', status: 'confirmed' }));
  await db.doc('appointments/a-cancel').set(appt('bob', { status: 'cancelled', time: '15:30' }));
  await db.doc('alerts/al-alice').set({ userId: 'alice', message: 'x', isRead: false, link: 'profile', createdAt: Date.now() });
  await db.doc('waitlist/w-alice').set({ userId: 'alice', name: 'A', phone: '', date: '2030-01-10', stylist: 'Any', createdAt: Date.now() });
  await db.doc('clientNotes/alice').set({ notes: 'note', updatedAt: Date.now() });
  const DAY = 24 * 60 * 60 * 1000;
  await db.doc('alerts/al-old').set({ userId: 'alice', message: 'old', isRead: true, link: 'profile', createdAt: Date.now() - 31 * DAY });
  // Leftovers from the retired cookie banner — the cron purges all of them.
  await db.doc('consentLogs/c-old').set({ necessary: true, userAgent: 'x', loggedAt: new Date(Date.now() - 4 * 365 * DAY).toISOString() });
  await db.doc('consentLogs/c-new').set({ necessary: true, userAgent: 'x', loggedAt: new Date().toISOString() });
});

// ---------------- Public availability ----------------
test('available-slots: works and leaks no personal data', async () => {
  const r = await api('/api/available-slots');
  assert.equal(r.status, 200);
  const raw = JSON.stringify(r.json);
  for (const leak of ['alice', 'bob', 'name', 'phone', 'secret note', 'userId', '+4917']) {
    assert.ok(!raw.includes(leak), `response leaks "${leak}"`);
  }
  const times = r.json.slots.filter(s => s.date === '2030-01-10').map(s => s.time).sort();
  assert.deepEqual(times, ['10:00', '13:00'], 'active bookings returned, cancelled excluded');
});

// ---------------- Email ----------------
test('email: no token / garbage token rejected', async () => {
  assert.equal((await api('/api/email', { method: 'POST', body: { email: 'x@example.com', subject: 's', message: 'm' } })).status, 401);
  assert.equal((await api('/api/email', { method: 'POST', token: 'not-a-token', body: { email: 'x@example.com', subject: 's', message: 'm' } })).status, 401);
});
test('email: customers cannot send free text at all (not even to themselves or the admin)', async () => {
  for (const email of ['victim@example.com', 'alice@example.com', 'durdurbarbershop@gmail.com']) {
    const r = await api('/api/email', { method: 'POST', token: T.alice, body: { email, subject: 'Phish', message: 'click' } });
    assert.equal(r.status, 403);
  }
});
test('email: unverified address on the admin list is not admin', async () => {
  const r = await api('/api/email', { method: 'POST', token: T.mallory, body: { email: 'victim@example.com', subject: 'Phish', message: 'click' } });
  assert.equal(r.status, 403);
});
test('email: admin passes auth (mail disabled in test => 503)', async () => {
  assert.equal((await api('/api/email', { method: 'POST', token: T.staff, body: { email: 'alice@example.com', subject: 's', message: 'm' } })).status, 503);
});

// ---------------- Booking notifications / loyalty ----------------
test('notify: login required, own bookings only', async () => {
  assert.equal((await api('/api/appointments/notify', { method: 'POST', body: { appointmentId: 'a-alice', event: 'booked' } })).status, 401);
  assert.equal((await api('/api/appointments/notify', { method: 'POST', token: T.bob, body: { appointmentId: 'a-alice', event: 'booked' } })).status, 404);
  assert.equal((await api('/api/appointments/notify', { method: 'POST', token: T.alice, body: { appointmentId: 'a-alice', event: 'nope' } })).status, 400);
});
test('notify: a booking earns exactly one loyalty point, once', async () => {
  const before = (await db.doc('users/alice').get()).data().haircutCount;
  const first = await api('/api/appointments/notify', { method: 'POST', token: T.alice, body: { appointmentId: 'a-alice', event: 'booked' } });
  assert.equal(first.status, 200);
  const again = await api('/api/appointments/notify', { method: 'POST', token: T.alice, body: { appointmentId: 'a-alice', event: 'booked' } });
  assert.equal(again.status, 409);
  assert.equal((await db.doc('users/alice').get()).data().haircutCount, before + 1);
});
test('notify: event must match the booking status', async () => {
  // a-alice is pending, not cancelled or confirmed.
  assert.equal((await api('/api/appointments/notify', { method: 'POST', token: T.alice, body: { appointmentId: 'a-alice', event: 'cancelled' } })).status, 409);
  assert.equal((await api('/api/appointments/notify', { method: 'POST', token: T.alice, body: { appointmentId: 'a-alice', event: 'accepted' } })).status, 409);
});

// ---------------- Translation ----------------
test('translate-ui: injected source text never reaches the shared cache', async () => {
  const r = await api('/api/translate-ui', { method: 'POST', body: { targetLang: 'en', sourceDict: { hero: { sub: 'HACKED SITE' } } } });
  assert.ok([503, 500, 429].includes(r.status) || !JSON.stringify(r.json).includes('HACKED'), `status ${r.status}`);
  const cache = await db.doc('settings/translations').get();
  assert.ok(!JSON.stringify(cache.data() || {}).includes('HACKED'));
});
test('translate-ui: unsupported language rejected', async () => {
  assert.equal((await api('/api/translate-ui', { method: 'POST', body: { targetLang: 'xx' } })).status, 400);
});

// ---------------- Consent log (retired) ----------------
test('consent-log endpoint no longer exists', async () => {
  assert.equal((await api('/api/consent-log', { method: 'POST', body: { analytics: true } })).status, 404);
});

// ---------------- Cron ----------------
test('cron cleanup: rejected without the secret', async () => {
  assert.equal((await api('/api/cron/cleanup')).status, 401);
  assert.equal((await api('/api/cron/cleanup', { headers: { authorization: 'Bearer wrong' } })).status, 401);
});
test('cron cleanup: with the secret deletes only expired data', async () => {
  const r = await api('/api/cron/cleanup', { headers: { authorization: 'Bearer test-cron-secret-123' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await db.doc('appointments/a-old').get()).exists, false, 'old appointment purged');
  assert.equal((await db.doc('appointments/a-bob').get()).exists, true, 'future appointment kept');
  assert.equal((await db.doc('alerts/al-old').get()).exists, false, 'alert older than 30 days purged');
  assert.equal((await db.doc('alerts/al-alice').get()).exists, true, 'recent alert kept');
  assert.equal((await db.collection('consentLogs').get()).size, 0, 'retired consent logs purged');
});

// ---------------- Cloudinary uploads ----------------
test('cloudinary sign: login required, purpose checked', async () => {
  assert.equal((await api('/api/cloudinary/sign', { method: 'POST', body: { purpose: 'reference' } })).status, 401);
  assert.equal((await api('/api/cloudinary/sign', { method: 'POST', token: T.alice, body: { purpose: 'avatar' } })).status, 400);
});
test('cloudinary sign: customers can only sign their own reference folder', async () => {
  assert.equal((await api('/api/cloudinary/sign', { method: 'POST', token: T.alice, body: { purpose: 'gallery' } })).status, 403);
  assert.equal((await api('/api/cloudinary/sign', { method: 'POST', token: T.mallory, body: { purpose: 'gallery' } })).status, 403);
  const r = await api('/api/cloudinary/sign', { method: 'POST', token: T.alice, body: { purpose: 'reference', folder: 'dhurdur/gallery' } });
  if (r.status === 503) return; // Cloudinary not configured in this run
  assert.equal(r.status, 200);
  assert.equal(r.json.folder, 'dhurdur/reference/alice', 'caller cannot choose the folder');
  assert.ok(r.json.signature && !('api_secret' in r.json) && !('apiSecret' in r.json), 'secret never returned');
});
test('cloudinary sign: admins can sign site folders', async () => {
  const r = await api('/api/cloudinary/sign', { method: 'POST', token: T.staff, body: { purpose: 'gallery' } });
  assert.ok([200, 503].includes(r.status));
  if (r.status === 200) assert.equal(r.json.folder, 'dhurdur/gallery');
});
test('cloudinary delete: admin only, site folders only', async () => {
  const url = 'https://res.cloudinary.com/a2x0mlwu/image/upload/v1/dhurdur/reference/alice/x.jpg';
  assert.equal((await api('/api/cloudinary/delete', { method: 'POST', body: { url } })).status, 401);
  assert.equal((await api('/api/cloudinary/delete', { method: 'POST', token: T.alice, body: { url } })).status, 403);
  assert.equal((await api('/api/cloudinary/delete', { method: 'POST', token: T.staff, body: { url } })).status, 400, 'customer photos cannot be deleted this way');
  assert.equal((await api('/api/cloudinary/delete', { method: 'POST', token: T.staff, body: { url: 'https://evil.example.com/a.jpg' } })).status, 400);
});

// ---------------- Password change ----------------
test('password: code request needs login', async () => {
  assert.equal((await api('/api/password/otp', { method: 'POST' })).status, 401);
});
test('password: wrong code rejected, correct code changes the password', async () => {
  const token = await signIn('bob@example.com', 'Passw0rd!x');
  await db.doc('otpCodes/bob').set({
    hash: createHash('sha256').update('bob:123456').digest('hex'),
    expiresAt: Date.now() + 600000, attempts: 0,
  });
  const wrong = await api('/api/password/change', { method: 'POST', token, body: { code: '000000', newPassword: 'NewPassw0rd!' } });
  assert.equal(wrong.status, 400);
  const weak = await api('/api/password/change', { method: 'POST', token, body: { code: '123456', newPassword: 'weakpass' } });
  assert.equal(weak.status, 400);
  const ok = await api('/api/password/change', { method: 'POST', token, body: { code: '123456', newPassword: 'NewPassw0rd!' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  await signIn('bob@example.com', 'NewPassw0rd!');
  // Code is single-use.
  const replay = await api('/api/password/change', { method: 'POST', token: await signIn('bob@example.com', 'NewPassw0rd!'), body: { code: '123456', newPassword: 'Another0ne!' } });
  assert.equal(replay.status, 400);
});
test('password: code locks after 5 wrong guesses', async () => {
  const token = await signIn('alice@example.com', 'Passw0rd!x');
  await db.doc('otpCodes/alice').set({
    hash: createHash('sha256').update('alice:654321').digest('hex'),
    expiresAt: Date.now() + 600000, attempts: 0,
  });
  const ip = freshIp();
  for (let i = 0; i < 5; i++) {
    await api('/api/password/change', { method: 'POST', token, ip, body: { code: String(100000 + i), newPassword: 'NewPassw0rd!' } });
  }
  const r = await api('/api/password/change', { method: 'POST', token, ip, body: { code: '654321', newPassword: 'NewPassw0rd!' } });
  assert.equal(r.status, 400, 'correct code refused once locked');
});

// ---------------- Account deletion ----------------
test('account delete: needs login', async () => {
  assert.equal((await api('/api/account/delete', { method: 'POST' })).status, 401);
});
test('export: needs login', async () => {
  assert.equal((await api('/api/account/export', { method: 'POST', body: {} })).status, 401);
});
test('export: customer gets all their own data, including staff notes', async () => {
  const r = await api('/api/account/export', { method: 'POST', token: T.alice, body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.profile.id, 'alice');
  assert.equal(r.json.account.email, 'alice@example.com');
  assert.equal(r.json.staffNotes.notes, 'note');
  assert.ok(r.json.appointments.length >= 1 && r.json.appointments.every(a => a.userId === 'alice'));
  assert.ok(r.json.information.purposes);
});
test("export: customer cannot export someone else's data", async () => {
  // Fresh user: the password tests above revoke bob's session.
  const dave = await makeUser('dave', 'dave@example.com');
  assert.equal((await api('/api/account/export', { method: 'POST', token: dave, body: { uid: 'alice' } })).status, 403);
});
test('export: admin can export a customer (request by email)', async () => {
  const r = await api('/api/account/export', { method: 'POST', token: T.staff, body: { uid: 'alice' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.profile.id, 'alice');
});
test("account delete: customer cannot delete someone else's account", async () => {
  await makeUser('carol', 'carol@example.com');
  const dave = await signIn('dave@example.com', 'Passw0rd!x');
  assert.equal((await api('/api/account/delete', { method: 'POST', token: dave, body: { uid: 'carol' } })).status, 403);
  assert.equal((await db.doc('users/carol').get()).exists, true);
});
test('account delete: admin can erase a customer, but not another admin', async () => {
  const staff = await signIn('staff@example.com', 'Passw0rd!x');
  await db.doc('appointments/a-carol').set({ userId: 'carol', status: 'pending', date: '2030-01-01', time: '10:00' });
  const r = await api('/api/account/delete', { method: 'POST', token: staff, body: { uid: 'carol' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await db.doc('users/carol').get()).exists, false);
  assert.equal((await db.doc('appointments/a-carol').get()).exists, false);
  await assert.rejects(auth.getUser('carol'));
  await makeUser('staff2', 'staff2@example.com', { role: 'admin' });
  assert.equal((await api('/api/account/delete', { method: 'POST', token: staff, body: { uid: 'staff2' } })).status, 400);
});
test("account delete: removes all of the user's data and nobody else's", async () => {
  const token = await signIn('alice@example.com', 'Passw0rd!x');
  const r = await api('/api/account/delete', { method: 'POST', token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await db.doc('users/alice').get()).exists, false);
  assert.equal((await db.doc('appointments/a-alice').get()).exists, false);
  assert.equal((await db.doc('alerts/al-alice').get()).exists, false);
  assert.equal((await db.doc('waitlist/w-alice').get()).exists, false);
  assert.equal((await db.doc('clientNotes/alice').get()).exists, false);
  await assert.rejects(auth.getUser('alice'));
  assert.equal((await db.doc('appointments/a-bob').get()).exists, true);
  assert.equal((await db.doc('users/bob').get()).exists, true);
});

// ---------------- Rate limiting & headers ----------------
test('rate limit: hammering an endpoint from one IP gets 429', async () => {
  const ip = freshIp();
  const statuses = [];
  for (let i = 0; i < 15; i++) statuses.push((await api('/api/email', { method: 'POST', ip, body: {} })).status);
  assert.ok(statuses.includes(429), statuses.join(','));
});
test('rate limit: changing User-Agent does not reset the limit', async () => {
  const ip = freshIp();
  const statuses = [];
  for (let i = 0; i < 15; i++) {
    statuses.push((await api('/api/email', { method: 'POST', ip, headers: { 'user-agent': `bot-${i}` }, body: {} })).status);
  }
  assert.ok(statuses.includes(429), statuses.join(','));
});
test('security headers present on pages', async () => {
  const r = await fetch(BASE + '/');
  for (const h of ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy']) {
    assert.ok(r.headers.get(h), `missing ${h}`);
  }
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
