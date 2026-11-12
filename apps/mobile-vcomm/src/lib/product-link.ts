// Đường dẫn chia sẻ sản phẩm kèm mã giới thiệu (CONG_VIEC_22; QUYTAC_NGHIEPVU_434): /r/<mã giới thiệu>?sp=<mã sản phẩm>[&ctv=<mã cộng tác viên>].
// Một nút chia sẻ cho mọi người mua; cộng tác viên đã duyệt có thêm mã cộng tác viên để ghi lượt bấm như CONG_VIEC_49 (quyết định của người dùng 2026-11-12).
import { appBase } from "@/lib/api";

export function productShareLink(productId: string, referralCode: string | null, collaboratorCode: string | null): string | null {
  if (referralCode) {
    const query = new URLSearchParams({ sp: productId });
    if (collaboratorCode) query.set("ctv", collaboratorCode);
    return `${appBase}/r/${encodeURIComponent(referralCode)}?${query.toString()}`;
  }
  // Không có mã giới thiệu: chỉ còn đường dẫn cộng tác viên (QUYTAC_NGHIEPVU_325).
  return collaboratorCode ? `${appBase}/p/${productId}?ctv=${encodeURIComponent(collaboratorCode)}` : null;
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
