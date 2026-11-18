// MAN_HINH_289 Hóa đơn trong ca: danh sách hóa đơn ca hiện tại, tìm theo số; chi tiết; in lại ghi "In lại lần n" (QUYTAC_NGHIEPVU_620 khoản 3).
import type { IposSale, IposSaleRow } from "contracts";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Muted, Notice, Overlay } from "@/components/ui";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money, qty, usePos } from "@/lib/pos";
import { printSale, type PrintOutcome } from "@/lib/printer";
import { monospace } from "./Sell";
import { colors, radius, space } from "@/lib/theme";

const time = (value: string) => new Date(value).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });

export function Sales() {
  const { shift, context } = usePos();
  const [rows, setRows] = useState<IposSaleRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<IposSale | null>(null);
  const [printing, setPrinting] = useState<PrintOutcome | null>(null);
  const load = useCallback(async () => {
    if (!shift) return;
    try {
      setRows(await api<IposSaleRow[]>(`/ipos/pos/sales?shiftId=${shift.id}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`));
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [shift, search]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <View style={styles.wrap}>
      <TextInput accessibilityLabel={t("searchDocument")} placeholder={t("searchDocument")} placeholderTextColor={colors.textMuted} style={styles.search} value={search} onChangeText={setSearch} />
      {error ? <Notice text={error} /> : null}
      <FlatList
        data={rows ?? []}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ gap: space[2] }}
        ListEmptyComponent={rows ? <Muted>{t("noSalesInShift")}</Muted> : undefined}
        renderItem={({ item: row }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() => {
              setPrinting(null);
              void api<IposSale>(`/ipos/pos/sales/${row.id}`).then(setDetail);
            }}
          >
            <Text style={styles.number}>{row.documentNo}</Text>
            <Text style={styles.muted}>{time(row.soldAt)}</Text>
            <Text style={styles.muted}>{t("lineCount", { count: row.lineCount })}</Text>
            <Text style={styles.muted}>{row.memberName}</Text>
            <Text style={styles.amount}>{money(row.total)}</Text>
          </Pressable>
        )}
      />
      {detail ? (
        <Overlay title={detail.documentNo} onClose={() => setDetail(null)} width={560}>
          <Muted>
            {new Date(detail.soldAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {detail.memberName} · {t("printCount", { count: detail.printCount })}
          </Muted>
          {detail.lines.map((line) => (
            <View key={line.lineNo} style={styles.line}>
              <Text style={{ flex: 1, color: colors.text }}>
                {line.name} · {qty(line.quantity)} × {money(line.unitPrice)}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{money(line.amount)}</Text>
            </View>
          ))}
          <View style={styles.line}>
            <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>{t("total")}</Text>
            <Text style={{ fontWeight: "800", color: colors.text, fontSize: 18 }}>{money(detail.total)}</Text>
          </View>
          {printing?.printed ? <Notice tone="success" text={t("printed")} /> : null}
          {printing?.error ? <Notice text={printing.error} /> : null}
          {printing?.preview ? <Text style={styles.preview}>{printing.preview.join("\n")}</Text> : null}
          <Button
            label={t("reprint")}
            kind="secondary"
            onPress={() => {
              void (async () => {
                const logged = await api<IposSale>(`/ipos/pos/sales/${detail.id}/print-log`, { method: "POST", json: { reprint: true } });
                setDetail(logged);
                setPrinting(await printSale(logged, { storePaperWidth: context?.paperWidth ?? 80, reprintNumber: Math.max(1, logged.printCount - 1), openDrawer: false }));
              })().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
            }}
          />
        </Overlay>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space[3], gap: space[2] },
  search: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 44, backgroundColor: colors.surface, color: colors.text, maxWidth: 420 },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, padding: space[3] },
  number: { color: colors.primary, fontWeight: "700", minWidth: 170 },
  muted: { color: colors.textMuted, flex: 1 },
  amount: { color: colors.text, fontWeight: "700", minWidth: 100, textAlign: "right" },
  line: { flexDirection: "row", gap: space[2], alignItems: "center" },
  preview: { fontFamily: monospace, fontSize: 12, color: colors.text, backgroundColor: colors.background, padding: space[3], borderRadius: radius.small },
});
