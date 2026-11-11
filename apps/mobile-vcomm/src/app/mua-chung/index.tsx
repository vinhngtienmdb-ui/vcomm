// MAN_HINH_134 Mua chung: danh sách nhóm đang mở, nhóm của tôi (CONG_VIEC_49; CHUC_NANG_172; API_164; QUYTAC_NGHIEPVU_329, 330).
import type { BuyerCollaboratorResponse, GroupBuyItem, PageResponse } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { GroupProgress, remaining, TierRow } from "@/components/GroupBuy";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, assetUrl } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const statusTone = { open: "warning", succeeded: "success", failed: "error", cancelled: "neutral" } as const;

export default function GroupBuysScreen() {
  const { sanPham } = useLocalSearchParams<{ sanPham?: string }>();
  const [scope, setScope] = useState<"open" | "mine">("open");
  const [groups, setGroups] = useState<GroupBuyItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isCollaborator, setCollaborator] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    setGroups(null);
    const query = new URLSearchParams({ scope, ...(typeof sanPham === "string" && sanPham && scope === "open" ? { productId: sanPham } : {}) });
    api<PageResponse<GroupBuyItem>>(`/buyer/group-buys?${query}`)
      .then((page) => setGroups(page.data))
      .catch(() => setFailed(true));
    api<BuyerCollaboratorResponse>("/buyer/collaborator")
      .then((value) => setCollaborator(value.profile?.status === "approved"))
      .catch(() => undefined);
  }, [scope, sanPham]);
  useFocusEffect(load);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("groupBuyTitle")}</Title>
        <Notice tone="info" text={t("groupBuyRule")} />
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button label={t("groupBuyOpenTab")} kind={scope === "open" ? "primary" : "secondary"} onPress={() => setScope("open")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t("groupBuyMineTab")} kind={scope === "mine" ? "primary" : "secondary"} onPress={() => setScope("mine")} />
          </View>
        </View>
        {isCollaborator ? <Button label={t("groupBuyOpenNew")} kind="secondary" onPress={() => router.push("/mua-chung/mo-nhom")} /> : null}
        {failed ? (
          <>
            <Notice text={t("loadFailed")} />
            <Button label={t("retry")} kind="secondary" onPress={load} />
          </>
        ) : groups === null ? (
          <Loading />
        ) : groups.length === 0 ? (
          <Card>
            <Muted>{scope === "open" ? t("groupBuyNoneOpen") : t("groupBuyNoneMine")}</Muted>
          </Card>
        ) : (
          groups.map((group) => (
            <Pressable key={group.id} accessibilityRole="link" onPress={() => router.push(`/mua-chung/${group.id}`)}>
              <Card>
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  {group.imageUrl ? (
                    <Image source={{ uri: assetUrl(group.imageUrl)! }} style={{ width: 56, height: 56, borderRadius: radius.small }} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: radius.small, backgroundColor: colors.primaryLight }} />
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{[group.productName, group.variantLabel].filter(Boolean).join(" · ")}</Text>
                    <Muted>
                      {t("groupBuyBy", { name: group.openerName })}
                      {group.openerLabel ? ` · ${t(`collaboratorLabel_${group.openerLabel}`)}` : ""}
                      {group.status === "open" ? ` · ${t("groupBuyRemaining", { time: remaining(group.endsAt) })}` : ""}
                    </Muted>
                  </View>
                  {group.status !== "open" ? <StatusBadge tone={statusTone[group.status]} text={t(`groupBuyStatus_${group.status}`)} /> : null}
                </View>
                <TierRow tiers={group.tiers} quantity={group.quantity} />
                <GroupProgress group={group} />
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
    </ScrollView>
  );
}
