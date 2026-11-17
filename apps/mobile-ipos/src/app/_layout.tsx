// Khung ứng dụng iPOS: thiết bị, phiên (CONG_VIEC_74). Màn hình đăng ký thu ngân mở được khi chưa ghép thiết bị.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { t } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/theme";

const noticeOf = (reason: "session" | "device") => t(reason === "device" ? "deviceRevokedNotice" : "sessionEndedNotice");

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider onNotice={noticeOf}>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.topBar }} edges={["top"]}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
          </SafeAreaView>
        </SafeAreaView>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
