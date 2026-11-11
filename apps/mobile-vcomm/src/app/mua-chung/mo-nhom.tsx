// MAN_HINH_134 Mở nhóm mua chung (cộng tác viên đã duyệt): chọn biến thể đang bật mua chung, thời hạn (CONG_VIEC_49; API_164; QUYTAC_NGHIEPVU_329).
import type { GroupBuyItem, GroupBuyOption } from "contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useAction } from "@/components/auth";
import { TierRow } from "@/components/GroupBuy";
import { Button, Card, Choice, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function OpenGroupScreen() {
  const [options, setOptions] = useState<GroupBuyOption[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [hours, setHours] = useState("24");
  const { busy, error, fields, run } = useAction(["durationHours"]);
  useEffect(() => {
    api<GroupBuyOption[]>("/buyer/group-buy-options")
      .then((value) => {
        setOptions(value);
        setVariantId(value[0]?.variantId ?? null);
      })
      .catch((failure: unknown) => setFailed(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);
  const option = options?.find((item) => item.variantId === variantId) ?? null;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("groupBuyOpenNew")}</Title>
        {failed ? <Notice text={failed} /> : null}
        {!options && !failed ? <Loading /> : null}
        {options?.length === 0 ? <Notice tone="info" text={t("groupBuyNoOptions")} /> : null}
        {options && options.length > 0 ? (
          <Card>
            {error ? <Notice text={error} /> : null}
            <Choice
              label={t("groupBuyProduct")}
              value={variantId}
              options={options.map((item) => ({ value: item.variantId, label: [item.productName, item.variantLabel].filter(Boolean).join(" · ") }))}
              onChange={setVariantId}
            />
            {option ? (
              <>
                <TierRow tiers={option.tiers} quantity={0} />
                <Muted>{t("groupBuySetByVComm", { minimum: option.tiers[0]?.minQuantity ?? 2, max: option.maxPerBuyer })}</Muted>
                <Field label={t("groupBuyDuration", { max: option.maxDurationHours })} value={hours} onChangeText={setHours} keyboardType="number-pad" maxLength={3} error={fields.durationHours} />
              </>
            ) : null}
            <Button
              label={t("groupBuyOpenSubmit")}
              busy={busy}
              disabled={!option || !Number(hours)}
              onPress={() =>
                void run(async () => {
                  const opened = await api<GroupBuyItem>("/buyer/group-buys", { method: "POST", json: { variantId, durationHours: Number(hours) } });
                  router.replace(`/mua-chung/${opened.id}`);
                })
              }
            />
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
