// Danh sách khách phụ trách: họ tên, số điện thoại, ngày đăng ký, nút Gọi (MAN_HINH_78, MAN_HINH_84).
import type { BuyerSalesCustomerItem } from "contracts";
import { Linking, Text, View } from "react-native";
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
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{customer.fullName}</Text>
            <Muted>
              {customer.phone} · {t("registeredOn", { date: shortDate(customer.registeredAt) })}
            </Muted>
          </View>
          <Button label={t("call")} kind="secondary" onPress={() => void Linking.openURL(`tel:${customer.phone}`)} />
        </View>
      ))}
    </>
  );
}
