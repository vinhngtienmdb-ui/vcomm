// MAN_HINH_133 Mời bạn bè (CONG_VIEC_49; CHUC_NANG_171; API_162; QUYTAC_NGHIEPVU_327): đường dẫn giới thiệu, mức thưởng hiện tại, người đã mời và trạng thái thưởng.
import type { BuyerInvitationsResponse, InvitationBonusStatus } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, Share, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, appBase } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";
import { copyText } from "@/lib/clipboard";

const t = translator("vcommApp");
const tone: Record<InvitationBonusStatus, "success" | "info" | "neutral"> = { credited: "success", in_progress: "info", not_qualified: "neutral", no_order: "neutral" };

export default function InviteScreen() {
  const { me } = useSession();
  const [data, setData] = useState<BuyerInvitationsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api<BuyerInvitationsResponse>("/buyer/invitations")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useFocusEffect(load);
  const link = me?.referralCode ? `${appBase}/r/${me.referralCode}` : "";

  async function share() {
    const message = t("shareMessage", { link });
    if (Platform.OS === "web") {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) return void browser.share({ text: message }).catch(() => undefined);
      return copy();
    }
    await Share.share({ message });
  }
  async function copy() {
    setCopied(await copyText(link));
  }

  const program = data?.program;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("inviteTitle")}</Title>
        {failed ? (
          <>
            <Notice text={t("loadFailed")} />
            <Button label={t("retry")} kind="secondary" onPress={load} />
          </>
        ) : !data || !program ? (
          <Loading />
        ) : (
          <>
            <Card>
              {program.isEnabled && program.bonusAmount ? (
                <>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{t("inviteBonusTitle", { amount: money(program.bonusAmount) })}</Text>
                  <Muted>{t("inviteBonusRule", { amount: money(program.bonusAmount), minimum: money(program.minimumOrder) })}</Muted>
                </>
              ) : (
                <Notice tone="info" text={t("inviteProgramOff")} />
              )}
              {link ? (
                <>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{t("yourReferralLink")}</Text>
                  <Text selectable style={{ color: colors.text }}>
                    {link}
                  </Text>
                  {copied ? <Notice tone="success" text={t("copied")} /> : null}
                  <View style={{ flexDirection: "row", gap: space[2] }}>
                    <View style={{ flex: 1 }}>
                      <Button label={t("share")} onPress={() => void share()} />
                    </View>
                    {Platform.OS === "web" ? (
                      <View style={{ flex: 1 }}>
                        <Button label={t("copy")} kind="secondary" onPress={() => void copy()} />
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{`${t("myReferrals")} (${data.invitees.length})`}</Text>
              {data.invitees.length === 0 ? <Muted>{t("noReferrals")}</Muted> : null}
              {data.invitees.map((item, index) => (
                <View
                  key={`${item.phone}-${index}`}
                  style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start", borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{item.fullName}</Text>
                    <Muted>
                      {item.phone} · {t("registeredOn", { date: shortDate(item.registeredAt) })}
                    </Muted>
                  </View>
                  <StatusBadge
                    tone={tone[item.bonusStatus]}
                    text={item.bonusStatus === "credited" ? t("inviteCredited", { amount: money(item.bonusAmount ?? "0") }) : t(`inviteStatus_${item.bonusStatus}`)}
                  />
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
