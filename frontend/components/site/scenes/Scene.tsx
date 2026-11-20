"use client";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import styles from "./scenes.module.css";

/**
 * Frame of an animated product scene ("small video" made of HTML/CSS, a few KB, sharp on any
 * screen, text readable by search engines).
 *
 * - Plays only while it is on screen (IntersectionObserver) and while `active` is true.
 * - Play/pause button for the visitor (WCAG 2.2.2).
 * - With "reduce motion" the scenes show their final frame: the base CSS of every scene IS the
 *   final state and the keyframes only add the way to it, so no JS is needed for that.
 */
export function Scene({
  label,
  caption,
  tone = "mint",
  active = true,
  children,
}: {
  label: string;
  caption?: string;
  tone?: "mint" | "forest" | "sun" | "lilac" | "peach";
  active?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  // Before the first time it is seen the scene shows its final frame (no blank stage).
  const [started, setStarted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // false on the server and on the first client render, true afterwards: until then the CSS
  // animations just run (no-JS visitors see them), and they never hydrate-mismatch.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setStarted(true);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const run = visible && active && !userPaused;
  return (
    <figure
      ref={ref}
      className={styles.frame}
      data-tone={tone}
      data-run={ready ? (started ? String(run) : "idle") : undefined}
      aria-label={label}
    >
      <div className={styles.stage} aria-hidden="true">
        {children}
      </div>
      <figcaption className={styles.caption}>
        <span>{caption ?? "Dati di esempio."}</span>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => setUserPaused((v) => !v)}
          aria-label={userPaused ? "Riproduci l’animazione" : "Metti in pausa l’animazione"}
        >
          {userPaused ? (
            <Play size={14} aria-hidden="true" />
          ) : (
            <Pause size={14} aria-hidden="true" />
          )}
        </button>
      </figcaption>
    </figure>
  );
}
