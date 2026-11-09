"use client";

// Ô nhập có nhãn, lỗi theo trường, gợi ý (tài liệu 15: ONhap, OChon).
import { type ReactNode, useState } from "react";
import { failureOf } from "../lib/use-api";

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <div className="truong">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span id={`${id}-loi`} className="loi-o">
          {error}
        </span>
      ) : (
        hint && <span className="chu-thich">{hint}</span>
      )}
    </div>
  );
}

// Trạng thái gửi biểu mẫu: đang gửi, lỗi theo trường, lỗi chung.
export function useSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setFields({});
    setFormError(null);
    try {
      await action();
    } catch (error) {
      const failure = failureOf(error);
      setFields(failure.fields);
      if (Object.keys(failure.fields).length === 0) setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }
  const inputClass = (key: string) => `o-nhap${fields[key] ? " loi" : ""}`;
  return { submitting, fields, formError, run, inputClass };
}

export function FormError({ text }: { text: string | null }) {
  return text ? (
    <div className="khoi-canh-bao loi" role="alert">
      {text}
    </div>
  ) : null;
}
