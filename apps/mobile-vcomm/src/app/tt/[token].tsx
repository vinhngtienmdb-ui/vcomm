// Đường dẫn trong mã QR thanh toán của cửa hàng (CONG_VIEC_73; QUYTAC_NGHIEPVU_577): mở ứng dụng, nhận đơn rồi chuyển sang MAN_HINH_277.
import type { BuyerInstoreCheckout } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, Loading, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";

const t = translator("vcommApp");

export default function ClaimCheckoutScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<BuyerInstoreCheckout>("/buyer/instore/checkouts/claim", { method: "POST", json: { token } })
      .then((checkout) => router.replace({ pathname: "/thanh-toan-cua-hang/[id]", params: { id: checkout.id } }))
      .catch((failure) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [token]);
  if (!error) return <Loading />;
  return (
    <Screen>
      <Notice text={error} />
      <Button label={t("instoreHome")} onPress={() => router.replace("/trang-chu")} />
    </Screen>
  );
}
