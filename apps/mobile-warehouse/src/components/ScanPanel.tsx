// Phần quét dùng chung của MAN_HINH_108, 109: vị trí hiện tại, ô quét, thông báo, danh sách chọn khi khớp nhiều mặt hàng.
import type { StockItemOption } from "contracts";
import { Text, View } from "react-native";
import { ScanInput } from "@/components/ScanInput";
import { Card, Muted, Notice, OptionList } from "@/components/ui";
import type { useScanner } from "@/components/useScanner";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export function ScanPanel({
  scanner,
  usesLocations,
  onScan,
  onPick,
}: {
  scanner: ReturnType<typeof useScanner>;
  usesLocations: boolean;
  onScan: (code: string) => void;
  onPick: (option: StockItemOption) => void;
}) {
  return (
    <View style={{ gap: space[2] }}>
      {usesLocations ? (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: radius.medium, padding: space[3] }}>
          <Text style={{ color: colors.primaryDark, fontWeight: "700" }}>{scanner.location ? t("currentLocation", { code: scanner.location.code }) : t("scanLocationFirst")}</Text>
        </View>
      ) : null}
      <ScanInput placeholder={t("scanPlaceholder")} onScan={onScan} busy={scanner.busy} />
      {scanner.message ? <Notice tone={scanner.message.tone} text={scanner.message.text} /> : null}
      {scanner.candidates.length > 0 ? (
        <Card>
          <Muted>{t("chooseItem")}</Muted>
          <OptionList
            items={scanner.candidates}
            label={(option) => `${option.sku} · ${option.productName}${option.optionValues.length ? ` (${option.optionValues.join(", ")})` : ""}`}
            onPick={(option) => {
              scanner.setCandidates([]);
              onPick(option);
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}
