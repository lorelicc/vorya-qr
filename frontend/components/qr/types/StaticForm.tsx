import { Input, Select, fieldStyles } from "@/components/ui";
import type { QrTypeKey } from "./meta";

type Data = Record<string, string | boolean>;
type Props = { type: QrTypeKey; value: Data; onChange: (next: Data) => void; errors?: string };

export const STATIC_DEFAULTS: Partial<Record<QrTypeKey, Data>> = {
  website: { url: "https://" },
  wifi: { ssid: "", password: "", encryption: "WPA", hidden: false },
  text: { text: "" },
  email: { to: "", subject: "", body: "" },
  sms: { number: "", message: "" },
  phone: { number: "" },
  whatsapp: { number: "", message: "" },
  vcard_static: {
    first_name: "",
    last_name: "",
    organization: "",
    job_title: "",
    phone: "",
    email: "",
    website: "",
    street: "",
    city: "",
  },
};

/** Guided forms for static QR codes (data encoded inside the QR). */
export function StaticForm({ type, value, onChange, errors }: Props) {
  const set = (key: string) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });
  const v = (key: string) => String(value[key] ?? "");
  return (
    <div className="stack">
      {type === "website" && (
        <Input
          label="URL"
          type="url"
          inputMode="url"
          value={v("url")}
          onChange={set("url")}
          hint="Scritto nel QR: non si potrà cambiare dopo la stampa."
        />
      )}
      {type === "wifi" && (
        <>
          <Input
            label="Nome della rete (SSID)"
            value={v("ssid")}
            onChange={set("ssid")}
            maxLength={32}
          />
          <Select label="Protezione" value={v("encryption")} onChange={set("encryption")}>
            <option value="WPA">WPA/WPA2/WPA3</option>
            <option value="WEP">WEP</option>
            <option value="nopass">Nessuna password</option>
          </Select>
          {value.encryption !== "nopass" && (
            <Input
              label="Password"
              value={v("password")}
              onChange={set("password")}
              maxLength={63}
              autoComplete="off"
            />
          )}
          <label className={fieldStyles.label}>
            <input
              type="checkbox"
              checked={Boolean(value.hidden)}
              onChange={(e) => onChange({ ...value, hidden: e.target.checked })}
            />{" "}
            Rete nascosta
          </label>
        </>
      )}
      {type === "text" && (
        <TextArea label="Testo" value={v("text")} onChange={set("text")} max={1000} />
      )}
      {type === "email" && (
        <>
          <Input label="Destinatario" type="email" value={v("to")} onChange={set("to")} />
          <Input label="Oggetto" value={v("subject")} onChange={set("subject")} maxLength={200} />
          <TextArea label="Messaggio" value={v("body")} onChange={set("body")} max={1000} />
        </>
      )}
      {(type === "sms" || type === "phone" || type === "whatsapp") && (
        <Input
          label="Numero di telefono"
          type="tel"
          inputMode="tel"
          value={v("number")}
          onChange={set("number")}
          hint="Con prefisso internazionale, es. +39 333 1234567."
        />
      )}
      {(type === "sms" || type === "whatsapp") && (
        <TextArea label="Messaggio" value={v("message")} onChange={set("message")} max={500} />
      )}
      {type === "vcard_static" && (
        <>
          <div className="grid-2">
            <Input
              label="Nome"
              value={v("first_name")}
              onChange={set("first_name")}
              maxLength={60}
              autoComplete="off"
            />
            <Input
              label="Cognome"
              value={v("last_name")}
              onChange={set("last_name")}
              maxLength={60}
              autoComplete="off"
            />
            <Input
              label="Azienda"
              value={v("organization")}
              onChange={set("organization")}
              maxLength={80}
            />
            <Input
              label="Ruolo"
              value={v("job_title")}
              onChange={set("job_title")}
              maxLength={60}
            />
            <Input
              label="Telefono"
              type="tel"
              inputMode="tel"
              value={v("phone")}
              onChange={set("phone")}
            />
            <Input label="Email" type="email" value={v("email")} onChange={set("email")} />
          </div>
          <Input
            label="Sito web"
            inputMode="url"
            value={v("website")}
            onChange={set("website")}
            placeholder="www.esempio.it"
          />
          <div className="grid-2">
            <Input label="Indirizzo" value={v("street")} onChange={set("street")} maxLength={100} />
            <Input label="Città" value={v("city")} onChange={set("city")} maxLength={60} />
          </div>
          <p className={fieldStyles.hint}>
            Più dati inserisci, più il QR diventa fitto e difficile da leggere.
          </p>
        </>
      )}
      {errors && <p className={fieldStyles.error}>{errors}</p>}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  max,
  hint,
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  max: number;
  hint?: string;
}) {
  return (
    <label className={fieldStyles.field}>
      <span className={fieldStyles.label}>{label}</span>
      <textarea
        className={fieldStyles.control}
        rows={4}
        value={value}
        onChange={onChange}
        maxLength={max}
      />
      <span className={fieldStyles.hint}>{hint ?? `${value.length}/${max}`}</span>
    </label>
  );
}
