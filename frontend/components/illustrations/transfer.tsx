import { Illustration, art } from "./Illustration";
import { Badge, Blob, CHECK, CLOCK, CROSS, Lines, Paper, Stroke } from "./parts";

/** Company transfer between accounts: pending, accepted, declined. */
export function Transfer({ state }: { state: "pending" | "accepted" | "declined" }) {
  const badge = {
    pending: (
      <Badge x={120} y={56} tone="lilac">
        {CLOCK}
        <circle cx={8} cy={8} r={6} />
      </Badge>
    ),
    accepted: (
      <Badge x={120} y={56} tone="green">
        {CHECK}
      </Badge>
    ),
    declined: (
      <Badge x={120} y={56} tone="danger">
        {CROSS}
      </Badge>
    ),
  }[state];
  return (
    <Illustration>
      <Blob x={64} y={110} r={44} tone="mint" />
      <Blob x={178} y={110} r={44} tone={state === "declined" ? "peach" : "lilac"} slow />
      <g className={art.floatSlow}>
        <Paper x={28} y={84} w={72} h={58} />
        <Lines x={40} y={98} w={46} />
      </g>
      <g className={art.float}>
        <Paper x={140} y={84} w={72} h={58} />
        <Lines x={152} y={98} w={46} />
      </g>
      {state === "declined" ? (
        <Stroke d="M104 112c8-10 14-10 20 0" tone="dark" width={2.5} />
      ) : (
        <Stroke d="M104 112c12-16 24-16 34 0" />
      )}
      {badge}
    </Illustration>
  );
}
