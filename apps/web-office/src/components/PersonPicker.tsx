"use client";

// Chọn người trong tập đoàn (QUYTAC_NGHIEPVU_357): gõ tên hoặc email, chọn từ danh sách; hiện công ty, phòng ban.
import type { OfficePerson } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiFetch } from "ui/lib/api";

export const personLabel = (person: OfficePerson) => [person.fullName, person.companyName, person.departmentName].filter(Boolean).join(" · ");

export function PersonPicker({ id, value, onChange, multiple, invalid }: { id: string; value: OfficePerson[]; onChange: (people: OfficePerson[]) => void; multiple: boolean; invalid?: boolean }) {
  const t = useTranslations("officeTasks");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<OfficePerson[]>([]);
  useEffect(() => {
    const text = search.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    // Chờ người dùng ngừng gõ rồi mới tìm.
    const timer = setTimeout(() => {
      apiFetch<OfficePerson[]>(`/office/people?search=${encodeURIComponent(text)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const choose = (person: OfficePerson) => {
    onChange(multiple ? [...value.filter((item) => item.id !== person.id), person] : [person]);
    setSearch("");
    setResults([]);
  };
  return (
    <div>
      {value.length > 0 && (
        <div className="nhom-nut" style={{ marginBottom: "var(--khoang-2)" }}>
          {value.map((person) => (
            <span key={person.id} className="nhan thong-tin" style={{ whiteSpace: "normal" }}>
              {personLabel(person)}{" "}
              <button type="button" className="nut chu" aria-label={t("removePerson", { name: person.fullName })} onClick={() => onChange(value.filter((item) => item.id !== person.id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {(multiple || value.length === 0) && (
        <input id={id} className={`o-nhap${invalid ? " loi" : ""}`} value={search} placeholder={t("personSearch")} autoComplete="off" onChange={(event) => setSearch(event.target.value)} />
      )}
      {results.length > 0 && (
        <ul className="the" role="listbox" aria-label={t("personResults")} style={{ listStyle: "none", margin: 0, padding: "var(--khoang-2)" }}>
          {results.map((person) => (
            <li key={person.id}>
              <button type="button" className="nut chu" onClick={() => choose(person)}>
                {personLabel(person)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
