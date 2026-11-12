// Sao chép chữ vào bộ nhớ tạm trên máy thật và bản web (expo-clipboard, người dùng duyệt 2026-11-12 trong CONG_VIEC_22).
// Trả false khi không ghi được để màn hình không báo "Đã sao chép" sai.
import * as Clipboard from "expo-clipboard";

export async function copyText(text: string): Promise<boolean> {
  return Clipboard.setStringAsync(text).then(
    (written) => written !== false,
    () => false,
  );
}
