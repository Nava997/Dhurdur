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
          ← Back to Dhurdur
        </Link>

        <h1 className="text-3xl md:text-4xl font-serif mt-6 mb-2">Impressum</h1>

        <Section title="Angaben gemäß § 5 DDG">
          <p>Dhurdur</p>
          <p>Inh. Oliver Hayes</p>
          <p>Obere Str. 30</p>
          <p>97421 Schweinfurt</p>
        </Section>

        <Section title="Kontakt">
          <p>Telefon: 01523 2163823</p>
          <p>E-Mail: info@dhurdur.de</p>
        </Section>

        <Section title="Umsatzsteuer-ID">
          <p>Kleinunternehmer gemäß § 19 UStG — keine Umsatzsteuer-ID ausgewiesen</p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>Oliver Hayes, Obere Str. 30, 97421 Schweinfurt</p>
        </Section>

        <Section title="EU-Streitschlichtung">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-gold-400 underline">
              https://ec.europa.eu/consumers/odr/
            </a>
            . Unsere E-Mail-Adresse finden Sie oben. Wir sind nicht bereit oder verpflichtet, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>
      </div>
    </main>
  );
}