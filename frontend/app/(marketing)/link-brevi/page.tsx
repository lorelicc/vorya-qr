import { Bullets, Crumbs, CtaBand, FaqList, Hero, Section } from "@/components/site/blocks";
import { featureScene } from "@/components/site/scenes/for";
import { ShortLinkTab } from "@/components/site/generator/ShortLinkTab";
import { pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Accorciatore di link gratis, in italiano e senza pubblicità",
  description:
    "Accorcia i tuoi link, personalizza il back-half e misura i clic. Anteprima gratuita; per creare il link basta un account gratuito.",
  path: "/link-brevi",
});

const FAQ = [
  {
    q: "Perché devo registrarmi per creare il link?",
    a: "Per evitare link anonimi usati per abusi: un account gratuito ti permette di gestire, modificare e misurare i tuoi link. Registrarsi è gratis e non richiede carta di credito.",
  },
  {
    q: "Il link breve scade?",
    a: "Non per tempo. Se l'abbonamento finisce passi al Free: restano attivi i 2 link dinamici più vecchi, gli altri vengono sospesi finché non torni a un piano.",
  },
  {
    q: "Posso scegliere la parte finale del link?",
    a: "Sì, nei piani che includono il back-half personalizzato, per esempio qr.vorya.it/promo-estate.",
  },
  {
    q: "Posso vedere quante persone cliccano?",
    a: "Sì: scansioni e clic nel tempo, dispositivi e paesi. Nessun indirizzo IP viene salvato.",
  },
];

export default function ShortLinksPage() {
  return (
    <>
      <Crumbs tone="dark" items={[{ label: "Link brevi", href: "/link-brevi" }]} />
      <Hero
        eyebrow="Link brevi"
        title="Accorcia i tuoi link, misura i clic"
        lead="Link brevi che puoi cambiare dopo averli condivisi, con scadenza, password e destinazioni programmate nei piani che le includono."
        art="links"
        scene={featureScene("link-brevi")}
        tone="dark"
      />
      <Section>
        <ShortLinkTab />
      </Section>
      <Section card tone="sun" art="links" title="Cosa puoi fare">
        <Bullets
          items={[
            "Cambiare la destinazione quando vuoi",
            "Back-half personalizzato e modelli UTM",
            "Generare il QR dello stesso link in un clic",
            "Statistiche e report per i tuoi clienti",
          ]}
        />
      </Section>
      <FaqList items={FAQ} />
      <CtaBand title="Crea il tuo primo link breve" text="Registrati gratis: ci vuole un minuto." />
    </>
  );
}
