// Dữ liệu máy bán sau khi đăng nhập: ca hiện tại, danh mục (tải khi mở ca và mỗi 5 phút chỉ phần thay đổi; QUYTAC_NGHIEPVU_609), trạng thái mạng.
import type { IposCatalog, IposCatalogVariant, IposCurrentShift, IposPosContext, IposShift } from "contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiFailure } from "./api";

const syncMinutes = 5;

interface PosValue {
  current: IposCurrentShift | null;
  shift: IposShift | null;
  context: IposPosContext | null;
  categories: IposCatalog["categories"];
  variants: IposCatalogVariant[];
  online: boolean;
  loadError: string | null;
  reloadShift: () => Promise<void>;
  setShift: (shift: IposShift | null) => void;
  sync: (full?: boolean) => Promise<void>;
  byBarcode: (code: string) => IposCatalogVariant[];
  markOnline: (online: boolean) => void;
}

const PosContext = createContext<PosValue | null>(null);

export function usePos(): PosValue {
  const value = useContext(PosContext);
  if (!value) throw new Error("usePos chỉ dùng bên trong PosProvider.");
  return value;
}

export function PosProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<IposCurrentShift | null>(null);
  const [context, setContext] = useState<IposPosContext | null>(null);
  const [categories, setCategories] = useState<IposCatalog["categories"]>([]);
  const [catalog, setCatalog] = useState<Map<string, IposCatalogVariant>>(new Map());
  const [online, setOnline] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const since = useRef<string | null>(null);

  const markOnline = useCallback((value: boolean) => setOnline(value), []);

  const reloadShift = useCallback(async () => {
    try {
      setCurrent(await api<IposCurrentShift>("/ipos/pos/shifts/current"));
      setLoadError(null);
      setOnline(true);
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 0) setOnline(false);
      setLoadError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);

  const sync = useCallback(async (full = false) => {
    try {
      const query = !full && since.current ? `?since=${encodeURIComponent(since.current)}` : "";
      const data = await api<IposCatalog>(`/ipos/pos/catalog${query}`);
      setContext(data.context);
      setCategories(data.categories);
      setCatalog((previous) => {
        const next = data.full ? new Map<string, IposCatalogVariant>() : new Map(previous);
        for (const variant of data.variants) {
          if (variant.active) next.set(variant.variantId, variant);
          else next.delete(variant.variantId);
        }
        return next;
      });
      since.current = data.serverTime;
      setOnline(true);
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 0) setOnline(false);
    }
  }, []);

  useEffect(() => {
    void reloadShift();
    void sync(true);
  }, [reloadShift, sync]);

  useEffect(() => {
    const timer = setInterval(() => void sync(), syncMinutes * 60_000);
    return () => clearInterval(timer);
  }, [sync]);

  const variants = useMemo(() => [...catalog.values()].sort((left, right) => left.name.localeCompare(right.name, "vi")), [catalog]);
  const barcodeIndex = useMemo(() => {
    const index = new Map<string, IposCatalogVariant[]>();
    for (const variant of catalog.values()) {
      for (const code of [...variant.barcodes, variant.variantCode.toUpperCase()]) index.set(code, [...(index.get(code) ?? []), variant]);
    }
    return index;
  }, [catalog]);

  const value: PosValue = {
    current,
    shift: current?.shift ?? null,
    context,
    categories,
    variants,
    online,
    loadError,
    reloadShift,
    setShift: (shift) => setCurrent((previous) => (previous ? { ...previous, shift } : previous)),
    sync,
    byBarcode: (code) => barcodeIndex.get(code.trim()) ?? barcodeIndex.get(code.trim().toUpperCase()) ?? [],
    markOnline,
  };
  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

// Định dạng tiền, số lượng hiển thị trên máy bán.
export const money = (value: string | number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value));
export const qty = (value: string | number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value));
export const newKey = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (globalThis.crypto?.getRandomValues?.(new Uint8Array(1))[0] ?? Math.floor(Math.random() * 256)) % 16;
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
