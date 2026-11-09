// Kiểm tra hai tệp dịch có cùng tập khóa (mỗi khóa phải có ở cả vi và en).
import en from "./en.json";
import vi from "./vi.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}
const vietnamese = new Set(keys(vi));
const english = new Set(keys(en));
const missing = [...[...vietnamese].filter((key) => !english.has(key)).map((key) => `en thiếu ${key}`), ...[...english].filter((key) => !vietnamese.has(key)).map((key) => `vi thiếu ${key}`)];
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`Tệp dịch khớp: ${vietnamese.size} khóa.`);
