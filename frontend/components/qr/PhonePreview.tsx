"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { PageRenderer } from "@/components/page/PageRenderer";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import styles from "./PhonePreview.module.css";

/** Width the hosted page is designed for; the preview renders at this width and is scaled down. */
const DESIGN_WIDTH = 390;

/**
 * Live preview of the hosted page inside a phone mockup. The page is laid out at a real phone
 * width and scaled to fit the mockup, so type and spacing look exactly like on a phone.
 */
export function PhonePreview({ page, files }: { page: PageDoc; files: PageFiles }) {
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  useLayoutEffect(() => {
    const node = screen.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / DESIGN_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={styles.phone} aria-label="Anteprima della pagina su smartphone">
      <span className={styles.notch} aria-hidden="true" />
      <div className={styles.screen} ref={screen}>
        <div
          className={styles.canvas}
          style={{ width: DESIGN_WIDTH, transform: `scale(${scale})`, height: `${100 / scale}%` }}
        >
          <PageRenderer page={page} files={files} slug={null} preview />
        </div>
      </div>
    </div>
  );
}
