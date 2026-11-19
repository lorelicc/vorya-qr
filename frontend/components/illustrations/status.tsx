import { Illustration, art } from "./Illustration";
import { Badge, Blob, CLOCK, CROSS, LOCK, MiniQr, Paper, Stroke } from "./parts";

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
