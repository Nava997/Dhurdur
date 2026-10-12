// Fills the live Firestore with the services and team shown on the homepage,
// so the booking form has something to offer until the salon enters its own.
//
//   node scripts/seed-demo-data.mjs           -> preview only, writes nothing
//   node scripts/seed-demo-data.mjs --yes     -> write the demo data
//   node scripts/seed-demo-data.mjs --remove  -> delete the demo data again
//
// Only touches documents whose id starts with "demo-"; anything the salon
// added in the admin panel is left alone. Reads FIREBASE_SERVICE_ACCOUNT_BASE64
// from .env.local.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const serviceAccount = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Names and prices match the homepage menu; durations are sensible defaults
// the salon can change in Admin Panel → Leistungen.
const services = [
  { id: 'demo-haarschnitt', name: 'Klassischer Haarschnitt', price: '35', durationMins: 45 },
  { id: 'demo-skin-fade', name: 'Skin Fade', price: '40', durationMins: 45 },
  { id: 'demo-bart', name: 'Bart Trimmen & Formen', price: '25', durationMins: 30 },
  { id: 'demo-rasur', name: 'Heißes-Handtuch-Rasur', price: '30', durationMins: 30 },
  { id: 'demo-kombi', name: 'Haarschnitt & Bart Kombi', price: '55', durationMins: 60 },
  { id: 'demo-premium', name: 'Premium Grooming Paket', price: '75', durationMins: 90 },
];
const allServices = services.map((s) => s.name);
const stylists = [
  { id: 'demo-oliver', name: 'Oliver Hayes', services: allServices },
  { id: 'demo-sophia', name: 'Sophia Bennett', services: allServices },
  { id: 'demo-marcus', name: 'Marcus Steele', services: allServices },
];

const mode = process.argv.includes('--remove') ? 'remove' : process.argv.includes('--yes') ? 'write' : 'preview';
console.log(`Firebase project: ${serviceAccount.project_id}`);
const [svcSnap, styleSnap] = await Promise.all([db.collection('services').get(), db.collection('stylists').get()]);
console.log(`Currently: ${svcSnap.size} services, ${styleSnap.size} team members`);

if (mode === 'preview') {
  console.log('\nWould add services:');
  services.forEach((s) => console.log(`  ${s.name} — €${s.price}, ${s.durationMins} min`));
  console.log('Would add team:', stylists.map((s) => s.name).join(', '));
  console.log('\nNothing written. Run again with --yes to write.');
  process.exit(0);
}

const batch = db.batch();
for (const { id, ...data } of services) {
  const ref = db.collection('services').doc(id);
  if (mode === 'write') batch.set(ref, data); else batch.delete(ref);
}
for (const { id, ...data } of stylists) {
  const ref = db.collection('stylists').doc(id);
  if (mode === 'write') batch.set(ref, data); else batch.delete(ref);
}
await batch.commit();
console.log(mode === 'write'
  ? `Added ${services.length} services and ${stylists.length} team members.`
  : 'Removed the demo services and team members.');
process.exit(0);
