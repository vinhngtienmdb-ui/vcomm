// Thêm khách trên ứng dụng (CHUC_NANG_100; API_71; QUYTAC_NGHIEPVU_135): kiểm trùng mã số thuế; đối tác có sẵn thì nhận làm khách của mình.
import type { PartnerLookupResponse, PartnerResponse } from "contracts";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

export default function AddCustomerScreen() {
  const t = translator("salesApp");
  const router = useRouter();
  const { can } = useSession();
  const [individual, setIndividual] = useState(false);
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [existing, setExisting] = useState<PartnerLookupResponse | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setExisting(null);
    if (!identity.trim()) return;
    const parameter = individual ? "citizenId" : "taxCode";
    const found = await api<PartnerLookupResponse>(`/crm/partners/lookup?${parameter}=${encodeURIComponent(identity.trim())}`).catch(() => null);
    if (found?.partner) setExisting(found);
  }

  async function run(action: () => Promise<PartnerResponse>) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const saved = await action();
      router.replace({ pathname: "/khach/[id]", params: { id: saved.id } });
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setError(failure.message);
        setFields(failure.fields);
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(() =>
      api<PartnerResponse>("/crm/partners", {
        method: "POST",
        json: {
          kind: individual ? "individual" : "organization",
          name,
          taxCode: individual ? null : identity.trim() || null,
          citizenId: individual ? identity.trim() || null : null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        },
      }),
    );

  return (
    <ScrollView>
      <Stack.Screen options={{ title: t("addCustomer") }} />
      <Screen>
        <Card>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Button label={t("organization")} kind={individual ? "secondary" : "primary"} onPress={() => setIndividual(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t("individual")} kind={individual ? "primary" : "secondary"} onPress={() => setIndividual(true)} />
            </View>
          </View>
          <Field
            label={individual ? t("citizenId") : t("taxCode")}
            value={identity}
            onChangeText={setIdentity}
            onBlur={() => void lookup()}
            keyboardType="number-pad"
            error={fields.taxCode ?? fields.citizenId}
          />
          {existing?.partner ? (
            <View style={{ gap: space[2] }}>
              <Notice tone="info" text={t("partnerExists", { code: existing.partner.code, name: existing.partner.name })} />
              {existing.canClaim ? (
                <Button label={t("claim")} busy={busy} onPress={() => void run(() => api<PartnerResponse>(`/crm/partners/${existing.partner?.id}/claim`, { method: "POST" }))} />
              ) : can("crm.customer.view_all") ? (
                <Button label={t("openCustomer")} onPress={() => router.replace({ pathname: "/khach/[id]", params: { id: existing.partner?.id ?? "" } })} />
              ) : (
                <Text style={{ color: colors.textMuted }}>{t("askManager")}</Text>
              )}
            </View>
          ) : (
            <>
              <Field label={t("customerName")} value={name} onChangeText={setName} error={fields.name} />
              <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fields.phone} />
              <Field label={t("address")} value={address} onChangeText={setAddress} error={fields.address} />
              {error ? <Notice text={error} /> : null}
              <Button label={t("saveCustomer")} busy={busy} disabled={!name.trim()} onPress={() => void save()} />
            </>
          )}
        </Card>
      </Screen>
    </ScrollView>
  );
}
