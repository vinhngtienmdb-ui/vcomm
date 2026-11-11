// Lưới thao tác trên MAN_HINH_106; chỉ hiện thao tác người dùng có quyền (máy chủ vẫn kiểm theo chi nhánh sở hữu kho).
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { t } from "@/lib/i18n";
import { operationPermission, operations } from "@/lib/operations";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export function ActionGrid() {
  const { can } = useSession();
  const visible = operations.filter((operation) => operationPermission[operation].some(can));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3] }}>
      {visible.map((operation) => (
        <Pressable
          key={operation}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/viec/[thaoTac]", params: { thaoTac: operation } })}
          style={{
            flexBasis: "47%",
            flexGrow: 1,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.medium,
            paddingVertical: space[4],
            paddingHorizontal: space[3],
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryDark, fontWeight: "700", fontSize: 15 }}>{t(`operation_${operation}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
