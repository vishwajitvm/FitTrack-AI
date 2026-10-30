import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small, safe Markdown renderer for assistant answers (no HTML is ever injected):
 * ### headings, paragraphs, - / * / • and 1. lists, | tables |, **bold**, *italic* / _italic_, `code`.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={cn("space-y-3 text-sm leading-relaxed text-slate-700", className)}>{blocks(text)}</div>;
}

const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(
        <p key={i} className={cn("font-semibold text-slate-900", level <= 2 ? "pt-1 text-base" : "pt-1 text-[13px] uppercase tracking-wide text-slate-600")}>
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        <div key={i} className="scrollbar-thin overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                {head.map((h, j) => (
                  <th key={j} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j} className="border-t border-line">
                  {head.map((_, k) => (
                    <td key={k} className="px-3 py-1.5 align-top">
                      {inline(r[k] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*([-*•]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i])) items.push(lines[i++].replace(bullet, ""));
      const List = ordered ? "ol" : "ul";
      out.push(
        <List key={i} className={cn("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc marker:text-slate-400")}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) && !bullet.test(lines[i]) && !(lines[i].includes("|") && TABLE_SEP.test(lines[i + 1] ?? ""))) {
      para.push(lines[i++]);
    }
    out.push(
      <p key={i}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return out;
}

/** **bold**, *italic* / _italic_ and `code`, in one pass. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // _italic_ only at word edges, so snake_case words stay as they are
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|(?<!\w)_[^_\s][^_]*_(?!\w))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={m.index} className="font-semibold text-slate-900">{inline(tok.slice(2, -2))}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={m.index} className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={m.index} className="text-slate-600">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
