"use client";
import { useRef, type ReactNode } from "react";
import { useInView } from "@/lib/motion";
import styles from "./illustrations.module.css";

/**
 * Frame shared by every illustration: 240x180 inline SVG, decorative (aria-hidden), colours only
 * from --art-* tokens. Loops (float, draw, pulse) pause off-screen or with the tab hidden, and
 * stop entirely with "reduce motion".
 */
export function Illustration({
  children,
  size = 200,
  className,
  viewBox = "0 0 240 180",
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  viewBox?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const visible = useInView(ref);
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      width={size}
      height={(size * 3) / 4}
      className={[styles.art, className].filter(Boolean).join(" ")}
      data-paused={visible ? undefined : ""}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export { styles as art };
