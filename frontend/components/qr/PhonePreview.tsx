import { PageRenderer } from "@/components/page/PageRenderer";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import styles from "./PhonePreview.module.css";

/** Live preview of the hosted page inside a phone mockup (same renderer as the public page). */
export function PhonePreview({ page, files }: { page: PageDoc; files: PageFiles }) {
  return (
    <div className={styles.phone} aria-label="Anteprima della pagina su smartphone">
      <span className={styles.notch} aria-hidden="true" />
      <div className={styles.screen}>
        <PageRenderer page={page} files={files} slug={null} preview />
      </div>
    </div>
  );
}
