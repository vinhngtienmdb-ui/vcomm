// Đọc bảng tỷ giá công khai của Vietcombank (CHUC_NANG_21, luồng 8 tài liệu 09). Nguồn giới hạn một lần gọi mỗi 5 phút.
import { Injectable } from "@nestjs/common";

export const EXCHANGE_RATE_FEED = Symbol("EXCHANGE_RATE_FEED");

export interface ExchangeRateFeed {
  // Nội dung XML của bảng tỷ giá.
  fetchXml(): Promise<string>;
}

export const vietcombankUrl = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=10";

@Injectable()
export class VietcombankFeed implements ExchangeRateFeed {
  async fetchXml(): Promise<string> {
    const response = await fetch(vietcombankUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Vietcombank trả mã ${response.status}`);
    return response.text();
  }
}

export interface FeedRate {
  currency: string;
  buy: string | null;
  transfer: string | null;
  sell: string | null;
}

// Giá trị dạng "26,300.50"; "-" là không có.
const toDecimal = (value: string | undefined): string | null => {
  const text = value?.trim().replace(/,/g, "");
  return text && /^\d+(\.\d+)?$/.test(text) && /[1-9]/.test(text) ? text : null;
};

export function parseVietcombankXml(xml: string): FeedRate[] {
  const rates: FeedRate[] = [];
  for (const match of xml.matchAll(/<Exrate\s+([^>]*?)\/?>/g)) {
    const attributes = Object.fromEntries([...match[1]!.matchAll(/(\w+)="([^"]*)"/g)].map((pair) => [pair[1]!, pair[2]!]));
    const currency = attributes.CurrencyCode?.trim();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) continue;
    rates.push({ currency, buy: toDecimal(attributes.Buy), transfer: toDecimal(attributes.Transfer), sell: toDecimal(attributes.Sell) });
  }
  if (rates.length === 0) throw new Error("Bảng tỷ giá Vietcombank không có dữ liệu");
  return rates;
}
