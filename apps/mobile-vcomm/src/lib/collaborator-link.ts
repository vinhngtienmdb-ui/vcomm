// Mã cộng tác viên từ đường dẫn sản phẩm khi người mua chưa đăng nhập: giữ trong lần mở ứng dụng, ghi lượt bấm sau khi đăng nhập, đăng ký (QUYTAC_NGHIEPVU_325).
import { api } from "@/lib/api";

let pending: { code: string; productId: string } | null = null;

export const holdCollaboratorClick = (code: string, productId: string) => {
  pending = { code, productId };
};

// Ghi lượt bấm; lỗi không chặn người mua xem sản phẩm.
export async function recordCollaboratorClick(code: string, productId: string): Promise<void> {
  await api("/buyer/collaborator/clicks", { method: "POST", json: { code, productId } }).catch(() => undefined);
}

export async function flushCollaboratorClick(): Promise<void> {
  const value = pending;
  pending = null;
  if (value) await recordCollaboratorClick(value.code, value.productId);
}
