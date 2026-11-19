"use client";
import { Button, Card } from "@/components/ui";
import { ImportArt } from "@/components/illustrations";
import type { ImportJob } from "./ImportWizard";
import styles from "./import.module.css";

const COLUMNS = [
  ["name", "Nome"],
  ["type", "Tipo"],
  ["destination", "Destinazione"],
  ["fields", "Campi"],
  ["back_half", "Back-half"],
  ["folder", "Cartella"],
  ["tags", "Tag"],
  ["style", "Stile"],
] as const;
// Error columns use the Italian names of the CSV; map them to the keys above.
const KEY: Record<string, string> = {
  nome: "name",
  tipo: "type",
  destinazione: "destination",
  campi: "fields",
  back_half: "back_half",
  cartella: "folder",
  tag: "tags",
  stile: "style",
};

/** Every row of the file with its errors highlighted (and listed: not colour alone). */
export function ImportPreview({
  job,
  busy,
  onConfirm,
  onRestart,
}: {
  job: ImportJob;
  busy: boolean;
  onConfirm: () => void;
  onRestart: () => void;
}) {
  const failed = new Map<string, string>();
  for (const e of job.errors) failed.set(`${e.row}:${KEY[e.column] ?? e.column}`, e.message);
  const ok = job.status === "validated";
  return (
    <div className="stack">
      <Card>
        <div className={styles.summary}>
          <ImportArt state={ok ? "done" : "errors"} />
          <div>
            <h2>
              {ok
                ? `${job.total} righe pronte da creare`
                : `${job.errors.length} ${job.errors.length === 1 ? "problema" : "problemi"} da correggere`}
            </h2>
            <p className="muted">
              {ok
                ? "Controlla l’anteprima. Alla conferma viene creato tutto insieme; se un limite del piano non basta non viene creato nulla."
                : "Non è stato creato nulla. Correggi il file e caricalo di nuovo."}
            </p>
            <div className={styles.actions}>
              {ok && (
                <Button loading={busy} onClick={onConfirm}>
                  Conferma e crea {job.total} elementi
                </Button>
              )}
              <Button variant="secondary" onClick={onRestart}>
                Carica un altro file
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {!ok && (
        <Card title="Errori">
          <ul className={styles.errors} role="list">
            {job.errors.map((e, i) => (
              <li key={i}>
                <strong>{e.row ? `Riga ${e.row}` : "File"}</strong> · {e.column}: {e.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Anteprima"
        description={
          job.preview && job.preview.length < job.total
            ? `Prime ${job.preview.length} righe di ${job.total}.`
            : undefined
        }
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Righe del file</caption>
            <thead>
              <tr>
                <th scope="col">Riga</th>
                {COLUMNS.map(([, label]) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {job.preview?.map((r) => (
                <tr key={r.row}>
                  <th scope="row">{r.row}</th>
                  {COLUMNS.map(([key]) => {
                    const message = failed.get(`${r.row}:${key}`);
                    return (
                      <td key={key} data-error={message ? "" : undefined} title={message}>
                        {r.cells[key] ?? ""}
                        {message && <span className="visually-hidden"> (errore: {message})</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
