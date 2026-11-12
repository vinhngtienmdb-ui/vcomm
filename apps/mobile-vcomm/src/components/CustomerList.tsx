// Danh sách khách phụ trách: họ tên, số điện thoại, ngày đăng ký, nút Gọi; bấm tên mở chi tiết khách MAN_HINH_196 (MAN_HINH_78, MAN_HINH_84).
import type { BuyerSalesCustomerItem } from "contracts";
import { router } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { Button, Muted } from "@/components/ui";
import { shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export function CustomerList({ customers }: { customers: BuyerSalesCustomerItem[] }) {
  if (customers.length === 0) return <Muted>{t("noSalesCustomers")}</Muted>;
  return (
    <>
      {customers.map((customer, index) => (
        <View
          key={customer.id}
          style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
        >
          <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/khach/[id]", params: { id: customer.id } })}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>{customer.fullName}</Text>
            <Muted>
              {customer.phone} · {t("registeredOn", { date: shortDate(customer.registeredAt) })}
            </Muted>
          </Pressable>
          <Button label={t("call")} kind="secondary" onPress={() => void Linking.openURL(`tel:${customer.phone}`)} />
        </View>
      ))}
    </>
  );
}
