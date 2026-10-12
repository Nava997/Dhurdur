import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Datenschutzerklärung | Dhurdur",
  description: "Wie Dhurdur Ihre Daten verarbeitet und schützt.",
};

// Keep every statement here in sync with what the code actually does:
// retention periods → app/api/cron/cleanup, export → app/api/account/export,
// erasure → app/api/account/delete, business details → lib/legal.ts.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-serif text-gold-400 mb-3">{title}</h2>
      <div className="text-zinc-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            {head.map(h => <th key={h} className="text-left p-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-800 align-top">
              {r.map((c, j) => <td key={j} className="p-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-12">Stand: {LEGAL.policyDate}</p>

        <Section title="1. Verantwortlicher">
          <p>
            {LEGAL.businessName}<br />
            Inh. {LEGAL.ownerName}<br />
            {LEGAL.street}<br />
            {LEGAL.city}<br />
            Telefon: {LEGAL.phone}<br />
            E-Mail: {LEGAL.email}
          </p>
          <p>
            Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen Voraussetzungen
            (§ 38 BDSG) nicht vorliegen. Bei Fragen zum Datenschutz wenden Sie sich bitte direkt an uns.
          </p>
        </Section>

        <Section title="2. Überblick">
          <p>
            Wir verarbeiten personenbezogene Daten nur, soweit es für den Betrieb dieser Website, Ihr
            Kundenkonto und die Terminbuchung erforderlich ist. Wir setzen <strong>keine</strong>{" "}
            Analyse-, Tracking- oder Werbedienste ein und erstellen keine Nutzungsprofile.
          </p>
        </Section>

        <Section title="3. Hosting und Server-Logfiles">
          <p>
            Die Website wird bei der Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA
            gehostet. Die Server-Funktionen, die Ihre Buchungs- und Kontodaten verarbeiten, laufen im
            Rechenzentrum Frankfurt am Main. Seitenaufrufe werden über das weltweite Netzwerk von
            Vercel ausgeliefert.
          </p>
          <p>
            Beim Aufruf der Website verarbeitet Vercel technisch notwendige Zugriffsdaten (IP-Adresse,
            Datum und Uhrzeit, aufgerufene Adresse, Browsertyp) in Server-Logs. Für sicherheitsrelevante
            Aktionen (z. B. Passwortänderung, Datenexport, Kontolöschung) protokollieren wir zusätzlich
            Zeitpunkt, Aktion, Nutzer-ID, IP-Adresse und Browsertyp. Diese Logs werden nur kurzzeitig
            bei Vercel vorgehalten und automatisch gelöscht.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und
            stabilen Betrieb). Mit Vercel besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).
          </p>
          <p>
            Bilder auf dieser Website werden über unseren eigenen Server ausgeliefert; Ihr Browser
            stellt dafür keine Verbindung zu externen Bildanbietern her (Ausnahme: von uns
            hochgeladene Fotos, siehe Abschnitt 7).
          </p>
        </Section>

        <Section title="4. Kundenkonto">
          <p>
            Für Online-Buchungen benötigen Sie ein Kundenkonto. Wir verarbeiten dabei Name,
            E-Mail-Adresse, optional Ihre Telefonnummer, Ihr Passwort (nur als verschlüsselter Hash)
            sowie Ihre Treuepunkte. Sie können sich alternativ mit Ihrem Google-Konto anmelden; Google
            übermittelt uns dann Ihren Namen und Ihre E-Mail-Adresse.
          </p>
          <p>
            Anmeldung und Datenbank laufen über Google Firebase (Google Ireland Limited, Gordon House,
            Barrow Street, Dublin 4, Irland). Die Datenbank (Cloud Firestore) befindet sich in
            Frankfurt am Main. Für die Anmeldung (Firebase Authentication) kann eine Verarbeitung auch
            in den USA erfolgen (siehe Abschnitt 10).
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag bzw. vorvertragliche Maßnahmen).
            Ihr Konto bleibt bestehen, bis Sie es löschen. Die Löschung können Sie jederzeit selbst
            im Profil unter „Konto löschen“ auslösen; dabei werden Konto, Termine, Benachrichtigungen,
            Wartelisten-Einträge, interne Notizen und hochgeladene Fotos sofort entfernt.
          </p>
        </Section>

        <Section title="5. Online-Terminbuchung">
          <p>
            Bei einer Buchung verarbeiten wir Name, Telefonnummer, gewünschte Leistung, Stylist,
            Datum und Uhrzeit, Ihre optionalen Wünsche/Notizen und ein optionales Referenzbild. Der
            Salon kann einen Termin bestätigen, absagen oder einen neuen Termin vorschlagen; Sie
            können Termine im Profil stornieren.
          </p>
          <p>
            <strong>Bitte tragen Sie keine Gesundheitsangaben</strong> (z. B. Allergien oder
            Hauterkrankungen) in das Notizfeld ein — sprechen Sie diese lieber direkt im Salon an.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Nach dem Termin bewahren wir die Buchung
            3 Jahre auf, um Rückfragen und Ansprüche klären zu können (Art. 6 Abs. 1 lit. f DSGVO;
            regelmäßige Verjährungsfrist § 195 BGB); danach wird sie automatisch gelöscht.
          </p>
          <p>
            Damit andere Kunden freie Zeiten sehen können, zeigt die Website belegte Zeitfenster an —
            ohne Namen oder andere Angaben zu Ihrer Person.
          </p>
        </Section>

        <Section title="6. E-Mails, Benachrichtigungen und Warteliste">
          <p>
            Wir senden Ihnen E-Mails zu Ihrer Buchung (Eingang, Bestätigung, Terminvorschlag,
            Absage/Stornierung) und zur Passwortänderung (Bestätigungscode). Der Salon erhält eine
            Kopie der Buchungsdaten per E-Mail. Versanddienstleister: {LEGAL.emailProvider}.
            Zusätzlich erscheinen Hinweise in Ihrem Profil (Glocken-Symbol); diese werden nach 30 Tagen
            gelöscht. Wir versenden keine Werbung oder Newsletter.
          </p>
          <p>
            Wenn Sie sich auf die Warteliste setzen, speichern wir Name, Telefonnummer, Wunschdatum
            und Stylist, um Sie bei einem frei werdenden Termin zu benachrichtigen. Einträge werden
            nach 6 Monaten gelöscht.
          </p>
          <p>Rechtsgrundlage jeweils: Art. 6 Abs. 1 lit. b DSGVO.</p>
        </Section>

        <Section title="7. Fotos (Cloudinary)">
          <p>
            Referenzbilder, die Sie bei einer Buchung hochladen, sowie die Fotos auf dieser Website
            (Galerie, Team, Produkte) speichern wir bei Cloudinary Inc., 3400 Central Expressway,
            Suite 110, Santa Clara, CA 95051, USA. Ihr Browser lädt diese Bilder
            direkt von Cloudinary; dabei wird Ihre IP-Adresse an Cloudinary übermittelt.
          </p>
          <p>
            Referenzbilder werden vor dem Hochladen in Ihrem Browser verkleinert; dabei werden alle
            Metadaten (z. B. GPS-Standort, Kameradaten) entfernt. Sie liegen in einem nur Ihrem Konto
            zugeordneten Ordner und sind nur für Sie und den Salon bestimmt. Sie werden mit dem Termin
            gelöscht, sofort bei Löschung Ihres Kontos, und — falls Sie die Buchung nicht
            abschließen — nach 7 Tagen.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Referenzbilder) bzw. lit. f DSGVO
            (Darstellung unseres Salons). Mit Cloudinary besteht ein Vertrag zur Auftragsverarbeitung.
          </p>
        </Section>

        <Section title="8. Interne Notizen des Salons">
          <p>
            Das Salon-Team kann zu Ihrem Kundenkonto interne Notizen anlegen (z. B. bevorzugte
            Schnittlänge), um Sie beim nächsten Besuch besser bedienen zu können. Diese Notizen sind
            nicht öffentlich, aber Bestandteil jeder Datenauskunft. Gesundheitsdaten werden darin nicht
            erfasst. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Löschung 3 Jahre nach der letzten
            Änderung oder mit Ihrem Konto.
          </p>
        </Section>

        <Section title="9. Speicherung auf Ihrem Gerät (§ 25 TDDDG)">
          <p>
            Wir verwenden keine Cookies zu Analyse-, Tracking- oder Werbezwecken. Wenn Sie sich
            anmelden, speichert Firebase Authentication Ihre Anmeldesitzung im Speicher Ihres Browsers
            (IndexedDB), damit Sie angemeldet bleiben. Das ist für den von Ihnen gewünschten Dienst
            unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und erfordert keine Einwilligung. Beim
            Abmelden wird die Sitzung entfernt.
          </p>
        </Section>

        <Section title="10. Empfänger und Übermittlung in Drittländer">
          <Table
            head={["Empfänger", "Zweck", "Ort der Verarbeitung"]}
            rows={[
              ["Google Ireland Ltd. (Firebase)", "Anmeldung, Datenbank", "Datenbank: Frankfurt; Anmeldung: EU/USA"],
              ["Vercel Inc.", "Hosting, Server-Funktionen", "Server-Funktionen: Frankfurt; Auslieferung: weltweit"],
              ["Cloudinary Inc.", "Speicherung von Fotos", "USA"],
              [LEGAL.emailProvider.split(",")[0], "Versand von E-Mails", "EU/USA"],
            ]}
          />
          <p>
            Alle Empfänger sind als Auftragsverarbeiter vertraglich gebunden (Art. 28 DSGVO). Soweit
            Daten in die USA übermittelt werden, erfolgt dies auf Grundlage des
            Angemessenheitsbeschlusses der EU-Kommission zum EU-US Data Privacy Framework (für
            zertifizierte Anbieter) bzw. der EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
          </p>
          <p>
            Zur Übersetzung der Website-Texte nutzen wir DeepL (DeepL SE, Köln). Dabei werden nur
            Website-Texte übermittelt, keine personenbezogenen Daten.
          </p>
          <p>
            Links zu Instagram, TikTok, Facebook und Google Maps sind einfache Verweise. Erst wenn Sie
            darauf klicken, werden Sie zum jeweiligen Anbieter weitergeleitet; vorher werden keine
            Daten übertragen.
          </p>
        </Section>

        <Section title="11. Speicherdauer im Überblick">
          <Table
            head={["Daten", "Löschung"]}
            rows={[
              ["Kundenkonto", "Bei Kontolöschung (sofort)"],
              ["Termine inkl. Referenzbilder", "3 Jahre nach dem Termindatum oder bei Kontolöschung"],
              ["Nicht verwendete Referenzbilder", "Nach 7 Tagen"],
              ["Benachrichtigungen im Profil", "Nach 30 Tagen"],
              ["Warteliste", "Nach 6 Monaten"],
              ["Interne Notizen", "3 Jahre nach letzter Änderung oder bei Kontolöschung"],
              ["Code zur Passwortänderung", "Nach 10 Minuten ungültig, gelöscht spätestens am Folgetag"],
              ["Schutz vor Missbrauch (pseudonymisierte IP-Zähler)", "Nach Ablauf des Zeitfensters, spätestens am Folgetag"],
              ["Server- und Sicherheitslogs", "Kurzfristig, automatisch durch Vercel"],
            ]}
          />
          <p>Die Löschung erfolgt automatisch durch einen täglichen Bereinigungsjob.</p>
        </Section>

        <Section title="12. Pflicht zur Bereitstellung, automatisierte Entscheidungen">
          <p>
            Für Kundenkonto und Buchung sind Name, E-Mail-Adresse und die Termindaten erforderlich;
            ohne sie können wir keine Online-Buchung anbieten. Telefonnummer, Notizen und
            Referenzbild sind freiwillig. Sie können Termine auch telefonisch oder vor Ort vereinbaren.
          </p>
          <p>Eine automatisierte Entscheidungsfindung einschließlich Profiling (Art. 22 DSGVO) findet nicht statt.</p>
        </Section>

        <Section title="13. Ihre Rechte">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Auskunft</strong> (Art. 15) und <strong>Datenübertragbarkeit</strong> (Art. 20): im Profil unter „Meine Daten herunterladen“ — enthält alle zu Ihnen gespeicherten Daten inkl. interner Notizen und Fotos — oder per E-Mail.</li>
            <li><strong>Berichtigung</strong> (Art. 16): im Profil unter „Einstellungen“ oder per E-Mail.</li>
            <li><strong>Löschung</strong> (Art. 17): im Profil unter „Konto löschen“ oder per E-Mail.</li>
            <li><strong>Einschränkung der Verarbeitung</strong> (Art. 18): per E-Mail.</li>
          </ul>
          <div className="border border-gold-500/40 p-4 mt-4">
            <p className="font-medium text-white mb-2">Widerspruchsrecht (Art. 21 DSGVO)</p>
            <p>
              Soweit wir Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO verarbeiten, können Sie
              aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen.
              Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende
              schutzwürdige Gründe nachweisen. Ein formloser Hinweis an {LEGAL.email} genügt.
            </p>
          </div>
          <p className="mt-4">
            <strong>Beschwerderecht:</strong> Sie können sich bei einer Datenschutz-Aufsichtsbehörde
            beschweren, z. B. beim Bayerischen Landesamt für Datenschutzaufsicht (BayLDA),
            Promenade 18, 91522 Ansbach, www.lda.bayern.de.
          </p>
        </Section>

        <Section title="14. Datensicherheit">
          <p>
            Verschlüsselte Übertragung (HTTPS/TLS, HSTS), Verschlüsselung der gespeicherten Daten,
            rollenbasierte Zugriffsregeln (Kunden sehen nur ihre eigenen Daten), Passwortänderung nur
            mit E-Mail-Bestätigungscode, Schutz vor Missbrauch durch Anfragebegrenzung sowie
            Sicherheits-Header (u. a. Content-Security-Policy).
          </p>
        </Section>

        <Section title="15. Änderungen">
          <p>
            Wir passen diese Datenschutzerklärung an, wenn sich die Website oder die Rechtslage
            ändert. Es gilt die jeweils hier veröffentlichte Fassung.
          </p>
        </Section>
      </div>
    </main>
  );
}
