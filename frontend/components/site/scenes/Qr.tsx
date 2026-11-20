/**
 * Decorative QR drawing for the animated scenes. It is NOT a real code (nothing to scan): a
 * deterministic pattern with the three finder squares, in two module styles that the design
 * scene cross-fades.
 */
const N = 21;

function cells(): boolean[][] {
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => next() > 0.52));
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        const gx = ox + x;
        const gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[gy][gx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core);
      }
  };
  finder(0, 0);
  finder(N - 7, 0);
  finder(0, N - 7);
  return grid;
}

const GRID = cells();
const isFinder = (x: number, y: number) =>
  (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);

function paths(round: boolean) {
  let modules = "";
  let finders = "";
  GRID.forEach((row, y) =>
    row.forEach((on, x) => {
      if (!on) return;
      if (isFinder(x, y)) {
        finders += `M${x} ${y}h1v1h-1z`;
      } else if (round) {
        modules += `M${x + 0.5} ${y + 0.08}a.42.42 0 1 0 .001 0z`;
      } else {
        modules += `M${x} ${y}h1v1h-1z`;
      }
    }),
  );
  return { modules, finders };
}

const SQUARE = paths(false);
const ROUND = paths(true);

export function QrGlyph({
  variant = "square",
  className,
}: {
  variant?: "square" | "round";
  className?: string;
}) {
  const p = variant === "round" ? ROUND : SQUARE;
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className={className} fill="currentColor">
      <path d={p.modules} />
      <path d={p.finders} />
    </svg>
  );
}
