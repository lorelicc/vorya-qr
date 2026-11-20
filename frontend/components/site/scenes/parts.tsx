import { MousePointer2 } from "lucide-react";
import s from "./scenes.module.css";

export function Cursor({ className }: { className: string }) {
  return (
    <span className={`${s.cursor} ${className}`}>
      <MousePointer2 size={22} fill="#091411" color="#fff" strokeWidth={1.5} />
    </span>
  );
}

export function Rows({ items }: { items: [string, string][] }) {
  return (
    <ul className={s.rows}>
      {items.map(([name, price]) => (
        <li key={name}>
          <span>{name}</span>
          <b>{price}</b>
        </li>
      ))}
    </ul>
  );
}
