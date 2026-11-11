// MAN_HINH_93 Đặt hàng (CHUC_NANG_116; API_126; QUYTAC_NGHIEPVU_158): địa chỉ nhận, dòng hàng, tiền hàng, phí giao hàng, tổng thanh toán.
// Chọn phương thức thanh toán đang bật (CONG_VIEC_25; QUYTAC_NGHIEPVU_163).
// CONG_VIEC_49: dùng ví mua sắm (MAN_HINH_135; QUYTAC_NGHIEPVU_332); đặt đơn tham gia nhóm mua chung (MAN_HINH_134; QUYTAC_NGHIEPVU_330).
import type { BuyerAddressItem, BuyerOrderDetail, BuyerOrderPreview, CartResponse, PaymentMethodCode } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AmountRow, OrderLines } from "@/components/OrderLines";
import { Button, Card, Choice, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { takeChosenAddress } from "@/lib/selection";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const method = translator("paymentMethods");

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
  const [useWallet, setUseWallet] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cart, book] = await Promise.all([api<CartResponse>("/buyer/cart"), api<BuyerAddressItem[]>("/buyer/addresses")]);
      const picked = groupLine ? [groupLine] : cart.lines.filter((line) => chosen.includes(line.variantId)).map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
      setLines(picked);
      const wanted = takeChosenAddress();
      const current = book.find((item) => item.id === wanted) ?? book.find((item) => item.id === address?.id) ?? book.find((item) => item.isDefault) ?? null;
      setAddress(current);
      if (picked.length > 0) {
        const next = await api<BuyerOrderPreview>("/buyer/orders/preview", {
          method: "POST",
          json: { addressId: current?.id ?? null, lines: picked, groupBuyId, useShoppingWallet: useWallet },
        });
        setPreview(next);
        // Giữ phương thức đã chọn nếu còn bật; chưa chọn thì lấy phương thức đầu tiên.
        setPaymentMethod((selected) => (selected && next.paymentMethods.includes(selected) ? selected : (next.paymentMethods[0] ?? null)));
      }
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.lines, params.nhom, params.bienThe, params.soLuong, useWallet]);

  useFocusEffect(
    useCallback(() => {
      void load();
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
          useShoppingWallet: useWallet,
        },
      });
      router.replace(`/don-hang/${order.id}`);
    } catch (failure) {
      const message = failure instanceof ApiFailure ? failure.message : t("unknownError");
      // Giá đổi: tải lại tổng mới để người mua xem rồi đặt lại.
      if (failure instanceof ApiFailure && failure.status === 409) {
        setNotice(message);
        await load();
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
            <Card>
              <OrderLines lines={preview.lines} />
            </Card>
            <Card>
              <AmountRow label={t("goodsAmount")} value={money(preview.goodsAmount)} />
              <AmountRow label={t("shippingFee")} value={Number(preview.shippingFee) === 0 ? t("free") : money(preview.shippingFee)} />
              <AmountRow label={t("orderTotal")} value={money(preview.total)} strong />
              {Number(preview.walletAmount) > 0 ? (
                <>
                  <AmountRow label={t("walletPaid")} value={`− ${money(preview.walletAmount)}`} />
                  <AmountRow label={t("payableRemaining")} value={money(preview.payable)} strong />
                </>
              ) : null}
            </Card>
            {Number(preview.shoppingWallet.balance) > 0 ? (
              <Card>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: useWallet, disabled: !preview.shoppingWallet.usable }}
                  disabled={!preview.shoppingWallet.usable}
                  onPress={() => setUseWallet(!useWallet)}
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
            <Button label={t("placeOrder")} busy={busy} disabled={!address || !preview.canOrder || (Number(preview.payable) > 0 && !paymentMethod)} onPress={() => void place()} />
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
