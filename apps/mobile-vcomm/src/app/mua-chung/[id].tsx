// MAN_HINH_134 Chi tiết nhóm mua chung: bậc giá, tiến độ, tham gia, chia sẻ (CONG_VIEC_49; CHUC_NANG_172; API_164; QUYTAC_NGHIEPVU_330).
import type { GroupBuyItem } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Platform, ScrollView, Share, Text, View } from "react-native";
import { GroupProgress, remaining, TierRow } from "@/components/GroupBuy";
import { AmountRow } from "@/components/OrderLines";
import { Button, Card, Loading, Muted, Notice, QuantityStepper, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure, appBase, assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const statusTone = { open: "warning", succeeded: "success", failed: "error", cancelled: "neutral" } as const;
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export default function GroupBuyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupBuyItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => {
    setError(null);
    api<GroupBuyItem>(`/buyer/group-buys/${encodeURIComponent(String(id))}`)
      .then(setGroup)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [id]);
  useFocusEffect(load);

  async function share() {
    if (!group) return;
    const link = `${appBase}/mua-chung/${group.id}`;
    const message = t("groupBuyShareMessage", { name: group.productName, link });
    if (Platform.OS === "web") {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) return void browser.share({ text: message }).catch(() => undefined);
      await browser?.clipboard?.writeText(link).catch(() => undefined);
      return setCopied(true);
    }
    await Share.share({ message });
  }

  const left = group ? group.maxPerBuyer - group.myQuantity : 0;
  const open = group?.status === "open" && new Date(group.endsAt).getTime() > Date.now();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/mua-chung"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        {error ? <Notice text={error} /> : null}
        {!group && !error ? <Loading /> : null}
        {group ? (
          <>
            {group.imageUrl ? <Image source={{ uri: assetUrl(group.imageUrl)! }} style={{ width: "100%", height: 200 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
            <Title>{[group.productName, group.variantLabel].filter(Boolean).join(" · ")}</Title>
            <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
              <Muted>
                {t("groupBuyBy", { name: group.openerName })}
                {group.openerLabel ? ` · ${t(`collaboratorLabel_${group.openerLabel}`)}` : ""}
              </Muted>
              <StatusBadge tone={statusTone[group.status]} text={t(`groupBuyStatus_${group.status}`)} />
            </View>
            <Card>
              <TierRow tiers={group.tiers} quantity={group.quantity} />
              <GroupProgress group={group} />
              {group.status === "open" ? (
                <>
                  <AmountRow label={t("groupBuyPriceNow")} value={group.currentPrice ? money(group.currentPrice) : t("groupBuyBelowMinimum")} />
                  <AmountRow label={t("groupBuyPrepay")} value={money(group.tiers[0]?.unitPrice ?? "0")} strong />
                  <AmountRow label={t("groupBuyEnds")} value={`${dateTime(group.endsAt)} (${remaining(group.endsAt)})`} />
                </>
              ) : null}
              {group.finalPrice ? <AmountRow label={t("groupBuyFinal")} value={money(group.finalPrice)} strong /> : null}
              {group.cancelReason ? <Notice tone="info" text={t("cancelledBecause", { reason: group.cancelReason })} /> : null}
              <AmountRow label={t("groupBuyPerBuyer")} value={t("groupBuyMine", { mine: group.myQuantity, max: group.maxPerBuyer })} />
            </Card>
            {open && left > 0 ? (
              <Card>
                <Text style={{ fontWeight: "600", color: colors.text }}>{t("quantity")}</Text>
                <QuantityStepper label={t("quantity")} value={Math.min(quantity, left)} maximum={left} onChange={setQuantity} />
                <Button
                  label={t("groupBuyJoin")}
                  onPress={() => router.push({ pathname: "/dat-hang", params: { nhom: group.id, bienThe: group.variantId, soLuong: String(Math.min(quantity, left)) } })}
                />
              </Card>
            ) : open ? (
              <Notice tone="info" text={t("groupBuyReachedMax")} />
            ) : null}
            {open ? <Button label={t("groupBuyShare")} kind="secondary" onPress={() => void share()} /> : null}
            {copied ? <Notice tone="success" text={t("copied")} /> : null}
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
