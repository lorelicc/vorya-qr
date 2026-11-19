import { Illustration, art } from "./Illustration";
import { Blob, MiniQr, Paper, Stroke } from "./parts";

/** First access: a phone scanning a QR, with the sample code ready. */
export function Onboarding({ size = 260 }: { size?: number }) {
  return (
    <Illustration size={size}>
      <Blob x={84} y={98} r={62} tone="mint" />
      <Blob x={184} y={70} r={40} tone="lilac" slow />
      <Blob x={196} y={146} r={22} tone="peach" />
      <g className={art.floatSlow}>
        <Paper x={40} y={52} w={88} h={88} r={16} />
        <MiniQr x={57} y={69} cell={8} />
      </g>
      <g className={art.float}>
        <rect x={146} y={34} width={64} height={116} rx={14} fill="var(--art-ink)" />
        <rect x={151} y={44} width={54} height={92} rx={8} fill="var(--art-paper)" />
        <rect x={158} y={54} width={40} height={10} rx={5} fill="var(--art-dark)" />
        <rect x={158} y={72} width={40} height={6} rx={3} fill="var(--art-line)" />
        <rect x={158} y={84} width={28} height={6} rx={3} fill="var(--art-line)" />
        <rect x={158} y={112} width={40} height={14} rx={7} fill="var(--art-mid)" />
      </g>
      <Stroke d="M132 96c6-8 10-8 14 0" width={2.5} />
      <Stroke d="M128 112c10-16 18-16 22 0" tone="dark" width={2} />
    </Illustration>
  );
}
