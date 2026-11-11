// MAN_HINH_76 Tài khoản (CHUC_NANG_106; API_118; QUYTAC_NGHIEPVU_142, 146):
// mã và đường dẫn giới thiệu, chia sẻ, sao chép; nhập mã người giới thiệu khi chưa có (một lần); đăng xuất.
// CONG_VIEC_49: danh sách người tôi giới thiệu chuyển sang MAN_HINH_133 Mời bạn bè; thêm lối vào Cộng tác viên.
import type { BuyerMeResponse } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, Share, Text, View } from "react-native";
import { useAction } from "@/components/auth";
import { Button, Card, Field, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, appBase } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

export default function AccountScreen() {
  const t = translator("vcommApp");
  const { me, setMe, reload, logout } = useSession();
  const { ma } = useLocalSearchParams<{ ma?: string }>();
  const [code, setCode] = useState(typeof ma === "string" ? ma : "");
  const [copied, setCopied] = useState(false);
  const { busy, error, fields, run } = useAction(["referralCode"]);

  useFocusEffect(
    useCallback(() => {
      // Tải lại tài khoản để thấy ngay khi vừa được đánh dấu nhân viên kinh doanh.
      void reload().catch(() => undefined);
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
          <Button label={t("commissionWallet")} kind="secondary" onPress={() => router.push("/vi-hoa-hong")} />
          <Button label={t("bankAccountTitle")} kind="secondary" onPress={() => router.push("/tai-khoan-hoan-tien")} />
          <Button label={t("shoppingWalletTitle")} kind="secondary" onPress={() => router.push("/vi-mua-sam")} />
          <Button label={t("inviteTitle")} kind="secondary" onPress={() => router.push("/moi-ban-be")} />
          <Button label={t("collaboratorTitle")} kind="secondary" onPress={() => router.push("/cong-tac-vien")} />
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
        <Button label={t("logout")} kind="secondary" onPress={() => void logout()} />
      </Screen>
    </ScrollView>
  );
}
