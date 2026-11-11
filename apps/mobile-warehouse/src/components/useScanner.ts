// Xử lý một lần quét theo QUYTAC_NGHIEPVU_282: vị trí → mặt hàng (khớp đúng mã vạch, mã hàng) → serial đang chờ → chọn theo tên → không tìm thấy (rung báo).
import type { StockItemOption } from "contracts";
import { useState } from "react";
import { Vibration } from "react-native";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { decide, findLocation, type ScanLocation } from "@/lib/scan";

export type ScanMessage = { tone: "success" | "error" | "info"; text: string };

export function useScanner(companyId: string | null, locations: ScanLocation[]) {
  const [location, setLocation] = useState<ScanLocation | null>(null);
  const [message, setMessage] = useState<ScanMessage | null>(null);
  const [candidates, setCandidates] = useState<StockItemOption[]>([]);
  const [busy, setBusy] = useState(false);

  const fail = (text: string) => {
    Vibration.vibrate(300);
    setMessage({ tone: "error", text });
  };

  const scan = async (code: string, handlers: { item: (option: StockItemOption) => void; serial?: (serial: string) => void; awaitingSerial: boolean }) => {
    setCandidates([]);
    const shelf = findLocation(code, locations);
    if (shelf) {
      setLocation(shelf);
      setMessage({ tone: "info", text: t("locationChanged", { code: shelf.code }) });
      return;
    }
    if (!companyId) return fail(t("chooseOwnerFirst"));
    setBusy(true);
    try {
      const options = await api<StockItemOption[]>(`/inventory/items?companyId=${companyId}&search=${encodeURIComponent(code)}`);
      const decision = decide(code, options, handlers.awaitingSerial && handlers.serial !== undefined);
      if (decision.kind === "item") handlers.item(decision.option);
      else if (decision.kind === "serial") handlers.serial!(decision.serial);
      else if (decision.kind === "choose") setCandidates(decision.options);
      else fail(t("codeNotFound", { code }));
    } catch (failure) {
      fail(failureText(failure));
    } finally {
      setBusy(false);
    }
  };

  return { location, setLocation, message, setMessage, fail, candidates, setCandidates, busy, scan };
}
