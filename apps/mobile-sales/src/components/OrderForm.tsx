// Biểu mẫu đơn bán trên ứng dụng (MAN_HINH_69; CHUC_NANG_101): khách trong phạm vi, kênh, kho, dòng hàng; giá do máy chủ tính theo bảng giá.
import type { SalesOptionsResponse, SalesOrderResponse, SalesPriceResponse, StockItemOption } from "contracts";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { vietnamToday } from "@/lib/orders";
import { colors, space } from "@/lib/theme";
import { Button, Card, Choice, Field, Loading, Muted, Notice, styles } from "./ui";

type Line = { variantId: string; name: string; units: StockItemOption["units"]; unitId: string; quantity: string; price: string | null };

export function OrderForm({ current, customerId, onSaved }: { current: SalesOrderResponse | null; customerId?: string; onSaved: (saved: SalesOrderResponse) => void }) {
  const t = translator("salesApp");
  const [options, setOptions] = useState<SalesOptionsResponse | null>(null);
  const [customer, setCustomer] = useState<string | null>(current?.customerId ?? customerId ?? null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [channelId, setChannelId] = useState<string | null>(current?.channelId ?? null);
  const [warehouseId, setWarehouseId] = useState<string | null>(current?.warehouseId ?? null);
  const [note, setNote] = useState(current?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    current?.lines.map((line) => ({
      variantId: line.variantId,
      name: [line.productName, ...line.optionValues].join(" · "),
      units: [{ unitId: line.unitId, unitName: line.unitName, factor: "1" }],
      unitId: line.unitId,
      quantity: line.quantity,
      price: line.unitPrice,
    })) ?? [],
  );
  const [itemSearch, setItemSearch] = useState("");
  const [found, setFound] = useState<StockItemOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SalesOptionsResponse>("/sales/options")
      .then((loaded) => {
        setOptions(loaded);
        setChannelId((value) => value ?? loaded.channels[0]?.id ?? null);
        setWarehouseId((value) => value ?? loaded.warehouses[0]?.id ?? null);
      })
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);

  useEffect(() => {
    const text = itemSearch.trim();
    if (text.length < 2) return setFound([]);
    const timer = setTimeout(() => {
      api<StockItemOption[]>(`/sales/items?search=${encodeURIComponent(text)}`)
        .then((items) => setFound(items.slice(0, 8)))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  // Giá gợi ý theo kênh, nhóm khách (QUYTAC_NGHIEPVU_67); máy chủ tính lại khi lưu.
  async function priceOf(variantId: string, unitId: string): Promise<string | null> {
    if (!channelId) return null;
    const parameters = new URLSearchParams({ variantId, unitId, channelId });
    if (customer) parameters.set("customerId", customer);
    return (await api<SalesPriceResponse>(`/sales/price?${parameters}`).catch(() => null))?.price ?? null;
  }

  async function addItem(item: StockItemOption) {
    const unitId = item.matchedUnitId ?? item.baseUnitId;
    const line: Line = {
      variantId: item.variantId,
      name: [item.productName, ...item.optionValues].join(" · "),
      units: item.units,
      unitId,
      quantity: "1",
      price: await priceOf(item.variantId, unitId),
    };
    setLines((existing) => [...existing, line]);
    setItemSearch("");
    setFound([]);
  }

  async function changeUnit(index: number, unitId: string) {
    const line = lines[index]!;
    const price = await priceOf(line.variantId, unitId);
    setLines((existing) => existing.map((item, position) => (position === index ? { ...item, unitId, price } : item)));
  }

  async function save() {
    if (!options || !channelId || !warehouseId) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = {
        customerId: customer,
        channelId,
        warehouseId,
        orderDate: current?.orderDate ?? vietnamToday(),
        note: note.trim() || null,
        lines: lines.map((line) => ({ variantId: line.variantId, unitId: line.unitId, quantity: line.quantity.replace(",", "."), discountPercent: "0" })),
        ...(current ? { version: current.version } : {}),
      };
      onSaved(await api<SalesOrderResponse>(current ? `/sales/orders/${current.id}` : "/sales/orders", { method: current ? "PATCH" : "POST", json: body }));
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setError(failure.message);
        setFields(failure.fields);
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  if (!options) return error ? <Notice text={error} /> : <Loading />;
  const chosen = options.customers.find((item) => item.id === customer);
  const matches = customerSearch.trim() ? options.customers.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(customerSearch.trim().toLowerCase())).slice(0, 8) : [];
  const total = lines.reduce((sum, line) => sum + (line.price ? Number(line.price) * Number(line.quantity.replace(",", ".") || 0) : 0), 0);

  return (
    <View style={{ gap: space[3] }}>
      <Card>
        <Text style={styles.label}>{t("customer")}</Text>
        {chosen ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{chosen.name}</Text>
            {!customerId ? (
              <Text accessibilityRole="button" style={{ color: colors.primary, fontWeight: "600" }} onPress={() => setCustomer(null)}>
                {t("change")}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <TextInput
              accessibilityLabel={t("findCustomer")}
              placeholder={t("findCustomer")}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />
            {matches.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => setCustomer(item.id)} style={{ paddingVertical: space[2] }}>
                <Text style={{ color: colors.text }}>
                  {item.code} · {item.name}
                </Text>
              </Pressable>
            ))}
          </>
        )}
        {fields.customerId ? <Text style={styles.error}>{fields.customerId}</Text> : null}
        <Choice label={t("channel")} value={channelId} options={options.channels.map((item) => ({ value: item.id, label: item.name }))} onChange={setChannelId} />
        <Choice label={t("warehouse")} value={warehouseId} options={options.warehouses.map((item) => ({ value: item.id, label: item.name }))} onChange={setWarehouseId} />
      </Card>
      <Card>
        <Text style={styles.label}>{t("lines")}</Text>
        {lines.map((line, index) => (
          <View key={`${line.variantId}-${index}`} style={{ gap: space[1], borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
              <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>{line.name}</Text>
              <Text accessibilityRole="button" style={{ color: colors.error }} onPress={() => setLines(lines.filter((_, position) => position !== index))}>
                {t("remove")}
              </Text>
            </View>
            {line.units.length > 1 ? (
              <Choice label={t("unit")} value={line.unitId} options={line.units.map((unit) => ({ value: unit.unitId, label: unit.unitName }))} onChange={(unitId) => void changeUnit(index, unitId)} />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <View style={{ width: 110 }}>
                <Field
                  label={t("quantity")}
                  value={line.quantity}
                  keyboardType="decimal-pad"
                  onChangeText={(quantity) => setLines(lines.map((item, position) => (position === index ? { ...item, quantity } : item)))}
                  error={fields[`lines.${index}.quantity`]}
                />
              </View>
              <Muted>{line.price ? `× ${money(line.price, options.currency)}` : t("noPrice")}</Muted>
            </View>
            {fields[`lines.${index}.variantId`] ? <Text style={styles.error}>{fields[`lines.${index}.variantId`]}</Text> : null}
          </View>
        ))}
        <TextInput accessibilityLabel={t("findItem")} placeholder={t("findItem")} value={itemSearch} onChangeText={setItemSearch} style={styles.input} placeholderTextColor={colors.textMuted} />
        {found.map((item) => (
          <Pressable key={item.variantId} accessibilityRole="button" onPress={() => void addItem(item)} style={{ paddingVertical: space[2] }}>
            <Text style={{ color: colors.text }}>
              {item.sku} · {[item.productName, ...item.optionValues].join(" · ")}
            </Text>
          </Pressable>
        ))}
        {fields.lines ? <Text style={styles.error}>{fields.lines}</Text> : null}
        <Text style={{ color: colors.text, fontWeight: "700", textAlign: "right" }}>{t("estimatedTotal", { amount: money(total, options.currency) })}</Text>
      </Card>
      <Field label={t("note")} value={note} onChangeText={setNote} multiline />
      {error ? <Notice text={error} /> : null}
      <Button label={t("saveOrder")} busy={busy} disabled={lines.length === 0} onPress={() => void save()} />
    </View>
  );
}
