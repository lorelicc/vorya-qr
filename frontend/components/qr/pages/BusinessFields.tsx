"use client";
import { Input } from "@/components/ui";
import { DAY_LABEL, type OpeningHoursBlock } from "@/lib/page-types";
import { TextArea } from "../types/StaticForm";
import { blockId, findBlock, upsertBlock } from "./defaults";
import { ContactFields, GalleryFields } from "./TemplateForms";
import type { FormProps } from "./shared";
import styles from "./pages.module.css";

export function BusinessFields(props: FormProps) {
  const { page, onChange } = props;
  const text = findBlock(page, "text");
  const hours = findBlock(page, "opening_hours");
  const address = findBlock(page, "address");
  const setDays = (days: OpeningHoursBlock["days"]) =>
    onChange(upsertBlock(page, "opening_hours", { days }, () => ({ id: blockId("o"), type: "opening_hours", days: [], note: "" })));
  return (
    <div className="stack">
      <TextArea label="Descrizione" value={text?.markdown ?? ""} max={4000} hint="Puoi usare **grassetto**, *corsivo* e [link](https://…)." onChange={(e) => onChange(upsertBlock(page, "text", { markdown: e.target.value }, () => ({ id: blockId("t"), type: "text", markdown: "" })))} />
      <div className={styles.section}>
        <h3>Orari</h3>
        {(hours?.days ?? []).map((d, index) => (
          <div key={d.day} className={styles.row}>
            <div className={styles.rowFields}>
              <label className={styles.check}>
                <input type="checkbox" checked={!d.closed} onChange={(e) => setDays(hours!.days.map((x, i) => (i === index ? { ...x, closed: !e.target.checked, ranges: x.ranges.length ? x.ranges : [{ opens: "09:00", closes: "18:00" }] } : x)))} /> {DAY_LABEL[d.day]}
              </label>
              {!d.closed && d.ranges[0] && (
                <>
                  <Input label="Apre" type="time" value={d.ranges[0].opens} onChange={(e) => setDays(hours!.days.map((x, i) => (i === index ? { ...x, ranges: [{ ...x.ranges[0], opens: e.target.value }] } : x)))} />
                  <Input label="Chiude" type="time" value={d.ranges[0].closes} onChange={(e) => setDays(hours!.days.map((x, i) => (i === index ? { ...x, ranges: [{ ...x.ranges[0], closes: e.target.value }] } : x)))} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <Input label="Indirizzo (per Google Maps e Apple Mappe)" value={address?.query ?? ""} maxLength={300} onChange={(e) => onChange(upsertBlock(page, "address", { query: e.target.value }, () => ({ id: blockId("a"), type: "address", label: "", query: "", providers: ["google", "apple"] })))} />
      <ContactFields {...props} />
      <GalleryFields {...props} />
    </div>
  );
} // prettier-ignore
