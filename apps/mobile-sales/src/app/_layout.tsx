// Khung ứng dụng: phiên đăng nhập; chưa đăng nhập hoặc chờ mã xác thực thì về MAN_HINH_66.
import { Redirect, Slot, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Loading } from "@/components/ui";
import { colors } from "@/lib/theme";
import { SessionProvider, useSession } from "@/lib/session";

function Gate() {
  const { stage } = useSession();
  const path = usePathname();
  if (stage === "loading") return <Loading />;
  const onLogin = path === "/dang-nhap";
  if (stage !== "ready" && !onLogin) return <Redirect href="/dang-nhap" />;
  if (stage === "ready" && onLogin) return <Redirect href="/khach" />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
          <Gate />
        </SafeAreaView>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
