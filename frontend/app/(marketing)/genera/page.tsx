import Link from "next/link";
import { Crumbs, CtaBand, FaqList, Hero, Section } from "@/components/site/blocks";
import { PublicGenerator } from "@/components/site/generator/PublicGenerator";
import { pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Generatore di QR code gratis, senza registrazione",
  description:
    "Crea QR code per sito web, vCard, Wi-Fi, testo, email, SMS, telefono e WhatsApp. Scarica PNG e SVG gratis, senza filigrana e senza registrarti.",
  path: "/genera",
});

const FAQ = [
  {
    q: "Il generatore è davvero gratuito?",
    a: "Sì: puoi creare e scaricare in PNG e SVG tutti i QR statici che vuoi, senza registrarti, senza email e senza filigrana.",
  },
  {
    q: "I QR creati qui scadono?",
    a: "No. Sono QR statici: il contenuto è scritto direttamente nel codice, quindi funzionano per sempre e senza internet (quando il contenuto non ne ha bisogno).",
  },
  {
    q: "Posso modificare un QR dopo averlo stampato?",
    a: "Un QR statico no. Se ti serve poterlo cambiare e vedere le scansioni, crea un QR dinamico: è gratis anche questo, con un account.",
  },
  {
    q: "Salvate il mio logo o i miei dati?",
    a: "No. Il logo resta nel tuo browser e viene usato solo per generare l'anteprima: non viene salvato. Contiamo solo, in forma anonima, quanti QR vengono generati.",
  },
];

export default function GeneraPage() {
  return (
    <>
      <Crumbs items={[{ label: "Genera un QR gratis", href: "/genera" }]} />
      <Hero
        eyebrow="Generatore gratuito"
        title="Genera il tuo QR code, gratis e senza registrarti"
        lead="Scegli il tipo, personalizza lo stile e scarica in PNG o SVG. Niente filigrana, niente pubblicità."
      />
      <Section>
        <PublicGenerator landing="/genera" />
      </Section>
      <FaqList items={FAQ} />
      <Section
        tone="soft"
        title="Statico o dinamico?"
        lead="Un QR statico contiene i dati nel codice. Un QR dinamico punta a un indirizzo breve che puoi cambiare dopo la stampa e permette di misurare le scansioni."
      >
        <p>
          <Link href="/guide/qr-statico-o-dinamico">Leggi la guida: QR statico o dinamico</Link>
        </p>
      </Section>
      <CtaBand
        title="Vuoi poterlo modificare dopo la stampa?"
        text="Crea un account gratis: i QR dinamici si cambiano quando vuoi e mostrano quante persone li scansionano."
      />
    </>
  );
}
