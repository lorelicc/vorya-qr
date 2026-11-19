import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown: paragraphs, line breaks, **bold**, *italic* and [text](https://…).
 * Output is React elements built from text nodes: HTML in the source is never interpreted.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index! > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${index++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) out.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      const label = token.slice(1, token.indexOf("]"));
      out.push(
        <a key={key} href={match[2]} rel="noopener noreferrer nofollow" target="_blank">
          {label}
        </a>,
      );
    }
    last = match.index! + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const paragraphs = source
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((paragraph, p) => (
        <p key={p}>
          {paragraph.split("\n").map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {inline(line, `${p}-${l}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
