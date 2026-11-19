import { Illustration, art } from "./Illustration";
import { Blob, Lines, MiniQr, Paper, Stroke } from "./parts";

/** Empty states: no company, no QR, no statistics, no presets, empty search. */

export function NoCompanies() {
  return (
    <Illustration>
      <Blob x={70} y={100} r={50} tone="mint" />
      <Blob x={180} y={70} r={30} tone="lilac" slow />
      <g className={art.float}>
        <Paper x={68} y={52} w={104} h={88} />
        <rect x={84} y={70} width={26} height={26} rx={8} fill="var(--art-glow)" />
        <path d="M91 90V78h12v12M97 78v12" fill="none" stroke="var(--art-dark)" strokeWidth={2} />
        <Lines x={118} y={72} w={40} rows={1} />
        <rect x={84} y={108} width={72} height={6} rx={3} fill="var(--art-line)" />
        <rect x={84} y={120} width={48} height={6} rx={3} fill="var(--art-line)" />
      </g>
      <Stroke d="M178 120c10 6 18 6 26-2" />
      <circle cx={196} cy={136} r={11} fill="var(--art-mid)" className={art.pulse} />
      <path
        d="M196 130v12M190 136h12"
        stroke="var(--art-paper)"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Illustration>
  );
}

export function NoQr() {
  return (
    <Illustration>
      <Blob x={84} y={96} r={56} tone="mint" />
      <Blob x={182} y={118} r={28} tone="peach" slow />
      <g className={art.float}>
        <Paper x={70} y={40} w={100} h={100} r={16} />
        <MiniQr x={92} y={62} cell={8} />
      </g>
      <Stroke d="M40 60c8-14 22-20 36-16" />
      <Stroke d="M186 52c10 2 16 10 16 20" tone="dark" width={2.5} />
    </Illustration>
  );
}

export function NoStats() {
  return (
    <Illustration>
      <Blob x={150} y={92} r={58} tone="lilac" />
      <g className={art.float}>
        <Paper x={52} y={46} w={136} h={96} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={70 + i * 22}
            y={118 - (i % 3) * 10 - 6}
            width={12}
            height={(i % 3) * 10 + 6}
            rx={3}
            fill="var(--art-line)"
          />
        ))}
        <Stroke d="M70 100c16-14 28 6 44-8s26-18 40-6 16 4 20 0" />
      </g>
      <circle cx={190} cy={50} r={8} fill="var(--art-glow)" className={art.pulse} />
    </Illustration>
  );
}

export function NoPresets() {
  return (
    <Illustration>
      <Blob x={96} y={104} r={52} tone="peach" />
      <Blob x={170} y={70} r={34} tone="mint" slow />
      <g className={art.float}>
        <Paper x={64} y={52} w={112} h={84} />
        {["mint", "lilac", "peach", "glow"].map((tone, i) => (
          <circle
            key={tone}
            cx={88 + i * 22}
            cy={78}
            r={9}
            fill={`var(--art-${tone})`}
            stroke="var(--art-line)"
          />
        ))}
        <rect x={80} y={100} width={80} height={8} rx={4} fill="var(--art-line)" />
        <rect x={80} y={114} width={52} height={8} rx={4} fill="var(--art-dark)" />
      </g>
      <Stroke d="M182 120c6 10 16 14 26 10" />
    </Illustration>
  );
}

export function EmptySearch() {
  return (
    <Illustration>
      <Blob x={110} y={96} r={54} tone="mint" />
      <g className={art.float}>
        <circle
          cx={104}
          cy={84}
          r={30}
          fill="var(--art-paper)"
          stroke="var(--art-dark)"
          strokeWidth={6}
        />
        <path d="M126 106l26 26" stroke="var(--art-dark)" strokeWidth={9} strokeLinecap="round" />
        <path d="M92 84h24" stroke="var(--art-line)" strokeWidth={5} strokeLinecap="round" />
      </g>
      <Stroke d="M170 60c10-2 20 4 22 14" tone="dark" width={2.5} />
      <circle cx={60} cy={130} r={6} fill="var(--art-lilac)" className={art.pulse} />
    </Illustration>
  );
}
