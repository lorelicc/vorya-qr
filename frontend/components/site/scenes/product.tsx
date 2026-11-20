import { Check, Link2 } from "lucide-react";
import { Cursor, Rows } from "./parts";
import { QrGlyph } from "./Qr";
import { Scene } from "./Scene";
import s from "./scenes.module.css";

/**
 * Animated product scenes. Each one is plain HTML/CSS (see Scene.tsx); the markup is the FINAL
 * frame and scenes.module.css animates the way to it. Numbers are illustrative: every scene
 * says "dati di esempio" in its caption.
 */

type Props = { active?: boolean };

/* 1 — Print once, change the destination whenever you want. */
export function HeroScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: il QR è stampato una volta, la destinazione si cambia dalla dashboard e la stessa scansione apre una pagina nuova"
      caption="Il QR resta uguale, cambia la pagina. Dati di esempio."
      tone="mint"
    >
      <div className={s.hStage}>
        <div className={s.hCard}>
          <span className={s.hCardLabel}>Scansiona il menu</span>
          <div className={s.hQr}>
            <QrGlyph />
            <i className={s.hBeam} />
          </div>
          <span className={s.hCardUrl}>qr.vorya.it/r/Ab3dEf7</span>
        </div>

        <div className={s.hPhone}>
          <span className={s.hNotch} />
          <div className={`${s.hScreen} ${s.hScreenA}`}>
            <header>Menu estate</header>
            <Rows
              items={[
                ["Spritz", "8 €"],
                ["Insalata di mare", "14 €"],
                ["Gelato", "5 €"],
              ]}
            />
          </div>
          <div className={`${s.hScreen} ${s.hScreenB}`}>
            <header>Menu autunno</header>
            <Rows
              items={[
                ["Vino caldo", "6 €"],
                ["Risotto alla zucca", "13 €"],
                ["Castagnaccio", "6 €"],
              ]}
            />
          </div>
        </div>

        <div className={s.hChip}>
          <small>Destinazione del QR</small>
          <div className={s.hField}>
            <span className={`${s.hText} ${s.hTextA}`}>menu-estate</span>
            <span className={`${s.hText} ${s.hTextB}`}>menu-autunno</span>
          </div>
          <span className={s.hSave}>
            <span className={s.hSaveLabel}>Salva</span>
            <span className={s.hSaved}>
              <Check size={14} /> Salvato
            </span>
          </span>
        </div>
        <span className={s.hBadge}>Stesso QR, nuova pagina</span>
        <Cursor className={s.hCursor} />
      </div>
    </Scene>
  );
}

/* 2 — From a huge URL to a short link, shared, with live clicks. */
export function LinkScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: un indirizzo lunghissimo diventa un link breve, viene copiato, condiviso in chat e i click aumentano"
      caption="Link breve, copiato e condiviso. Dati di esempio."
      tone="mint"
    >
      <div className={s.lStage}>
        <div className={s.lLong}>
          <Link2 size={16} />
          <span>
            https://www.ristorante-esempio.it/menu/estate/2025?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=aperitivo
          </span>
        </div>
        <div className={s.lShort}>
          <span>
            <b>qr.vorya.it/</b>aperitivo
          </span>
          <em className={s.lCopy}>
            <Check size={14} /> Copiato
          </em>
        </div>
        <div className={s.lChat}>
          <small>Chat</small>
          <p>
            Ecco il menu di stasera! <u>qr.vorya.it/aperitivo</u>
          </p>
        </div>
        <div className={s.lCount}>
          <small>Click</small>
          <div className={s.lWindow}>
            <div className={s.lNums}>
              <i>124</i>
              <i>125</i>
              <i>126</i>
              <i>127</i>
              <i>128</i>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}

/* 3 — Statistics. */
const DAYS = ["L", "M", "M", "G", "V", "S", "D"];
const BARS = [38, 46, 41, 62, 94, 80, 52];
const CITIES: [string, number][] = [
  ["Milano", 86],
  ["Roma", 64],
  ["Napoli", 41],
  ["Torino", 30],
];
export function StatsScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: le scansioni arrivano e compaiono nei grafici per giorno, città e dispositivo"
      caption="Scansioni per giorno, città e dispositivo. Dati di esempio."
      tone="lilac"
    >
      <div className={s.sStage}>
        <div className={`${s.card} ${s.sMain}`}>
          <div className={s.sHead}>
            <b>Scansioni</b>
            <span className={s.sTotal}>
              <span className={s.sTotalWindow}>
                <span className={s.sTotalNums}>
                  <i>0</i>
                  <i>412</i>
                  <i>857</i>
                  <i>1.284</i>
                </span>
              </span>
            </span>
          </div>
          <div className={s.sBars}>
            {BARS.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} data-peak={h === 94}>
                <em>{DAYS[i]}</em>
              </span>
            ))}
          </div>
          <span className={s.sPeak}>Picco: venerdì sera</span>
        </div>
        <div className={`${s.card} ${s.sSide}`}>
          <b>Dispositivi</b>
          <div className={s.sDonutRow}>
            <i className={s.sDonut} />
            <ul>
              <li>
                <span data-c="a" /> iPhone
              </li>
              <li>
                <span data-c="b" /> Android
              </li>
            </ul>
          </div>
        </div>
        <div className={`${s.card} ${s.sCities}`}>
          <b>Città</b>
          {CITIES.map(([name, w]) => (
            <div key={name} className={s.sCity}>
              <span>{name}</span>
              <i style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <span className={s.sPrivacy}>Nessun indirizzo IP viene salvato</span>
      </div>
    </Scene>
  );
}

/* 4 — QR design with the scannability check. */
export function DesignScene({ active }: Props) {
  return (
    <Scene
      active={active}
      label="Animazione: il QR cambia colore, forma dei moduli e logo, con il controllo di leggibilità"
      caption="Colori, forme e logo con controllo di leggibilità. Dati di esempio."
      tone="peach"
    >
      <div className={s.dStage}>
        <div className={s.dSwatches}>
          <i data-c="green" />
          <i data-c="indigo" />
          <i data-c="coral" />
          <i data-c="ink" />
          <span className={s.dRing} />
        </div>
        <div className={s.dQrCard}>
          <div className={s.dQr}>
            <QrGlyph variant="square" className={s.dSquare} />
            <QrGlyph variant="round" className={s.dRound} />
            <span className={s.dLogo}>V</span>
          </div>
        </div>
        <div className={s.dCheck}>
          <Check size={16} /> Scansionabile
        </div>
        <div className={s.dStyles}>
          <span className={s.dStyleA}>Quadrati</span>
          <span className={s.dStyleB}>Tondi</span>
        </div>
        <Cursor className={s.dCursor} />
      </div>
    </Scene>
  );
}
