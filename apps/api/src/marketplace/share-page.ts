// Trang chia sẻ sản phẩm MAN_HINH_266 (CONG_VIEC_68; QUYTAC_NGHIEPVU_552 đến 555). HTML tĩnh, không có script.
import { type Locale, messages } from "i18n";
import { escapeHtml } from "../common/html";
import { shopImagePath } from "./shop.service";
import type { PublicProduct } from "./share.service";

export interface ShareLinks {
  shareBase: string;
  webBase: string;
  appBase: string;
  appStoreUrl: string | null;
  googlePlayUrl: string | null;
}

const trimSlash = (value: string) => value.replace(/\/+$/, "");
export function shareLinks(): ShareLinks {
  return {
    shareBase: trimSlash(process.env.SHARE_PUBLIC_URL?.trim() || "http://localhost:4000"),
    webBase: trimSlash(process.env.VCOMM_WEB_URL?.trim() || "http://localhost:8083"),
    appBase: process.env.VCOMM_APP_LINK_BASE?.trim() || "vcomm://",
    appStoreUrl: process.env.APP_STORE_URL?.trim() || null,
    googlePlayUrl: process.env.GOOGLE_PLAY_URL?.trim() || null,
  };
}

// Mã sai dạng thì bỏ, trang vẫn hiện (QUYTAC_NGHIEPVU_552); mã cộng tác viên nhận cả chữ thường như QUYTAC_NGHIEPVU_325.
export function shareCodes(ref: unknown, ctv: unknown): { ref: string | null; ctv: string | null } {
  return {
    ref: typeof ref === "string" && /^\+?[0-9]{1,15}$/.test(ref) && ref.length <= 15 ? ref : null,
    ctv: typeof ctv === "string" && /^[A-Za-z0-9]{1,8}$/.test(ctv) ? ctv.toUpperCase() : null,
  };
}

export const shareUrl = (shareBase: string, productId: string, codes: { ref: string | null; ctv: string | null }) => {
  const query = new URLSearchParams();
  if (codes.ref) query.set("ref", codes.ref);
  if (codes.ctv) query.set("ctv", codes.ctv);
  const text = query.toString();
  return `${shareBase}/s/${productId}${text ? `?${text}` : ""}`;
};

// Đường dẫn trong ứng dụng, bản web theo QUYTAC_NGHIEPVU_434, 325 (QUYTAC_NGHIEPVU_555).
export function appPath(productId: string, codes: { ref: string | null; ctv: string | null }): string {
  if (codes.ref) {
    const query = new URLSearchParams({ sp: productId });
    if (codes.ctv) query.set("ctv", codes.ctv);
    return `r/${encodeURIComponent(codes.ref)}?${query.toString()}`;
  }
  if (codes.ctv) return `p/${productId}?ctv=${encodeURIComponent(codes.ctv)}`;
  return `san-pham/${productId}`;
}

export const formatMoney = (amount: string, currency: string) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(Number(amount));

// Giá thấp nhất; nhiều phân loại khác giá thì ghi "Từ" (QUYTAC_NGHIEPVU_553).
export function priceText(product: PublicProduct, currency: string, locale: Locale): string {
  const prices = product.variants.map((variant) => Number(variant.grossPrice));
  const lowest = product.variants.reduce((low, variant) => (Number(variant.grossPrice) < Number(low.grossPrice) ? variant : low)).grossPrice;
  const text = formatMoney(lowest, currency);
  return Math.max(...prices) > Math.min(...prices) ? messages[locale].sharePage.priceFrom.replace("{price}", text) : text;
}

export function shortDescription(value: string | null): string | null {
  const flat = (value ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  return flat.length > 160 ? `${flat.slice(0, 159).trimEnd()}…` : flat;
}

// Giá trị giao diện chép từ tài liệu 15 (packages/ui/src/styles.css) vì trang do API trả, không nạp được tệp CSS của giao diện.
const styles = `:root{--mau-chinh:#047857;--mau-chinh-dam:#065F46;--mau-thanh-tren:#064E3B;--mau-nen:#F6FAF8;--mau-be-mat:#FFFFFF;--mau-vien:#E2E8F0;--mau-vien-o-nhap:#64748B;--mau-chu:#0F172A;--mau-chu-phu:#475569;--mau-canh-bao:#7A4A05;--mau-canh-bao-nen:#FDF6E3;--mau-chinh-nhat:#E8F6F0;--phong:"Nunito Sans",system-ui,"Segoe UI",Roboto,Arial,sans-serif;--khoang-2:8px;--khoang-3:12px;--khoang-4:16px;--khoang-6:32px;--bo-vua:10px;--bo-tron:999px;--bong-nhe:0 1px 2px rgba(15,23,42,.06);color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--mau-nen);color:var(--mau-chu);font-family:var(--phong);font-size:14px;line-height:22px}
header{background:var(--mau-thanh-tren);color:#fff;padding:var(--khoang-3) var(--khoang-4);font-weight:800;font-size:18px}
main{padding:var(--khoang-4);display:grid;gap:var(--khoang-4);max-width:960px;margin:0 auto}
h1{font-size:20px;line-height:28px;font-weight:800;margin:0;overflow-wrap:anywhere}
.the{background:var(--mau-be-mat);border:1px solid var(--mau-vien);border-radius:var(--bo-vua);box-shadow:var(--bong-nhe);overflow:hidden;display:grid}
.anh{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:var(--mau-chinh-nhat)}
.noi-dung{padding:var(--khoang-4);display:grid;gap:var(--khoang-3);align-content:start}
.gia{color:var(--mau-chinh);font-size:24px;line-height:32px;font-weight:800}
.mo-ta{margin:0}.phu{color:var(--mau-chu-phu);font-size:13px;margin:0}
.nhan{justify-self:start;border-radius:var(--bo-tron);padding:1px 10px;font-size:12px;font-weight:700;background:var(--mau-canh-bao-nen);color:var(--mau-canh-bao)}
.cac-nut{display:grid;gap:var(--khoang-2);max-width:420px}.tai{display:flex;flex-wrap:wrap;gap:var(--khoang-2)}.tai .nut{flex:1 1 140px}
.nut{display:flex;align-items:center;justify-content:center;border-radius:var(--bo-vua);padding:11px 14px;font-weight:700;font-size:14px;border:1px solid transparent;text-decoration:none;text-align:center}
.nut.chinh{background:var(--mau-chinh);color:#fff}.nut.phu{background:var(--mau-be-mat);color:var(--mau-chu);border-color:var(--mau-vien-o-nhap)}
.trong{background:var(--mau-be-mat);border:1px dashed var(--mau-vien-o-nhap);border-radius:var(--bo-vua);padding:var(--khoang-6);display:grid;gap:var(--khoang-3);justify-items:center;text-align:center}
footer{color:var(--mau-chu-phu);font-size:12px;text-align:center;padding-bottom:var(--khoang-4)}
:focus-visible{outline:2px solid var(--mau-chinh);outline-offset:2px}
@media (min-width:768px){.the.co-anh{grid-template-columns:360px minmax(0,1fr)}}`;

const meta = (property: string, content: string) => `<meta property="${property}" content="${escapeHtml(content)}">`;

function page(locale: Locale, title: string, head: string, body: string, storeName: string): string {
  return (
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(title)}</title>${head}<style>${styles}</style></head>` +
    `<body><header>VComm</header><main>${body}<footer>© ${escapeHtml(storeName)}</footer></main></body></html>`
  );
}

export function renderSharePage(input: { locale: Locale; links: ShareLinks; storeName: string; currency: string; product: PublicProduct; codes: { ref: string | null; ctv: string | null } }): string {
  const { locale, links, storeName, currency, product, codes } = input;
  const text = messages[locale].sharePage;
  const price = priceText(product, currency, locale);
  const description = shortDescription(product.description);
  const imageId = product.imageIds[0] ?? null;
  const imageUrl = imageId ? `${links.shareBase}${shopImagePath(imageId)}` : null;
  const url = shareUrl(links.shareBase, product.id, codes);
  const path = appPath(product.id, codes);
  const inStock = product.variants.some((variant) => Number(variant.available) > 0);
  const lowest = product.variants.reduce((low, variant) => (Number(variant.grossPrice) < Number(low.grossPrice) ? variant : low)).grossPrice;
  const head = [
    `<meta name="description" content="${escapeHtml(description ? `${price} · ${description}` : price)}">`,
    meta("og:type", "product"),
    meta("og:title", product.name),
    meta("og:description", description ? `${price} · ${description}` : price),
    meta("og:url", url),
    meta("og:site_name", storeName),
    meta("og:locale", locale === "vi" ? "vi_VN" : "en_US"),
    imageUrl ? meta("og:image", imageUrl) + meta("og:image:alt", product.name) : "",
    meta("product:price:amount", lowest),
    meta("product:price:currency", currency),
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
  ].join("");
  const download = [
    links.appStoreUrl ? `<a class="nut phu" href="${escapeHtml(links.appStoreUrl)}">${escapeHtml(text.appStore)}</a>` : "",
    links.googlePlayUrl ? `<a class="nut phu" href="${escapeHtml(links.googlePlayUrl)}">${escapeHtml(text.googlePlay)}</a>` : "",
  ].join("");
  const body =
    `<div class="the${imageUrl ? " co-anh" : ""}">${imageUrl ? `<img class="anh" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}">` : ""}` +
    `<div class="noi-dung"><h1>${escapeHtml(product.name)}</h1><div class="gia">${escapeHtml(price)}</div>` +
    (inStock ? "" : `<span class="nhan">${escapeHtml(text.outOfStock)}</span>`) +
    (description ? `<p class="mo-ta">${escapeHtml(description)}</p>` : "") +
    `<p class="phu">${escapeHtml(text.store.replace("{name}", storeName))}</p>` +
    `<div class="cac-nut"><a class="nut chinh" href="${escapeHtml(links.appBase + path)}">${escapeHtml(text.openApp)}</a>` +
    `<a class="nut phu" href="${escapeHtml(`${links.webBase}/${path}`)}">${escapeHtml(text.openWeb)}</a>` +
    (download ? `<div class="tai">${download}</div>` : "") +
    `</div>` +
    (codes.ref ? `<p class="phu">${escapeHtml(text.referralHint.replace("{code}", codes.ref))}</p>` : "") +
    `</div></div>`;
  return page(locale, `${product.name} – ${storeName}`, head, body, storeName);
}

export function renderUnavailablePage(locale: Locale, links: ShareLinks, storeName: string): string {
  const text = messages[locale].sharePage;
  const body = `<div class="trong"><h1>${escapeHtml(text.unavailable)}</h1><a class="nut chinh" href="${escapeHtml(`${links.webBase}/`)}">${escapeHtml(text.viewStore)}</a></div>`;
  return page(locale, text.unavailable, `<meta name="robots" content="noindex">`, body, storeName);
}

export const sharePageSecurityPolicy = (links: ShareLinks) => `default-src 'none'; img-src ${links.shareBase}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
