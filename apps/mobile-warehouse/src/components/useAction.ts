// Gọi một thao tác, giữ lỗi chung và lỗi theo ô (như apps/mobile-vcomm).
import { useCallback, useState } from "react";
import { ApiFailure, failureText } from "@/lib/api";

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await action();
    } catch (failure) {
      if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) {
        setFields(failure.fields);
        setError(Object.values(failure.fields).join(" "));
      } else setError(failureText(failure));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, fields, run, setError };
}
