// MAN_HINH_94 Sổ địa chỉ (CHUC_NANG_114; API_125; QUYTAC_NGHIEPVU_156): danh sách, thêm, sửa, xóa, đặt mặc định; chọn tỉnh, xã hai cấp.
// Mở từ màn hình đặt hàng với tham số chon=1 thì chạm một địa chỉ để chọn rồi quay lại.
import type { BuyerAddressItem, RegionItem } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { RegionPicker } from "@/components/RegionPicker";
import { Button, Card, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { chooseAddress } from "@/lib/selection";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
type Form = { id: string | null; recipientName: string; phone: string; province: RegionItem | null; ward: RegionItem | null; streetAddress: string; isDefault: boolean };
const empty: Form = { id: null, recipientName: "", phone: "", province: null, ward: null, streetAddress: "", isDefault: false };

function confirm(text: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(text) ?? true);
  return new Promise((resolve) =>
    Alert.alert(t("confirmTitle"), text, [
      { text: t("cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("confirm"), style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function AddressForm({ initial, onSaved, onCancel }: { initial: Form; onSaved: (items: BuyerAddressItem[]) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>(initial);
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [wards, setWards] = useState<RegionItem[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<RegionItem[]>("/buyer/regions/provinces")
      .then(setProvinces)
      .catch(() => setError(t("unknownError")));
  }, []);
  useEffect(() => {
    if (!form.province) return setWards([]);
    api<RegionItem[]>(`/buyer/regions/provinces/${form.province.code}/wards`)
      .then(setWards)
      .catch(() => setError(t("unknownError")));
  }, [form.province]);

  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = {
        recipientName: form.recipientName,
        phone: form.phone,
        provinceCode: form.province?.code ?? "",
        wardCode: form.ward?.code ?? "",
        streetAddress: form.streetAddress,
        isDefault: form.isDefault,
      };
      onSaved(await api<BuyerAddressItem[]>(form.id ? `/buyer/addresses/${form.id}` : "/buyer/addresses", { method: form.id ? "PUT" : "POST", json: body }));
    } catch (failure) {
      if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) setFields(failure.fields);
      else setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{form.id ? t("editAddress") : t("addAddress")}</Text>
      <Field label={t("recipientName")} value={form.recipientName} onChangeText={(recipientName) => setForm({ ...form, recipientName })} maxLength={100} error={fields.recipientName} />
      <Field label={t("recipientPhone")} value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" error={fields.phone} />
      <RegionPicker label={t("province")} value={form.province} items={provinces} error={fields.provinceCode} onChange={(province) => setForm({ ...form, province, ward: null })} />
      <RegionPicker label={t("ward")} value={form.ward} items={wards} disabled={!form.province} error={fields.wardCode} onChange={(ward) => setForm({ ...form, ward })} />
      <Field
        label={t("streetAddress")}
        value={form.streetAddress}
        onChangeText={(streetAddress) => setForm({ ...form, streetAddress })}
        maxLength={200}
        error={fields.streetAddress}
        placeholder={t("streetAddressHint")}
      />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.isDefault }} onPress={() => setForm({ ...form, isDefault: !form.isDefault })} style={{ paddingVertical: space[2] }}>
        <Text style={{ color: colors.text }}>{`${form.isDefault ? "☑" : "☐"} ${t("setDefault")}`}</Text>
      </Pressable>
      {error ? <Notice text={error} /> : null}
      <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
        <Button label={t("save")} busy={busy} disabled={!form.province || !form.ward} onPress={() => void save()} />
        <Button label={t("cancel")} kind="secondary" onPress={onCancel} />
      </View>
    </Card>
  );
}

export default function AddressBookScreen() {
  const { chon } = useLocalSearchParams<{ chon?: string }>();
  const choosing = chon === "1";
  const [items, setItems] = useState<BuyerAddressItem[] | null>(null);
  const [editing, setEditing] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BuyerAddressItem[]>("/buyer/addresses")
      .then((value) => {
        setItems(value);
        if (value.length === 0) setEditing(empty);
      })
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);

  async function act(path: string, method: string, question?: string) {
    if (question && !(await confirm(question))) return;
    setError(null);
    try {
      setItems(await api<BuyerAddressItem[]>(path, { method }));
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("addressBook")}</Title>
        {choosing ? <Muted>{t("chooseAddressHint")}</Muted> : null}
        {error ? <Notice text={error} /> : null}
        {!items && !error ? <Loading /> : null}
        {editing ? (
          <AddressForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(value) => {
              setItems(value);
              setEditing(null);
            }}
          />
        ) : items && items.length < 10 ? (
          <Button label={t("addAddress")} kind="secondary" onPress={() => setEditing(empty)} />
        ) : null}
        {(items ?? []).map((item) => (
          <Card key={item.id}>
            <Pressable
              accessibilityRole={choosing ? "button" : undefined}
              disabled={!choosing}
              onPress={() => {
                chooseAddress(item.id);
                router.back();
              }}
              style={{ gap: space[1] }}
            >
              <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{item.recipientName}</Text>
                <Text style={{ color: colors.textMuted }}>{item.phone}</Text>
                {item.isDefault ? <StatusBadge text={t("defaultAddress")} tone="success" /> : null}
              </View>
              <Text style={{ color: colors.text }}>{item.streetAddress}</Text>
              <Muted>{`${item.wardName}, ${item.provinceName}`}</Muted>
            </Pressable>
            {choosing ? null : (
              <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
                <Button
                  label={t("edit")}
                  kind="secondary"
                  onPress={() =>
                    setEditing({
                      id: item.id,
                      recipientName: item.recipientName,
                      phone: item.phone,
                      province: { code: item.provinceCode, name: item.provinceName },
                      ward: { code: item.wardCode, name: item.wardName },
                      streetAddress: item.streetAddress,
                      isDefault: item.isDefault,
                    })
                  }
                />
                {item.isDefault ? null : <Button label={t("makeDefault")} kind="secondary" onPress={() => void act(`/buyer/addresses/${item.id}/default`, "POST")} />}
                <Button label={t("remove")} kind="secondary" onPress={() => void act(`/buyer/addresses/${item.id}`, "DELETE", t("removeAddressConfirm"))} />
              </View>
            )}
          </Card>
        ))}
      </Screen>
    </ScrollView>
  );
}
