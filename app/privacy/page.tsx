import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung | Dhurdur",
  description: "Wie Dhurdur Ihre personenbezogenen Daten erhebt, nutzt und schützt.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-serif text-gold-400 mb-3">{title}</h2>
      <div className="text-zinc-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-white font-normal">{children}</strong>;
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white px-6 md:px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-gold-400 transition-colors">
          ← Zurück zu Dhurdur
        </Link>

        <h1 className="text-3xl md:text-4xl font-serif mt-6 mb-2">Datenschutzerklärung</h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-12">Stand: [Datum vor Veröffentlichung eintragen]</p>

        <div className="mb-12 p-4 border border-gold-700/60 bg-gold-900/20 text-gold-200 text-xs leading-relaxed">
          Dieser Text beschreibt, was die Dhurdur-Website technisch tatsächlich verarbeitet. Er ersetzt keine
          Rechtsberatung: Bitte die Angaben in eckigen Klammern ausfüllen und den Text vor Veröffentlichung
          (z.&nbsp;B. durch einen Anwalt oder eRecht24) prüfen lassen. Danach diesen Hinweis entfernen.
        </div>

        <Section title="1. Verantwortlicher">
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der DSGVO ist:
          </p>
          <p>
            Dhurdur — [Vollständiger Name des Inhabers / Rechtsform]<br />
            Obere Str. 30, 97421 Schweinfurt<br />
            Telefon: 01523 2163823<br />
            E-Mail: [kontakt@ihre-domain.de]
          </p>
          <p>Weitere Angaben finden Sie im <Link href="/impressum" className="text-gold-400 underline">Impressum</Link>.</p>
        </Section>

        <Section title="2. Welche Daten wir verarbeiten">
          <p><B>Konto- und Buchungsdaten:</B> Name, E-Mail-Adresse, Telefonnummer, gebuchte Leistungen, Termin, gewünschter Stylist sowie freiwillige Hinweise oder Sonderwünsche.</p>
          <p><B>Anmeldung über Google oder Facebook:</B> Wenn Sie diese Option nutzen, erhalten wir vom jeweiligen Anbieter über Firebase Authentication Ihren Namen, Ihre E-Mail-Adresse und ggf. Ihr Profilbild.</p>
          <p><B>Referenzbilder:</B> Fotos, die Sie optional zu einer Buchung bereitstellen (z.&nbsp;B. eine Frisurenvorlage). Metadaten wie Standortangaben werden vor dem Speichern entfernt.</p>
          <p><B>Warteliste und Benachrichtigungen:</B> Wenn Sie sich auf die Warteliste setzen, speichern wir Name, Telefonnummer, Wunschdatum und Stylist. Benachrichtigungen zu Ihren Terminen werden in Ihrem Konto angezeigt.</p>
          <p><B>Notizen des Salons:</B> Unsere Stylisten können interne Notizen zu Ihren Terminen hinterlegen (z.&nbsp;B. verwendete Schnitttechnik), um Sie beim nächsten Besuch gleich gut zu bedienen.</p>
          <p><B>Technische Daten:</B> Beim Aufruf der Website verarbeitet unser Hosting-Anbieter technisch notwendige Daten (IP-Adresse, Zeitpunkt, Browser). Zum Schutz vor Missbrauch begrenzen wir die Anzahl von Anfragen pro IP-Adresse kurzzeitig im Arbeitsspeicher.</p>
        </Section>

        <Section title="3. Zwecke und Rechtsgrundlagen">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><B>Kundenkonto, Terminbuchung, Bestätigungen per E-Mail/SMS:</B> Vertragserfüllung bzw. vorvertragliche Maßnahmen, Art. 6 Abs. 1 lit. b DSGVO.</li>
            <li><B>Warteliste, Stylisten-Notizen, Missbrauchsschutz und Sicherheitsprotokolle:</B> berechtigtes Interesse an einem reibungslosen und sicheren Salonbetrieb, Art. 6 Abs. 1 lit. f DSGVO.</li>
            <li><B>Analyse-Cookies:</B> nur mit Ihrer Einwilligung, Art. 6 Abs. 1 lit. a DSGVO i.&nbsp;V.&nbsp;m. § 25 Abs. 1 TDDDG.</li>
            <li><B>Speicherung Ihrer Cookie-Auswahl:</B> technisch erforderlich, § 25 Abs. 2 TDDDG; Nachweis der Einwilligung, Art. 7 Abs. 1 DSGVO.</li>
            <li><B>Aufbewahrung von Buchungsunterlagen:</B> gesetzliche Pflichten, Art. 6 Abs. 1 lit. c DSGVO.</li>
          </ul>
        </Section>

        <Section title="4. Empfänger und Auftragsverarbeiter">
          <p>Wir setzen folgende Dienstleister ein, die Daten nur in unserem Auftrag und nur im erforderlichen Umfang verarbeiten:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><B>Google Firebase</B> (Google Ireland Ltd.) — Anmeldung, Datenbank, Dateispeicher. Serverstandort: [Firebase-Region eintragen, z.&nbsp;B. europe-west1 (Belgien)].</li>
            <li><B>Twilio</B> (Twilio Ireland Ltd. / Twilio Inc., USA) — Versand von SMS-Terminbenachrichtigungen (Telefonnummer, Nachrichtentext).</li>
            <li><B>Google Workspace / Gmail</B> (Google Ireland Ltd.) — Versand von E-Mail-Terminbestätigungen.</li>
            <li><B>DeepL</B> (DeepL SE, Köln) — Übersetzung von Oberflächentexten und Leistungsbeschreibungen. Dabei werden keine personenbezogenen Kundendaten übermittelt.</li>
            <li><B>Vercel</B> (Vercel Inc., USA) — Hosting der Website. [Bitte prüfen und ggf. anpassen.]</li>
          </ul>
          <p>
            Soweit Daten in die USA übermittelt werden, stützen wir uns auf die Zertifizierung des Anbieters
            nach dem EU-U.S. Data Privacy Framework (Art. 45 DSGVO) bzw. auf EU-Standardvertragsklauseln
            (Art. 46 Abs. 2 lit. c DSGVO). Mit allen Anbietern bestehen Verträge zur Auftragsverarbeitung
            nach Art. 28 DSGVO. [Bitte vor Veröffentlichung bestätigen.]
          </p>
          <p>Wir verkaufen Ihre Daten nicht und geben sie nicht an Werbetreibende weiter.</p>
        </Section>

        <Section title="5. Speicherdauer">
          <p>Wir speichern Ihre Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist. Abgelaufene Daten werden täglich automatisch gelöscht:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Abgeschlossene oder stornierte Termine: 36 Monate nach dem Termin</li>
            <li>Stylisten-Notizen: 36 Monate nach der letzten Änderung</li>
            <li>Benachrichtigungen im Kundenkonto: 12 Monate</li>
            <li>Wartelisten-Einträge: 6 Monate</li>
            <li>Kundenkonto: bis zur Löschung durch Sie</li>
            <li>Protokolle Ihrer Cookie-Einwilligung: [Dauer festlegen, z.&nbsp;B. 3 Jahre] zum Nachweis der Einwilligung</li>
          </ul>
          <p>Gesetzliche Aufbewahrungspflichten (z.&nbsp;B. nach HGB und AO für Rechnungen) bleiben unberührt.</p>
        </Section>

        <Section title="6. Cookies und lokale Speicherung">
          <p>
            Wir speichern Ihre Cookie-Auswahl und Ihre Spracheinstellung lokal in Ihrem Browser. Diese
            Speicherung ist technisch notwendig und kann nicht deaktiviert werden. Analyse-Cookies werden nur
            gesetzt, wenn Sie im Cookie-Banner ausdrücklich zustimmen.
          </p>
          <p>
            Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen oder ändern — über den
            Link <B>„Cookie-Einstellungen“</B> im Fußbereich der Startseite oder indem Sie die Website-Daten in
            Ihrem Browser löschen.
          </p>
        </Section>

        <Section title="7. Ihre Rechte">
          <p>Sie haben jederzeit das Recht auf:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)</li>
            <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
          </ul>
          <p>Einige Rechte können Sie direkt selbst in Ihrem Kundenkonto ausüben:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><B>Daten bearbeiten</B> — Mein Konto → Profil</li>
            <li><B>Daten exportieren</B> — Mein Konto → Daten exportieren</li>
            <li><B>Konto löschen</B> — Mein Konto → Konto löschen</li>
          </ul>
          <p>Für alle weiteren Anliegen wenden Sie sich bitte an [kontakt@ihre-domain.de].</p>
        </Section>

        <Section title="8. Beschwerderecht bei der Aufsichtsbehörde">
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für uns zuständig ist
            das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach,{" "}
            <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer" className="text-gold-400 underline">www.lda.bayern.de</a>.
          </p>
        </Section>

        <Section title="9. Pflicht zur Bereitstellung">
          <p>
            Für eine Online-Terminbuchung benötigen wir Ihren Namen und eine Kontaktmöglichkeit. Ohne diese
            Angaben ist eine Online-Buchung nicht möglich — Sie können uns aber jederzeit telefonisch erreichen
            oder ohne Termin vorbeikommen.
          </p>
        </Section>
      </div>
    </main>
  );
}
