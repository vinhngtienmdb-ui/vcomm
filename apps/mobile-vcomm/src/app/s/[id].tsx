// Ứng dụng mở bằng đường dẫn chia sẻ /s/<mã sản phẩm>?ref=&ctv= (liên kết tên miền hoặc bản web; CONG_VIEC_68; QUYTAC_NGHIEPVU_555, 556):
// chuyển sang đường dẫn cũ để giữ cách đăng ký, ghi lượt bấm cộng tác viên, mở sản phẩm của QUYTAC_NGHIEPVU_434, 325.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function ShareLink() {
  const { id, ref, ctv } = useLocalSearchParams<{ id: string; ref?: string; ctv?: string }>();
  const productId = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : "";
  const referral = typeof ref === "string" && /^\+?[0-9]{1,15}$/.test(ref) ? ref : "";
  const collaborator = typeof ctv === "string" && /^[A-Za-z0-9]{1,8}$/.test(ctv) ? ctv.toUpperCase() : "";
  if (!productId) return <Redirect href="/" />;
  if (referral) return <Redirect href={{ pathname: "/r/[code]", params: { code: referral, sp: productId, ...(collaborator ? { ctv: collaborator } : {}) } }} />;
  if (collaborator) return <Redirect href={{ pathname: "/p/[id]", params: { id: productId, ctv: collaborator } }} />;
  return <Redirect href={{ pathname: "/san-pham/[id]", params: { id: productId } }} />;
}
