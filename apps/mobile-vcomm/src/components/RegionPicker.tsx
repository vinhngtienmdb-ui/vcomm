// Chọn tỉnh hoặc xã từ danh mục hai cấp, có ô tìm kiếm không dấu (QUYTAC_NGHIEPVU_156).
import type { RegionItem } from "contracts";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";
import { Button, styles } from "./ui";

const t = translator("vcommApp");
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export function RegionPicker({
  label,
  value,
  items,
  disabled,
  error,
  onChange,
}: {
  label: string;
  value: RegionItem | null;
  items: RegionItem[];
  disabled?: boolean;
  error?: string | undefined;
  onChange: (item: RegionItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const key = plain(search.trim());
    return key ? items.filter((item) => plain(item.name).includes(key)) : items;
  }, [items, search]);
  return (
    <View style={{ gap: space[1] }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={[styles.input, { justifyContent: "center", opacity: disabled ? 0.6 : 1 }, error ? { borderColor: colors.error } : null]}
      >
        <Text style={{ color: value ? colors.text : colors.textMuted, fontSize: 16 }}>{value?.name ?? t("chooseRegion")}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: space[4], gap: space[3] }}>
          <Text style={styles.title}>{label}</Text>
          <TextInput
            accessibilityLabel={t("regionSearch")}
            placeholder={t("regionSearch")}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.input}
            autoFocus
          />
          <FlatList
            data={shown}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
                style={{ paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: item.code === value?.code ? "700" : "400" }}>{item.name}</Text>
              </Pressable>
            )}
          />
          <Button label={t("close")} kind="secondary" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}
