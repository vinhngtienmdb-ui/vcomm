// MAN_HINH_69 Lập đơn bán trên ứng dụng (CHUC_NANG_101).
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { OrderForm } from "@/components/OrderForm";
import { Screen } from "@/components/ui";
import { translator } from "@/lib/i18n";

export default function NewOrderScreen() {
  const t = translator("salesApp");
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t("newOrder") }} />
      <Screen>
        <OrderForm current={null} {...(customerId ? { customerId } : {})} onSaved={(saved) => router.replace({ pathname: "/don/[id]", params: { id: saved.id } })} />
      </Screen>
    </ScrollView>
  );
}
