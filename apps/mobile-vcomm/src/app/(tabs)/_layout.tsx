// Thanh điều hướng dưới: Trang chủ, Cửa hàng, Bảng tin (CONG_VIEC_49), Đơn hàng (CONG_VIEC_24), Kinh doanh (chỉ nhân viên kinh doanh), Tài khoản (QUYTAC_NGHIEPVU_144).
import { Tabs } from "expo-router";
import { NotificationBell } from "@/components/NotificationBell";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const t = translator("vcommApp");
  const { me } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.topBar },
        headerTintColor: colors.surface,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        // CONG_VIEC_22: mục Thông báo kèm số chưa đọc (MAN_HINH_200).
        headerRight: () => <NotificationBell />,
      }}
    >
      <Tabs.Screen name="trang-chu" options={{ title: t("tabHome") }} />
      <Tabs.Screen name="cua-hang" options={{ title: t("tabShop") }} />
      <Tabs.Screen name="bang-tin" options={{ title: t("tabFeed") }} />
      <Tabs.Screen name="don-hang" options={{ title: t("tabOrders") }} />
      <Tabs.Screen name="kinh-doanh" options={{ title: t("tabSales"), href: me?.isSalesStaff ? undefined : null }} />
      <Tabs.Screen name="tai-khoan" options={{ title: t("tabAccount") }} />
    </Tabs>
  );
}
