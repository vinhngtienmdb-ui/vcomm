"use client";

// CayDuLieu (tài liệu 15): danh sách dạng cây từ các phần tử có parentId.
import type { ReactNode } from "react";

interface Node {
  id: string;
  parentId: string | null;
}

export function TreeList<T extends Node>({ items, selectedId, onSelect, label }: { items: T[]; selectedId: string | null; onSelect: (item: T) => void; label: (item: T) => ReactNode }) {
  const ids = new Set(items.map((item) => item.id));
  const render = (parentId: string | null): ReactNode => {
    // Phần tử có cha không nằm trong danh sách được coi là gốc.
    const level = items.filter((item) => (parentId === null ? item.parentId === null || !ids.has(item.parentId) : item.parentId === parentId));
    if (level.length === 0) return null;
    return (
      <ul className={parentId === null ? "cay" : undefined}>
        {level.map((item) => (
          <li key={item.id}>
            <button type="button" className={item.id === selectedId ? "chon" : ""} aria-pressed={item.id === selectedId} onClick={() => onSelect(item)}>
              {label(item)}
            </button>
            {render(item.id)}
          </li>
        ))}
      </ul>
    );
  };
  return <>{render(null)}</>;
}
