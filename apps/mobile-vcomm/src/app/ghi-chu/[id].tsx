// MAN_HINH_197 Thêm ghi chú chăm sóc (CHUC_NANG_205; API_229; QUYTAC_NGHIEPVU_435): kênh, nội dung, ngày hẹn tùy chọn. Ghi chú đã lưu không sửa, không xóa.
import type { CareNoteChannel } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { useAction } from "@/components/auth";
import { Button, Card, Choice, Field, Muted, Notice, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const channels: CareNoteChannel[] = ["call", "message", "meeting", "other"];
type Plan = "none" | "tomorrow" | "threeDays" | "week" | "other";

const vietnamToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
// Ngày nhập dạng ngày/tháng/năm; sai thì để máy chủ báo lỗi ô ngày hẹn.
function parseDate(text: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  return match ? `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}` : text.trim();
}

export default function CareNoteScreen() {
  const { id, ten } = useLocalSearchParams<{ id: string; ten?: string }>();
  const [channel, setChannel] = useState<CareNoteChannel>("call");
  const [content, setContent] = useState("");
  const [plan, setPlan] = useState<Plan>("none");
  const [customDate, setCustomDate] = useState("");
  const { busy, error, fields, run } = useAction(["content", "followUpOn", "channel"]);

  function followUpOn(): string | null {
    const today = vietnamToday();
    return { none: null, tomorrow: shift(today, 1), threeDays: shift(today, 3), week: shift(today, 7), other: parseDate(customDate) }[plan];
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("careNoteTitle")}</Title>
        {typeof ten === "string" ? <Muted>{ten}</Muted> : null}
        <Card>
          <Choice label={t("careChannel")} value={channel} options={channels.map((value) => ({ value, label: t(`careChannel_${value}`) }))} onChange={setChannel} />
          <Field
            label={t("careContent")}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={5}
            maxLength={1000}
            style={{ minHeight: 120, textAlignVertical: "top" }}
            error={fields.content}
          />
          <Muted>{t("careContentCount", { count: content.length })}</Muted>
          <Choice
            label={t("careFollowUp")}
            value={plan}
            options={(["none", "tomorrow", "threeDays", "week", "other"] as const).map((value) => ({ value, label: t(`carePlan_${value}`) }))}
            onChange={setPlan}
          />
          {plan === "other" ? <Field label={t("careFollowUpDate")} value={customDate} onChangeText={setCustomDate} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" /> : null}
          {fields.followUpOn ? <Notice text={fields.followUpOn} /> : null}
        </Card>
        {error ? <Notice text={error} /> : null}
        <Button
          label={t("careSave")}
          busy={busy}
          disabled={content.trim().length === 0}
          onPress={() =>
            void run(async () => {
              await api(`/buyer/sales/customers/${encodeURIComponent(String(id))}/notes`, { method: "POST", json: { channel, content, followUpOn: followUpOn() } });
              router.back();
            })
          }
        />
      </Screen>
    </ScrollView>
  );
}
