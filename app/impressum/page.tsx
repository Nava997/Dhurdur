import Link from "next/link";
import { LEGAL } from "@/lib/legal";

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

        <Section title="Angaben gemäß § 5 DDG">
          <p>{LEGAL.businessName}</p>
          <p>Inh. {LEGAL.ownerName}</p>
          <p>{LEGAL.street}</p>
          <p>{LEGAL.city}</p>
        </Section>

        <Section title="Kontakt">
          <p>Telefon: {LEGAL.phone}</p>
          <p>E-Mail: {LEGAL.email}</p>
        </Section>

        <Section title="Umsatzsteuer">
          {LEGAL.smallBusiness
            ? <p>Kleinunternehmer gemäß § 19 UStG — es wird keine Umsatzsteuer berechnet und keine Umsatzsteuer-ID ausgewiesen.</p>
            : <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: siehe Rechnung.</p>}
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>{LEGAL.ownerName}, {LEGAL.street}, {LEGAL.city}</p>
        </Section>

        <Section title="Verbraucherstreitbeilegung">
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>
      </div>
    </main>
  );
}
