// Thanh điều hướng dưới của ứng dụng; chỉ người có quyền bán hàng ở công ty đang chọn dùng được (QUYTAC_NGHIEPVU_136).
import { Tabs } from "expo-router";
import { Button, Notice, Screen } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const t = translator("salesApp");
  const { can, logout, me, switchCompany } = useSession();
  if (!can("sales.access"))
    return (
      <Screen>
        <Notice tone="warning" text={t("noAccess")} />
        {me?.companies
          .filter((company) => company.id !== me.currentCompanyId)
          .map((company) => (
            <Button key={company.id} kind="secondary" label={t("switchTo", { name: company.shortName })} onPress={() => void switchCompany(company.id)} />
          ))}
        <Button label={t("logout")} kind="secondary" onPress={() => void logout()} />
      </Screen>
    );
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.topBar },
        headerTintColor: colors.surface,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="khach" options={{ title: t("tabCustomers") }} />
      <Tabs.Screen name="don" options={{ title: t("tabOrders") }} />
      <Tabs.Screen name="ghe-tham" options={{ title: t("tabVisits") }} />
      <Tabs.Screen name="hoa-hong" options={{ title: t("tabCommissions"), href: can("finance.commission.view_own") ? undefined : null }} />
      <Tabs.Screen name="tai-khoan" options={{ title: t("tabAccount") }} />
    </Tabs>
  );
}
