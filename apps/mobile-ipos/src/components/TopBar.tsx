// Thanh trên của máy bán: cửa hàng, điểm bán, quầy, người đang bán, trạng thái thuê bao.
import { StyleSheet, Text, View } from "react-native";
import type { IposDeviceInfo } from "contracts";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export function TopBar({ device, member }: { device: IposDeviceInfo | null; member?: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {device ? `${device.merchantName} · ${device.outletName} · ${device.registerName}${member ? ` · ${member}` : ""}` : t("title")}
      </Text>
      {device?.subscriptionStatus && device.subscriptionStatus !== "active" ? <Text style={styles.badge}>{t(`subscription_${device.subscriptionStatus}`)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], backgroundColor: colors.topBar },
  text: { flex: 1, color: colors.surface, fontSize: 15, fontWeight: "600" },
  badge: { color: colors.surface, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.round, paddingHorizontal: space[2], paddingVertical: 2, fontSize: 12 },
});
