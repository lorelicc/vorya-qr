import { Check, Lock, X } from "lucide-react";
import { Scene } from "./Scene";
import s from "./scenes2.module.css";

type Kind = "termini" | "privacy" | "cookie";
const TONE = { termini: "lilac", privacy: "mint", cookie: "sun" } as const;

/** Illustration for the legal pages: terms (checked sheet), privacy (shield), cookies (switches). */
export function LegalScene({ kind, active }: { kind: Kind; active?: boolean }) {
  return (
    <Scene
      active={active}
      tone={TONE[kind]}
      label={
        {
          termini: "Animazione: un documento con le regole del servizio che si spuntano una a una",
          privacy: "Animazione: uno scudo protegge i dati; l’indirizzo IP non viene salvato",
          cookie: "Animazione: i cookie tecnici sono attivi, quelli di profilazione non sono usati",
        }[kind]
      }
      caption="Scritto in modo semplice."
    >
      {kind === "termini" && (
        <div className={s.lStage}>
          <div className={s.lDoc}>
            <b>Termini di servizio</b>
            {["Cosa offriamo", "Prova e piani", "Uso consentito", "Contenuti tuoi", "Abusi"].map(
              (t, i) => (
                <span key={t} className={s.lRow} data-i={i}>
                  <i className={s.lLine} />
                  <em>
                    <Check size={14} />
                  </em>
                  {t}
                </span>
              ),
            )}
          </div>
          <span className={s.lSeal}>OK</span>
        </div>
      )}
      {kind === "privacy" && (
        <div className={s.lStage}>
          <div className={s.lShield}>
            <Lock size={42} />
          </div>
          {["Nome", "Email", "Dispositivo"].map((t, i) => (
            <span key={t} className={s.lChip} data-i={i}>
              <Check size={14} /> {t}
            </span>
          ))}
          <span className={s.lNo}>
            <X size={14} /> Indirizzo IP <u>non salvato</u>
          </span>
        </div>
      )}
      {kind === "cookie" && (
        <div className={s.lStage}>
          <div className={s.lCookie}>
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} data-i={i} />
            ))}
          </div>
          <div className={s.lSwitches}>
            <span className={s.lSwitch} data-on="true">
              Cookie tecnici <b>Attivi</b>
              <i />
            </span>
            <span className={s.lSwitch}>
              Profilazione e terze parti <b>Non usati</b>
              <i />
            </span>
          </div>
        </div>
      )}
    </Scene>
  );
}
