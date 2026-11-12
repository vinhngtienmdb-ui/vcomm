// Danh sách IP được phép của khóa API (QUYTAC_NGHIEPVU_485): địa chỉ IPv4, IPv6 hoặc dải CIDR.
import { BlockList, isIP } from "node:net";

export interface ParsedIp {
  address: string;
  prefix: number;
  family: "ipv4" | "ipv6";
}

// Địa chỉ IPv4 dạng IPv6 (`::ffff:1.2.3.4`) quy về IPv4 để so với danh sách.
export function normalizeIp(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped ? mapped[1]! : ip;
}

export function parseIpEntry(entry: string): ParsedIp | null {
  const [rawAddress, rawPrefix, extra] = entry.trim().split("/");
  if (extra !== undefined || !rawAddress) return null;
  const address = normalizeIp(rawAddress);
  const version = isIP(address);
  if (version === 0) return null;
  const maximum = version === 4 ? 32 : 128;
  if (rawPrefix !== undefined && !/^\d{1,3}$/.test(rawPrefix)) return null;
  const prefix = rawPrefix === undefined ? maximum : Number(rawPrefix);
  if (prefix > maximum) return null;
  return { address, prefix, family: version === 4 ? "ipv4" : "ipv6" };
}

export function ipAllowed(ip: string | undefined, entries: string[]): boolean {
  if (entries.length === 0) return true;
  if (!ip) return false;
  const address = normalizeIp(ip);
  const version = isIP(address);
  if (version === 0) return false;
  const list = new BlockList();
  for (const entry of entries) {
    const parsed = parseIpEntry(entry);
    if (parsed) list.addSubnet(parsed.address, parsed.prefix, parsed.family);
  }
  return list.check(address, version === 4 ? "ipv4" : "ipv6");
}

// PostgreSQL trả `inet` dạng có độ dài mặt nạ (`1.2.3.4/32`); một địa chỉ thì bỏ mặt nạ khi hiển thị.
export const displayIp = (value: string): string => value.replace(/^([0-9.]+)\/32$/, "$1").replace(/^([0-9A-Fa-f:]+)\/128$/, "$1");
