import { QrGlyph } from "./Qr";
import { Scene } from "./Scene";
import type { PhoneSpec } from "./specs";
import s from "./scenes2.module.css";

/**
 * Generic "scan and see" scene: a printed card with a QR, the beam, and the phone showing what
 * the visitor gets. One component for every QR type and sector; only the content changes.
 */
export function PhoneScene({
  spec,
  label,
  tone = "mint",
  active,
}: {
  spec: PhoneSpec;
  label: string;
  tone?: "mint" | "lilac" | "sun" | "peach";
  active?: boolean;
}) {
  return (
    <Scene
      active={active}
      label={`Animazione: ${label}`}
      caption="Cosa vede chi scansiona. Contenuto di esempio."
      tone={tone}
    >
      <div className={s.pStage} style={{ ["--accent" as string]: spec.accent }}>
        <div className={s.pCard}>
          <span className={s.pCardLabel}>{spec.label}</span>
          <div className={s.pQr}>
            <QrGlyph />
            <i className={s.pBeam} />
          </div>
        </div>
        <div className={s.pPhone}>
          <span className={s.pNotch} />
          <div className={s.pScreen}>
            <header>
              <b>{spec.title}</b>
              {spec.sub && <small>{spec.sub}</small>}
            </header>
            <ul>
              {spec.rows.map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  {v && <b>{v}</b>}
                </li>
              ))}
            </ul>
            <span className={s.pCta}>{spec.cta}</span>
          </div>
        </div>
        <span className={s.pBadge}>Si apre subito</span>
      </div>
    </Scene>
  );
}
