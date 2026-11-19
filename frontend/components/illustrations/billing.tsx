import { Illustration, art } from "./Illustration";
import { Badge, Blob, CHECK, CROSS, MiniQr, Paper, Stroke } from "./parts";

/** Billing (0.3): payment done, payment failed, plan canceled. Same weight and rules as the rest. */

function Card({ tone }: { tone: "ok" | "ko" }) {
  return (
    <g className={art.float}>
      <rect
        x={58}
        y={52}
        width={112}
        height={72}
        rx={12}
        fill="var(--art-paper)"
        stroke="var(--art-line)"
        strokeWidth={1.5}
      />
      <rect
        x={58}
        y={68}
        width={112}
        height={14}
        fill={tone === "ok" ? "var(--art-mint)" : "var(--art-line)"}
      />
      <rect x={70} y={96} width={34} height={8} rx={4} fill="var(--art-line)" />
      <rect x={70} y={110} width={22} height={6} rx={3} fill="var(--art-line)" />
      <circle cx={150} cy={104} r={8} fill="var(--art-mid)" opacity={0.5} />
    </g>
  );
}

export function PaymentOk() {
  return (
    <Illustration>
      <Blob x={116} y={98} r={60} tone="mint" />
      <Blob x={192} y={52} r={20} tone="peach" slow />
      <Card tone="ok" />
      <Badge x={164} y={56} tone="green">
        {CHECK}
      </Badge>
      <Stroke d="M40 60c8-12 20-16 32-12" />
      <Stroke d="M176 140c10 4 20 0 26-8" tone="dark" width={2.5} />
    </Illustration>
  );
}

export function PaymentKo() {
  return (
    <Illustration>
      <Blob x={116} y={98} r={60} tone="peach" />
      <Card tone="ko" />
      <Badge x={164} y={56} tone="danger">
        {CROSS}
      </Badge>
      <Stroke d="M40 62c8-12 20-16 32-12" tone="dark" width={2.5} />
    </Illustration>
  );
}

export function PlanCanceled() {
  return (
    <Illustration>
      <Blob x={116} y={98} r={58} tone="lilac" />
      <g className={art.float}>
        <Paper x={72} y={46} w={92} h={92} r={16} />
        <MiniQr x={90} y={64} cell={8} tone="dark" />
        <path d="M72 138L164 46" stroke="var(--color-danger)" strokeWidth={3} opacity={0.35} />
      </g>
      <Badge x={160} y={128} tone="lilac">
        <path d="M3 8h10" />
      </Badge>
    </Illustration>
  );
}
