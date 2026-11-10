// Tài khoản: người đang đăng nhập, đổi công ty, đăng xuất (QUYTAC_NGHIEPVU_136).
import { ScrollView, Text } from "react-native";
import { Button, Card, Muted, Screen, Title } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function AccountScreen() {
  const t = translator("salesApp");
  const { me, switchCompany, logout } = useSession();
  if (!me) return null;
  return (
    <ScrollView>
      <Screen>
        <Card>
          <Title>{me.user.fullName}</Title>
          <Muted>{me.user.email ?? me.user.phone ?? ""}</Muted>
        </Card>
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("company")}</Text>
          {me.companies.map((company) =>
            company.id === me.currentCompanyId ? (
              <Text key={company.id} style={{ color: colors.primary, fontWeight: "700" }}>
                ✓ {company.shortName}
              </Text>
            ) : (
              <Button key={company.id} kind="secondary" label={t("switchTo", { name: company.shortName })} onPress={() => void switchCompany(company.id)} />
            ),
          )}
        </Card>
        <Button label={t("logout")} kind="secondary" onPress={() => void logout()} />
      </Screen>
    </ScrollView>
  );
}
