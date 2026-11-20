import { Check, GripVertical, MessageCircle, Sparkles, Star } from "lucide-react";
import { QrGlyph } from "./Qr";
import { Scene } from "./Scene";
import s from "./scenes2.module.css";

type Props = { active?: boolean };

/* What happens when the subscription ends: only the oldest codes that fit the plan stay active. */
export function PlanScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: quando l’abbonamento finisce si passa al piano Free, restano attivi i 2 QR dinamici più vecchi e gli altri vengono sospesi, senza cancellare nulla"
      caption="Esempio con 6 QR dinamici. Dati di esempio."
      tone="mint"
    >
      <div className={s.gStage}>
        <div className={s.gPlans}>
          <span className={s.gPaid}>Piano a pagamento</span>
          <span className={s.gArrow}>→</span>
          <span className={s.gFree}>Piano Free</span>
        </div>
        <div className={s.gGrid}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={s.gTile} data-n={n}>
              <QrGlyph />
              <span className={s.gName}>QR {n}</span>
              <span className={s.gPill}>
                <i className={s.gOn}>Attivo</i>
                <i className={s.gOff}>Sospeso</i>
              </span>
            </div>
          ))}
        </div>
        <p className={s.gNote}>
          <Sparkles size={16} /> Torni a un piano: si riattivano subito. Non cancelliamo nulla.
        </p>
      </div>
    </Scene>
  );
}

/* Hosted pages: blocks added in the editor appear on the phone. */
export function PagesScene({ active }: Props) {
  const blocks = [
    "Intestazione",
    "Pulsante · Chiama",
    "Pulsante · Come arrivare",
    "Link · Sito web",
  ];
  return (
    <Scene
      active={active}
      label="Animazione: si aggiungono blocchi nell’editor e la pagina sul telefono si costruisce"
      caption="Un editor a blocchi con anteprima dal vivo. Contenuto di esempio."
      tone="lilac"
    >
      <div className={s.aStage}>
        <div className={`${s.card2} ${s.aEditor}`}>
          <b>Blocchi della pagina</b>
          {blocks.map((b) => (
            <span key={b} className={s.aBlock}>
              <GripVertical size={16} /> {b}
            </span>
          ))}
        </div>
        <div className={s.aPhone}>
          <div className={s.aScreen}>
            <header>La tua attività</header>
            <span className={s.aBtn}>Chiama</span>
            <span className={s.aBtn}>Come arrivare</span>
            <span className={s.aLink}>esempio.it</span>
          </div>
        </div>
      </div>
    </Scene>
  );
}

/* Several companies in one account. */
const COMPANIES = [
  ["Bar Centrale", 12],
  ["Studio Legale", 7],
  ["Boutique", 21],
] as const;
export function CompaniesScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: più aziende nello stesso account, ognuna con i suoi QR, separata dalle altre"
      caption="Più aziende, un solo account. Dati di esempio."
      tone="sun"
    >
      <div className={s.cStage}>
        <div className={`${s.card2} ${s.cList}`}>
          <b>Aziende</b>
          {COMPANIES.map(([name, n], i) => (
            <span key={name} className={s.cItem} data-i={i}>
              {name}
              <em>{n} QR</em>
            </span>
          ))}
        </div>
        <div className={`${s.card2} ${s.cPanel}`}>
          {COMPANIES.map(([name], i) => (
            <div key={name} className={s.cRows} data-i={i}>
              <b>{name}</b>
              {[0, 1, 2].map((r) => (
                <span key={r} className={s.cRow}>
                  <QrGlyph /> <i /> <u />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Scene>
  );
}

/* Bulk import from CSV. */
export function ImportScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: le righe di un file CSV diventano tanti QR in pochi secondi"
      caption="Dal CSV ai QR, tutti insieme. Dati di esempio."
      tone="peach"
    >
      <div className={s.iStage}>
        <div className={`${s.card2} ${s.iCsv}`}>
          <b>cartellini.csv</b>
          {[
            "Tavolo 1, esempio.it/1",
            "Tavolo 2, esempio.it/2",
            "Tavolo 3, esempio.it/3",
            "Tavolo 4, esempio.it/4",
          ].map((r) => (
            <span key={r}>{r}</span>
          ))}
        </div>
        <span className={s.iArrow}>→</span>
        <div className={s.iGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className={s.iTile} data-n={n}>
              <QrGlyph />
            </div>
          ))}
        </div>
        <span className={s.iDone}>
          <Check size={16} /> 8 QR creati
        </span>
      </div>
    </Scene>
  );
}

/* FAQ: questions and straight answers. */
const QA = [
  ["Posso disdire quando voglio?", "Sì, in qualsiasi momento, senza penali."],
  ["Il piano Free ha pubblicità?", "Mai, nemmeno nel Free."],
  ["I QR statici scadono?", "No: il contenuto è nel codice."],
] as const;
export function FaqScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: domande frequenti con risposte dirette"
      caption="Risposte chiare, senza giri di parole."
      tone="lilac"
    >
      <div className={s.fStage}>
        {QA.map(([q, a], i) => (
          <div key={q} className={s.fPair} data-i={i}>
            <p className={s.fQ}>
              <MessageCircle size={16} /> {q}
            </p>
            <p className={s.fA}>
              <Check size={16} /> {a}
            </p>
          </div>
        ))}
      </div>
    </Scene>
  );
}

/* Pricing: monthly/yearly switch and the highlighted plan. */
export function PricingScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: un interruttore passa dal prezzo mensile a quello annuale, più conveniente"
      caption="Prezzi di esempio: quelli veri sono nella tabella qui sotto."
      tone="sun"
    >
      <div className={s.xStage}>
        <div className={s.xSwitch}>
          <span className={s.xThumb} />
          <b>Mensile</b>
          <b>Annuale</b>
        </div>
        <span className={s.xSave}>Risparmi</span>
        <div className={`${s.card2} ${s.xCard}`}>
          <span className={s.xRibbon}>
            <Star size={14} /> Il più scelto
          </span>
          <b className={s.xName}>Plus</b>
          <div className={s.xPrice}>
            <span className={s.xAmt}>
              <span className={s.xMonth}>10 €</span>
              <span className={s.xYear}>8 €</span>
            </span>
            <small>/ mese</small>
          </div>
          <i className={s.xLine} />
          <i className={s.xLine} />
          <i className={s.xLine} />
        </div>
      </div>
    </Scene>
  );
}
