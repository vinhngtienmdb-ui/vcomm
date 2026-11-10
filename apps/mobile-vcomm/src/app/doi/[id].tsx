// MAN_HINH_84 Khách của một cấp dưới (CHUC_NANG_111; API_122; QUYTAC_NGHIEPVU_151): thông tin đầy đủ, chỉ cấp dưới trong nhánh.
import type { BuyerSalesCustomerItem } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { CustomerList } from "@/components/CustomerList";
import { Card, Loading, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function MemberCustomersScreen() {
  const { id, ten } = useLocalSearchParams<{ id: string; ten?: string }>();
  const [customers, setCustomers] = useState<BuyerSalesCustomerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<BuyerSalesCustomerItem[]>(`/buyer/sales/members/${encodeURIComponent(String(id))}/customers`)
      .then((items) => active && setCustomers(items))
      .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("customersOf", { name: typeof ten === "string" ? ten : "" })}</Title>
        {error ? <Notice text={error} /> : null}
        {!customers && !error ? <Loading /> : null}
        {customers ? (
          <Card>
            <CustomerList customers={customers} />
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
