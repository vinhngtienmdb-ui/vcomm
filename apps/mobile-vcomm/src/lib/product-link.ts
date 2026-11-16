// Đường dẫn chia sẻ sản phẩm (CONG_VIEC_68; QUYTAC_NGHIEPVU_552): <địa chỉ chia sẻ>/s/<mã sản phẩm>?ref=<mã giới thiệu>&ctv=<mã cộng tác viên>.
// Trang chia sẻ do API trả có thẻ Open Graph (ảnh, tên, giá) để Facebook, Zalo hiện thẻ xem trước; nút trên trang mở ứng dụng theo
// đường dẫn cũ /r/<mã>?sp=, /p/<mã sản phẩm>?ctv= của CONG_VIEC_22, 49 (QUYTAC_NGHIEPVU_434, 325). Không có mã nào thì không có nút chia sẻ (như trước).
import { apiBase } from "@/lib/api";

export const shareBase = (process.env.EXPO_PUBLIC_SHARE_URL ?? apiBase.replace(/\/api\/v1\/?$/, "")).replace(/\/+$/, "");

export function productShareLink(productId: string, referralCode: string | null, collaboratorCode: string | null): string | null {
  if (!referralCode && !collaboratorCode) return null;
  const query = new URLSearchParams();
  if (referralCode) query.set("ref", referralCode);
  if (collaboratorCode) query.set("ctv", collaboratorCode);
  return `${shareBase}/s/${productId}?${query.toString()}`;
}

// Sản phẩm cần mở sau khi người nhận đăng ký, đăng nhập xong trong cùng lần mở ứng dụng.
let pendingProductId: string | null = null;
export const holdProduct = (productId: string) => {
  pendingProductId = productId;
};
// Đọc không xóa (cổng gọi trong lúc vẽ, có thể vẽ lại); trang sản phẩm xóa khi đã mở.
export const peekHeldProduct = (): string | null => pendingProductId;
export const clearHeldProduct = () => {
  pendingProductId = null;
};
