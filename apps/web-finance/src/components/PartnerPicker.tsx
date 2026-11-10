"use client";

// Ô tìm đối tác theo phía công nợ (khách hàng hoặc nhà cung cấp của công ty): gõ tên, mã rồi nhấn Enter.
import type { DebtSide, FinancePartnerOption } from "contracts";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";
import { apiFetch } from "ui/lib/api";

export function PartnerPicker({ id, side, onPick, invalid }: { id: string; side: DebtSide; onPick: (partner: FinancePartnerOption) => void; invalid?: boolean }) {
  const t = useTranslations("payments");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FinancePartnerOption[] | null>(null);
  async function find() {
    const found = await apiFetch<FinancePartnerOption[]>(`/finance/partners?${new URLSearchParams({ side, ...(search.trim() ? { search: search.trim() } : {}) })}`).catch(() => []);
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
          placeholder={t("partnerSearch")}
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
          <span className="chu-thich">{t("noPartner")}</span>
        ) : (
          <select
            className="o-nhap"
            aria-label={t("choosePartner")}
            value=""
            onChange={(event) => {
              const partner = results.find((result) => result.id === event.target.value);
              if (!partner) return;
              onPick(partner);
              setSearch("");
              setResults(null);
            }}
          >
            <option value="">{t("choosePartner")}</option>
            {results.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.code} · {partner.name}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
}
