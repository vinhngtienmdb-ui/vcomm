// Trang chủ: lời chào; mua sắm làm ở CONG_VIEC_24. CONG_VIEC_49: lối vào Mua chung (MAN_HINH_134). CONG_VIEC_73: lối vào Mã thanh toán (MAN_HINH_276).
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { SmartOtpReminder } from "@/components/SmartOtpReminder";
import { Button, Card, Muted, Screen, Title } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function HomeScreen() {
  const t = translator("vcommApp");
  const { me } = useSession();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <SmartOtpReminder />
        <Card>
          <Title>{t("homeGreeting", { name: me?.fullName ?? "" })}</Title>
          <Muted>{t("homeComing")}</Muted>
        </Card>
        <Card>
          <Title>{t("payCodeEntry")}</Title>
          <Muted>{t("payCodeEntryHint")}</Muted>
          <Button label={t("payCodeTitle")} onPress={() => router.push("/ma-thanh-toan")} />
        </Card>
        <Card>
          <Title>{t("groupBuyTitle")}</Title>
          <Muted>{t("groupBuyHomeHint")}</Muted>
          <Button label={t("groupBuyBrowse")} onPress={() => router.push("/mua-chung")} />
        </Card>
      </Screen>
    </ScrollView>
  );
}
