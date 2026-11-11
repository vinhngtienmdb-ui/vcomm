// MAN_HINH_152 Hạng thành viên (CONG_VIEC_51; CHUC_NANG_179; API_177; QUYTAC_NGHIEPVU_351): hạng hiện tại, chi tiêu năm, mức lên hạng, bảng hạng.
import type { BuyerLoyaltyResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const factor = (value: string) => value.replace(".", ",");

export default function TierScreen() {
  const [summary, setSummary] = useState<BuyerLoyaltyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    api<BuyerLoyaltyResponse>("/buyer/loyalty")
      .then(setSummary)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);
  useFocusEffect(reload);
  const target = summary?.nextTier ? Number(summary.nextTier.minAnnualSpend) : 0;
  const progress = summary && target > 0 ? Math.min(Number(summary.spendCurrentYear) / target, 1) : 1;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/diem-thuong"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{t("tierTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!summary && !error ? <Loading /> : null}
        {summary ? (
          <>
            <Card>
              <Muted>{t("tierCurrent")}</Muted>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{summary.tier?.nameVi ?? ""}</Text>
              <Muted>{t("tierMultiplier", { multiplier: factor(summary.tier?.multiplier ?? "1") })}</Muted>
            </Card>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("tierSpendYear", { year: summary.year })}</Text>
                <Text style={{ fontWeight: "700", color: colors.text }}>{money(summary.spendCurrentYear)}</Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
                style={{ height: 10, borderRadius: radius.round, backgroundColor: colors.border }}
              >
                <View style={{ width: `${progress * 100}%`, height: 10, borderRadius: radius.round, backgroundColor: colors.primary }} />
              </View>
              <Muted>
                {summary.nextTier && summary.remainingToNext ? t("tierRemaining", { amount: money(summary.remainingToNext), tier: summary.nextTier.nameVi, year: summary.year }) : t("tierTop")}
              </Muted>
              <Muted>{t("tierPreviousYear", { year: summary.year - 1, amount: money(summary.spendPreviousYear) })}</Muted>
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("tierAll")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                {summary.tiers.map((tier) => {
                  const current = tier.id === summary.tier?.id;
                  return (
                    <View
                      key={tier.id}
                      style={{
                        flexGrow: 1,
                        minWidth: 80,
                        borderWidth: 1,
                        borderColor: current ? colors.primary : colors.border,
                        backgroundColor: current ? colors.primaryLight : colors.surface,
                        borderRadius: radius.small,
                        padding: space[2],
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.text }}>{tier.nameVi}</Text>
                      <Muted>{t("tierFrom", { amount: money(tier.minAnnualSpend) })}</Muted>
                      <Muted>{`×${factor(tier.multiplier)}`}</Muted>
                    </View>
                  );
                })}
              </View>
              <Muted>{t("tierRules")}</Muted>
            </Card>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
