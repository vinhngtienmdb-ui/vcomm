// Màn hình mở đầu của khung ứng dụng (lát L0): thanh trên và thông báo chưa ghép thiết bị. MAN_HINH_283 ghép thiết bị làm ở lát L1.
import { StyleSheet, Text, View } from "react-native";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export default function Start() {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>{t("title")}</Text>
      </View>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.heading}>{t("notPairedTitle")}</Text>
          <Text style={styles.muted}>{t("notPairedText")}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 48, justifyContent: "center", paddingHorizontal: space[4], backgroundColor: colors.topBar },
  topBarText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space[4] },
  card: { width: "100%", maxWidth: 440, gap: space[3], padding: space[4], backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  muted: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
