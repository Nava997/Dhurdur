// End-to-end API security tests against a local dev server wired to the
// Firebase emulators. Nothing here touches the live project.
//
//   1. firebase emulators:start --project avdar-salon --only auth,firestore,storage
//   2. NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//      FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
//      EMAIL_USER= EMAIL_PASS= DEEPL_API_KEY= \
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
  T.mallory = await makeUser('mallory', 'rick.maity07@gmail.com', { verified: false });

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
  await db.doc('consentLogs/c-old').set({ necessary: true, loggedAt: new Date(Date.now() - 4 * 365 * DAY).toISOString() });
  await db.doc('consentLogs/c-new').set({ necessary: true, loggedAt: new Date().toISOString() });
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
test('email: customer cannot email a third party', async () => {
  const r = await api('/api/email', { method: 'POST', token: T.alice, body: { email: 'victim@example.com', subject: 'Phish', message: 'click' } });
  assert.equal(r.status, 403);
});
test('email: unverified address on the admin list is not admin', async () => {
  const r = await api('/api/email', { method: 'POST', token: T.mallory, body: { email: 'victim@example.com', subject: 'Phish', message: 'click' } });
  assert.equal(r.status, 403);
});
test('email: customer to self and admin to customer pass auth (mail disabled in test => 503)', async () => {
  assert.equal((await api('/api/email', { method: 'POST', token: T.alice, body: { email: 'alice@example.com', subject: 's', message: 'm' } })).status, 503);
  assert.equal((await api('/api/email', { method: 'POST', token: T.staff, body: { email: 'alice@example.com', subject: 's', message: 'm' } })).status, 503);
});
test('email: caller cannot set the sender address (field rejected/ignored)', async () => {
  const r = await api('/api/email', { method: 'POST', token: T.alice, body: { email: 'alice@example.com', subject: 's', message: 'm', fromEmail: 'ceo@bank.com', fromName: 'Bank' } });
  assert.notEqual(r.status, 200);
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

// ---------------- Consent log ----------------
test('consent-log: stores only capped, typed fields', async () => {
  const r = await api('/api/consent-log', { method: 'POST', body: { analytics: 'yes', version: 'v'.repeat(500), userAgent: 'u'.repeat(5000), evil: { nested: 'x'.repeat(1000) }, necessary: false } });
  assert.equal(r.status, 200);
  const logs = await db.collection('consentLogs').get();
  const d = logs.docs.at(-1).data();
  assert.equal(d.analytics, false);
  assert.equal(d.necessary, true);
  assert.ok(d.consentVersion.length <= 32 && d.userAgent.length <= 300);
  assert.equal(d.evil, undefined);
});
test('consent-log: junk body rejected', async () => {
  assert.equal((await api('/api/consent-log', { method: 'POST', body: 'not json' })).status, 400);
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
  assert.equal((await db.doc('consentLogs/c-old').get()).exists, false, 'consent log older than 3 years purged');
  assert.equal((await db.doc('consentLogs/c-new').get()).exists, true, 'recent consent log kept');
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
  for (let i = 0; i < 15; i++) statuses.push((await api('/api/consent-log', { method: 'POST', ip, body: { analytics: false } })).status);
  assert.ok(statuses.includes(429), statuses.join(','));
});
test('rate limit: changing User-Agent does not reset the limit', async () => {
  const ip = freshIp();
  const statuses = [];
  for (let i = 0; i < 15; i++) {
    statuses.push((await api('/api/consent-log', { method: 'POST', ip, headers: { 'user-agent': `bot-${i}` }, body: { analytics: false } })).status);
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
