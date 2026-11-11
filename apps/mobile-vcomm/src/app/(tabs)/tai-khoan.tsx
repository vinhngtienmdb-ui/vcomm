// MAN_HINH_76 Tài khoản, MAN_HINH_77 Người tôi giới thiệu (CHUC_NANG_106; API_118; QUYTAC_NGHIEPVU_142, 146):
// mã và đường dẫn giới thiệu, chia sẻ, sao chép; nhập mã người giới thiệu khi chưa có (một lần); người tôi giới thiệu; đăng xuất.
import type { BuyerMeResponse, BuyerReferralItem } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, Share, Text, View } from "react-native";
import { useAction } from "@/components/auth";
import { Button, Card, Field, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, appBase } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

export default function AccountScreen() {
  const t = translator("vcommApp");
  const { me, setMe, reload, logout } = useSession();
  const { ma } = useLocalSearchParams<{ ma?: string }>();
  const [code, setCode] = useState(typeof ma === "string" ? ma : "");
  const [referrals, setReferrals] = useState<BuyerReferralItem[] | null>(null);
  const [referralsFailed, setReferralsFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { busy, error, fields, run } = useAction(["referralCode"]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Tải lại tài khoản để thấy ngay khi vừa được đánh dấu nhân viên kinh doanh.
      void reload().catch(() => undefined);
      api<BuyerReferralItem[]>("/buyer/referrals")
        .then((items) => {
          if (!active) return;
          setReferrals(items);
          setReferralsFailed(false);
        })
        .catch(() => active && setReferralsFailed(true));
      return () => {
        active = false;
      };
    }, [reload]),
  );

  if (!me) return null;
  const link = me.referralCode ? `${appBase}/r/${me.referralCode}` : "";

  async function share() {
    const message = t("shareMessage", { link });
    // Bản web: dùng hộp chia sẻ của trình duyệt nếu có, không thì sao chép.
    if (Platform.OS === "web") {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) return void browser.share({ text: message }).catch(() => undefined);
      return copy();
    }
    await Share.share({ message });
  }
  async function copy() {
    await globalThis.navigator?.clipboard?.writeText(link).catch(() => undefined);
    setCopied(true);
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Card>
          <Title>{me.fullName}</Title>
          <Muted>{me.phone}</Muted>
          <Button label={t("addressBook")} kind="secondary" onPress={() => router.push("/so-dia-chi")} />
          <Button label={t("bankAccountTitle")} kind="secondary" onPress={() => router.push("/tai-khoan-hoan-tien")} />
        </Card>
        {me.referralCode ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("yourReferralCode")}</Text>
            <Text accessibilityLabel={t("yourReferralCode")} style={{ fontSize: 24, fontWeight: "800", color: colors.primary, letterSpacing: 1 }}>
              {me.referralCode}
            </Text>
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
          </Card>
        ) : null}
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("referrer")}</Text>
          {me.referrer ? (
            <Text style={{ color: colors.text }}>
              {me.referrer.fullName} · {me.referrer.maskedPhone}
            </Text>
          ) : (
            <Muted>{t("noReferrer")}</Muted>
          )}
          {me.canSetReferrer ? (
            <>
              {error ? <Notice text={error} /> : null}
              <Field label={t("enterReferrer")} value={code} onChangeText={setCode} keyboardType="phone-pad" maxLength={15} error={fields.referralCode} />
              <Muted>{t("referrerOnce")}</Muted>
              <Button
                label={t("saveReferrer")}
                busy={busy}
                disabled={!code.trim()}
                onPress={() => void run(async () => setMe(await api<BuyerMeResponse>("/buyer/referrer", { method: "POST", json: { referralCode: code.trim() } })))}
              />
            </>
          ) : null}
        </Card>
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {t("myReferrals")}
            {referrals ? ` (${referrals.length})` : ""}
          </Text>
          {referralsFailed ? <Notice text={t("loadFailed")} /> : null}
          {referrals?.length === 0 ? <Muted>{t("noReferrals")}</Muted> : null}
          {referrals?.map((item, index) => (
            <View key={`${item.maskedPhone}-${index}`} style={{ borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{item.fullName}</Text>
              <Muted>
                {item.maskedPhone} · {t("registeredOn", { date: shortDate(item.registeredAt) })}
              </Muted>
            </View>
          ))}
        </Card>
        <Button label={t("logout")} kind="secondary" onPress={() => void logout()} />
      </Screen>
    </ScrollView>
  );
}
