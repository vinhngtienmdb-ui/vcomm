// Khung ứng dụng kho: phiên đăng nhập; chưa đăng nhập thì chỉ mở được màn hình đăng nhập (MAN_HINH_105).
import { Redirect, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Button, Loading, Notice, Screen } from "@/components/ui";
import { t } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import { SessionProvider, useSession } from "@/lib/session";

function Gate() {
  const { stage, retry } = useSession();
  const path = usePathname();
  if (stage === "loading") return <Loading />;
  if (stage === "offline")
    return (
      <Screen>
        <Notice text={t("offline")} />
        <Button label={t("retry")} onPress={() => void retry()} />
      </Screen>
    );
  if (stage !== "ready" && path !== "/dang-nhap") return <Redirect href="/dang-nhap" />;
  if (stage === "ready" && path === "/dang-nhap") return <Redirect href="/kho" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.topBar }} edges={["top"]}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
            <Gate />
          </SafeAreaView>
        </SafeAreaView>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
