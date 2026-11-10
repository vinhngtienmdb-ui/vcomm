// Khung ứng dụng VComm: phiên đăng nhập; chưa đăng nhập thì chỉ mở được đăng nhập, đăng ký, quên mật khẩu, đường dẫn giới thiệu.
import { Redirect, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Button, Loading, Notice, Screen } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import { SessionProvider, useSession } from "@/lib/session";

const publicPaths = ["/dang-nhap", "/dang-ky", "/quen-mat-khau"];

function Gate() {
  const { stage, retry } = useSession();
  const path = usePathname();
  if (stage === "loading") return <Loading />;
  if (stage === "offline")
    return (
      <Screen>
        <Notice text={translator("vcommApp")("offline")} />
        <Button label={translator("vcommApp")("retry")} onPress={() => void retry()} />
      </Screen>
    );
  const onPublic = publicPaths.includes(path);
  const onReferral = path.startsWith("/r/");
  if (stage !== "ready" && !onPublic && !onReferral) return <Redirect href="/dang-nhap" />;
  if (stage === "ready" && onPublic) return <Redirect href="/trang-chu" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="dang-nhap" />
      <Stack.Screen name="dang-ky" />
      <Stack.Screen name="quen-mat-khau" />
      <Stack.Screen name="r/[code]" />
      <Stack.Screen name="doi/[id]" />
      <Stack.Screen name="de-xuat" />
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
          <Gate />
        </SafeAreaView>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
