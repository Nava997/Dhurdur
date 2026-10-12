// Security tests for firestore.rules and storage.rules.
// Run with: npm run test:rules   (starts the Firestore + Storage emulators)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-dhurdur-rules';
let env;

// Verified allow-listed admin, and a user whose profile has role 'admin'.
const ADMIN_EMAIL = 'rick.maity07@gmail.com';
const alice = () => env.authenticatedContext('alice', { email: 'alice@example.com', email_verified: true }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.com', email_verified: true }).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const emailAdmin = () => env.authenticatedContext('admin1', { email: ADMIN_EMAIL, email_verified: true }).firestore();
const roleAdmin = () => env.authenticatedContext('admin2', { email: 'staff@example.com', email_verified: true }).firestore();
const fakeAdmin = () => env.authenticatedContext('mallory', { email: ADMIN_EMAIL, email_verified: false }).firestore();

const validBooking = (userId, extra = {}) => ({
  userId, name: 'Alice', phone: '+491701234567', services: ['Skin Fade'], totalDurationMins: 45,
  stylist: 'Any', date: '2030-01-10', time: '10:00', status: 'pending', sendsms: true, usedReward: false,
  ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { id: 'alice', name: 'Alice', email: 'alice@example.com', phone: '', haircutCount: 3, role: 'user' });
    await setDoc(doc(db, 'users/bob'), { id: 'bob', name: 'Bob', email: 'bob@example.com', phone: '', haircutCount: 0, role: 'user' });
    await setDoc(doc(db, 'users/admin2'), { id: 'admin2', name: 'Staff', email: 'staff@example.com', phone: '', haircutCount: 0, role: 'admin' });
    await setDoc(doc(db, 'appointments/a1'), validBooking('alice'));
    await setDoc(doc(db, 'appointments/b1'), validBooking('bob'));
    await setDoc(doc(db, 'appointments/p1'), validBooking('alice', { status: 'proposed', proposedDate: '2030-01-11', proposedTime: '11:00' }));
    await setDoc(doc(db, 'alerts/al1'), { userId: 'alice', message: 'hi', isRead: false, link: 'profile', createdAt: 1 });
    await setDoc(doc(db, 'waitlist/w1'), { userId: 'alice', name: 'Alice', phone: '', date: '2030-01-10', stylist: 'Any', createdAt: 1 });
    await setDoc(doc(db, 'clientNotes/alice'), { notes: 'likes #1 fade', updatedAt: 1 });
    await setDoc(doc(db, 'services/s1'), { name: 'Skin Fade', price: '40', durationMins: 45 });
    await setDoc(doc(db, 'settings/general'), { walkinWaitTime: '15 Minuten', holidays: [] });
    await setDoc(doc(db, 'consentLogs/c1'), { analytics: false });
    await setDoc(doc(db, 'rateLimits/r1'), { count: 1 });
    await setDoc(doc(db, 'otpCodes/alice'), { hash: 'x', expiresAt: 1, attempts: 0 });
  });
});

// ---------- Privilege escalation ----------
test('customer cannot make themselves admin', async () => {
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { role: 'admin' }));
});
test('customer cannot create a profile with role admin', async () => {
  const db = env.authenticatedContext('newbie', { email: 'n@example.com' }).firestore();
  await assertFails(setDoc(doc(db, 'users/newbie'), { id: 'newbie', name: 'N', email: 'n@example.com', phone: '', haircutCount: 0, role: 'admin' }));
});
test('customer can create a normal profile', async () => {
  const db = env.authenticatedContext('newbie', { email: 'n@example.com' }).firestore();
  await assertSucceeds(setDoc(doc(db, 'users/newbie'), { id: 'newbie', name: 'N', email: 'n@example.com', phone: '', haircutCount: 0, role: 'user' }));
});
test('customer cannot start with loyalty points', async () => {
  const db = env.authenticatedContext('newbie', { email: 'n@example.com' }).firestore();
  await assertFails(setDoc(doc(db, 'users/newbie'), { id: 'newbie', name: 'N', email: 'n@example.com', phone: '', haircutCount: 10, role: 'user' }));
});
test('customer cannot jump loyalty points', async () => {
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { haircutCount: 10 }));
});
test('customer can add one loyalty point (booking) and edit name/phone', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { haircutCount: 4 }));
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { name: 'Alice B', phone: '+491709999999' }));
});
test('unverified email on the admin list is NOT admin', async () => {
  await assertFails(getDocs(collection(fakeAdmin(), 'users')));
  await assertFails(getDoc(doc(fakeAdmin(), 'clientNotes/alice')));
  await assertFails(setDoc(doc(fakeAdmin(), 'services/evil'), { name: 'x', price: '0', durationMins: 1 }));
});
test('verified allow-listed admin and role-admin both have admin access', async () => {
  await assertSucceeds(getDocs(collection(emailAdmin(), 'users')));
  await assertSucceeds(getDocs(collection(roleAdmin(), 'appointments')));
  await assertSucceeds(updateDoc(doc(roleAdmin(), 'users/alice'), { haircutCount: 20 }));
});

// ---------- Personal data exposure ----------
test('guest cannot read bookings, alerts, waitlist or profiles', async () => {
  await assertFails(getDocs(collection(guest(), 'appointments')));
  await assertFails(getDoc(doc(guest(), 'appointments/a1')));
  await assertFails(getDocs(collection(guest(), 'alerts')));
  await assertFails(getDocs(collection(guest(), 'waitlist')));
  await assertFails(getDoc(doc(guest(), 'users/alice')));
});
test("customer cannot read someone else's data", async () => {
  await assertFails(getDoc(doc(bob(), 'appointments/a1')));
  await assertFails(getDocs(collection(bob(), 'appointments')));
  await assertFails(getDoc(doc(bob(), 'users/alice')));
  await assertFails(getDoc(doc(bob(), 'alerts/al1')));
  await assertFails(getDoc(doc(bob(), 'waitlist/w1')));
});
test('customer can read their own data via userId query', async () => {
  await assertSucceeds(getDocs(query(collection(alice(), 'appointments'), where('userId', '==', 'alice'))));
  await assertSucceeds(getDocs(query(collection(alice(), 'alerts'), where('userId', '==', 'alice'))));
  await assertSucceeds(getDocs(query(collection(alice(), 'waitlist'), where('userId', '==', 'alice'))));
  await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
});
test('customer cannot read staff notes about themselves', async () => {
  await assertFails(getDoc(doc(alice(), 'clientNotes/alice')));
});
test('server-only collections are closed to everyone on the client', async () => {
  for (const db of [guest(), alice(), emailAdmin()]) {
    await assertFails(getDoc(doc(db, 'consentLogs/c1')));
    await assertFails(getDoc(doc(db, 'rateLimits/r1')));
    await assertFails(getDoc(doc(db, 'otpCodes/alice')));
  }
});

// ---------- Booking integrity ----------
test('customer can create a pending booking for themselves', async () => {
  await assertSucceeds(addDoc(collection(alice(), 'appointments'), validBooking('alice', { specialRequests: 'short' })));
});
test('customer cannot create a pre-confirmed booking', async () => {
  await assertFails(addDoc(collection(alice(), 'appointments'), validBooking('alice', { status: 'confirmed' })));
});
test('customer cannot book in someone else\'s name', async () => {
  await assertFails(addDoc(collection(alice(), 'appointments'), validBooking('bob')));
});
test('customer cannot claim a reward or inject admin fields', async () => {
  await assertFails(addDoc(collection(alice(), 'appointments'), validBooking('alice', { usedReward: true })));
  await assertFails(addDoc(collection(alice(), 'appointments'), validBooking('alice', { notes: 'VIP, free' })));
});
test('guest cannot create bookings', async () => {
  await assertFails(addDoc(collection(guest(), 'appointments'), validBooking('alice')));
});
test('customer cannot confirm or edit their own pending booking', async () => {
  await assertFails(updateDoc(doc(alice(), 'appointments/a1'), { status: 'confirmed' }));
  await assertFails(updateDoc(doc(alice(), 'appointments/a1'), { date: '2030-02-01' }));
});
test('customer can accept or decline a salon proposal', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'appointments/p1'), {
    status: 'confirmed', date: '2030-01-11', time: '11:00', proposedDate: null, proposedTime: null,
  }));
});
test('customer can decline a salon proposal', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'appointments/p1'), { status: 'cancelled' }));
});
test('customer can cancel their own open booking, but only the status', async () => {
  await assertFails(updateDoc(doc(alice(), 'appointments/a1'), { status: 'cancelled', time: '15:30' }));
  await assertSucceeds(updateDoc(doc(alice(), 'appointments/a1'), { status: 'cancelled' }));
  await assertFails(updateDoc(doc(alice(), 'appointments/a1'), { status: 'pending' }));
  await assertFails(updateDoc(doc(bob(), 'appointments/p1'), { status: 'cancelled' }));
});
test("customer cannot touch someone else's booking or delete bookings", async () => {
  await assertFails(updateDoc(doc(bob(), 'appointments/a1'), { referenceImage: 'x' }));
  await assertFails(deleteDoc(doc(alice(), 'appointments/a1')));
});
test("reference photo must be in the customer's own Cloudinary folder", async () => {
  const base = 'https://res.cloudinary.com/a2x0mlwu/image/upload/v1712345678/dhurdur/reference';
  await assertSucceeds(setDoc(doc(alice(), 'appointments/ref-ok'), validBooking('alice', { referenceImage: `${base}/alice/abc_123.jpg` })));
  await assertSucceeds(updateDoc(doc(alice(), 'appointments/a1'), { referenceImage: `${base}/alice/xyz.jpg` }));
  for (const bad of [
    `${base}/bob/abc.jpg`,                                                            // someone else's folder
    'https://res.cloudinary.com/othercloud/image/upload/dhurdur/reference/alice/a.jpg', // another account
    'https://evil.example.com/alice/a.jpg',                                           // arbitrary site
    'javascript:alert(1)',
  ]) {
    await assertFails(setDoc(doc(alice(), 'appointments/ref-bad'), validBooking('alice', { referenceImage: bad })));
    await assertFails(updateDoc(doc(alice(), 'appointments/a1'), { referenceImage: bad }));
  }
});
test('admin can confirm and delete bookings', async () => {
  await assertSucceeds(updateDoc(doc(emailAdmin(), 'appointments/a1'), { status: 'confirmed' }));
  await assertSucceeds(deleteDoc(doc(roleAdmin(), 'appointments/b1')));
});

// ---------- Alerts / waitlist ----------
test('customer can mark own alert read and clear it, but not edit text', async () => {
  await assertSucceeds(updateDoc(doc(alice(), 'alerts/al1'), { isRead: true }));
  await assertFails(updateDoc(doc(alice(), 'alerts/al1'), { message: 'changed' }));
  await assertSucceeds(deleteDoc(doc(alice(), 'alerts/al1')));
});
test("customer cannot hijack or delete someone else's alert", async () => {
  await assertFails(updateDoc(doc(bob(), 'alerts/al1'), { userId: 'bob' }));
  await assertFails(deleteDoc(doc(bob(), 'alerts/al1')));
});
test('customer cannot create alerts for other people', async () => {
  await assertFails(addDoc(collection(bob(), 'alerts'), { userId: 'alice', message: 'phish', isRead: false, link: 'profile', createdAt: 2 }));
});
test('waitlist: own entry only, no edits', async () => {
  await assertSucceeds(addDoc(collection(bob(), 'waitlist'), { userId: 'bob', name: 'Bob', phone: '', date: '2030-01-10', stylist: 'Any', createdAt: 2 }));
  await assertFails(addDoc(collection(bob(), 'waitlist'), { userId: 'alice', name: 'x', phone: '', date: '2030-01-10', stylist: 'Any', createdAt: 2 }));
  await assertFails(updateDoc(doc(alice(), 'waitlist/w1'), { date: '2030-03-01' }));
});

// ---------- Public content ----------
test('anyone can read services/settings, only admins can change them', async () => {
  await assertSucceeds(getDocs(collection(guest(), 'services')));
  await assertSucceeds(getDoc(doc(guest(), 'settings/general')));
  await assertFails(setDoc(doc(alice(), 'services/s1'), { name: 'Free', price: '0', durationMins: 1 }));
  await assertFails(setDoc(doc(alice(), 'settings/translations'), { en: { hero: { sub: 'hacked' } } }));
  await assertFails(updateDoc(doc(guest(), 'settings/general'), { walkinWaitTime: 'closed forever' }));
  await assertSucceeds(updateDoc(doc(emailAdmin(), 'settings/general'), { walkinWaitTime: '20 Minuten' }));
});

// ---------- Storage ----------
const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
test('storage: owner can upload a small image to their own folder', async () => {
  const s = env.authenticatedContext('alice', { email: 'alice@example.com', email_verified: true }).storage();
  await assertSucceeds(uploadBytes(ref(s, 'reference-images/alice/a1/x.jpg'), img, { contentType: 'image/jpeg' }));
});
test('storage: no uploads into someone else\'s folder, no non-images', async () => {
  const s = env.authenticatedContext('bob', { email: 'bob@example.com', email_verified: true }).storage();
  await assertFails(uploadBytes(ref(s, 'reference-images/alice/a1/evil.jpg'), img, { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(s, 'reference-images/bob/b1/evil.html'), img, { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(s, 'anything/else.jpg'), img, { contentType: 'image/jpeg' }));
});
test('storage: others cannot read a customer\'s reference image', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'reference-images/alice/a1/x.jpg'), img, { contentType: 'image/jpeg' });
  });
  const bobS = env.authenticatedContext('bob', { email: 'bob@example.com', email_verified: true }).storage();
  const guestS = env.unauthenticatedContext().storage();
  await assertFails(getBytes(ref(bobS, 'reference-images/alice/a1/x.jpg')));
  await assertFails(getBytes(ref(guestS, 'reference-images/alice/a1/x.jpg')));
});
