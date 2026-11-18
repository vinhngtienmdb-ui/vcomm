// MAN_HINH_291 Thu chi và đóng ca (QUYTAC_NGHIEPVU_622, 623): thu chi tiền mặt (mở ngăn kéo); đếm tiền theo mệnh giá hoặc nhập tổng;
// tiền hệ thống, chênh lệch, lý do, để lại két; biên bản ca. Đóng ca xong thì khóa màn hình (phiên kết thúc khi đóng ca).
import type { IposCashMovementCategory, IposShiftReport } from "contracts";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Choice, Field, Muted, Notice, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money, usePos } from "@/lib/pos";
import { openDrawer } from "@/lib/printer";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const notes = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000];

function ReportCard({ report }: { report: IposShiftReport }) {
  const row = (label: string, value: string | null, strong = false, plain = false) => (
    <View style={styles.reportRow} key={label}>
      <Text style={[styles.reportLabel, strong ? { fontWeight: "700", color: colors.text } : null]}>{label}</Text>
      <Text style={[styles.reportValue, strong ? { fontWeight: "800" } : null]}>{value === null ? "—" : plain ? value : money(value)}</Text>
    </View>
  );
  return (
    <Card>
      <Title>{report.shift.closedAt ? t("shiftReportTitle") : t("shiftNowTitle")}</Title>
      <Muted>{t("shiftOpenedBy", { name: report.shift.memberName, time: new Date(report.shift.openedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) })}</Muted>
      {row(t("salesCountLabel"), String(report.salesCount), false, true)}
      {row(t("revenue"), report.revenue)}
      {report.revenueByMethod.map((item) => row(`  ${t(`payment_${item.method}`)}`, item.amount))}
      {row(t("openingCash"), report.shift.openingCash)}
      {row(t("cashIn"), report.cashIn)}
      {row(t("cashOut"), report.cashOut)}
      {row(t("systemCash"), report.systemCash, true)}
      {report.countedCash !== null ? row(t("countedCash"), report.countedCash) : null}
      {report.difference !== null ? row(t("difference"), report.difference, true) : null}
      {report.differenceReason ? <Muted>{t("differenceReasonShown", { reason: report.differenceReason })}</Muted> : null}
      {report.leftCash !== null ? row(t("leftCash"), report.leftCash) : null}
      {report.handedOver !== null ? row(t("handedOver"), report.handedOver) : null}
      {report.movements.length > 0 ? <Text style={styles.sub}>{t("movementsTitle")}</Text> : null}
      {report.movements.map((movement) => (
        <Muted key={movement.id}>
          {movement.direction === "in" ? "+" : "−"}
          {money(movement.amount)} · {t(`category_${movement.category}`)} · {movement.reason}
        </Muted>
      ))}
    </Card>
  );
}

export function CloseShift() {
  const { shift, setShift } = usePos();
  const { lock } = useSession();
  const [report, setReport] = useState<IposShiftReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [category, setCategory] = useState<IposCashMovementCategory>("expense");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [typedTotal, setTypedTotal] = useState("");
  const [differenceReason, setDifferenceReason] = useState("");
  const [leftCash, setLeftCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!shift) return;
    try {
      setReport(await api<IposShiftReport>(`/ipos/pos/shifts/${shift.id}/report`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [shift]);
  useEffect(() => {
    void load();
  }, [load]);

  const countedByNotes = notes.reduce((sum, note) => sum + note * Number(counts[String(note)] || 0), 0);
  const usingNotes = Object.values(counts).some((value) => Number(value) > 0);
  const counted = usingNotes ? countedByNotes : Number(typedTotal || 0);
  const difference = report ? counted - Number(report.systemCash) : 0;

  if (report?.shift.closedAt) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.column}>
          <ReportCard report={report} />
          <Button
            label={t("finishAndLock")}
            onPress={() => {
              setShift(null);
              void lock();
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.column}>
        {error ? <Notice text={error} /> : null}
        {report ? <ReportCard report={report} /> : null}
        <Card>
          <Title>{t("cashMovementTitle")}</Title>
          <Choice label="" value={direction} options={[{ value: "out", label: t("cashOutAction") }, { value: "in", label: t("cashInAction") }]} onChange={setDirection} />
          <Choice
            label={t("movementCategory")}
            value={category}
            options={(["handover", "expense", "other"] as const).map((value) => ({ value, label: t(`category_${value}`) }))}
            onChange={setCategory}
          />
          <Field label={t("amount")} keyboardType="number-pad" value={amount ? money(amount) : ""} onChangeText={(text) => setAmount(text.replace(/\D/g, ""))} error={fields.amount} />
          <Field label={t("reason")} value={reason} maxLength={200} onChangeText={setReason} error={fields.reason} />
          <Button
            label={t("saveMovement")}
            kind="secondary"
            disabled={!amount || Number(amount) <= 0 || !reason.trim()}
            onPress={() => {
              if (!shift) return;
              api<IposShiftReport>(`/ipos/pos/shifts/${shift.id}/cash-movements`, { method: "POST", json: { direction, category, amount, reason: reason.trim() } })
                .then((next) => {
                  setReport(next);
                  setAmount("");
                  setReason("");
                  void openDrawer();
                })
                .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
            }}
          />
        </Card>
      </View>
      <View style={styles.column}>
        <Card>
          <Title>{t("closeShiftTitle")}</Title>
          <Muted>{t("countByNotes")}</Muted>
          <View style={styles.notes}>
            {notes.map((note) => (
              <View key={note} style={styles.note}>
                <Text style={styles.noteLabel}>{money(note)}</Text>
                <TextInput
                  accessibilityLabel={t("noteCount", { note: money(note) })}
                  keyboardType="number-pad"
                  style={styles.noteInput}
                  value={counts[String(note)] ?? ""}
                  onChangeText={(text) => setCounts((current) => ({ ...current, [String(note)]: text.replace(/\D/g, "") }))}
                />
              </View>
            ))}
          </View>
          {!usingNotes ? <Field label={t("countedTotal")} keyboardType="number-pad" value={typedTotal ? money(typedTotal) : ""} onChangeText={(text) => setTypedTotal(text.replace(/\D/g, ""))} /> : null}
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>{t("countedCash")}</Text>
            <Text style={styles.reportValue}>{money(counted)}</Text>
          </View>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>{t("difference")}</Text>
            <Text style={[styles.reportValue, { color: difference === 0 ? colors.success : colors.error }]}>{money(difference)}</Text>
          </View>
          {difference !== 0 ? <Field label={t("differenceReason")} value={differenceReason} maxLength={500} onChangeText={setDifferenceReason} error={fields.differenceReason} /> : null}
          <Field label={t("leftCash")} keyboardType="number-pad" value={leftCash ? money(leftCash) : ""} onChangeText={(text) => setLeftCash(text.replace(/\D/g, ""))} error={fields.leftCash} />
          <Muted>{t("handedOverPreview", { amount: money(Math.max(0, counted - Number(leftCash || 0))) })}</Muted>
          <Button
            label={t("closeShift")}
            busy={busy}
            disabled={(!usingNotes && typedTotal === "") || leftCash === "" || Number(leftCash) > counted || (difference !== 0 && !differenceReason.trim())}
            onPress={() => {
              if (!shift) return;
              setBusy(true);
              setFields({});
              api<IposShiftReport>(`/ipos/pos/shifts/${shift.id}/close`, {
                method: "POST",
                json: {
                  countedCash: String(counted),
                  denominations: usingNotes ? Object.fromEntries(Object.entries(counts).filter(([, value]) => Number(value) > 0).map(([note, value]) => [note, Number(value)])) : null,
                  differenceReason: difference === 0 ? null : differenceReason.trim(),
                  leftCash,
                },
              })
                .then(setReport)
                .catch((failure: unknown) => {
                  if (failure instanceof ApiFailure) {
                    setFields(failure.fields);
                    if (Object.keys(failure.fields).length === 0) setError(failure.message);
                  } else setError(String(failure));
                })
                .finally(() => setBusy(false));
            }}
          />
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space[3], padding: space[3] },
  column: { flex: 1, minWidth: 360, gap: space[3] },
  reportRow: { flexDirection: "row", justifyContent: "space-between", gap: space[2] },
  reportLabel: { color: colors.textMuted },
  reportValue: { color: colors.text, fontWeight: "600" },
  sub: { marginTop: space[2], fontWeight: "700", color: colors.text },
  notes: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  note: { width: "31%", gap: 2 },
  noteLabel: { color: colors.textMuted, fontSize: 13 },
  noteInput: { width: "100%", height: 40, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, textAlign: "center", color: colors.text, backgroundColor: colors.surface },
});
