// Thành phần dùng chung của mua chung (MAN_HINH_134): bậc giá, thanh tiến độ theo tổng số lượng.
import type { GroupBuyItem, GroupBuyTier } from "contracts";
import { Text, View } from "react-native";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export function TierRow({ tiers, quantity }: { tiers: GroupBuyTier[]; quantity: number }) {
  return (
    <View style={{ flexDirection: "row", gap: space[1] }}>
      {tiers.map((tier) => {
        const reached = quantity >= tier.minQuantity;
        return (
          <View
            key={tier.minQuantity}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: reached ? colors.primary : colors.border,
              backgroundColor: reached ? colors.primaryLight : colors.surface,
              borderRadius: radius.small,
              padding: space[1],
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}>{money(tier.unitPrice)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("groupBuyFrom", { count: tier.minQuantity })}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Thanh tiến độ: mốc cuối là 100%.
export function GroupProgress({ group }: { group: GroupBuyItem }) {
  const top = group.tiers[group.tiers.length - 1]?.minQuantity ?? 1;
  const minimum = group.tiers[0]?.minQuantity ?? 1;
  const next = group.tiers.find((tier) => tier.minQuantity > group.quantity);
  return (
    <View style={{ gap: space[1] }}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: top, now: Math.min(group.quantity, top) }}
        style={{ height: 10, borderRadius: radius.round, backgroundColor: colors.border, overflow: "hidden" }}
      >
        <View style={{ width: `${Math.min(100, (group.quantity / top) * 100)}%`, height: 10, backgroundColor: colors.primary }} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        {group.quantity < minimum
          ? t("groupBuyToMinimum", { count: group.quantity, missing: minimum - group.quantity })
          : next
            ? t("groupBuyToNext", { count: group.quantity, missing: next.minQuantity - group.quantity })
            : t("groupBuyTopReached", { count: group.quantity })}
      </Text>
    </View>
  );
}

// Thời gian còn lại dạng "5 giờ 12 phút".
export function remaining(endsAt: string): string {
  const minutes = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 60_000));
  if (minutes >= 1440) return t("remainingDays", { days: Math.floor(minutes / 1440) });
  return t("remainingHours", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}
