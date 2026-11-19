import { Check } from "lucide-react";
import styles from "./wizard.module.css";

export const STEPS = ["Tipo", "Contenuto", "Design", "Salva e scarica"] as const;

/** Progress indicator: the bar fills with a transform (scaleX), steps already done get a check. */
export function Stepper({
  step,
  onJump,
  maxReached,
}: {
  step: number;
  onJump: (i: number) => void;
  maxReached: number;
}) {
  return (
    <nav className={styles.stepper} aria-label="Avanzamento">
      <div className={styles.track} aria-hidden="true">
        <span style={{ transform: `scaleX(${step / (STEPS.length - 1)})` }} />
      </div>
      <ol>
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? "done" : i === step ? "current" : "todo"}>
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={i > maxReached}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={styles.dot}>
                {i < step ? <Check size={14} aria-hidden="true" /> : i + 1}
              </span>
              <span className={styles.label}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
