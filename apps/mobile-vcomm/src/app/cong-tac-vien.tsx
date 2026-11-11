// MAN_HINH_132 Cộng tác viên (CONG_VIEC_49; CHUC_NANG_171; API_162; QUYTAC_NGHIEPVU_324 đến 326): đăng ký, trạng thái, mã, nhãn, thống kê 30 ngày, đơn ghi nhận gần đây.
import type { BuyerCollaboratorOrderItem, BuyerCollaboratorResponse, CollaboratorStatus } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAction } from "@/components/auth";
import { Button, Card, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const tone: Record<CollaboratorStatus, "success" | "warning" | "error" | "neutral"> = { pending: "warning", approved: "success", rejected: "error", suspended: "neutral" };

export default function CollaboratorScreen() {
  const [data, setData] = useState<BuyerCollaboratorResponse | null>(null);
  const [orders, setOrders] = useState<BuyerCollaboratorOrderItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [channel, setChannel] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, fields, run } = useAction(["channel"]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const value = await api<BuyerCollaboratorResponse>("/buyer/collaborator");
      setData(value);
      if (value.profile?.status === "approved" || value.profile?.status === "suspended") setOrders(await api<BuyerCollaboratorOrderItem[]>("/buyer/collaborator/orders"));
    } catch {
      setFailed(true);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const profile = data?.profile ?? null;
  const canSubmit = !profile || profile.status === "rejected";
  async function submit() {
    await run(async () => {
      setData(await api<BuyerCollaboratorResponse>("/buyer/collaborator", { method: "POST", json: { channel: channel.trim() || null, acceptTerms: true, version: profile?.version ?? 0 } }));
      setSent(true);
    });
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("collaboratorTitle")}</Title>
        {failed ? (
          <>
            <Notice text={t("loadFailed")} />
            <Button label={t("retry")} kind="secondary" onPress={() => void load()} />
          </>
        ) : !data ? (
          <Loading />
        ) : (
          <>
            {sent ? <Notice tone="success" text={t("collaboratorSent")} /> : null}
            {profile ? (
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                  <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>{t("collaboratorProfile")}</Text>
                  {profile.label ? <StatusBadge tone="info" text={t(`collaboratorLabel_${profile.label}`)} /> : null}
                  <StatusBadge tone={tone[profile.status]} text={t(`collaboratorStatus_${profile.status}`)} />
                </View>
                {profile.code ? (
                  <>
                    <Muted>{t("collaboratorCode")}</Muted>
                    <Text selectable style={{ fontSize: 24, fontWeight: "800", color: colors.primary, letterSpacing: 1 }}>
                      {profile.code}
                    </Text>
                  </>
                ) : null}
                {profile.status === "pending" ? <Muted>{t("collaboratorPending", { date: shortDate(profile.submittedAt) })}</Muted> : null}
                {profile.status === "rejected" ? <Notice text={t("collaboratorRejected", { reason: profile.reason ?? "" })} /> : null}
                {profile.status === "suspended" ? <Notice tone="warning" text={t("collaboratorSuspended", { reason: profile.reason ?? "" })} /> : null}
                {profile.status === "approved" ? <Muted>{t("collaboratorHowTo")}</Muted> : null}
              </Card>
            ) : (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("collaboratorIntroTitle")}</Text>
                <Muted>{t("collaboratorIntro")}</Muted>
              </Card>
            )}
            {canSubmit ? (
              <Card>
                {error ? <Notice text={error} /> : null}
                <Field label={t("collaboratorChannel")} value={channel} onChangeText={setChannel} maxLength={200} error={fields.channel} />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted(!accepted)}
                  style={{ flexDirection: "row", gap: space[2], alignItems: "center", paddingVertical: space[1] }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: accepted ? colors.primary : colors.inputBorder,
                      backgroundColor: accepted ? colors.primary : colors.surface,
                    }}
                  />
                  <Text style={{ flex: 1, color: colors.text }}>{t("collaboratorTerms", { version: data.termsVersion })}</Text>
                </Pressable>
                <Button label={profile ? t("collaboratorResubmit") : t("collaboratorSubmit")} busy={busy} disabled={!accepted} onPress={() => void submit()} />
              </Card>
            ) : null}
            {data.stats ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("collaboratorStats")}</Text>
                {(
                  [
                    ["collaboratorClicks", String(data.stats.clicks)],
                    ["collaboratorOrders", String(data.stats.orders)],
                    ["collaboratorPendingAmount", money(data.stats.pendingAmount)],
                    ["collaboratorCreditedAmount", money(data.stats.creditedAmount)],
                  ] as const
                ).map(([key, value]) => (
                  <View key={key} style={{ flexDirection: "row", gap: space[2] }}>
                    <Text style={{ flex: 1, color: colors.text }}>{t(key)}</Text>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{value}</Text>
                  </View>
                ))}
                <Button label={t("commissionWallet")} kind="secondary" onPress={() => router.push("/vi-hoa-hong")} />
              </Card>
            ) : null}
            {data.stats ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("collaboratorRecentOrders")}</Text>
                {orders.length === 0 ? <Muted>{t("collaboratorNoOrders")}</Muted> : null}
                {orders.map((item) => (
                  <View key={item.orderId} style={{ gap: 2 }}>
                    <Text style={{ fontWeight: "600", color: colors.text }}>{item.productName}</Text>
                    <Muted>{`${item.documentNo} · ${item.credited ? t("collaboratorCreditedShort") : t("collaboratorPendingShort")} · ${money(item.amount)}`}</Muted>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
