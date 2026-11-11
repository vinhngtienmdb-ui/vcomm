// MAN_HINH_97 Yêu cầu trả hàng (CHUC_NANG_118; API_129; QUYTAC_NGHIEPVU_161): chọn dòng, số lượng, lý do, mô tả, ảnh (bản web).
import { returnReasons, type BuyerOrderDetail, type ReturnReason } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { Button, Card, Choice, Field, Loading, Muted, Notice, QuantityStepper, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const counted = ["pending", "approved", "received"];

export default function ReturnRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<BuyerOrderDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<BuyerOrderDetail>(`/buyer/orders/${encodeURIComponent(String(id))}`)
      .then(setOrder)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [id]);

  // Số còn được yêu cầu của mỗi dòng: đã giao trừ phần ở các yêu cầu chưa bị từ chối, chưa rút.
  const remaining = (orderLineId: string, quantity: string) =>
    Number(quantity) -
    (order?.returnRequests ?? [])
      .filter((request) => counted.includes(request.status))
      .flatMap((request) => request.lines)
      .filter((line) => line.orderLineId === orderLineId)
      .reduce((sum, line) => sum + Number(line.quantity), 0);

  function pickImage() {
    const input = globalThis.document?.createElement("input");
    if (!input) return;
    input.type = "file";
    input.accept = "image/jpeg,image/png";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await api<{ id: string }>("/buyer/return-requests/images", { method: "POST", body: form });
        setImages((current) => [...current, { id: uploaded.id, name: file.name }]);
      } catch (failure) {
        setError(failure instanceof ApiFailure ? (Object.values(failure.fields)[0] ?? failure.message) : t("unknownError"));
      }
    };
    input.click();
  }

  async function submit() {
    if (!order || !reason) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const lines = Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
      await api(`/buyer/orders/${order.id}/return-requests`, { method: "POST", json: { reason, description, lines, imageIds: images.map((image) => image.id) } });
      router.replace(`/don-hang/${order.id}`);
    } catch (failure) {
      if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) setFields(failure.fields);
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const chosen = Object.values(quantities).some((quantity) => quantity > 0);
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("returnTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!order && !error ? <Loading /> : null}
        {order ? (
          <>
            <Muted>{t("returnHint", { number: order.documentNo })}</Muted>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("returnChooseLines")}</Text>
              {order.lines
                .filter((line) => line.orderLineId && !line.isGift)
                .map((line, index) => {
                  const maximum = Math.floor(remaining(line.orderLineId!, line.quantity));
                  return (
                    <View key={line.orderLineId} style={{ gap: space[1] }}>
                      <Text style={{ color: colors.text, fontWeight: "600" }}>{line.productName}</Text>
                      <Muted>{t("returnRemaining", { count: maximum })}</Muted>
                      {maximum > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                          <Button label={t("returnNone")} kind="secondary" disabled={!quantities[line.orderLineId!]} onPress={() => setQuantities({ ...quantities, [line.orderLineId!]: 0 })} />
                          <QuantityStepper
                            label={t("quantity")}
                            value={quantities[line.orderLineId!] ?? 0}
                            maximum={maximum}
                            onChange={(value) => setQuantities({ ...quantities, [line.orderLineId!]: Math.max(value, 1) })}
                          />
                        </View>
                      ) : null}
                      {fields[`lines.${index}.quantity`] ? <Text style={{ color: colors.error }}>{fields[`lines.${index}.quantity`]}</Text> : null}
                    </View>
                  );
                })}
            </Card>
            <Card>
              <Choice label={t("returnReason")} value={reason} options={returnReasons.map((value) => ({ value, label: t(`returnReason_${value}`) }))} onChange={setReason} />
              <Field label={t("returnDescription")} value={description} onChangeText={setDescription} maxLength={500} multiline error={fields.description} />
              <Text style={{ fontWeight: "600", color: colors.text }}>{t("returnImages", { count: images.length })}</Text>
              {images.map((image) => (
                <Muted key={image.id}>{image.name}</Muted>
              ))}
              {Platform.OS === "web" ? images.length < 5 ? <Button label={t("returnAddImage")} kind="secondary" onPress={pickImage} /> : null : <Muted>{t("returnImagesWebOnly")}</Muted>}
            </Card>
            <Button label={t("returnSubmit")} busy={busy} disabled={!chosen || !reason || !description.trim()} onPress={() => void submit()} />
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
