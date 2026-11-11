"use client";

// Ô tìm mặt hàng của công ty đang chọn: gõ mã vạch, mã hàng hoặc tên rồi nhấn Enter (máy quét mã vạch gõ kèm Enter).
import type { ProductKind, StockItemOption } from "contracts";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";
import { apiFetch } from "ui/lib/api";

export const itemLabel = (item: { sku: string; productName: string; optionValues: string[] }) =>
  `${item.sku} · ${item.productName}${item.optionValues.length > 0 ? ` (${item.optionValues.join(", ")})` : ""}`;

// kind: chỉ tìm mặt hàng một loại (đơn bán tay chỉ dịch vụ khi chưa bật cài đặt, CONG_VIEC_43).
export async function findItems(search: string, kind?: ProductKind): Promise<StockItemOption[]> {
  return apiFetch<StockItemOption[]>(`/sales/items?${new URLSearchParams({ search: search.trim(), ...(kind ? { kind } : {}) })}`).catch(() => []);
}

export function ItemPicker({ id, onPick, invalid, kind }: { id: string; onPick: (item: StockItemOption) => void; invalid?: boolean; kind?: ProductKind }) {
  const t = useTranslations("purchasing");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StockItemOption[] | null>(null);

  async function find() {
    if (!search.trim()) return;
    const found = await findItems(search, kind);
    if (found.length === 1) {
      onPick(found[0]!);
      setSearch("");
      setResults(null);
    } else setResults(found);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void find();
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <span className="nhom-nut">
        <input
          id={id}
          className={`o-nhap${invalid ? " loi" : ""}`}
          value={search}
          placeholder={t("itemSearchHint")}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={keyDown}
          style={{ flex: 1 }}
        />
        <button type="button" className="nut phu" onClick={() => void find()}>
          {t("find")}
        </button>
      </span>
      {results !== null &&
        (results.length === 0 ? (
          <span className="chu-thich">{t("noItem")}</span>
        ) : (
          <select
            className="o-nhap"
            aria-label={t("chooseItem")}
            value=""
            onChange={(event) => {
              const item = results.find((result) => result.variantId === event.target.value);
              if (!item) return;
              onPick(item);
              setSearch("");
              setResults(null);
            }}
          >
            <option value="">{t("chooseItem")}</option>
            {results.map((item) => (
              <option key={item.variantId} value={item.variantId}>
                {itemLabel(item)}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
}
