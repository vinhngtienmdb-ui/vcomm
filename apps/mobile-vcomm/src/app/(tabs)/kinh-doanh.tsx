// MAN_HINH_78 Kinh doanh: khách tôi phụ trách, chỉ nhân viên kinh doanh (CHUC_NANG_108; API_118; QUYTAC_NGHIEPVU_145, 146).
import type { BuyerSalesCustomerItem } from "contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function SalesScreen() {
  const [customers, setCustomers] = useState<BuyerSalesCustomerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api<BuyerSalesCustomerItem[]>("/buyer/sales/customers")
        .then((items) => active && setCustomers(items))
        .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        {error ? <Notice text={error} /> : null}
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("salesCustomers")}</Text>
          {customers ? <Muted>{t("customerCount", { count: customers.length })}</Muted> : null}
          {!customers && !error ? <Loading /> : null}
          {customers?.length === 0 ? <Muted>{t("noSalesCustomers")}</Muted> : null}
          {customers?.map((customer, index) => (
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
        </Card>
      </Screen>
    </ScrollView>
  );
}
