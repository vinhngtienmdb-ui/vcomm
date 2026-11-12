// MAN_HINH_198 Hẹn của tôi (CHUC_NANG_205; API_230; QUYTAC_NGHIEPVU_436): quá hạn, hôm nay, 7 ngày tới; bấm khách mở chi tiết; Đã xong.
import type { FollowUpItem, FollowUpsResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function FollowUpsScreen() {
  const [data, setData] = useState<FollowUpsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<FollowUpsResponse>("/buyer/sales/follow-ups")
      .then(setData)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);
  useFocusEffect(load);

  async function done(item: FollowUpItem) {
    setBusyId(item.noteId);
    try {
      await api(`/buyer/sales/follow-ups/${item.noteId}/done`, { method: "POST" });
      load();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusyId(null);
    }
  }

  const group = (title: string, tone: "error" | "info" | "success", items: FollowUpItem[], canFinish: boolean) => (
    <View style={{ gap: space[2] }}>
      <Notice tone={tone} text={t("followUpGroup", { title, count: items.length })} />
      {items.length > 0 ? (
        <Card>
          {items.map((item, index) => (
            <View
              key={item.noteId}
              style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
            >
              <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/khach/[id]", params: { id: item.customerId } })}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  {item.customerName} · {t("followUpOn", { date: shortDate(`${item.followUpOn}T00:00:00+07:00`) })}
                </Text>
                <Muted>
                  {t(`careChannel_${item.channel}`)} · {item.content}
                </Muted>
              </Pressable>
              {canFinish ? <Button label={t("followUpDone")} kind="secondary" busy={busyId === item.noteId} onPress={() => void done(item)} /> : null}
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("followUpsTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!data && !error ? <Loading /> : null}
        {data ? (
          <>
            {group(t("followUpOverdue"), "error", data.overdue, true)}
            {group(t("followUpToday"), "info", data.dueToday, true)}
            {group(t("followUpUpcoming"), "success", data.upcoming, true)}
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
