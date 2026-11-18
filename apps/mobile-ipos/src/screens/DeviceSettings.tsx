// MAN_HINH_292 Cài đặt thiết bị (QUYTAC_NGHIEPVU_620 khoản 2 đến 5): máy in (Sunmi gắn sẵn, mạng LAN, Bluetooth đã ghép đôi), khổ giấy, in không dấu, bảng mã máy in rời,
// số liên, tự in, mở ngăn kéo qua máy in, in thử; thông tin thiết bị và quầy. Chủ cửa hàng mở ngăn kéo có ghi nhật ký.
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, Choice, Field, Muted, Notice, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { usePos } from "@/lib/pos";
import { openDrawer, printTest, type PrintOutcome } from "@/lib/printer";
import { bluetoothPrinters, hasPhysicalPrinter } from "@/lib/printer-driver";
import { defaultPrinterSettings, loadPrinterSettings, savePrinterSettings, type PrinterSettings } from "@/lib/printer-settings";
import { useSession } from "@/lib/session";
import { monospace } from "./Sell";
import { colors, space } from "@/lib/theme";

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={{ flex: 1, color: colors.text }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export function DeviceSettings() {
  const { device, me } = useSession();
  const { context } = usePos();
  const [settings, setSettings] = useState<PrinterSettings>(defaultPrinterSettings);
  const [saved, setSaved] = useState(false);
  const [outcome, setOutcome] = useState<PrintOutcome | null>(null);
  const [drawerNote, setDrawerNote] = useState<string | null>(null);
  const [bonded, setBonded] = useState<{ address: string; name: string }[] | null>(null);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);
  useEffect(() => {
    void loadPrinterSettings().then(setSettings);
  }, []);
  const update = (patch: Partial<PrinterSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSaved(false);
  };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.column}>
        <Card>
          <Title>{t("printerTitle")}</Title>
          {!hasPhysicalPrinter ? <Notice tone="info" text={t("webPreviewPrinter")} /> : null}
          <Choice
            label={t("printerConnection")}
            value={settings.connection}
            options={[
              { value: "none", label: t("printer_none") },
              { value: "sunmi", label: t("printer_sunmi") },
              { value: "lan", label: t("printer_lan") },
              { value: "bluetooth", label: t("printer_bluetooth") },
            ]}
            onChange={(connection) => update({ connection })}
          />
          {settings.connection === "bluetooth" ? (
            <>
              <Notice tone="warning" text={t("bluetoothUntested")} />
              <Muted>{settings.bluetoothAddress ? t("bluetoothChosen", { name: settings.bluetoothName || settings.bluetoothAddress }) : t("bluetoothNone")}</Muted>
              <Button
                label={t("bluetoothFind")}
                kind="secondary"
                onPress={() => {
                  setBluetoothError(null);
                  bluetoothPrinters()
                    .then(setBonded)
                    .catch((failure: unknown) => setBluetoothError(failure instanceof Error ? t(failure.message === "bluetoothOff" ? "bluetoothOff" : failure.message === "bluetoothPermission" ? "bluetoothPermission" : "bluetoothFailed") : String(failure)));
                }}
              />
              {bluetoothError ? <Notice text={bluetoothError} /> : null}
              {bonded ? (
                bonded.length === 0 ? (
                  <Muted>{hasPhysicalPrinter ? t("bluetoothNoneBonded") : t("webPreviewPrinter")}</Muted>
                ) : (
                  <Choice label={t("bluetoothBonded")} value={settings.bluetoothAddress || null} options={bonded.map((item) => ({ value: item.address, label: item.name || item.address }))} onChange={(address) => update({ bluetoothAddress: address, bluetoothName: bonded.find((item) => item.address === address)?.name ?? "" })} />
                )
              ) : null}
            </>
          ) : null}
          {settings.connection === "lan" || settings.connection === "bluetooth" ? (
            <>
              <Choice
                label={t("codepageMapping")}
                value={settings.codepageMapping}
                options={(["epson", "xprinter", "pos-5890", "citizen", "bixolon"] as const).map((value) => ({ value, label: value }))}
                onChange={(codepageMapping) => update({ codepageMapping })}
              />
              <Toggle label={t("printAscii")} value={settings.ascii} onChange={(ascii) => update({ ascii })} />
            </>
          ) : null}
          {settings.connection === "lan" ? (
            <>
              <Field label={t("printerHost")} value={settings.host} autoCapitalize="none" keyboardType="numbers-and-punctuation" onChangeText={(host) => update({ host: host.trim() })} />
              <Field label={t("printerPort")} value={String(settings.port)} keyboardType="number-pad" onChangeText={(port) => update({ port: Number(port.replace(/\D/g, "")) || 9100 })} />
            </>
          ) : null}
          <Choice
            label={t("paperWidthLabel")}
            value={settings.paperWidth === null ? "store" : String(settings.paperWidth)}
            options={[
              { value: "store", label: t("paperStore", { width: context?.paperWidth ?? 80 }) },
              { value: "80", label: "80 mm" },
              { value: "58", label: "58 mm" },
            ]}
            onChange={(value) => update({ paperWidth: value === "store" ? null : (Number(value) as 58 | 80) })}
          />
          <Choice label={t("copies")} value={String(settings.copies)} options={["1", "2", "3"].map((value) => ({ value, label: value }))} onChange={(value) => update({ copies: Number(value) as 1 | 2 | 3 })} />
          <Toggle label={t("autoPrint")} value={settings.autoPrint} onChange={(autoPrint) => update({ autoPrint })} />
          <Toggle label={t("drawerViaPrinter")} value={settings.drawerViaPrinter} onChange={(drawerViaPrinter) => update({ drawerViaPrinter })} />
          {saved ? <Notice tone="success" text={t("settingsSavedDevice")} /> : null}
          {outcome?.printed ? <Notice tone="success" text={t("printed")} /> : null}
          {outcome?.error ? <Notice text={outcome.error} /> : null}
          {outcome?.preview ? <Text style={styles.preview}>{outcome.preview.join("\n")}</Text> : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label={t("testPrint")} kind="secondary" onPress={() => void printTest(settings, context?.paperWidth ?? 80).then(setOutcome)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t("save")} onPress={() => void savePrinterSettings(settings).then(() => setSaved(true))} />
            </View>
          </View>
        </Card>
      </View>
      <View style={styles.column}>
        <Card>
          <Title>{t("deviceInfoTitle")}</Title>
          <Muted>{t("deviceInfoStore", { name: device?.merchantName ?? "", code: device?.merchantCode ?? "" })}</Muted>
          <Muted>{t("deviceInfoOutlet", { name: device?.outletName ?? "", code: context?.outletCode ?? "—" })}</Muted>
          <Muted>{t("deviceInfoRegister", { name: device?.registerName ?? "" })}</Muted>
          <Muted>{t("deviceInfoMember", { name: me?.member.fullName ?? "" })}</Muted>
        </Card>
        {me?.member.role === "owner" ? (
          <Card>
            <Title>{t("drawerTitle")}</Title>
            <Muted>{t("drawerText")}</Muted>
            {drawerNote ? <Notice tone="info" text={drawerNote} /> : null}
            <Button
              label={t("openDrawer")}
              kind="secondary"
              onPress={() => {
                void (async () => {
                  await api("/ipos/pos/drawer-events", { method: "POST", json: { reason: null } });
                  setDrawerNote((await openDrawer()) ?? t("drawerOpened"));
                })().catch((failure: unknown) => setDrawerNote(failure instanceof Error ? failure.message : String(failure)));
              }}
            />
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space[3], padding: space[3] },
  column: { flex: 1, minWidth: 360, gap: space[3] },
  row: { flexDirection: "row", gap: space[2] },
  toggle: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44 },
  preview: { fontFamily: monospace, fontSize: 12, color: colors.text, backgroundColor: colors.background, padding: space[3] },
});
