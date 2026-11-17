// Khung máy bán sau khi đăng nhập: thanh trạng thái (ca, mạng, máy in, thuê bao; MAN_HINH_286), các mục Bán hàng, Hóa đơn trong ca, Thu chi và đóng ca,
// Cài đặt thiết bị, Khóa màn hình. Chưa mở ca thì hiện màn hình mở ca.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Loading, Notice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { PosProvider, usePos } from "@/lib/pos";
import { loadPrinterSettings } from "@/lib/printer-settings";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";
import { CloseShift } from "./CloseShift";
import { DeviceSettings } from "./DeviceSettings";
import { OpenShift } from "./OpenShift";
import { Sales } from "./Sales";
import { Sell } from "./Sell";

type Tab = "sell" | "sales" | "close" | "settings";

function StatusStrip() {
  const { device, me, lock } = useSession();
  const { shift, online } = usePos();
  const [printer, setPrinter] = useState<string>("");
  useEffect(() => {
    void loadPrinterSettings().then((settings) => setPrinter(t(`printer_${settings.connection}`)));
  }, []);
  const status = device?.subscriptionStatus;
  return (
    <View style={styles.strip}>
      <Text style={styles.stripMain} numberOfLines={1}>
        {device ? `${device.outletName} · ${device.registerName} · ${me?.member.fullName ?? ""}` : t("title")}
      </Text>
      <Text style={styles.badge}>{shift ? t("shiftOpenSince", { time: new Date(shift.openedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) }) : t("noShift")}</Text>
      <Text style={[styles.badge, !online ? { backgroundColor: colors.error } : null]}>{online ? t("online") : t("offlineShort")}</Text>
      <Text style={styles.badge}>{t("printerBadge", { name: printer })}</Text>
      {status && status !== "active" ? <Text style={[styles.badge, { backgroundColor: status === "locked" ? colors.error : colors.warning }]}>{t(`subscription_${status}`)}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => void lock()} style={styles.lock}>
        <Text style={styles.lockText}>{t("lockScreen")}</Text>
      </Pressable>
    </View>
  );
}

function Body() {
  const { current, shift, loadError, online } = usePos();
  const [tab, setTab] = useState<Tab>("sell");
  if (!current) return loadError ? <Notice text={loadError} /> : <Loading />;
  const tabs: { key: Tab; label: string }[] = shift
    ? [
        { key: "sell", label: t("tabSell") },
        { key: "sales", label: t("tabSales") },
        { key: "close", label: t("tabClose") },
        { key: "settings", label: t("tabSettings") },
      ]
    : [
        { key: "sell", label: t("tabOpenShift") },
        { key: "settings", label: t("tabSettings") },
      ];
  const active = tabs.some((item) => item.key === tab) ? tab : "sell";
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((item) => (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active === item.key }} onPress={() => setTab(item.key)} style={[styles.tab, active === item.key ? styles.tabOn : null]}>
            <Text style={[styles.tabText, active === item.key ? { color: colors.primary } : null]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {!online ? <Notice text={t("offlineBanner")} /> : null}
      <View style={{ flex: 1 }}>
        {active === "settings" ? <DeviceSettings /> : !shift ? <OpenShift /> : active === "sales" ? <Sales /> : active === "close" ? <CloseShift /> : <Sell />}
      </View>
    </View>
  );
}

export function Pos() {
  return (
    <PosProvider>
      <View style={{ flex: 1 }}>
        <StatusStrip />
        <Body />
      </View>
    </PosProvider>
  );
}

const styles = StyleSheet.create({
  strip: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], backgroundColor: colors.topBar },
  stripMain: { flex: 1, color: colors.surface, fontSize: 15, fontWeight: "600" },
  badge: { color: colors.surface, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.round, paddingHorizontal: space[2], paddingVertical: 2, fontSize: 12, overflow: "hidden" },
  lock: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: radius.small, paddingHorizontal: space[3], paddingVertical: space[1] },
  lockText: { color: colors.surface, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: space[1], paddingHorizontal: space[3], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 15 },
});
