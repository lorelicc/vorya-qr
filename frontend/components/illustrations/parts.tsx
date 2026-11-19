import { art } from "./Illustration";

/** Building blocks shared by the illustrations (all colours are --art-* tokens). */

export function Blob({
  x,
  y,
  r,
  tone = "mint",
  slow,
}: {
  x: number;
  y: number;
  r: number;
  tone?: "mint" | "lilac" | "peach" | "glow" | "danger";
  slow?: boolean;
}) {
  return (
    <g className={slow ? art.floatSlow : art.float}>
      <path
        fill={`var(--art-${tone})`}
        d={`M${x - r} ${y}c0-${r * 0.62} ${r * 0.42}-${r} ${r}-${r}s${r} ${r * 0.34} ${r} ${r * 0.9}-${r * 0.46} ${r * 1.1}-${r} ${r * 1.1}-${r}-${r * 0.38}-${r}-${r}Z`}
      />
    </g>
  );
}

export function Paper({
  x,
  y,
  w,
  h,
  r = 12,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill="var(--art-paper)"
      stroke="var(--art-line)"
      strokeWidth={1.5}
    />
  );
}

/** A 7x7 QR-like glyph: three finder corners plus a few modules (not a real code). */
export function MiniQr({
  x,
  y,
  cell = 6,
  tone = "ink",
}: {
  x: number;
  y: number;
  cell?: number;
  tone?: "ink" | "dark";
}) {
  const on = [10, 12, 17, 24, 25, 31, 33, 38, 39, 45, 46, 47];
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect
        x={x + fx * cell}
        y={y + fy * cell}
        width={cell * 3}
        height={cell * 3}
        rx={cell * 0.6}
        fill="none"
        stroke={`var(--art-${tone})`}
        strokeWidth={cell * 0.7}
      />
      <rect
        x={x + (fx + 1) * cell}
        y={y + (fy + 1) * cell}
        width={cell}
        height={cell}
        rx={cell * 0.3}
        fill={`var(--art-${tone})`}
      />
    </g>
  );
  return (
    <g>
      {finder(0, 0)}
      {finder(4, 0)}
      {finder(0, 4)}
      {on.map((i) => (
        <rect
          key={i}
          x={x + (i % 7) * cell + cell * 0.1}
          y={y + Math.floor(i / 7) * cell + cell * 0.1}
          width={cell * 0.8}
          height={cell * 0.8}
          rx={cell * 0.25}
          fill={`var(--art-${tone})`}
        />
      ))}
    </g>
  );
}

export function Lines({ x, y, w, rows = 2 }: { x: number; y: number; w: number; rows?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w * 0.7} height={7} rx={3.5} fill="var(--art-dark)" />
      {Array.from({ length: rows }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + 14 + i * 12}
          width={w * (i % 2 ? 0.6 : 1)}
          height={6}
          rx={3}
          fill="var(--art-line)"
        />
      ))}
    </g>
  );
}

/** A green stroke drawn in a loop with stroke-dashoffset. */
export function Stroke({
  d,
  tone = "mid",
  width = 3,
}: {
  d: string;
  tone?: string;
  width?: number;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      className={art.draw}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={`var(--art-${tone})`}
      strokeWidth={width}
    />
  );
}

export function Badge({
  x,
  y,
  tone,
  children,
}: {
  x: number;
  y: number;
  tone: "green" | "danger" | "lilac" | "peach";
  children: React.ReactNode;
}) {
  const fill = {
    green: "var(--art-mid)",
    danger: "var(--color-danger)",
    lilac: "var(--color-info)",
    peach: "var(--color-warning)",
  }[tone];
  return (
    <g className={art.pulse}>
      <circle cx={x} cy={y} r={16} fill={fill} />
      <g
        transform={`translate(${x - 8} ${y - 8})`}
        className={art.fill}
        fill="none"
        stroke="var(--art-paper)"
        strokeWidth={2.6}
      >
        {children}
      </g>
    </g>
  );
}

export const CHECK = <path d="M3 8.5l3.2 3.2L13 5" />;
export const CROSS = <path d="M4 4l8 8M12 4l-8 8" />;
export const CLOCK = <path d="M8 3v5l3 2" />;
export const LOCK = (
  <>
    <rect x={3} y={7} width={10} height={7} rx={1.5} />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </>
);
