import { Illustration, art } from "./Illustration";
import { Badge, Blob, CHECK, CLOCK, CROSS, LOCK, MiniQr, Paper, Stroke } from "./parts";

/** Locked feature (plan), 404, access denied, trial expired, suspended account. */

export function Locked() {
  return (
    <Illustration size={160}>
      <Blob x={120} y={96} r={56} tone="lilac" />
      <g className={art.float}>
        <Paper x={78} y={50} w={84} h={84} />
        <rect x={98} y={70} width={44} height={10} rx={5} fill="var(--art-line)" />
        <rect x={98} y={88} width={30} height={10} rx={5} fill="var(--art-line)" />
      </g>
      <Badge x={156} y={124} tone="lilac">
        {LOCK}
      </Badge>
    </Illustration>
  );
}

export function NotFound() {
  return (
    <Illustration>
      <Blob x={120} y={96} r={64} tone="mint" />
      <g className={art.float}>
        <Paper x={74} y={44} w={92} h={92} r={16} />
        <MiniQr x={92} y={62} cell={8} tone="dark" />
        <rect x={118} y={84} width={30} height={30} rx={6} fill="var(--art-paper)" />
        <text
          x={133}
          y={105}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill="var(--art-dark)"
        >
          ?
        </text>
      </g>
      <Stroke d="M42 54c10-12 24-14 34-6" />
      <Stroke d="M178 130c12 4 22 0 28-10" tone="dark" width={2.5} />
    </Illustration>
  );
}

export function AccessDenied() {
  return (
    <Illustration>
      <Blob x={120} y={100} r={60} tone="peach" />
      <g className={art.float}>
        <path
          d="M120 40l40 14v32c0 26-18 42-40 50-22-8-40-24-40-50V54Z"
          fill="var(--art-paper)"
          stroke="var(--art-line)"
          strokeWidth={1.5}
        />
        <path d="M120 54l26 9v22c0 17-11 28-26 34Z" fill="var(--art-mint)" />
      </g>
      <Badge x={156} y={124} tone="danger">
        {LOCK}
      </Badge>
    </Illustration>
  );
}

export function TrialExpired() {
  return (
    <Illustration>
      <Blob x={110} y={100} r={60} tone="peach" />
      <g className={art.float}>
        <circle
          cx={112}
          cy={88}
          r={42}
          fill="var(--art-paper)"
          stroke="var(--art-line)"
          strokeWidth={1.5}
        />
        <path
          d="M112 88V62M112 88l18 12"
          stroke="var(--art-dark)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={112} cy={88} r={4} fill="var(--art-ink)" />
      </g>
      <Stroke d="M162 60c12 2 20 12 20 24" />
      <Badge x={156} y={126} tone="peach">
        {CLOCK}
        <circle cx={8} cy={8} r={6} />
      </Badge>
    </Illustration>
  );
}

export function Suspended() {
  return (
    <Illustration>
      <Blob x={120} y={100} r={60} tone="danger" />
      <g className={art.float}>
        <Paper x={72} y={48} w={96} h={88} />
        <rect x={96} y={72} width={14} height={40} rx={4} fill="var(--art-dark)" />
        <rect x={130} y={72} width={14} height={40} rx={4} fill="var(--art-dark)" />
      </g>
      <Badge x={160} y={128} tone="danger">
        {CROSS}
      </Badge>
    </Illustration>
  );
}

/** 0.3: password-protected link. */
export function PasswordGate() {
  return (
    <Illustration>
      <Blob x={118} y={98} r={60} tone="lilac" />
      <Blob x={190} y={60} r={22} tone="mint" slow />
      <g className={art.float}>
        <Paper x={70} y={52} w={100} h={84} />
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={94 + i * 17}
            cy={96}
            r={6}
            fill="var(--art-dark)"
            className={art.pulse}
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
        <rect x={86} y={68} width={68} height={8} rx={4} fill="var(--art-line)" />
        <rect x={86} y={112} width={40} height={8} rx={4} fill="var(--art-mint)" />
      </g>
      <Badge x={164} y={128} tone="lilac">
        {LOCK}
      </Badge>
      <Stroke d="M40 64c10-14 24-18 36-12" />
    </Illustration>
  );
}

/** 0.3: static QR warning. Palette art + danger red; the QR "freezes" (slow pulse + ring). */
export function StaticWarning() {
  return (
    <Illustration size={150}>
      <Blob x={120} y={96} r={58} tone="danger" />
      <Blob x={190} y={52} r={20} tone="peach" slow />
      <g className={art.float}>
        <Paper x={74} y={46} w={92} h={92} r={16} />
        <MiniQr x={92} y={64} cell={8} tone="dark" />
        <path
          d="M70 142h100"
          stroke="var(--color-danger)"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.35}
        />
      </g>
      <g className={art.pulse}>
        <circle cx={166} cy={46} r={17} fill="var(--color-danger)" />
        <path d="M166 38v10" stroke="var(--art-paper)" strokeWidth={3.2} strokeLinecap="round" />
        <circle cx={166} cy={54} r={2} fill="var(--art-paper)" />
      </g>
      <Stroke d="M44 70c8-12 20-16 32-12" tone="dark" width={2.5} />
    </Illustration>
  );
}

/** 0.3 import: a stack of rows turning into QR codes. state: running | done | errors */
export function ImportArt({ state }: { state: "running" | "done" | "errors" }) {
  return (
    <Illustration>
      <Blob x={118} y={98} r={58} tone={state === "errors" ? "danger" : "mint"} />
      <Blob x={190} y={58} r={22} tone={state === "done" ? "peach" : "lilac"} slow />
      <g className={art.float}>
        <Paper x={52} y={50} w={86} h={86} />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={64}
            y={64 + i * 16}
            width={62 - (i % 2) * 14}
            height={7}
            rx={3.5}
            fill="var(--art-line)"
          />
        ))}
      </g>
      <g className={art.floatSlow}>
        <Paper x={142} y={64} w={54} h={54} r={10} />
        <MiniQr x={152} y={74} cell={5} tone="dark" />
      </g>
      {state === "running" && <Stroke d="M138 90c2-10 4-10 6 0" width={2.5} />}
      {state === "running" && <Stroke d="M112 150c12 8 28 8 40 0" />}
      {state === "done" && (
        <Badge x={176} y={122} tone="green">
          {CHECK}
        </Badge>
      )}
      {state === "errors" && (
        <Badge x={176} y={122} tone="danger">
          {CROSS}
        </Badge>
      )}
    </Illustration>
  );
}
