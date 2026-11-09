// Lỗi trùng chỉ mục duy nhất của PostgreSQL (hai người lưu cùng lúc vượt qua bước kiểm tra trùng).
export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}
