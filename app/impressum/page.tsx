import Link from "next/link";

export const metadata = { title: "Impressum | Dhurdur" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-serif text-gold-400 mb-3">{title}</h2>
      <div className="text-zinc-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 md:px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-gold-400 transition-colors">
          ← Zurück zu Dhurdur
        </Link>

        <h1 className="text-3xl md:text-4xl font-serif mt-6 mb-2">Impressum</h1>

        <div className="mb-12 p-4 border border-gold-700/60 bg-gold-900/20 text-gold-200 text-xs leading-relaxed">
          Die Angaben in eckigen Klammern müssen vor dem Livegang mit den echten Unternehmensdaten
          ausgefüllt werden — ein unvollständiges Impressum ist ein Abmahnrisiko (§ 5 DDG). Den finalen
          Text bitte von einem Anwalt oder einem Dienst wie eRecht24 prüfen lassen und diesen Hinweis entfernen.
        </div>

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

        <Section title="Verbraucherstreitbeilegung">
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen. [Anpassen, falls dies nicht zutrifft.]
          </p>
        </Section>
      </div>
    </main>
  );
}