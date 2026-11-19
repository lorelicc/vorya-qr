"use client";
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, IconButton, Input, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import styles from "./admin.module.css";

type Word = { word: string; kind: "route" | "blocked" };

export function ReservedWords({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [words, setWords] = useState<Word[] | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Word[]>("admin/reserved-words")
      .then(setWords)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Word>("admin/reserved-words", "POST", { word: value });
      setWords((all) => [...(all ?? []), created].sort((a, b) => a.word.localeCompare(b.word)));
      setValue("");
      toast.show(`«${created.word}» riservata.`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function remove(word: Word) {
    try {
      await api(`admin/reserved-words/${word.word}`, "DELETE");
      setWords((all) => all?.filter((w) => w.word !== word.word) ?? null);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Parole riservate</h1>
          <p>
            Back-half che nessuno può usare. Le route dell’app sono fisse; le parole vietate o
            fuorvianti (es. login, paypal) si possono aggiungere e togliere.
          </p>
        </div>
      </div>
      {canWrite && (
        <Card title="Riserva una parola">
          <form className={styles.domainForm} onSubmit={add}>
            <Input
              label="Parola"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={50}
              required
            />
            <span />
            <Button type="submit" disabled={!value.trim()}>
              Aggiungi
            </Button>
          </form>
        </Card>
      )}
      {error && <p role="alert">{error}</p>}
      {words === null ? (
        <p className="muted">Caricamento…</p>
      ) : (
        <ul className={styles.words}>
          {words.map((w) => (
            <li key={w.word}>
              <code>{w.word}</code>
              {w.kind === "route" ? (
                <Badge>route</Badge>
              ) : (
                canWrite && (
                  <IconButton label={`Libera ${w.word}`} onClick={() => remove(w)}>
                    <Trash2 size={14} />
                  </IconButton>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
