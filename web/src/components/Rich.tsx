import { Fragment } from "react";

/** Renders the advisor's light markdown: **bold**, bullet lines, paragraphs. */
export function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.every((l) => /^\s*[•\-*]\s/.test(l));
        if (bullets) {
          return (
            <ul key={i} className="my-1.5 space-y-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="text-marigold-deep">•</span>
                  <span>{inline(l.replace(/^\s*[•\-*]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {/^\s*[•\-]\s/.test(l) ? <span className="inline-flex gap-2"><span className="text-marigold-deep">•</span><span>{inline(l.replace(/^\s*[•\-]\s/, ""))}</span></span> : inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    /^\*\*.+\*\*$/.test(part) ? <strong key={i} className="font-700 font-bold">{part.slice(2, -2)}</strong> : /^\*.+\*$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
