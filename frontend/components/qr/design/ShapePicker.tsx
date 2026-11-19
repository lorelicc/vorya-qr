import styles from "./design.module.css";

type Option<T extends string> = { value: T; label: string; icon: React.ReactNode };

/** Visual radio group for module and eye shapes. */
export function ShapePicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.shapes}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label
            key={option.value}
            className={styles.shape}
            data-selected={value === option.value || undefined}
            title={option.label}
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {option.icon}
            </svg>
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const grid = (draw: (x: number, y: number) => React.ReactNode) =>
  [0, 1, 2].flatMap((y) =>
    [0, 1, 2]
      .filter((x) => (x + y) % 2 === 0 || x === 1)
      .map((x) => <g key={`${x}${y}`}>{draw(3 + x * 6.5, 3 + y * 6.5)}</g>),
  );

export const MODULE_OPTIONS = [
  {
    value: "square" as const,
    label: "Quadrati",
    icon: grid((x, y) => <rect x={x} y={y} width={5.5} height={5.5} />),
  },
  {
    value: "rounded" as const,
    label: "Arrotondati",
    icon: grid((x, y) => <rect x={x} y={y} width={5.5} height={5.5} rx={1.6} />),
  },
  {
    value: "dots" as const,
    label: "Pallini",
    icon: grid((x, y) => <circle cx={x + 2.75} cy={y + 2.75} r={2.6} />),
  },
  {
    value: "classy" as const,
    label: "Classy",
    icon: grid((x, y) => (
      <path d={`M${x + 2} ${y}h3.5v3.5a2 2 0 0 1-2 2h-3.5v-3.5a2 2 0 0 1 2-2z`} />
    )),
  },
  {
    value: "extra_rounded" as const,
    label: "Fluidi",
    icon: grid((x, y) => <rect x={x} y={y} width={5.5} height={5.5} rx={2.75} />),
  },
];

const frame = (r: number, leaf = false) => (
  <path
    fillRule="evenodd"
    d={
      leaf
        ? "M9 3h12v12a6 6 0 0 1-6 6H3V9a6 6 0 0 1 6-6zM9 6a3 3 0 0 0-3 3v9h9a3 3 0 0 0 3-3V6z"
        : `M${3 + r} 3h${18 - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${18 - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${18 - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${18 - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}zM6 6v12h12V6z`
    }
  />
);

export const FRAME_OPTIONS = [
  { value: "square" as const, label: "Quadrata", icon: frame(0) },
  { value: "rounded" as const, label: "Arrotondata", icon: frame(3) },
  {
    value: "circle" as const,
    label: "Cerchio",
    icon: (
      <path
        fillRule="evenodd"
        d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 6a6 6 0 1 0 0 12a6 6 0 0 0 0-12z"
      />
    ),
  },
  { value: "leaf" as const, label: "Foglia", icon: frame(0, true) },
  { value: "extra_rounded" as const, label: "Morbida", icon: frame(6) },
];

export const BALL_OPTIONS = [
  {
    value: "square" as const,
    label: "Quadrato",
    icon: <rect x={6} y={6} width={12} height={12} />,
  },
  {
    value: "rounded" as const,
    label: "Arrotondato",
    icon: <rect x={6} y={6} width={12} height={12} rx={3} />,
  },
  { value: "circle" as const, label: "Cerchio", icon: <circle cx={12} cy={12} r={6.5} /> },
  {
    value: "leaf" as const,
    label: "Foglia",
    icon: <path d="M10 6h8v8a4 4 0 0 1-4 4H6v-8a4 4 0 0 1 4-4z" />,
  },
];
