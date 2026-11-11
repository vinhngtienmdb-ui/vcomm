// MAN_HINH_93 Đặt hàng (CHUC_NANG_116; API_126; QUYTAC_NGHIEPVU_158): địa chỉ nhận, dòng hàng, tiền hàng, phí giao hàng, tổng thanh toán.
// Chọn phương thức thanh toán đang bật (CONG_VIEC_25; QUYTAC_NGHIEPVU_163). Dùng điểm thưởng, mặc định không dùng (CONG_VIEC_51; QUYTAC_NGHIEPVU_348).
// CONG_VIEC_49: dùng ví mua sắm (MAN_HINH_135; QUYTAC_NGHIEPVU_332); đặt đơn tham gia nhóm mua chung (MAN_HINH_134; QUYTAC_NGHIEPVU_330).
// Ghép điểm thưởng với ví mua sắm (CONG_VIEC_51 mục 19): điểm trừ trước, ví trả phần còn lại; đơn mua chung không dùng điểm.
// CONG_VIEC_57 (MAN_HINH_192; QUYTAC_NGHIEPVU_421 đến 423): chọn cách nhận hàng, trạm còn đủ hàng; đơn mua chung chỉ giao qua đơn vị vận chuyển.
import type { BuyerAddressItem, BuyerOrderDetail, BuyerOrderPreview, CartResponse, FulfillmentMode, PaymentMethodCode, StationOption } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { AmountRow, OrderLines } from "@/components/OrderLines";
import { Button, Card, Choice, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { takeChosenAddress } from "@/lib/selection";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const method = translator("paymentMethods");
// Apple Pay không dùng được trên Android (CONG_VIEC_41; QUYTAC_NGHIEPVU_268): ẩn phương thức của cổng apple_pay.
const usableMethods = (codes: PaymentMethodCode[]) => (Platform.OS === "android" ? codes.filter((code) => !code.startsWith("apple_pay")) : codes);

// Danh sách trạm đủ hàng, lọc theo tỉnh khi có trạm ở nhiều tỉnh (QUYTAC_NGHIEPVU_421).
function StationPicker({ stations, value, onChange }: { stations: StationOption[]; value: string | null; onChange: (id: string) => void }) {
  const provinces = [...new Map(stations.map((station) => [station.provinceCode, station.provinceName])).entries()];
  const [province, setProvince] = useState<string>("all");
  const shown = province === "all" ? stations : stations.filter((station) => station.provinceCode === province);
  return (
    <View style={{ gap: space[2] }}>
      {provinces.length > 1 ? (
        <Choice label="" value={province} options={[{ value: "all", label: t("stationAllProvinces") }, ...provinces.map(([code, name]) => ({ value: code, label: name }))]} onChange={setProvince} />
      ) : null}
      {shown.map((station) => {
        const selected = station.id === value;
        return (
          <Pressable
            key={station.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(station.id)}
            style={{ borderWidth: 1, borderRadius: 8, padding: space[3], gap: 2, borderColor: selected ? colors.primary : colors.inputBorder, backgroundColor: colors.surface }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {station.name}
              {station.sameWard ? ` · ${t("stationSameWard")}` : ""}
            </Text>
            <Muted>{station.address}</Muted>
            <Muted>{`${station.openingHours} · ${station.phone}`}</Muted>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ lines?: string; nhom?: string; bienThe?: string; soLuong?: string }>();
  // Đơn mua chung: một dòng theo nhóm, không lấy từ giỏ.
  const groupBuyId = typeof params.nhom === "string" && params.nhom ? params.nhom : null;
  const groupLine = groupBuyId && typeof params.bienThe === "string" ? { variantId: params.bienThe, quantity: Math.max(1, Number(params.soLuong ?? 1) || 1) } : null;
  const chosen = String(params.lines ?? "")
    .split(",")
    .filter(Boolean);
  const [lines, setLines] = useState<{ variantId: string; quantity: number }[] | null>(null);
  const [address, setAddress] = useState<BuyerAddressItem | null | undefined>(undefined);
  const [preview, setPreview] = useState<BuyerOrderPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodCode | null>(null);
  // Số điểm đang áp dụng (đã qua xem trước) và số người mua đang nhập.
  const [usePoints, setUsePoints] = useState(false);
  const [pointsApplied, setPointsApplied] = useState(0);
  const [pointsText, setPointsText] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  // Lựa chọn ví đọc qua ref: bật, tắt ví tải lại xem trước với số điểm đang áp dụng, không đặt lại điểm.
  const walletChoice = useRef(false);
  // Cách nhận, trạm đang chọn đọc qua ref như ví (CONG_VIEC_57).
  const [mode, setMode] = useState<FulfillmentMode>("carrier");
  const modeChoice = useRef<FulfillmentMode>("carrier");
  const stationChoice = useRef<string | null>(null);

  const load = useCallback(
    async (pointsToRedeem = 0) => {
      setError(null);
      try {
        const [cart, book] = await Promise.all([api<CartResponse>("/buyer/cart"), api<BuyerAddressItem[]>("/buyer/addresses")]);
        const picked = groupLine ? [groupLine] : cart.lines.filter((line) => chosen.includes(line.variantId)).map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
        setLines(picked);
        const wanted = takeChosenAddress();
        const current = book.find((item) => item.id === wanted) ?? book.find((item) => item.id === address?.id) ?? book.find((item) => item.isDefault) ?? null;
        setAddress(current);
        if (picked.length > 0) {
          const fetched = await api<BuyerOrderPreview>("/buyer/orders/preview", {
            method: "POST",
            json: {
              addressId: current?.id ?? null,
              lines: picked,
              groupBuyId,
              pointsToRedeem: groupBuyId ? 0 : pointsToRedeem,
              useShoppingWallet: walletChoice.current,
              fulfillmentMode: modeChoice.current,
              stationId: stationChoice.current,
            },
          });
          const next = { ...fetched, paymentMethods: usableMethods(fetched.paymentMethods) };
          setPreview(next);
          // Trạm đang chọn không còn trong danh sách (hết hàng, đổi địa chỉ): bỏ chọn.
          stationChoice.current = next.station?.id ?? null;
          setPointsApplied(next.pointsToRedeem);
          if (pointsToRedeem > 0) setPointsText(String(next.pointsToRedeem));
          // Giữ phương thức đã chọn nếu còn bật; chưa chọn thì lấy phương thức đầu tiên.
          setPaymentMethod((selected) => (selected && next.paymentMethods.includes(selected) ? selected : (next.paymentMethods[0] ?? null)));
        }
      } catch (failure) {
        setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [params.lines, params.nhom, params.bienThe, params.soLuong],
  );

  useFocusEffect(
    useCallback(() => {
      void load(0);
      setUsePoints(false);
    }, [load]),
  );

  async function place() {
    const needsMethod = Number(preview?.payable ?? 0) > 0;
    if (!address || !lines || !preview || (needsMethod && !paymentMethod)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const order = await api<BuyerOrderDetail>("/buyer/orders", {
        method: "POST",
        json: {
          addressId: address.id,
          lines,
          expectedTotal: preview.total,
          paymentMethod: paymentMethod ?? "cod",
          groupBuyId,
          pointsToRedeem: usePoints && !groupBuyId ? pointsApplied : 0,
          useShoppingWallet: useWallet,
          fulfillmentMode: mode,
          stationId: preview.station?.id ?? null,
        },
      });
      router.replace(`/don-hang/${order.id}`);
    } catch (failure) {
      const message = failure instanceof ApiFailure ? failure.message : t("unknownError");
      // Giá đổi: tải lại tổng mới để người mua xem rồi đặt lại.
      if (failure instanceof ApiFailure && failure.status === 409) {
        setNotice(message);
        await load(usePoints ? pointsApplied : 0);
      } else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("checkout")}</Title>
        {notice ? <Notice tone="warning" text={notice} /> : null}
        {error ? <Notice text={error} /> : null}
        {lines === null && !error ? <Loading /> : null}
        {lines?.length === 0 ? <Notice tone="warning" text={t("checkoutNothing")} /> : null}
        {address !== undefined ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("deliverTo")}</Text>
            {address ? (
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{`${address.recipientName} · ${address.phone}`}</Text>
                <Text style={{ color: colors.text }}>{address.streetAddress}</Text>
                <Muted>{`${address.wardName}, ${address.provinceName}`}</Muted>
              </View>
            ) : (
              <Muted>{t("noAddress")}</Muted>
            )}
            <Button label={address ? t("changeAddress") : t("addAddress")} kind="secondary" onPress={() => router.push({ pathname: "/so-dia-chi", params: { chon: "1" } })} />
          </Card>
        ) : null}
        {preview ? (
          <>
            {groupBuyId ? null : (
              <Card>
                <Choice
                  label={t("fulfillmentMode")}
                  value={mode}
                  options={(["carrier", "station_pickup", "station_delivery"] as const).map((value) => ({ value, label: t(`fulfillment_${value}`) }))}
                  onChange={(value) => {
                    modeChoice.current = value;
                    stationChoice.current = null;
                    setMode(value);
                    void load(usePoints ? pointsApplied : 0);
                  }}
                />
                {mode === "carrier" ? null : preview.stations.length === 0 ? (
                  <Notice tone="warning" text={t(mode === "station_delivery" ? "noDeliveryStation" : "noPickupStation")} />
                ) : (
                  <>
                    <Muted>{t("chooseStationHint")}</Muted>
                    <StationPicker
                      stations={preview.stations}
                      value={preview.station?.id ?? null}
                      onChange={(id) => {
                        stationChoice.current = id;
                        void load(usePoints ? pointsApplied : 0);
                      }}
                    />
                  </>
                )}
              </Card>
            )}
            <Card>
              <OrderLines lines={preview.lines} />
            </Card>
            <Card>
              <AmountRow label={t("goodsAmount")} value={money(preview.goodsAmount)} />
              <AmountRow label={t("shippingFee")} value={Number(preview.shippingFee) === 0 ? t("free") : money(preview.shippingFee)} />
              <AmountRow label={t("orderTotal")} value={money(preview.total)} strong />
              {Number(preview.pointsAmount) > 0 ? (
                <AmountRow label={t("pointsDeduction", { points: preview.pointsToRedeem.toLocaleString("vi-VN") })} value={`−${money(preview.pointsAmount)}`} />
              ) : null}
              {Number(preview.walletAmount) > 0 || Number(preview.pointsAmount) > 0 ? (
                <>
                  {Number(preview.walletAmount) > 0 ? <AmountRow label={t("walletPaid")} value={`− ${money(preview.walletAmount)}`} /> : null}
                  <AmountRow label={t("payableRemaining")} value={money(preview.payable)} strong />
                </>
              ) : null}
              {preview.expectedPoints > 0 ? <Muted>{t("pointsExpectedCheckout", { points: preview.expectedPoints.toLocaleString("vi-VN") })}</Muted> : null}
            </Card>
            {preview.loyalty.balance > 0 && !groupBuyId ? (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{t("usePoints")}</Text>
                  <Text
                    accessibilityRole="switch"
                    accessibilityState={{ checked: usePoints, disabled: !preview.loyalty.redeemable }}
                    onPress={() => {
                      if (!preview.loyalty.redeemable) return;
                      const next = !usePoints;
                      setUsePoints(next);
                      if (!next) void load(0);
                    }}
                    style={{ color: preview.loyalty.redeemable ? colors.primary : colors.textMuted, fontWeight: "700", paddingVertical: space[1] }}
                  >
                    {usePoints ? t("usePointsOn") : t("usePointsOff")}
                  </Text>
                </View>
                <Muted>
                  {preview.loyalty.redeemable
                    ? t("usePointsHint", {
                        balance: preview.loyalty.balance.toLocaleString("vi-VN"),
                        max: preview.loyalty.maxPoints.toLocaleString("vi-VN"),
                        min: preview.loyalty.minPoints.toLocaleString("vi-VN"),
                        value: money(preview.loyalty.pointValue ?? "0"),
                      })
                    : t(`usePointsBlocked_${preview.loyalty.blockedReason ?? "insufficient"}`, { min: preview.loyalty.minPoints.toLocaleString("vi-VN") })}
                </Muted>
                {usePoints ? (
                  <>
                    <Field label={t("pointsToUse")} keyboardType="number-pad" value={pointsText} onChangeText={(value) => setPointsText(value.replace(/\D/g, ""))} />
                    <View style={{ flexDirection: "row", gap: space[2] }}>
                      <View style={{ flex: 1 }}>
                        <Button label={t("applyPoints")} kind="secondary" onPress={() => void load(Number(pointsText || 0))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label={t("useMaxPoints")}
                          kind="secondary"
                          onPress={() => {
                            setPointsText(String(preview.loyalty.maxPoints));
                            void load(preview.loyalty.maxPoints);
                          }}
                        />
                      </View>
                    </View>
                  </>
                ) : null}
              </Card>
            ) : null}
            {Number(preview.shoppingWallet.balance) > 0 ? (
              <Card>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: useWallet, disabled: !preview.shoppingWallet.usable }}
                  disabled={!preview.shoppingWallet.usable}
                  onPress={() => {
                    walletChoice.current = !useWallet;
                    setUseWallet(!useWallet);
                    void load(usePoints ? pointsApplied : 0);
                  }}
                  style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: useWallet ? colors.primary : colors.inputBorder,
                      backgroundColor: useWallet ? colors.primary : colors.surface,
                    }}
                  />
                  <Text style={{ flex: 1, color: colors.text }}>{t("useShoppingWallet", { balance: money(preview.shoppingWallet.balance) })}</Text>
                </Pressable>
                {preview.shoppingWallet.usable ? null : <Muted>{t("shoppingWalletUnavailable")}</Muted>}
              </Card>
            ) : null}
            {groupBuyId ? <Notice tone="info" text={t("groupBuyCheckoutHint")} /> : null}
            {preview.paymentMethods.length > 0 && Number(preview.payable) > 0 ? (
              <Card>
                <Choice label={t("paymentMethod")} value={paymentMethod} options={preview.paymentMethods.map((code) => ({ value: code, label: method(code) }))} onChange={setPaymentMethod} />
              </Card>
            ) : null}
            {preview.canOrder ? null : <Notice tone="warning" text={t("orderingNotOpen")} />}
            <Button
              label={t("placeOrder")}
              busy={busy}
              disabled={!address || !preview.canOrder || (Number(preview.payable) > 0 && !paymentMethod) || (mode !== "carrier" && !preview.station)}
              onPress={() => void place()}
            />
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
