// Danh sách dòng phiếu quét (MAN_HINH_108, 109): số lượng sửa được, lô, hạn dùng, đơn giá, serial; chạm dòng serial để chọn dòng chờ quét serial.
import type { LotSuggestion } from "contracts";
import { Pressable, Text, TextInput, View } from "react-native";
import { QuantityInput, StatusBadge, styles } from "@/components/ui";
import { quantity, shortDate, t } from "@/lib/i18n";
import { removeSerial, type ScanLine } from "@/lib/scan";
import { colors, space } from "@/lib/theme";

export type LotMode = "inbound" | "outbound" | "none";

export function LineList({
  lines,
  onChange,
  lotMode,
  withCost,
  awaitingKey,
  onAwait,
  suggestions,
  remaining,
  fields,
  signed,
  counting,
}: {
  lines: ScanLine[];
  onChange: (lines: ScanLine[]) => void;
  lotMode: LotMode;
  withCost?: boolean;
  awaitingKey: string | null;
  onAwait: (key: string | null) => void;
  suggestions?: Record<string, LotSuggestion[]>;
  remaining?: (line: ScanLine) => string | null;
  fields?: Record<string, string>;
  signed?: boolean;
  // Đếm kiểm kê: chọn được cả lô hết hạn, không cần lý do đổi lô.
  counting?: boolean;
}) {
  const update = (key: string, change: Partial<ScanLine>) => onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));
  return (
    <View style={{ gap: space[3] }}>
      {lines.map((line, index) => {
        const error = (field: string) => fields?.[`lines.${index}.${field}`] ?? fields?.[`additions.${index}.${field}`];
        const lots = suggestions?.[line.key] ?? [];
        const chosen = lots.find((lot) => lot.lotId === line.lotId);
        return (
          <View key={line.key} style={{ borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[3], gap: space[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{line.productName}</Text>
                <Text style={styles.muted}>{[line.sku, line.locationCode ? t("locationLine", { code: line.locationCode }) : null, remaining?.(line)].filter(Boolean).join(" · ")}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t("removeLine", { name: line.productName })} onPress={() => onChange(lines.filter((item) => item.key !== line.key))}>
                <Text style={{ color: colors.error, fontWeight: "700", padding: space[1] }}>{t("remove")}</Text>
              </Pressable>
            </View>
            {line.tracksSerials ? (
              <View style={{ gap: space[1] }}>
                <Pressable accessibilityRole="button" onPress={() => onAwait(awaitingKey === line.key ? null : line.key)} style={{ gap: space[1] }}>
                  <Text style={{ color: colors.text }}>{t("serialCount", { count: line.serials.length, unit: line.unitName })}</Text>
                  {awaitingKey === line.key ? <StatusBadge text={t("awaitingSerial")} tone="warning" /> : <Text style={{ color: colors.primary }}>{t("scanSerialForLine")}</Text>}
                </Pressable>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
                  {line.serials.map((serial) => (
                    <Pressable
                      key={serial}
                      accessibilityRole="button"
                      accessibilityLabel={t("removeSerial", { serial })}
                      onPress={() => onChange(removeSerial(lines, line.key, serial))}
                      style={styles.chip}
                    >
                      <Text style={{ color: colors.text }}>{serial} ✕</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <QuantityInput
                  label={t("quantityOf", { name: line.productName })}
                  value={String(line.quantity)}
                  minimum={signed ? -1e12 : 0}
                  onChange={(value) => update(line.key, { quantity: Number(value.replace(",", ".")) || 0 })}
                />
                <Text style={styles.muted}>{line.unitName}</Text>
              </View>
            )}
            {error("quantity") ? <Text style={styles.error}>{error("quantity")}</Text> : null}
            {error("serials") ? <Text style={styles.error}>{error("serials")}</Text> : null}
            {withCost ? (
              <LabeledInput
                label={t("unitCost", { unit: line.unitName })}
                value={line.unitCost}
                onChange={(value) => update(line.key, { unitCost: value })}
                keyboardType="decimal-pad"
                error={error("unitCost")}
              />
            ) : null}
            {line.tracksLots && lotMode === "inbound" ? (
              <>
                <LabeledInput label={t("lotNo")} value={line.lotNo ?? ""} onChange={(value) => update(line.key, { lotNo: value })} error={error("lotNo")} />
                <LabeledInput label={t("expiresOn")} placeholder="2027-03-15" value={line.expiresOn ?? ""} onChange={(value) => update(line.key, { expiresOn: value })} error={error("expiresOn")} />
              </>
            ) : null}
            {line.tracksLots && lotMode === "outbound" ? (
              <View style={{ gap: space[1] }}>
                <Text style={styles.label}>{t("lot")}</Text>
                {lots.length === 0 ? <Text style={styles.muted}>{t("noLotAvailable")}</Text> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
                  {lots.map((lot) => {
                    const selected = lot.lotId === line.lotId;
                    return (
                      <Pressable
                        key={`${lot.lotId}|${lot.locationId ?? ""}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: lot.expired && !counting }}
                        disabled={lot.expired && !counting}
                        onPress={() => update(line.key, { lotId: lot.lotId, lotNo: lot.lotNo, expiresOn: lot.expiresOn })}
                        style={[styles.chip, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : null, lot.expired && !counting ? { opacity: 0.5 } : null]}
                      >
                        <Text style={{ color: selected ? colors.surface : colors.text }}>
                          {t("lotChoice", { lot: lot.lotNo, expires: lot.expiresOn ? shortDate(lot.expiresOn) : "—", quantity: quantity(lot.quantity) })}
                          {lot.suggested ? ` · ${t("suggested")}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {chosen && !chosen.suggested && !counting ? (
                  <LabeledInput label={t("lotOverrideReason")} value={line.lotOverrideReason} onChange={(value) => update(line.key, { lotOverrideReason: value })} error={error("lotOverrideReason")} />
                ) : null}
                {error("lotId") ? <Text style={styles.error}>{error("lotId")}</Text> : null}
              </View>
            ) : null}
            {error("locationId") ? <Text style={styles.error}>{error("locationId")}</Text> : null}
            {error("variantId") ? <Text style={styles.error}>{error("variantId")}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={{ gap: space[1] }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? "default"}
        style={[styles.input, error ? { borderColor: colors.error } : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
