import styles from "./header.module.css";

const Q = [
  [0, 0], [2, 0], [3, 1], [1, 1], [0, 2], [2, 2], [1, 3], [3, 3], [3, 0], [0, 3],
] as const; // prettier-ignore

/** Small tinted illustrations for the mega-menu intro cards (colours come from the card). */
export function MegaArt({ kind }: { kind: string }) {
  return (
    <svg className={styles.art} viewBox="0 0 240 160" aria-hidden="true">
      {kind === "prodotto" && (
        <>
          <rect
            className={styles.f1}
            x="34"
            y="22"
            width="120"
            height="96"
            rx="16"
            fill="var(--a)"
            opacity=".28"
          />
          <g className={styles.f2}>
            <rect x="62" y="44" width="124" height="92" rx="16" fill="var(--a)" />
            {Q.map(([x, y]) => (
              <rect
                key={`${x}${y}`}
                x={76 + x * 14}
                y={58 + y * 14}
                width="10"
                height="10"
                rx="3"
                fill="var(--c)"
              />
            ))}
            <rect x="140" y="62" width="34" height="8" rx="4" fill="var(--b)" />
            <rect x="140" y="78" width="26" height="8" rx="4" fill="var(--b)" opacity=".6" />
            <rect x="140" y="100" width="8" height="22" rx="3" fill="var(--c)" />
            <rect x="154" y="90" width="8" height="32" rx="3" fill="var(--c)" />
            <rect x="168" y="80" width="8" height="42" rx="3" fill="var(--b)" />
          </g>
          <circle className={styles.f3} cx="196" cy="36" r="14" fill="var(--b)" />
        </>
      )}
      {kind === "tipi" && (
        <>
          <g className={styles.f1}>
            <rect
              x="26"
              y="40"
              width="84"
              height="92"
              rx="14"
              fill="var(--a)"
              opacity=".45"
              transform="rotate(-12 68 86)"
            />
          </g>
          <g className={styles.f3}>
            <rect
              x="130"
              y="40"
              width="84"
              height="92"
              rx="14"
              fill="var(--a)"
              opacity=".45"
              transform="rotate(12 172 86)"
            />
          </g>
          <g className={styles.f2}>
            <rect x="78" y="22" width="88" height="104" rx="14" fill="var(--a)" />
            <rect x="94" y="40" width="30" height="30" rx="8" fill="var(--c)" />
            <rect x="94" y="82" width="56" height="8" rx="4" fill="var(--b)" />
            <rect x="94" y="98" width="40" height="8" rx="4" fill="var(--b)" opacity=".6" />
            <circle cx="142" cy="54" r="9" fill="var(--b)" />
          </g>
        </>
      )}
      {kind === "soluzioni" && (
        <>
          <g className={styles.f2}>
            <rect x="38" y="64" width="164" height="76" rx="10" fill="var(--a)" />
            <rect x="30" y="34" width="180" height="34" rx="10" fill="var(--b)" />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x={30 + i * 36}
                y="34"
                width="18"
                height="34"
                fill="var(--c)"
                opacity=".35"
              />
            ))}
            <rect x="52" y="84" width="46" height="56" rx="8" fill="var(--c)" />
            <rect x="120" y="82" width="62" height="30" rx="8" fill="var(--c)" opacity=".4" />
          </g>
          <g className={styles.f1}>
            <rect x="146" y="92" width="44" height="44" rx="10" fill="#fff" />
            {Q.slice(0, 6).map(([x, y]) => (
              <rect
                key={`${x}${y}`}
                x={153 + x * 9}
                y={99 + y * 9}
                width="6"
                height="6"
                rx="2"
                fill="var(--c)"
              />
            ))}
          </g>
        </>
      )}
      {kind === "risorse" && (
        <>
          <g className={styles.f1}>
            <rect x="26" y="26" width="120" height="70" rx="16" fill="var(--a)" />
            <path d="M54 96 L48 122 L80 96 Z" fill="var(--a)" />
            <rect x="46" y="46" width="70" height="8" rx="4" fill="var(--b)" />
            <rect x="46" y="64" width="50" height="8" rx="4" fill="var(--b)" opacity=".6" />
          </g>
          <g className={styles.f2}>
            <rect x="100" y="64" width="116" height="66" rx="16" fill="var(--b)" />
            <path d="M190 130 L198 150 L168 130 Z" fill="var(--b)" />
            <text
              x="158"
              y="112"
              textAnchor="middle"
              fontSize="40"
              fontWeight="800"
              fill="var(--c)"
            >
              ?
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
