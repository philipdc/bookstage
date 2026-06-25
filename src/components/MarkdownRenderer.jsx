function parseInline(text, keyPrefix = 'inline') {
  const parts = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${parts.length}`;

    if (token.startsWith('`')) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{parseInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key}>{parseInline(token.slice(1, -1), key)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      parts.push(
        <a key={key} href={link[2]} target="_blank" rel="noreferrer">
          {parseInline(link[1], key)}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function flushParagraph(elements, paragraph, key) {
  if (paragraph.length === 0) return;
  elements.push(<p key={`p-${key}`}>{parseInline(paragraph.join(' '), `p-${key}`)}</p>);
  paragraph.length = 0;
}

function flushList(elements, list, key) {
  if (!list) return null;
  const Tag = list.ordered ? 'ol' : 'ul';
  elements.push(
    <Tag key={`list-${key}`}>
      {list.items.map((item, index) => (
        <li key={`li-${key}-${index}`}>{parseInline(item, `li-${key}-${index}`)}</li>
      ))}
    </Tag>
  );
  return null;
}

export default function MarkdownRenderer({ children, className = '' }) {
  const source = String(children || '').replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const elements = [];
  const paragraph = [];
  let list = null;
  let code = null;
  let key = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (code) {
      if (trimmed.startsWith('```')) {
        elements.push(<pre key={`code-${key++}`}><code>{code.lines.join('\n')}</code></pre>);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushParagraph(elements, paragraph, key++);
      list = flushList(elements, list, key++);
      code = { lines: [] };
      continue;
    }

    if (!trimmed) {
      flushParagraph(elements, paragraph, key++);
      list = flushList(elements, list, key++);
      continue;
    }

    if (trimmed.includes('|') && lines[index + 1] && isTableDivider(lines[index + 1])) {
      flushParagraph(elements, paragraph, key++);
      list = flushList(elements, list, key++);

      const headers = splitTableRow(trimmed);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;

      elements.push(
        <div className="markdown-table-wrap" key={`table-${key++}`}>
          <table>
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={`th-${cellIndex}`}>{parseInline(header, `th-${key}-${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`td-${rowIndex}-${cellIndex}`}>
                      {parseInline(row[cellIndex] || '', `td-${key}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(elements, paragraph, key++);
      list = flushList(elements, list, key++);
      const Tag = `h${Math.min(heading[1].length, 4)}`;
      elements.push(<Tag key={`h-${key++}`}>{parseInline(heading[2], `h-${key}`)}</Tag>);
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph(elements, paragraph, key++);
      const nextOrdered = Boolean(ordered);
      if (!list || list.ordered !== nextOrdered) {
        list = flushList(elements, list, key++);
        list = { ordered: nextOrdered, items: [] };
      }
      list.items.push((unordered || ordered)[1]);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph(elements, paragraph, key++);
      list = flushList(elements, list, key++);
      elements.push(<blockquote key={`quote-${key++}`}>{parseInline(quote[1], `quote-${key}`)}</blockquote>);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph(elements, paragraph, key++);
  flushList(elements, list, key++);

  if (code) elements.push(<pre key={`code-${key++}`}><code>{code.lines.join('\n')}</code></pre>);

  return <div className={`markdown-body ${className}`.trim()}>{elements}</div>;
}
