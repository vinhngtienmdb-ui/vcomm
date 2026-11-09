// Chọn cột tên theo ngôn ngữ của yêu cầu (CHUC_NANG_22): name_vi hoặc name_en của danh mục hệ thống.
import { type SQL, sql } from "drizzle-orm";

export function localizedName(alias: string, locale: "vi" | "en" | undefined): SQL {
  if (!/^[a-z_]+$/.test(alias)) throw new Error("Bí danh bảng không hợp lệ");
  return sql.raw(`${alias}.${locale === "en" ? "name_en" : "name_vi"}`);
}
