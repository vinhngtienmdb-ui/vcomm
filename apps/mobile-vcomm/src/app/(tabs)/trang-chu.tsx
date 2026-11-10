// Trang chủ: lời chào; mua sắm làm ở CONG_VIEC_24.
import { ScrollView } from "react-native";
import { Card, Muted, Screen, Title } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function HomeScreen() {
  const t = translator("vcommApp");
  const { me } = useSession();
  return (
    <ScrollView>
      <Screen>
        <Card>
          <Title>{t("homeGreeting", { name: me?.fullName ?? "" })}</Title>
          <Muted>{t("homeComing")}</Muted>
        </Card>
      </Screen>
    </ScrollView>
  );
}
