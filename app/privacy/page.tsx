import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung | Dhurdur",
  description: "Wie Dhurdur Ihre Daten sammelt, nutzt und schützt.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-serif text-gold-400 mb-3">{title}</h2>
      <div className="text-zinc-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white px-6 md:px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-gold-400 transition-colors">
          ← Zurück zu Dhurdur
        </Link>

        <h1 className="text-3xl md:text-4xl font-serif mt-6 mb-2">Datenschutzerklärung</h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-12">Stand: 09.09.2026</p>

        <Section title="1. Verantwortlicher">
          <p>
            Dhurdur<br />
            Inh. Oliver Hayes<br />
            Obere Str. 30<br />
            97421 Schweinfurt<br />
            Telefon: 01523 2163823<br />
            E-Mail: datenschutz@dhurdur.de
          </p>
        </Section>

        <Section title="2. Verarbeitungsübersicht">
          <p>Wir verarbeiten personenbezogene Daten bei Website-Besuch, Online-Buchung, Kundenkonto, Kommunikation und Analyse.</p>
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left p-2">Daten</th>
                <th className="text-left p-2">Zweck</th>
                <th className="text-left p-2">Rechtsgrundlage</th>
                <th className="text-left p-2">Speicherdauer</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="p-2">IP, Browser, Zeit, Seiten</td>
                <td className="p-2">Sicherheit, Fehleranalyse</td>
                <td className="p-2">Art. 6 Abs. 1 lit. f DSGVO</td>
                <td className="p-2">30 Tage / 1 Jahr</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="p-2">Name, E-Mail, Telefon, Services</td>
                <td className="p-2">Terminkoordination, Erinnerung</td>
                <td className="p-2">Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="p-2">3 Jahre nach Termin</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="p-2">Name, E-Mail, Passwort-Hash</td>
                <td className="p-2">Kontoverwaltung, Login, Historie</td>
                <td className="p-2">Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="p-2">Bis Konto-Löschung + 30 Tage</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="p-2">E-Mail, Telefon, Inhalt</td>
                <td className="p-2">Bestätigung, Erinnerung, Reset</td>
                <td className="p-2">Art. 6 Abs. 1 lit. b DSGVO</td>
                <td className="p-2">1 Jahr nach Versand</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="p-2">Pseudonyme Nutzer-ID, Events</td>
                <td className="p-2">Website-Optimierung (Einwilligung)</td>
                <td className="p-2">Art. 6 Abs. 1 lit. a DSGVO</td>
                <td className="p-2">14 Monate</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="3. Hosting & Server-Logfiles">
          <p>
            Diese Website wird bei Vercel Inc. (USA) gehostet, mit Edge-Netzwerk in der EU.
            Bei jedem Aufruf erfasst der Hosting-Anbieter automatisch technische Zugriffsdaten
            (IP-Adresse, Datum/Uhrzeit, aufgerufene Seite, Referrer, Browsertyp) in Server-Logfiles.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem Betrieb).
            Logfiles werden nach 30 Tagen gelöscht.
            Ein Auftragsverarbeitungsvertrag (AVV) mit Vercel besteht.
            EU-Standardvertragsklauseln (SCC) für US-Übermittlung liegen vor.
          </p>
        </Section>

        <Section title="4. Online-Buchung & Kundenkonto">
          <p>
            Bei der Buchung verarbeiten wir Name, E-Mail, Telefon, gewünschte Services,
            Stylist-Präferenz, Terminwunsch, Notizen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
            (Vertragsanbahnung). Daten werden 3 Jahre nach letztem Termin gespeichert
            (steuerrechtliche Aufbewahrung).
          </p>
          <p>
            Registrierung: Name, E-Mail, Telefon, Passwort-Hash.
            Verifizierung per E-Mail (Firebase). Social Login via Google/Facebook möglich.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </Section>

        <Section title="5. Referenzbilder (Firebase Storage)">
          <p>
            Optional können Sie bei der Buchung ein Referenzbild hochladen (z. B. Haarstil-Vorlage).
            Das Bild wird in Firebase Storage gespeichert (EU-Region, falls Bucket in EU).
            EXIF-Metadaten werden beim Upload entfernt. Das Bild wird nur mit Ihrem Termin verknüpft
            und nach 3 Jahren (mit dem Termin) gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </Section>

        <Section title="6. Cookies & TTDSG §25">
          <p>
            Notwendige Cookies (Sitzung, Sicherheit, Sprache) – immer aktiv, keine Einwilligung nötig
            (§25 Abs. 2 Nr. 2 TTDSG). Analytics-Cookies (Firebase Analytics) – nur mit Einwilligung
            (Art. 6 Abs. 1 lit. a DSGVO). Speicherdauer Analytics: 14 Monate.
            Sie können Einwilligung jederzeit widerrufen über "Cookie-Einstellungen" im Footer.
          </p>
        </Section>

        <Section title="7. Firebase / Google / DeepL">
          <p>
            Authentifizierung via Firebase Authentication (Google Ireland Ltd., EU).
            Social Login via Google/Facebook (Meta Platforms Ireland Ltd., EU).
            UI-Übersetzung via DeepL SE (Deutschland, EU).
            Keine personenbezogenen Daten an DeepL.
          </p>
        </Section>

        <Section title="8. Auftragsverarbeiter">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Google Cloud / Firebase</strong> (Auth, Firestore, Storage, Analytics) — EU (europe-west1/3), AVV ✅, SCC ✅</li>
            <li><strong>Twilio</strong> (SMS) — USA, AVV ✅, SCC ✅</li>
            <li><strong>Google (Gmail/Workspace)</strong> (Transaktions-E-Mails) — EU/USA, AVV ✅, SCC ✅</li>
            <li><strong>DeepL SE</strong> (Übersetzung) — Deutschland, EU, AVV ✅, DSGVO direkt</li>
            <li><strong>Vercel</strong> (Hosting) — USA mit EU Edge, AVV ✅, SCC ✅</li>
          </ul>
          <p className="mt-2 text-sm">
            Für USA-Übermittlungen: EU-Standardvertragsklauseln (SCC 2021/914) + ergänzende Maßnahmen.
            DPF-Zertifizierung geprüft.
          </p>
        </Section>

        <Section title="9. Ihre Rechte (Art. 15–22 DSGVO)">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left p-2">Recht</th>
                <th className="text-left p-2">Beschreibung</th>
                <th className="text-left p-2">Ausübung</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 15 – Auskunft</td><td className="p-2">Bestätigung & Kopie der Daten</td><td className="p-2">Profil → "Daten exportieren" oder E-Mail</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 16 – Berichtigung</td><td className="p-2">Korrektur unrichtiger Daten</td><td className="p-2">Profil → Einstellungen bearbeiten</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 17 – Löschung</td><td className="p-2">'Recht auf Vergessenwerden' (vorbehaltlich Aufbewahrungspflichten)</td><td className="p-2">Profil → "Konto löschen" oder E-Mail</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 18 – Einschränkung</td><td className="p-2">Verarbeitung beschränken</td><td className="p-2">E-Mail an datenschutz@dhurdur.de</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 20 – Datenübertragbarkeit</td><td className="p-2">Strukturierter, maschinenlesbarer Export</td><td className="p-2">Profil → "Daten exportieren" (JSON)</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 21 – Widerspruch</td><td className="p-2">Gegen Verarbeitung aus berechtigtem Interesse</td><td className="p-2">E-Mail oder Cookie-Banner (Analytics)</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Art. 7 Abs. 3 – Widerruf</td><td className="p-2">Einwilligung jederzeit widerrufen</td><td className="p-2">Cookie-Banner oder E-Mail</td></tr>
            </tbody>
          </table>
          <p className="mt-2">
            Beschwerderecht: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA),
            Promenade 18, 91522 Ansbach, https://www.lda.bayern.de
          </p>
        </Section>

        <Section title="10. Datensicherheit (Art. 32 DSGVO)">
          <ul className="list-disc list-inside space-y-1">
            <li>Transportverschlüsselung: TLS 1.2+ (HTTPS, HSTS)</li>
            <li>Speicherverschlüsselung: Firebase/Firestore AES-256 at rest</li>
            <li>Zugriffskontrolle: Rollenbasiert (User/Admin), Firebase Custom Claims, MFA für Admin</li>
            <li>Passwortsicherheit: bcrypt (Firebase), Breach-Check (HIBP), Mindestlänge 8</li>
            <li>Rate Limiting: API-Routen mit Zod-Validierung, In-Memory Rate Limiting</li>
            <li>Sicherheits-Headers: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy</li>
            <li>Audit-Logging: Alle Admin-Aktionen & API-Zugriffe</li>
            <li>Notfallplan: Incident-Response-Prozess (72h-Meldepflicht Art. 33 DSGVO)</li>
            <li>EXIF-Entfernung bei Bild-Uploads</li>
          </ul>
        </Section>

        <Section title="11. Speicherdauer & Löschung">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left p-2">Datenkategorie</th>
                <th className="text-left p-2">Regelfrist</th>
                <th className="text-left p-2">Ausnahme</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800"><td className="p-2">Buchungsdaten</td><td className="p-2">3 Jahre nach Terminende</td><td className="p-2">Steuerrechtliche Aufbewahrung (§ 147 AO)</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Kundenkonto</td><td className="p-2">Bis Widerruf + 30 Tage</td><td className="p-2">Rechtliche Verpflichtungen</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Kommunikationslogs</td><td className="p-2">1 Jahr</td><td className="p-2">Beweissicherung</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Analytics-Daten</td><td className="p-2">14 Monate</td><td className="p-2">GA4 Standard</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Sicherheitslogs</td><td className="p-2">1 Jahr</td><td className="p-2">Angriffserkennung</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Referenzbilder</td><td className="p-2">Mit Termin (3 Jahre)</td><td className="p-2">Vertrag</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Kundennotizen (Admin)</td><td className="p-2">3 Jahre (mit Termin)</td><td className="p-2">Vertrag</td></tr>
              <tr className="border-b border-zinc-800"><td className="p-2">Backups</td><td className="p-2">30 Tage (rolling)</td><td className="p-2">Disaster Recovery</td></tr>
            </tbody>
          </table>
          <p className="text-sm">
            Automatische Löschung via Firestore TTL-Indizes: alerts (30 Tage), appointments (3 Jahre),
            waitlist (6 Monate), consentLogs (3 Jahre).
          </p>
        </Section>

        <Section title="12. Kontakt & Datenschutzbeauftragter">
          <p><strong>Verantwortlicher:</strong></p>
          <p>Dhurdur</p>
          <p>Inh. Oliver Hayes</p>
          <p>Obere Str. 30, 97421 Schweinfurt</p>
          <p>E-Mail: datenschutz@dhurdur.de</p>
          <p>Telefon: 01523 2163823</p>
<p className="mt-2"><strong>Datenschutzbeauftragter:</strong> Nicht verpflichtend bestellt (&lt; 20 Personen). Ansprechpartner: Inhaber.</p>        </Section>

        <Section title="13. Änderungen">
          <p>
            Wir behalten uns vor, diese Erklärung anzupassen. Die aktuelle Version finden Sie auf dieser Seite.
            Bei wesentlichen Änderungen informieren wir per E-Mail oder Website-Hinweis.
          </p>
        </Section>

        <Section title="Salvatorische Klausel">
          <p>Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>
        </Section>

        <p className="text-xs text-zinc-500 mt-10 text-center">
          *Diese Datenschutzerklärung wurde unter Berücksichtigung der DSGVO, BDSG, TTDSG und DSK-Orientierungshilfen erstellt. Sie ersetzt keine rechtliche Beratung.*
        </p>
      </div>
    </main>
  );
}