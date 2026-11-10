"use client";

// MAN_HINH_32 Phiếu nhập khác, xuất khác, điều chỉnh (CHUC_NANG_40; QUYTAC_NGHIEPVU_47, 50, 51; API_65):
// quét mã vạch thêm dòng, chọn lô gợi ý hết hạn trước, serial, vị trí; gửi duyệt, rút; liên kết MAN_HINH_08.
// MAN_HINH_33 Phiếu chuyển kho (CHUC_NANG_41; API_66): kho đích, kho nguồn xác nhận xuất, kho đích nhận theo số thực nhận, biên bản chênh lệch.
import {
  stockReasonCodes,
  type LocationResponse,
  type LotSuggestion,
  type StockDocumentResponse,
  type StocktakeOptionsResponse,
  type StockDocumentType,
  type StockItemOption,
  type TransferDestination,
  type WarehouseResponse,
} from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, Suspense, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { DocumentStatusBadge } from "@/components/DocumentStatus";

type LineDraft = {
  key: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  tracksLots: boolean;
  tracksSerials: boolean;
  units: StockItemOption["units"];
  unitId: string;
  quantity: string;
  unitCost: string;
  lotId: string;
  lotNo: string;
  manufacturedOn: string;
  expiresOn: string;
  lotOverrideReason: string;
  locationId: string;
  serials: string;
};

const editableTypes = ["receipt_other", "issue_other", "adjustment", "transfer"] as const;
let nextKey = 0;
const newKey = () => `dong-${++nextKey}`;
// Dòng làm giảm tồn: phiếu xuất, chuyển kho, hoặc dòng âm của phiếu điều chỉnh.
const decreases = (type: StockDocumentType, quantity: string) => type === "issue_other" || type === "transfer" || (type === "adjustment" && quantity.trim().startsWith("-"));

export default function DocumentPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <DocumentLoader />
    </Suspense>
  );
}

function DocumentLoader() {
  const t = useTranslations("documents");
  const { id } = useParams<{ id: string }>();
  const parameters = useSearchParams();
  const isNew = id === "new";
  const { state, reload } = useApi<StockDocumentResponse>(isNew ? null : `/inventory/documents/${id}`);
  if (isNew) {
    const type = parameters.get("type") as (typeof editableTypes)[number] | null;
    if (!type || !editableTypes.includes(type)) return <MessageView text={t("chooseType")} />;
    return <DocumentForm type={type} document={null} onChanged={() => undefined} />;
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(document) =>
        document.canEdit ? (
          <DocumentForm key={`${document.id}:${document.version}`} type={document.type} document={document} onChanged={() => void reload()} />
        ) : (
          <DocumentView document={document} onChanged={() => void reload()} />
        )
      }
    </Loaded>
  );
}

function DocumentForm({ type, document, onChanged }: { type: StockDocumentType; document: StockDocumentResponse | null; onChanged: () => void }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const { notify } = useAdmin();
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const [warehouseId, setWarehouseId] = useState(document?.warehouseId ?? "");
  const [companyId, setCompanyId] = useState(document?.companyId ?? "");
  const [documentDate, setDocumentDate] = useState(document?.documentDate ?? vietnamToday());
  const reasonCodes = stockReasonCodes[type] as readonly string[];
  const [reasonCode, setReasonCode] = useState(document?.reasonCode ?? reasonCodes[0]!);
  const [reason, setReason] = useState(document?.reason ?? "");
  const [note, setNote] = useState(document?.note ?? "");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(document?.destinationWarehouseId ?? "");
  const destinations = useApi<TransferDestination[]>(type === "transfer" && companyId ? `/inventory/transfer-destinations?companyId=${companyId}` : null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [draft, setDraft] = useState<{ id: string; version: number } | null>(document ? { id: document.id, version: document.version } : null);
  const [confirming, setConfirming] = useState<"submit" | "delete" | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const operable = warehouses.state.kind === "ready" ? warehouses.state.data.filter((item) => item.canOperate && item.status === "active") : [];
  const warehouse = operable.find((item) => item.id === warehouseId) ?? null;
  const locations = useApi<LocationResponse[]>(warehouse?.usesLocations ? `/inventory/warehouses/${warehouse.id}/locations` : null);
  const activeLocations = locations.state.kind === "ready" ? locations.state.data.filter((location) => location.status === "active") : [];

  // Chọn sẵn kho, chủ hàng đầu tiên; phiếu đã lập thì nạp lại thông tin đơn vị của từng dòng.
  useEffect(() => {
    if (!warehouseId && operable[0]) setWarehouseId(operable[0].id);
  }, [operable, warehouseId]);
  useEffect(() => {
    if (warehouse && !warehouse.owners.some((owner) => owner.companyId === companyId))
      setCompanyId(warehouse.owners.find((owner) => owner.companyId === warehouse.companyId)?.companyId ?? warehouse.owners[0]!.companyId);
  }, [warehouse, companyId]);
  useEffect(() => {
    if (!document) return;
    void (async () => {
      const loaded: LineDraft[] = [];
      for (const line of document.lines) {
        const options = await apiFetch<StockItemOption[]>(`/inventory/items?${new URLSearchParams({ companyId: document.companyId, search: line.sku })}`).catch(() => []);
        const option = options.find((item) => item.variantId === line.variantId);
        loaded.push({
          key: newKey(),
          variantId: line.variantId,
          sku: line.sku,
          productName: line.productName,
          optionValues: line.optionValues,
          tracksLots: line.tracksLots,
          tracksSerials: line.tracksSerials,
          units: option?.units ?? [{ unitId: line.unitId, unitName: line.unitName, factor: "1" }],
          unitId: line.unitId,
          quantity: line.quantity,
          unitCost: line.unitCost ?? "",
          lotId: line.lotId ?? "",
          lotNo: line.lotNo ?? "",
          manufacturedOn: line.manufacturedOn ?? "",
          expiresOn: line.expiresOn ?? "",
          lotOverrideReason: line.lotOverrideReason ?? "",
          locationId: line.locationId ?? "",
          serials: line.serials.join("\n"),
        });
      }
      setLines(loaded);
    })();
  }, [document]);

  function addItem(option: StockItemOption) {
    setLines((current) => [
      ...current,
      {
        key: newKey(),
        variantId: option.variantId,
        sku: option.sku,
        productName: option.productName,
        optionValues: option.optionValues,
        tracksLots: option.tracksLots,
        tracksSerials: option.tracksSerials,
        units: option.units,
        unitId: option.matchedUnitId ?? option.baseUnitId,
        quantity: "1",
        unitCost: "",
        lotId: "",
        lotNo: "",
        manufacturedOn: "",
        expiresOn: "",
        lotOverrideReason: "",
        locationId: activeLocations.length === 1 ? activeLocations[0]!.id : "",
        serials: "",
      },
    ]);
  }
  const update = (key: string, change: Partial<LineDraft>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));

  async function save(): Promise<string> {
    const body = JSON.stringify({
      type,
      warehouseId,
      companyId,
      documentDate,
      reasonCode,
      reason,
      note: note || null,
      destinationWarehouseId: type === "transfer" ? destinationWarehouseId || null : null,
      version: draft?.version,
      lines: lines.map((line) => ({
        variantId: line.variantId,
        unitId: line.unitId,
        quantity: line.quantity.replace(",", "."),
        unitCost: line.unitCost || null,
        lotId: line.lotId || null,
        lotNo: line.lotNo || null,
        manufacturedOn: line.manufacturedOn || null,
        expiresOn: line.expiresOn || null,
        lotOverrideReason: line.lotOverrideReason || null,
        locationId: line.locationId || null,
        serials: line.serials
          .split(/[\n,;]/)
          .map((serial) => serial.trim())
          .filter(Boolean),
      })),
    });
    const saved = draft
      ? await apiFetch<StockDocumentResponse>(`/inventory/documents/${draft.id}`, { method: "PATCH", body })
      : await apiFetch<StockDocumentResponse>("/inventory/documents", { method: "POST", body });
    setDraft({ id: saved.id, version: saved.version });
    return saved.id;
  }

  function saveDraft() {
    void run(async () => {
      const savedId = await save();
      notify(t("saved"));
      if (document) onChanged();
      else router.replace(`/documents/${savedId}`);
    });
  }

  function submit() {
    setConfirming(null);
    void run(async () => {
      const savedId = await save();
      const submitted = await apiFetch<StockDocumentResponse>(`/inventory/documents/${savedId}/submit`, { method: "POST" });
      notify(submitted.status === "posted" ? t(type === "transfer" ? "approvedNow" : "postedNow") : t("submitted"));
      if (document) onChanged();
      else router.replace(`/documents/${savedId}`);
    });
  }

  async function remove() {
    setConfirming(null);
    try {
      await apiFetch(`/inventory/documents/${draft!.id}`, { method: "DELETE" });
      notify(t("deleted"));
      router.replace("/documents");
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const lineError = (index: number) =>
    Object.entries(fields)
      .filter(([key]) => key.startsWith(`lines.${index}.`))
      .map(([, message]) => message)
      .join(" ");

  return (
    <>
      <div className="tieu-de">
        <h1>{document?.documentNo ?? t(`new_${type}`)}</h1>
        <Link className="nut phu" href="/documents">
          {t("backToList")}
        </Link>
      </div>
      <section className="the" style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <div style={{ display: "grid", gap: "var(--khoang-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field id="kho" label={`${t("warehouse")} *`} error={fields.warehouseId}>
            <select id="kho" className={inputClass("warehouseId")} value={warehouseId} disabled={Boolean(draft)} onChange={(event) => setWarehouseId(event.target.value)}>
              {operable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="chu-hang" label={`${t("owner")} *`} hint={t("ownerHint")} error={fields.companyId}>
            <select id="chu-hang" className={inputClass("companyId")} value={companyId} disabled={Boolean(draft) || lines.length > 0} onChange={(event) => setCompanyId(event.target.value)}>
              {warehouse?.owners.map((owner) => (
                <option key={owner.companyId} value={owner.companyId}>
                  {owner.companyName}
                </option>
              ))}
            </select>
          </Field>
          {type === "transfer" && (
            <Field id="kho-dich" label={`${t("destination")} *`} error={fields.destinationWarehouseId}>
              <select id="kho-dich" className={inputClass("destinationWarehouseId")} value={destinationWarehouseId} onChange={(event) => setDestinationWarehouseId(event.target.value)}>
                <option value="">—</option>
                {destinations.state.kind === "ready" &&
                  destinations.state.data
                    .filter((item) => item.id !== warehouseId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.name} ({item.companyName})
                      </option>
                    ))}
              </select>
            </Field>
          )}
          <Field id="ngay-phieu" label={`${t("date")} *`} error={fields.documentDate}>
            <input id="ngay-phieu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
          </Field>
          <Field id="ma-ly-do" label={`${t("reasonCode")} *`} error={fields.reasonCode}>
            <select id="ma-ly-do" className={inputClass("reasonCode")} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {reasonCodes.map((code) => (
                <option key={code} value={code}>
                  {t(`reason_${code}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="ly-do" label={`${t("reason")} *`} error={fields.reason}>
          <input id="ly-do" className={inputClass("reason")} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field id="ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu" className={inputClass("note")} rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>

      <section className="the" style={{ marginTop: "var(--khoang-4)", display: "grid", gap: "var(--khoang-3)" }}>
        <h2>{t("lines")}</h2>
        {companyId && <ItemScanner companyId={companyId} onPick={addItem} />}
        {type === "adjustment" && <p className="chu-thich">{t("adjustmentHint")}</p>}
        {lines.length === 0 ? (
          <p className="chu-thich">{t("noLines")}</p>
        ) : (
          lines.map((line, index) => (
            <LineEditor
              key={line.key}
              line={line}
              type={type}
              warehouseId={warehouseId}
              companyId={companyId}
              locations={warehouse?.usesLocations ? activeLocations : null}
              reasonCode={reasonCode}
              error={lineError(index)}
              onChange={(change) => update(line.key, change)}
              onRemove={() => setLines(lines.filter((item) => item.key !== line.key))}
            />
          ))
        )}
        {fields.lines && <span className="loi-o">{fields.lines}</span>}
      </section>

      <FormError text={formError} />
      <div className="nhom-nut" style={{ marginTop: "var(--khoang-4)" }}>
        <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !warehouseId} onClick={saveDraft}>
          {t("saveDraft")}
        </button>
        <button type="button" className="nut chinh" disabled={submitting || lines.length === 0} onClick={() => setConfirming("submit")}>
          {t("submit")}
        </button>
        {draft && (
          <button type="button" className="nut chu" onClick={() => setConfirming("delete")}>
            {t("delete")}
          </button>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title={t(`${confirming}Title`)}
          text={t(`${confirming}Text`)}
          confirmLabel={confirming === "submit" ? t("submit") : t("delete")}
          busy={submitting}
          onConfirm={() => (confirming === "submit" ? submit() : void remove())}
          onClose={() => setConfirming(null)}
        />
      )}
    </>
  );
}

// Ô quét mã vạch: máy quét gõ mã kèm Enter; một kết quả thì thêm ngay, nhiều kết quả thì cho chọn.
function ItemScanner({ companyId, onPick }: { companyId: string; onPick: (option: StockItemOption) => void }) {
  const t = useTranslations("documents");
  const { notify } = useAdmin();
  const [text, setText] = useState("");
  const [options, setOptions] = useState<StockItemOption[]>([]);

  async function find(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const search = text.trim();
    if (!search) return;
    try {
      const found = await apiFetch<StockItemOption[]>(`/inventory/items?${new URLSearchParams({ companyId, search })}`);
      const exact = found.filter((item) => item.matchedUnitId || item.sku === search.toUpperCase());
      if (exact.length === 1 || found.length === 1) {
        onPick(exact[0] ?? found[0]!);
        setText("");
        setOptions([]);
      } else if (found.length === 0) {
        notify(t("itemNotFound"), "loi");
      } else {
        setOptions(found);
      }
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <label htmlFor="quet-ma">{t("scan")}</label>
      <input id="quet-ma" className="o-nhap" autoFocus placeholder={t("scanHint")} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => void find(event)} />
      {options.length > 0 && (
        <div className="nhom-nut">
          {options.map((option) => (
            <button
              key={option.variantId}
              type="button"
              className="nut phu"
              onClick={() => {
                onPick(option);
                setOptions([]);
                setText("");
              }}
            >
              {option.sku} · {option.productName}
              {option.optionValues.length > 0 ? ` · ${option.optionValues.join(" / ")}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LineEditor(props: {
  line: LineDraft;
  type: StockDocumentType;
  warehouseId: string;
  companyId: string;
  locations: LocationResponse[] | null;
  reasonCode: string;
  error: string;
  onChange: (change: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  const { line, type, locations, error, onChange } = props;
  const t = useTranslations("documents");
  const decrease = decreases(type, line.quantity);
  const id = (field: string) => `${line.key}-${field}`;
  const lotQuery =
    decrease && line.tracksLots && props.warehouseId
      ? new URLSearchParams({
          warehouseId: props.warehouseId,
          companyId: props.companyId,
          variantId: line.variantId,
          ...(line.locationId ? { locationId: line.locationId } : {}),
          ...(props.reasonCode === "expired_disposal" ? { includeExpired: "true" } : {}),
        })
      : null;
  const lots = useApi<LotSuggestion[]>(lotQuery ? `/inventory/documents/lot-suggestions?${lotQuery}` : null);
  const lotOptions = lots.state.kind === "ready" ? lots.state.data : [];
  const suggested = lotOptions.find((lot) => lot.suggested);
  useEffect(() => {
    if (decrease && line.tracksLots && !line.lotId && suggested) onChange({ lotId: suggested.lotId });
  }, [decrease, line.tracksLots, line.lotId, suggested, onChange]);

  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <strong>
          {line.sku} · {line.productName}
          {line.optionValues.length > 0 && <span className="chu-thich"> · {line.optionValues.join(" / ")}</span>}
        </strong>
        <button type="button" className="nut chu" onClick={props.onRemove}>
          {t("removeLine")}
        </button>
      </div>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Field id={id("so-luong")} label={t("quantity")}>
          <input id={id("so-luong")} inputMode="decimal" className="o-nhap" value={line.quantity} onChange={(event) => onChange({ quantity: event.target.value })} />
        </Field>
        <Field id={id("don-vi")} label={t("unit")}>
          <select id={id("don-vi")} className="o-nhap" value={line.unitId} onChange={(event) => onChange({ unitId: event.target.value })}>
            {line.units.map((unit) => (
              <option key={unit.unitId} value={unit.unitId}>
                {unit.unitName}
                {unit.factor !== "1" ? ` (${unit.factor})` : ""}
              </option>
            ))}
          </select>
        </Field>
        {!decrease && type !== "issue_other" && (
          <Field id={id("don-gia")} label={type === "receipt_other" ? `${t("unitCost")} *` : t("unitCostOptional")}>
            <input id={id("don-gia")} inputMode="decimal" className="o-nhap" value={line.unitCost} onChange={(event) => onChange({ unitCost: event.target.value.replace(/[.\s]/g, "") })} />
          </Field>
        )}
        {locations && (
          <Field id={id("vi-tri")} label={`${t("location")} *`}>
            <select id={id("vi-tri")} className="o-nhap" value={line.locationId} onChange={(event) => onChange({ locationId: event.target.value, lotId: "" })}>
              <option value="">—</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code}
                </option>
              ))}
            </select>
          </Field>
        )}
        {line.tracksLots && !decrease && (
          <>
            <Field id={id("so-lo")} label={`${t("lotNo")} *`}>
              <input id={id("so-lo")} className="o-nhap" value={line.lotNo} maxLength={50} onChange={(event) => onChange({ lotNo: event.target.value })} />
            </Field>
            <Field id={id("han-dung")} label={`${t("expiresOn")} *`}>
              <input id={id("han-dung")} type="date" className="o-nhap" value={line.expiresOn} onChange={(event) => onChange({ expiresOn: event.target.value })} />
            </Field>
            <Field id={id("ngay-san-xuat")} label={t("manufacturedOn")}>
              <input id={id("ngay-san-xuat")} type="date" className="o-nhap" value={line.manufacturedOn} onChange={(event) => onChange({ manufacturedOn: event.target.value })} />
            </Field>
          </>
        )}
        {line.tracksLots && decrease && (
          <Field id={id("lo")} label={`${t("lot")} *`}>
            <select id={id("lo")} className="o-nhap" value={line.lotId} onChange={(event) => onChange({ lotId: event.target.value })}>
              <option value="">—</option>
              {lotOptions.map((lot) => (
                <option key={`${lot.lotId}:${lot.locationId ?? ""}`} value={lot.lotId}>
                  {lot.lotNo} · {lot.expiresOn ? formatDate(lot.expiresOn) : t("noExpiry")} · {formatNumber(lot.quantity)}
                  {lot.suggested ? ` · ${t("suggested")}` : ""}
                  {lot.expired ? ` · ${t("expired")}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {line.tracksLots && decrease && line.lotId && suggested && line.lotId !== suggested.lotId && (
        <Field id={id("ly-do-lo")} label={`${t("lotOverrideReason")} *`}>
          <input id={id("ly-do-lo")} className="o-nhap" value={line.lotOverrideReason} maxLength={200} onChange={(event) => onChange({ lotOverrideReason: event.target.value })} />
        </Field>
      )}
      {line.tracksSerials && (
        <Field id={id("serial")} label={`${t("serials")} *`} hint={t("serialsHint")}>
          <textarea id={id("serial")} className="o-nhap" rows={3} value={line.serials} onChange={(event) => onChange({ serials: event.target.value })} />
        </Field>
      )}
      {error && <span className="loi-o">{error}</span>}
    </div>
  );
}

function DocumentView({ document, onChanged }: { document: StockDocumentResponse; onChanged: () => void }) {
  const t = useTranslations("documents");
  const { notify } = useAdmin();
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = (value: string | null) => (value === null ? "—" : formatMoney(value, "VND"));
  // Phiếu nháp nhập mua, trả hàng: chỉ gửi hoặc xóa (lập lại từ đơn mua, phiếu nhập gốc).
  const purchaseDraft = ["purchase_receipt", "purchase_return", "sales_issue", "sales_return"].includes(document.type) && document.status === "draft";

  async function act(action: "submit" | "delete") {
    setBusy(true);
    try {
      if (action === "delete") {
        await apiFetch(`/inventory/documents/${document.id}`, { method: "DELETE" });
        window.location.assign("/inventory/documents");
        return;
      }
      await apiFetch(`/inventory/documents/${document.id}/submit`, { method: "POST" });
      notify(t("purchaseSubmitted"));
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  async function ship() {
    setBusy(true);
    try {
      await apiFetch(`/inventory/documents/${document.id}/ship`, { method: "POST" });
      notify(t("shipped"));
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      await apiFetch(`/inventory/documents/${document.id}/withdraw`, { method: "POST" });
      notify(t("withdrawn"));
      setWithdrawing(false);
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  const headings = [t("sku"), t("quantity"), t("lot"), t("location"), t("serials"), t("value")];
  return (
    <>
      <div className="tieu-de">
        <h1>
          {t(`type_${document.type}`)} {document.documentNo ?? t("draftNo")}
        </h1>
        <DocumentStatusBadge status={document.status} type={document.type} />
        <Link className="nut phu" href="/documents">
          {t("backToList")}
        </Link>
        {document.approvalRequestId && (
          <a className="nut phu" href={`/hop-duyet/${document.approvalRequestId}`}>
            {t("viewApproval")}
          </a>
        )}
        <button
          type="button"
          className="nut phu"
          onClick={() =>
            void apiDownload(
              `/inventory/labels/products?companyId=${document.companyId}&variantIds=${[...new Set(document.lines.map((line) => line.variantId))].join(",")}&copies=1`,
              "tem-san-pham.pdf",
              true,
            ).catch((error) => notify(failureOf(error).message, "loi"))
          }
        >
          {t("printLabels")}
        </button>
        {document.canShip && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void ship()}>
            {t("ship")}
          </button>
        )}
        {document.canWithdraw && (
          <button type="button" className="nut phu" onClick={() => setWithdrawing(true)}>
            {t("withdraw")}
          </button>
        )}
        {purchaseDraft && (
          <>
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("delete")}>
              {t("deleteDraft")}
            </button>
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit")}>
              {t("submitPurchase")}
            </button>
          </>
        )}
        {document.canReturn && (
          <Link className="nut phu" href={document.type === "sales_issue" ? `/sales-returns/new?issueId=${document.id}` : `/purchase-returns/new?receiptId=${document.id}`}>
            {document.type === "sales_issue" ? t("receiveReturn") : t("returnToSupplier")}
          </Link>
        )}
      </div>
      <section className="the">
        <dl className="thong-tin-dong">
          <dt>{t("warehouse")}</dt>
          <dd>
            {document.warehouseName}
            {document.destinationWarehouseName && ` → ${document.destinationWarehouseName}`}
          </dd>
          <dt>{t("owner")}</dt>
          <dd>{document.companyName}</dd>
          {document.partnerName && (
            <>
              <dt>{t(document.type.startsWith("sales") ? "customer" : "supplier")}</dt>
              <dd>{document.partnerName}</dd>
            </>
          )}
          {document.internalReceipt && (
            <>
              <dt>{t("internalIssue")}</dt>
              <dd>
                {document.internalReceipt.sellerCompanyName}: {document.internalReceipt.issueDocumentNo}
              </dd>
            </>
          )}
          {document.sourceNo && (
            <>
              <dt>
                {t(document.type === "purchase_receipt" ? "sourceOrder" : document.type === "sales_issue" ? "sourceSalesOrder" : document.type === "sales_return" ? "sourceIssue" : "sourceReceipt")}
              </dt>
              <dd>
                {document.type === "purchase_receipt" || document.type === "sales_issue" ? (
                  // Thẻ a thường: đơn mua, đơn bán nằm ở mini app Mua hàng, Bán hàng.
                  <a href={`/${document.type === "sales_issue" ? "sales" : "purchasing"}/orders/${document.sourceId}`}>{document.sourceNo}</a>
                ) : (
                  <Link href={`/documents/${document.sourceId}`}>{document.sourceNo}</Link>
                )}
              </dd>
            </>
          )}
          <dt>{t("date")}</dt>
          <dd>{formatDate(document.documentDate)}</dd>
          <dt>{t("reason")}</dt>
          <dd>
            {t(`reason_${document.reasonCode}`)}: {document.reason}
          </dd>
          {document.note && (
            <>
              <dt>{t("note")}</dt>
              <dd>{document.note}</dd>
            </>
          )}
          <dt>{t("createdBy")}</dt>
          <dd>{document.createdByName}</dd>
          <dt>{t("value")}</dt>
          <dd>{money(document.totalValue)}</dd>
        </dl>
      </section>
      <div className="khung-bang" style={{ marginTop: "var(--khoang-4)" }}>
        <table>
          <thead>
            <tr>
              {headings.map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>
                    {line.sku} · {line.productName}
                    {line.optionValues.length > 0 && <span className="chu-thich"> · {line.optionValues.join(" / ")}</span>}
                  </span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>
                    {formatNumber(line.quantity)} {line.unitName}
                    {line.unitName !== line.baseUnitName && (
                      <span className="chu-thich">
                        {" "}
                        = {formatNumber(line.baseQuantity)} {line.baseUnitName}
                      </span>
                    )}
                  </span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>
                    {line.lotNo ? `${line.lotNo}${line.expiresOn ? ` · ${formatDate(line.expiresOn)}` : ""}` : "—"}
                    {line.lotOverrideReason && <span className="chu-thich"> · {line.lotOverrideReason}</span>}
                  </span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{line.locationCode ?? "—"}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>
                    {line.serials.join(", ") || "—"}
                    {line.rejectedBaseQuantity !== null && Number(line.rejectedBaseQuantity) > 0 && (
                      <span className="nhan loi">
                        {" "}
                        {t("rejected", { count: formatNumber(line.rejectedBaseQuantity), unit: line.baseUnitName })}: {line.rejectionReason}
                      </span>
                    )}
                  </span>
                </td>
                <td data-nhan={headings[5]}>
                  <span>{money(line.costValue)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {document.canReceive && <ReceiveForm document={document} onReceived={onChanged} />}
      {document.canQualityCheck && <QualityCheckForm document={document} onChecked={onChanged} />}
      {document.canReceiveInternal && <InternalReceiveForm document={document} onReceived={onChanged} />}
      {document.discrepancies.length > 0 && (
        <section className="the" style={{ marginTop: "var(--khoang-4)" }}>
          <h2>{t("discrepancies")}</h2>
          <ul>
            {document.discrepancies.map((item) => (
              <li key={item.lineId}>
                {item.sku}: {t("discrepancyLine", { shipped: formatNumber(item.shippedQuantity), received: formatNumber(item.receivedQuantity), difference: formatNumber(item.difference) })}
                {item.value !== null && ` · ${money(item.value)}`}
                {item.note && <span className="chu-thich"> · {item.note}</span>}
                {item.responsibleUserName && ` · ${t("responsible")}: ${item.responsibleUserName}`}
                {item.compensationAmount !== null && ` · ${t("compensation")}: ${money(item.compensationAmount)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {withdrawing && (
        <ConfirmDialog title={t("withdrawTitle")} text={t("withdrawText")} confirmLabel={t("withdraw")} busy={busy} onConfirm={() => void withdraw()} onClose={() => setWithdrawing(false)} />
      )}
    </>
  );
}

// Kho đích nhận hàng: số thực nhận theo đơn vị cơ sở, vị trí đích, serial nhận được; chênh lệch tự lập biên bản.
function ReceiveForm({ document, onReceived }: { document: StockDocumentResponse; onReceived: () => void }) {
  const t = useTranslations("documents");
  const { notify } = useAdmin();
  const destination = useApi<WarehouseResponse>(`/inventory/warehouses/${document.destinationWarehouseId}`);
  const usesLocations = destination.state.kind === "ready" && destination.state.data.usesLocations;
  const locations = useApi<LocationResponse[]>(usesLocations ? `/inventory/warehouses/${document.destinationWarehouseId}/locations` : null);
  const people = useApi<StocktakeOptionsResponse>(`/inventory/stocktake-options?warehouseId=${document.destinationWarehouseId}`);
  const [lines, setLines] = useState(
    document.lines.map((line) => ({ lineId: line.id, receivedQuantity: line.baseQuantity, destinationLocationId: "", serials: line.serials.join("\n"), responsibleUserId: "" })),
  );
  const [note, setNote] = useState("");
  const { submitting, fields, formError, run } = useSubmit();
  const update = (index: number, change: Partial<(typeof lines)[number]>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));

  function submit() {
    void run(async () => {
      await apiFetch(`/inventory/documents/${document.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          note: note || null,
          lines: lines.map((line) => ({
            lineId: line.lineId,
            receivedQuantity: line.receivedQuantity.replace(",", "."),
            destinationLocationId: line.destinationLocationId || null,
            responsibleUserId: line.responsibleUserId || null,
            serials: line.serials
              .split(/[\n,;]/)
              .map((serial) => serial.trim())
              .filter(Boolean),
          })),
        }),
      });
      notify(t("received"));
      onReceived();
    });
  }

  return (
    <section className="the" style={{ marginTop: "var(--khoang-4)", display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("receiveTitle")}</h2>
      <p className="chu-thich">{t("receiveHint")}</p>
      {document.lines.map((line, index) => (
        <div key={line.id} style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
          <strong>
            {line.sku} · {formatNumber(line.baseQuantity)} {line.baseUnitName}
            {line.lotNo && <span className="chu-thich"> · {line.lotNo}</span>}
          </strong>
          <Field id={`nhan-${index}`} label={t("receivedQuantity")}>
            <input id={`nhan-${index}`} inputMode="decimal" className="o-nhap" value={lines[index]!.receivedQuantity} onChange={(event) => update(index, { receivedQuantity: event.target.value })} />
          </Field>
          {usesLocations && (
            <Field id={`vi-tri-nhan-${index}`} label={`${t("location")} *`}>
              <select id={`vi-tri-nhan-${index}`} className="o-nhap" value={lines[index]!.destinationLocationId} onChange={(event) => update(index, { destinationLocationId: event.target.value })}>
                <option value="">—</option>
                {locations.state.kind === "ready" &&
                  locations.state.data
                    .filter((location) => location.status === "active")
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code}
                      </option>
                    ))}
              </select>
            </Field>
          )}
          {Number(lines[index]!.receivedQuantity.replace(",", ".")) < Number(line.baseQuantity) && (
            <Field id={`trach-nhiem-${index}`} label={t("responsible")}>
              <select id={`trach-nhiem-${index}`} className="o-nhap" value={lines[index]!.responsibleUserId} onChange={(event) => update(index, { responsibleUserId: event.target.value })}>
                <option value="">—</option>
                {people.state.kind === "ready" &&
                  people.state.data.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {line.tracksSerials && (
            <Field id={`serial-nhan-${index}`} label={t("serials")}>
              <textarea id={`serial-nhan-${index}`} className="o-nhap" rows={2} value={lines[index]!.serials} onChange={(event) => update(index, { serials: event.target.value })} />
            </Field>
          )}
          {Object.entries(fields)
            .filter(([key]) => key.startsWith(`lines.${index}.`))
            .map(([key, message]) => (
              <span key={key} className="loi-o">
                {message}
              </span>
            ))}
        </div>
      ))}
      <Field id="ghi-chu-nhan" label={t("receiveNote")}>
        <input id="ghi-chu-nhan" className="o-nhap" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifySelf: "start" }} onClick={submit}>
        {t("receive")}
      </button>
    </section>
  );
}

// Kết quả kiểm tra chất lượng phiếu nhập mua (QUYTAC_NGHIEPVU_65): số không đạt theo đơn vị của dòng, serial không đạt, lý do; phần đạt ghi sổ kho.
function QualityCheckForm({ document, onChecked }: { document: StockDocumentResponse; onChecked: () => void }) {
  const t = useTranslations("documents");
  const { notify } = useAdmin();
  const [results, setResults] = useState<Record<string, { rejectedQuantity: string; rejectedSerials: string[]; rejectionReason: string }>>({});
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const result = (lineId: string) => results[lineId] ?? { rejectedQuantity: "0", rejectedSerials: [], rejectionReason: "" };
  const change = (lineId: string, value: Partial<ReturnType<typeof result>>) => setResults({ ...results, [lineId]: { ...result(lineId), ...value } });

  function submit() {
    void run(async () => {
      await apiFetch(`/inventory/documents/${document.id}/quality-check`, {
        method: "POST",
        body: JSON.stringify({
          lines: document.lines.map((line) => ({ lineId: line.id, ...result(line.id), rejectedQuantity: line.tracksSerials ? "0" : result(line.id).rejectedQuantity || "0" })),
          version: document.version,
        }),
      });
      notify(t("qualityChecked"));
      onChecked();
    });
  }

  return (
    <section className="the" style={{ marginTop: "var(--khoang-4)" }}>
      <h2 style={{ margin: 0 }}>{t("qualityCheck")}</h2>
      <div className="chu-thich">{t("qualityCheckHint")}</div>
      {document.lines.map((line, index) => (
        <fieldset key={line.id} className="the" style={{ margin: 0 }}>
          <legend className="an-nhan">{line.sku}</legend>
          <strong>
            {line.sku} · {line.productName} · {formatNumber(line.quantity)} {line.unitName}
          </strong>
          {line.tracksSerials ? (
            <Field id={`serial-loi-${index}`} label={t("rejectedSerials")} error={fields[`lines.${index}.rejectedSerials`]}>
              <span className="nhom-nut">
                {line.serials.map((serial) => (
                  <label key={serial}>
                    <input
                      type="checkbox"
                      checked={result(line.id).rejectedSerials.includes(serial)}
                      onChange={(event) =>
                        change(line.id, {
                          rejectedSerials: event.target.checked ? [...result(line.id).rejectedSerials, serial] : result(line.id).rejectedSerials.filter((item) => item !== serial),
                        })
                      }
                    />{" "}
                    {serial}
                  </label>
                ))}
              </span>
            </Field>
          ) : (
            <Field id={`so-loi-${index}`} label={t("rejectedQuantity", { unit: line.unitName })} error={fields[`lines.${index}.rejectedQuantity`]}>
              <input
                id={`so-loi-${index}`}
                className={inputClass(`lines.${index}.rejectedQuantity`)}
                inputMode="decimal"
                value={result(line.id).rejectedQuantity}
                onChange={(event) => change(line.id, { rejectedQuantity: event.target.value })}
              />
            </Field>
          )}
          <Field id={`ly-do-loi-${index}`} label={t("rejectionReason")} error={fields[`lines.${index}.rejectionReason`]}>
            <input
              id={`ly-do-loi-${index}`}
              className={inputClass(`lines.${index}.rejectionReason`)}
              value={result(line.id).rejectionReason}
              onChange={(event) => change(line.id, { rejectionReason: event.target.value })}
            />
          </Field>
        </fieldset>
      ))}
      <FormError text={formError} />
      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifySelf: "start" }} onClick={submit}>
        {t("confirmQualityCheck")}
      </button>
    </section>
  );
}

// CONG_VIEC_09 (MAN_HINH_32 sửa): nhận hàng nội bộ theo số thực nhận (đơn vị cơ sở), chọn serial đã xuất, vị trí; nhận thiếu ghi lý do (API_82).
function InternalReceiveForm({ document, onReceived }: { document: StockDocumentResponse; onReceived: () => void }) {
  const t = useTranslations("documents");
  const { notify } = useAdmin();
  const warehouse = useApi<WarehouseResponse>(`/inventory/warehouses/${document.warehouseId}`);
  const usesLocations = warehouse.state.kind === "ready" && warehouse.state.data.usesLocations;
  const locations = useApi<LocationResponse[]>(usesLocations ? `/inventory/warehouses/${document.warehouseId}/locations` : null);
  const shipped = new Map((document.internalReceipt?.lines ?? []).map((line) => [line.lineId, line]));
  const [entries, setEntries] = useState(() =>
    document.lines.map((line) => ({ lineId: line.id, receivedQuantity: line.baseQuantity, locationId: "", serials: shipped.get(line.id)?.shippedSerials ?? [] })),
  );
  const [shortageReason, setShortageReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const change = (index: number, value: Partial<(typeof entries)[number]>) => setEntries(entries.map((entry, position) => (position === index ? { ...entry, ...value } : entry)));
  const short = entries.some((entry) => Number(entry.receivedQuantity || 0) < Number(shipped.get(entry.lineId)?.shippedBaseQuantity ?? 0));

  function submit() {
    void run(async () => {
      await apiFetch(`/inventory/internal-receipts/${document.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          lines: entries.map((entry) => ({ ...entry, receivedQuantity: entry.receivedQuantity || "0", locationId: entry.locationId || null })),
          shortageReason,
          version: document.version,
        }),
      });
      notify(t("internalReceived"));
      onReceived();
    });
  }

  return (
    <section className="the" style={{ marginTop: "var(--khoang-4)" }}>
      <h2 style={{ margin: 0 }}>{t("receiveInternal")}</h2>
      <div className="chu-thich">{t("receiveInternalHint")}</div>
      {document.lines.map((line, index) => {
        const entry = entries[index]!;
        const sent = shipped.get(line.id);
        return (
          <fieldset key={line.id} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">{line.sku}</legend>
            <strong>
              {line.sku} · {line.productName}
            </strong>
            <span className="chu-thich">{t("internalShipped", { count: formatNumber(sent?.shippedBaseQuantity ?? line.baseQuantity), unit: line.baseUnitName })}</span>
            {line.tracksSerials && (sent?.shippedSerials.length ?? 0) > 0 ? (
              <Field id={`serial-nhan-${index}`} label={t("serials")} error={fields[`lines.${index}.serials`] ?? fields[`lines.${index}.receivedQuantity`]}>
                <span className="nhom-nut">
                  {sent!.shippedSerials.map((serial) => (
                    <label key={serial}>
                      <input
                        type="checkbox"
                        checked={entry.serials.includes(serial)}
                        onChange={(event) => {
                          const serials = event.target.checked ? [...entry.serials, serial] : entry.serials.filter((item) => item !== serial);
                          change(index, { serials, receivedQuantity: String(serials.length) });
                        }}
                      />{" "}
                      {serial}
                    </label>
                  ))}
                </span>
              </Field>
            ) : (
              <Field id={`so-nhan-${index}`} label={t("internalReceivedQuantity", { unit: line.baseUnitName })} error={fields[`lines.${index}.receivedQuantity`]}>
                <input
                  id={`so-nhan-${index}`}
                  className={inputClass(`lines.${index}.receivedQuantity`)}
                  inputMode="decimal"
                  value={entry.receivedQuantity}
                  onChange={(event) => change(index, { receivedQuantity: event.target.value })}
                />
              </Field>
            )}
            {usesLocations && (
              <Field id={`vi-tri-nhan-${index}`} label={t("location")} error={fields[`lines.${index}.locationId`]}>
                <select
                  id={`vi-tri-nhan-${index}`}
                  className={inputClass(`lines.${index}.locationId`)}
                  value={entry.locationId}
                  onChange={(event) => change(index, { locationId: event.target.value })}
                >
                  <option value="">—</option>
                  {(locations.state.kind === "ready" ? locations.state.data : [])
                    .filter((location) => location.status === "active")
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code}
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </fieldset>
        );
      })}
      {short && (
        <Field id="ly-do-thieu" label={`${t("shortageReason")} *`} error={fields.shortageReason}>
          <input id="ly-do-thieu" className={inputClass("shortageReason")} value={shortageReason} onChange={(event) => setShortageReason(event.target.value)} />
        </Field>
      )}
      <FormError text={formError} />
      {/* Lỗi lô, hạn dùng… không có ô trên form này: hiện kèm số dòng. */}
      <FormError
        text={
          Object.entries(fields)
            .filter(([key]) => key !== "shortageReason" && !/^lines\.\d+\.(receivedQuantity|serials|locationId)$/.test(key))
            .map(([key, text]) => {
              const line = /^lines\.(\d+)\./.exec(key);
              return line ? `${document.lines[Number(line[1])]?.sku ?? ""}: ${text}` : text;
            })
            .join(" ") || null
        }
      />
      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifySelf: "start" }} onClick={submit}>
        {t("confirmReceiveInternal")}
      </button>
    </section>
  );
}
