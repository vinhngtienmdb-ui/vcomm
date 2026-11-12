// Đường dẫn giới thiệu /r/<số điện thoại>: chưa đăng nhập thì mở đăng ký với mã điền sẵn; đã đăng nhập thì mở tài khoản (QUYTAC_NGHIEPVU_142).
// Có sp (chia sẻ sản phẩm, QUYTAC_NGHIEPVU_434): đăng ký, đăng nhập xong thì mở sản phẩm; đã đăng nhập thì mở thẳng sản phẩm, không đổi người giới thiệu.
// Có ctv: ghi lượt bấm cộng tác viên như đường dẫn /p (QUYTAC_NGHIEPVU_325).
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Loading } from "@/components/ui";
import { holdCollaboratorClick, recordCollaboratorClick } from "@/lib/collaborator-link";
import { holdProduct } from "@/lib/product-link";
import { useSession } from "@/lib/session";

export default function ReferralLink() {
  const { code, sp, ctv } = useLocalSearchParams<{ code: string; sp?: string; ctv?: string }>();
  const { stage } = useSession();
  const [done, setDone] = useState(false);
  const ma = typeof code === "string" ? code.replace(/[^0-9+]/g, "").slice(0, 15) : "";
  const productId = typeof sp === "string" && /^[0-9a-f-]{36}$/i.test(sp) ? sp : "";
  const collaborator = typeof ctv === "string" ? ctv.trim().toUpperCase().slice(0, 8) : "";
  // Giữ ngay khi vẽ (ghi đè cùng giá trị nên vẽ lại không sao): Redirect sang đăng ký chạy trước effect của màn hình này.
  if (productId && stage !== "ready") {
    holdProduct(productId);
    if (collaborator) holdCollaboratorClick(collaborator, productId);
  }
  useEffect(() => {
    if (!productId || stage !== "ready") return;
    if (!collaborator) return setDone(true);
    void recordCollaboratorClick(collaborator, productId).finally(() => setDone(true));
  }, [stage, productId, collaborator]);
  if (stage !== "ready") return <Redirect href={{ pathname: "/dang-ky", params: { ma } }} />;
  if (!productId) return <Redirect href={{ pathname: "/tai-khoan", params: { ma } }} />;
  if (!done) return <Loading />;
  return <Redirect href={{ pathname: "/san-pham/[id]", params: { id: productId } }} />;
}
