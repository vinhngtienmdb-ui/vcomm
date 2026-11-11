// Khung ứng dụng VComm: phiên đăng nhập; chưa đăng nhập thì chỉ mở được đăng nhập, đăng ký, quên mật khẩu, đường dẫn giới thiệu.
import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Button, Loading, Notice, Screen } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import { flushCollaboratorClick } from "@/lib/collaborator-link";
import { SessionProvider, useSession } from "@/lib/session";

const publicPaths = ["/dang-nhap", "/dang-ky", "/quen-mat-khau"];

function Gate() {
  const { stage, retry } = useSession();
  const path = usePathname();
  // Lượt bấm đường dẫn cộng tác viên giữ lại khi chưa đăng nhập (CONG_VIEC_49).
  useEffect(() => {
    if (stage === "ready") void flushCollaboratorClick();
  }, [stage]);
  if (stage === "loading") return <Loading />;
  if (stage === "offline")
    return (
      <Screen>
        <Notice text={translator("vcommApp")("offline")} />
        <Button label={translator("vcommApp")("retry")} onPress={() => void retry()} />
      </Screen>
    );
  const onPublic = publicPaths.includes(path);
  const onReferral = path.startsWith("/r/") || path.startsWith("/p/");
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
      <Stack.Screen name="khach/[id]" />
      <Stack.Screen name="de-xuat" />
      <Stack.Screen name="san-pham/[id]" />
      <Stack.Screen name="gio-hang" />
      <Stack.Screen name="so-dia-chi" />
      <Stack.Screen name="dat-hang" />
      <Stack.Screen name="don-hang/[id]" />
      <Stack.Screen name="tra-hang" />
      <Stack.Screen name="p/[id]" />
      <Stack.Screen name="cong-tac-vien" />
      <Stack.Screen name="moi-ban-be" />
      <Stack.Screen name="mua-chung/index" />
      <Stack.Screen name="mua-chung/[id]" />
      <Stack.Screen name="mua-chung/mo-nhom" />
      <Stack.Screen name="vi-mua-sam" />
      <Stack.Screen name="bai-dang/[id]" />
      <Stack.Screen name="dang-bai" />
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
