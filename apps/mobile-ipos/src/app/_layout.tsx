// Khung ứng dụng iPOS (CONG_VIEC_74 lát L0). Ghép thiết bị, đăng nhập, phiên làm ở lát L1.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.topBar }} edges={["top"]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
