// Một lượt ghé thăm: khách, người ghi, thời điểm, ghi chú, số ảnh, mở vị trí trên bản đồ (QUYTAC_NGHIEPVU_139).
import type { VisitItem } from "contracts";
import { Linking, Text, View } from "react-native";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";
import { Muted, styles } from "./ui";

export const visitTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

export function VisitCard({ visit, showCustomer }: { visit: VisitItem; showCustomer: boolean }) {
  const t = translator("salesApp");
  return (
    <View style={styles.card}>
      {showCustomer ? <Text style={{ fontWeight: "700", color: colors.text }}>{visit.partnerName}</Text> : null}
      <Muted>
        {visitTime(visit.visitedAt)} · {visit.userName}
      </Muted>
      <Text style={{ color: colors.text }}>{visit.note}</Text>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        {visit.photoIds.length > 0 ? <Muted>{t("photoCount", { count: visit.photoIds.length })}</Muted> : null}
        <Text
          accessibilityRole="link"
          style={{ color: colors.primary, fontWeight: "600" }}
          onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`)}
        >
          {t("openMap")}
        </Text>
      </View>
    </View>
  );
}
