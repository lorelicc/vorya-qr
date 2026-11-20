import { BarChart3, Mail, Wine } from "lucide-react";
import { Cursor } from "./parts";
import { Scene } from "./Scene";
import s from "./scenes.module.css";

/**
 * Animated product scenes. Each one is plain HTML/CSS (see Scene.tsx); the markup is the FINAL
 * frame and scenes.module.css animates the way to it. Numbers are illustrative: every scene
 * says "dati di esempio" in its caption.
 */

type Props = { active?: boolean };

/* 5 — Menu: change a price, the phone updates. */
export function MenuScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: il ristoratore cambia un prezzo nell’editor e il menu sul telefono del cliente si aggiorna"
      caption="Un prezzo cambia e il menu si aggiorna. Dati di esempio."
      tone="sun"
    >
      <div className={s.mStage}>
        <div className={`${s.card} ${s.mEditor}`}>
          <b>Modifica voce</b>
          <label>
            <small>Nome</small>
            <span className={s.mInput}>Spritz</span>
          </label>
          <label>
            <small>Prezzo</small>
            <span className={s.mInput}>
              <span className={`${s.mPrice} ${s.mPriceA}`}>8,00 €</span>
              <span className={`${s.mPrice} ${s.mPriceB}`}>9,00 €</span>
            </span>
          </label>
          <span className={s.mPublish}>Pubblica</span>
        </div>
        <div className={s.mPhone}>
          <span className={s.hNotch} />
          <header>
            <Wine size={14} /> Carta
          </header>
          <ul className={s.rows}>
            <li className={s.mFlash}>
              <span>Spritz</span>
              <b>
                <span className={s.mOld}>8 €</span>
                <span className={s.mNew}>9 €</span>
              </b>
            </li>
            <li>
              <span>Negroni</span>
              <b>9 €</b>
            </li>
            <li>
              <span>Prosecco</span>
              <b>6 €</b>
            </li>
            <li>
              <span>Tagliere</span>
              <b>12 €</b>
            </li>
          </ul>
          <span className={s.mUpdated}>Aggiornato ora</span>
        </div>
        <Cursor className={s.mCursor} />
      </div>
    </Scene>
  );
}

/* 7 — Automatic email report. */
export function ReportScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: il primo del mese arriva nella casella un report con le scansioni"
      caption="Il report arriva da solo, con disiscrizione in un clic. Dati di esempio."
      tone="sun"
    >
      <div className={s.rStage}>
        <div className={`${s.card} ${s.rInbox}`}>
          <b>
            <Mail size={14} /> Posta in arrivo
          </b>
          <p className={s.rMuted} />
          <p className={s.rMuted} />
          <p className={s.rNew}>
            <i>1</i>
            <span>
              <b>Vorya QR</b> Il tuo report di novembre
            </span>
          </p>
        </div>
        <div className={`${s.card} ${s.rMail}`}>
          <header>
            <BarChart3 size={16} /> Report di novembre
          </header>
          <div className={s.rBars}>
            {[40, 55, 48, 72, 66, 90].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className={s.rKpi}>
            <span>
              <small>Scansioni</small>
              <b>1.284</b>
            </span>
            <span>
              <small>Rispetto a ottobre</small>
              <b>+18%</b>
            </span>
          </div>
          <u>Annulla iscrizione ai report</u>
        </div>
        <span className={s.rWhen}>Ogni 1° del mese, alle 07:00</span>
      </div>
    </Scene>
  );
}
