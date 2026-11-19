import styles from "./Skeleton.module.css";

/** Placeholder block with a shimmer (static under reduced motion). */
export function Skeleton({
  height = 16,
  width = "100%",
  radius = "var(--radius-sm)",
}: {
  height?: number | string;
  width?: number | string;
  radius?: string;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ height, width, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({
  rows = 4,
  label = "Caricamento…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className={styles.list} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={56} radius="var(--radius-lg)" />
      ))}
    </div>
  );
}
