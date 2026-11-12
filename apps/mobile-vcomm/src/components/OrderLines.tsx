// Dòng hàng của đơn VComm: tên, phân loại, số lượng, giá, khuyến mãi, quà tặng.
import type { MarketplaceOrderLine } from "contracts";
import { Image, Text, View } from "react-native";
import { assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";
import { Muted, StatusBadge } from "./ui";

const t = translator("vcommApp");

export function OrderLines({ lines }: { lines: MarketplaceOrderLine[] }) {
  return (
    <View style={{ gap: space[3] }}>
      {lines.map((line, index) => (
        <View key={`${line.variantId}-${index}`} style={{ flexDirection: "row", gap: space[3] }}>
          {line.imageUrl ? (
            <Image source={{ uri: assetUrl(line.imageUrl)! }} style={{ width: 56, height: 56, borderRadius: radius.small }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: radius.small, backgroundColor: colors.primaryLight }} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{line.productName}</Text>
            {line.variantLabel ? <Muted>{line.variantLabel}</Muted> : null}
            {line.isGift ? <StatusBadge text={t("gift")} tone="success" /> : <Muted>{t("lineQuantityPrice", { quantity: line.quantity, price: money(line.unitPrice) })}</Muted>}
            {Number(line.promotionDiscount) > 0 && !line.isGift ? <Muted>{t("promotionDiscount", { amount: money(line.promotionDiscount) })}</Muted> : null}
          </View>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{line.isGift ? t("free") : money(line.total)}</Text>
        </View>
      ))}
    </View>
  );
}

export function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
      <Text style={{ color: colors.text, fontWeight: strong ? "700" : "400" }}>{label}</Text>
      <Text style={{ color: strong ? colors.primary : colors.text, fontWeight: "700", fontSize: strong ? 18 : 14 }}>{value}</Text>
    </View>
  );
}

export const orderStatusTone = {
  awaiting_payment: "warning",
  awaiting_group: "warning",
  awaiting_shipment: "info",
  ready_for_pickup: "success",
  awaiting_pickup: "info",
  shipping: "warning",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
} as const;
