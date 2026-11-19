"use client";
import { UploadCloud } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { errorMessage } from "@/lib/api";
import { uploadFile, type UploadPurpose } from "@/lib/upload";
import styles from "./Dropzone.module.css";

const ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp",
  pdf: "application/pdf",
  audio: "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav",
};
const KIND: Record<UploadPurpose, keyof typeof ACCEPT> = {
  image: "image", cover: "image", avatar: "image", gallery: "image", logo: "image",
  pdf: "pdf", audio: "audio",
}; // prettier-ignore

type Props<T> = {
  path: string;
  purpose: UploadPurpose;
  label: string;
  hint?: string;
  multiple?: boolean;
  compact?: boolean;
  onUploaded: (result: T) => void;
};

/** Drag & drop (or tap to choose) with real upload progress. */
export function Dropzone<T>({
  path,
  purpose,
  label,
  hint,
  multiple,
  compact,
  onUploaded,
}: Props<T>) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function send(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    for (const file of Array.from(files).slice(0, multiple ? 20 : 1)) {
      setProgress(0);
      try {
        onUploaded(await uploadFile<T>(path, file, { purpose }, setProgress));
      } catch (err) {
        setError(`${file.name}: ${errorMessage(err)}`);
      }
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  }

  const onDrag = (event: DragEvent, value: boolean) => {
    event.preventDefault();
    setOver(value);
  };

  return (
    <div className={styles.wrapper}>
      <label
        htmlFor={inputId}
        className={`${styles.zone} ${compact ? styles.compact : ""}`}
        data-over={over || undefined}
        data-busy={progress !== null || undefined}
        onDragEnter={(e) => onDrag(e, true)}
        onDragOver={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={(e) => {
          onDrag(e, false);
          send(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={compact ? 20 : 28} aria-hidden="true" className={styles.icon} />
        <span className={styles.label}>
          {progress === null ? label : `Caricamento… ${Math.round(progress * 100)}%`}
        </span>
        {hint && progress === null && <span className={styles.hint}>{hint}</span>}
        {progress !== null && (
          <span
            className={styles.bar}
            role="progressbar"
            aria-label="Avanzamento del caricamento"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        )}
        <input
          ref={input}
          id={inputId}
          type="file"
          className="visually-hidden"
          accept={ACCEPT[KIND[purpose]]}
          multiple={multiple}
          disabled={progress !== null}
          onChange={(e) => send(e.target.files)}
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
