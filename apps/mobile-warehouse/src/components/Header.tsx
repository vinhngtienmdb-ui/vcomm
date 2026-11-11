// Thanh đầu màn hình: nút quay lại, tiêu đề, dòng phụ, nút bên phải.
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean | (() => void); right?: ReactNode }) {
  const goBack = typeof back === "function" ? back : () => (router.canGoBack() ? router.back() : router.replace("/kho"));
  return (
    <View style={{ backgroundColor: colors.topBar, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[2] }}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={goBack}
          style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.round, paddingHorizontal: space[3], paddingVertical: space[1] }}
        >
          <Text style={{ color: colors.surface, fontWeight: "700" }}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: colors.surface, fontSize: 16, fontWeight: "700" }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: colors.surface, opacity: 0.85, fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.round, paddingHorizontal: space[3], paddingVertical: space[1] }}>
      <Text style={{ color: colors.surface, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
