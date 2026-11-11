// Tạo PDF bằng pdfmake với phông Roboto kèm thư viện (có tiếng Việt); không cho tải tệp ngoài.
import { dirname, join } from "node:path";

// pdfmake 0.3 không kèm khai báo kiểu.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake") as {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(definition: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
};
const fontDirectory = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");
pdfmake.setFonts({
  Roboto: {
    normal: join(fontDirectory, "Roboto-Regular.ttf"),
    bold: join(fontDirectory, "Roboto-Medium.ttf"),
    italics: join(fontDirectory, "Roboto-Italic.ttf"),
    bolditalics: join(fontDirectory, "Roboto-MediumItalic.ttf"),
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory));

export async function renderPdf(definition: Record<string, unknown>): Promise<Buffer> {
  return Buffer.from(await pdfmake.createPdf(definition).getBuffer());
}
