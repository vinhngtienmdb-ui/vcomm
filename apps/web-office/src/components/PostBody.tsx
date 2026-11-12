"use client";

// Hiển thị nội dung tin bảng tin (QUYTAC_NGHIEPVU_367): **đậm**, *nghiêng*, [chữ](https://…), dòng "- " là danh sách.
// Dựng phần tử React từ văn bản, không dùng HTML nên không chạy được mã trong nội dung; đường dẫn chỉ http, https.
import type { ReactNode } from "react";

const inlinePattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const key = `${keyPrefix}-${index}`;
    if (match[1] !== undefined) parts.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<em key={key}>{match[2]}</em>);
    else
      parts.push(
        <a key={key} href={match[4]} target="_blank" rel="noopener noreferrer nofollow">
          {match[3]}
        </a>,
      );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function PostBody({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const index = blocks.length;
    blocks.push(
      <p key={`p-${index}`}>
        {paragraph.flatMap((line, lineIndex) => (lineIndex === 0 ? inline(line, `${index}-${lineIndex}`) : [<br key={`br-${index}-${lineIndex}`} />, ...inline(line, `${index}-${lineIndex}`)]))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (items.length === 0) return;
    const index = blocks.length;
    blocks.push(
      <ul key={`ul-${index}`}>
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>{inline(item, `${index}-${itemIndex}`)}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else if (line.startsWith("- ")) {
      flushParagraph();
      items.push(line.slice(2));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div style={{ overflowWrap: "anywhere" }}>{blocks}</div>;
}
