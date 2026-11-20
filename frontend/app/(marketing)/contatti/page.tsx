import { ContactForm } from "@/components/site/ContactForm";
import { Crumbs, Hero, Section } from "@/components/site/blocks";
import { pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Contatti: scrivici, rispondiamo in italiano",
  description:
    "Hai una domanda su Vorya QR, sui piani o sulla fatturazione? Scrivici dal modulo: ti rispondiamo il prima possibile.",
  path: "/contatti",
});

export default function ContactPage() {
  return (
    <>
      <Crumbs items={[{ label: "Contatti", href: "/contatti" }]} />
      <Hero
        eyebrow="Contatti"
        title="Scrivici, rispondiamo noi"
        lead="Domande sui piani, sulla fatturazione o su come usare i QR: raccontaci cosa ti serve."
        art="contact"
      />
      <Section>
        <ContactForm />
      </Section>
    </>
  );
}
