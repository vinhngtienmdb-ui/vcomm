// MAN_HINH_285 Mở ca (QUYTAC_NGHIEPVU_596, 621): tiền đầu ca, gợi ý tiền để lại của ca trước, ghi chú khi khác; cảnh báo thuê bao quá hạn, tạm khóa.
import type { IposShift } from "contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Field, Muted, Notice, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money, usePos } from "@/lib/pos";
import { space } from "@/lib/theme";

export function OpenShift() {
  const { current, setShift, sync, context } = usePos();
  const suggested = current?.suggestedOpeningCash ?? null;
  const [cash, setCash] = useState(suggested ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const status = current?.subscriptionStatus;
  const locked = status === "locked";
  const differs = suggested !== null && cash !== "" && cash !== suggested;
  return (
    <ScrollView contentContainerStyle={styles.center}>
      <View style={styles.box}>
        <Card>
          <Title>{t("openShiftTitle")}</Title>
          {status === "overdue" ? <Notice tone="warning" text={t("subscriptionOverdueNotice")} /> : null}
          {locked ? <Notice text={t("subscriptionLockedNotice")} /> : null}
          {current?.otherOpenShift ? <Notice tone="warning" text={t("otherShiftOpen", { name: current.otherOpenShift.memberName })} /> : null}
          {context && !context.outletCode ? <Notice tone="warning" text={t("outletCodeMissingNotice")} /> : null}
          <Field
            label={t("openingCash")}
            keyboardType="number-pad"
            value={cash ? money(cash) : ""}
            onChangeText={(value) => setCash(value.replace(/\D/g, ""))}
            error={fields.openingCash}
            editable={!locked}
          />
          {suggested !== null ? <Muted>{t("suggestedOpeningCash", { amount: money(suggested) })}</Muted> : null}
          {differs ? <Field label={t("openingNote")} value={note} onChangeText={setNote} maxLength={500} error={fields.note} /> : null}
          {error ? <Notice text={error} /> : null}
          <Button
            label={t("openShift")}
            busy={busy}
            disabled={locked || cash === "" || Boolean(current?.otherOpenShift) || (differs && !note.trim())}
            onPress={() => {
              setBusy(true);
              setError(null);
              api<IposShift>("/ipos/pos/shifts", { method: "POST", json: { openingCash: cash, note: differs ? note.trim() : null } })
                .then((shift) => {
                  setShift(shift);
                  void sync(true);
                })
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
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space[4] },
  box: { width: "100%", maxWidth: 480 },
});
