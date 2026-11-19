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

/** Admin gift: a wrapped box with a QR tag (plan given for free). */
export function GiftPlan() {
  return (
    <Illustration>
      <Blob x={118} y={100} r={60} tone="peach" />
      <Blob x={188} y={52} r={20} tone="lilac" slow />
      <g className={art.float}>
        <rect
          x={70}
          y={78}
          width={96}
          height={64}
          rx={10}
          fill="var(--art-paper)"
          stroke="var(--art-line)"
          strokeWidth={1.5}
        />
        <rect
          x={62}
          y={62}
          width={112}
          height={22}
          rx={8}
          fill="var(--art-mint)"
          stroke="var(--art-line)"
          strokeWidth={1.5}
        />
        <rect x={110} y={62} width={12} height={80} fill="var(--art-mid)" opacity={0.55} />
        <path
          d="M116 62c-14-18-34-12-26 0M116 62c14-18 34-12 26 0"
          fill="none"
          stroke="var(--art-mid)"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </g>
      <Badge x={164} y={130} tone="green">
        {CHECK}
      </Badge>
      <Stroke d="M40 58c8-12 20-16 32-12" />
    </Illustration>
  );
}

/** Admin gift of months: a calendar with a ribbon. */
export function GiftMonths() {
  return (
    <Illustration>
      <Blob x={118} y={100} r={60} tone="mint" />
      <g className={art.float}>
        <rect
          x={64}
          y={52}
          width={108}
          height={88}
          rx={12}
          fill="var(--art-paper)"
          stroke="var(--art-line)"
          strokeWidth={1.5}
        />
        <rect x={64} y={52} width={108} height={24} rx={12} fill="var(--art-mid)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={86 + (i % 3) * 32}
            cy={96 + Math.floor(i / 3) * 24}
            r={7}
            fill={i === 4 ? "var(--art-green)" : "var(--art-line)"}
          />
        ))}
      </g>
      <g className={art.pulse}>
        <circle cx={168} cy={56} r={16} fill="var(--color-warning)" />
        <path
          d="M168 48v16M160 56h16"
          stroke="var(--art-paper)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <Stroke d="M40 70c8-12 20-16 32-12" tone="dark" width={2.5} />
    </Illustration>
  );
}
