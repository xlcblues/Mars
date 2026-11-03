import { createElement, Fragment, type ReactNode } from "react";

const INLINE_SPLIT =
  /(\*\*[^*]+?\*\*|~~[^~]+?~~|\*[^*]+?\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE_SPLIT);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (!part) return;
    const key = `${keyBase}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      nodes.push(<strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>);
    } else if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
      nodes.push(<del key={key}>{renderInline(part.slice(2, -2), key)}</del>);
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      nodes.push(<em key={key}>{renderInline(part.slice(1, -1), key)}</em>);
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      nodes.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else {
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link && SAFE_URL.test(link[2])) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer">
            {renderInline(link[1], key)}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={key}>{part}</Fragment>);
      }
    }
  });
  return nodes;
}

function headingNode(level: number, text: string, key: string) {
  return createElement(`h${level}`, { key }, renderInline(text, key));
}

function parseBlocks(source: string): ReactNode[] {
  const lines = source.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push(
        <pre key={`code-${blockIndex++}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      nodes.push(headingNode(heading[1].length, heading[2], `h-${blockIndex++}`));
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      nodes.push(<hr key={`hr-${blockIndex++}`} />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote key={`quote-${blockIndex++}`}>
          {quoteLines.map((quote, quoteIndex) => (
            <p key={`${blockIndex}-${quoteIndex}`}>
              {renderInline(quote, `quote-${blockIndex}-${quoteIndex}`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const unordered = /^[-*+]\s+/.test(trimmed);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${blockIndex++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${blockIndex}-${itemIndex}`}>
              {renderInline(item, `li-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const ordered = /^\d+[.)]\s+/.test(trimmed);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${blockIndex++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${blockIndex}-${itemIndex}`}>
              {renderInline(item, `li-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        /^(#{1,6})\s+/.test(nextTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed) ||
        nextTrimmed.startsWith(">") ||
        /^[-*+]\s+/.test(nextTrimmed) ||
        /^\d+[.)]\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = paragraphLines.join(" ").trim();
    if (paragraph) {
      nodes.push(<p key={`p-${blockIndex++}`}>{renderInline(paragraph, `p-${blockIndex}`)}</p>);
    }
  }

  return nodes;
}

export function MarkdownView({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return <div className={className ?? "report-markdown"}>{parseBlocks(content)}</div>;
}
