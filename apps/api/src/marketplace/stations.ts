// Trạm giao hàng O2O khi đặt đơn VComm (CONG_VIEC_57; QUYTAC_NGHIEPVU_418, 421, 422). Chỉ đọc cài đặt trạm của mini app Bán lẻ.
import type { FulfillmentMode, StationOption } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";
import { availableQuantities } from "./store.service";

type Executor = Pick<Database, "execute">;

export type StationMode = Exclude<FulfillmentMode, "carrier">;

export interface Station extends StationOption {
  warehouseId: string;
  deliveryFee: string;
  freeDeliveryThreshold: string | null;
}

type StationRow = {
  id: string;
  name: string;
  province_code: string;
  province_name: string;
  ward_code: string;
  ward_name: string;
  street_address: string;
  phone: string;
  opening_hours: string;
  warehouse_id: string;
  delivery_fee: string;
  free_delivery_threshold: string | null;
};

// Trạm đang bật cách nhận, cửa hàng đang hoạt động, kho đang hoạt động; trạm giao chỉ khi xã của địa chỉ trong danh sách xã được giao.
async function stationRows(executor: Executor, companyId: string, mode: StationMode, deliveryWardCode: string | null, stationId: string | null): Promise<StationRow[]> {
  const enabled =
    mode === "station_pickup" ? sql`s.pickup_enabled` : sql`s.delivery_enabled AND EXISTS (SELECT 1 FROM retail.station_wards sw WHERE sw.store_id = s.id AND sw.ward_code = ${deliveryWardCode})`;
  return (
    await executor.execute<StationRow>(sql`
    SELECT s.id, s.display_name AS name, s.province_code, p.name AS province_name, s.ward_code, w.name AS ward_name, s.street_address, s.phone, s.opening_hours,
      s.warehouse_id, s.delivery_fee::text, s.free_delivery_threshold::text
    FROM retail.stores s
    JOIN marketplace.provinces p ON p.code = s.province_code JOIN marketplace.wards w ON w.code = s.ward_code
    JOIN inventory.warehouses wh ON wh.id = s.warehouse_id AND wh.status = 'active'
    WHERE s.company_id = ${companyId} AND s.status = 'active' AND ${enabled} AND (${stationId}::uuid IS NULL OR s.id = ${stationId}::uuid)`)
  ).rows;
}

function toStation(row: StationRow, address: { provinceCode: string; wardCode: string } | null): Station {
  return {
    id: row.id,
    name: row.name,
    provinceCode: row.province_code,
    provinceName: row.province_name,
    wardName: row.ward_name,
    address: `${row.street_address}, ${row.ward_name}, ${row.province_name}`,
    phone: row.phone,
    openingHours: row.opening_hours,
    sameWard: address?.wardCode === row.ward_code,
    sameProvince: address?.provinceCode === row.province_code,
    warehouseId: row.warehouse_id,
    deliveryFee: row.delivery_fee,
    freeDeliveryThreshold: row.free_delivery_threshold,
  };
}

// Kho trạm đủ tồn khả dụng cho mọi dòng (gồm hàng tặng) theo đơn vị cơ sở.
async function hasStock(executor: Executor, companyId: string, warehouseId: string, needed: Map<string, number>): Promise<boolean> {
  const available = await availableQuantities(executor, warehouseId, companyId, [...needed.keys()]);
  return [...needed].every(([variantId, quantity]) => Number(available.get(variantId) ?? 0) >= quantity);
}

// Danh sách trạm đủ hàng, sắp cùng xã, cùng tỉnh với địa chỉ đã chọn, rồi theo tên (QUYTAC_NGHIEPVU_421).
export async function stationOptions(
  executor: Executor,
  companyId: string,
  mode: StationMode,
  address: { provinceCode: string; wardCode: string } | null,
  needed: Map<string, number>,
): Promise<Station[]> {
  if (mode === "station_delivery" && !address) return [];
  const rows = await stationRows(executor, companyId, mode, address?.wardCode ?? null, null);
  const stations: Station[] = [];
  for (const row of rows) if (await hasStock(executor, companyId, row.warehouse_id, needed)) stations.push(toStation(row, address));
  return stations.sort((a, b) => Number(b.sameWard) - Number(a.sameWard) || Number(b.sameProvince) - Number(a.sameProvince) || a.name.localeCompare(b.name, "vi"));
}

// Trạm khách chọn còn hợp lệ cho cách nhận và địa chỉ; không kiểm tồn (giữ hàng khi đặt sẽ kiểm).
export async function chosenStation(executor: Executor, companyId: string, mode: StationMode, stationId: string | null, address: { provinceCode: string; wardCode: string }): Promise<Station> {
  if (!stationId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { stationId: "required" } });
  const row = (await stationRows(executor, companyId, mode, address.wardCode, stationId))[0];
  if (!row) throw new ApiError("BUSINESS_RULE", "stationUnavailable");
  return toStation(row, address);
}

// Phí giao theo cách nhận (QUYTAC_NGHIEPVU_422): nhận tại trạm 0; trạm giao theo cài đặt trạm, miễn phí từ mức tiền hàng.
export function stationFee(mode: StationMode, station: Station, goods: number): number {
  if (mode === "station_pickup") return 0;
  const threshold = station.freeDeliveryThreshold === null ? null : Number(station.freeDeliveryThreshold);
  return threshold !== null && goods >= threshold ? 0 : Math.round(Number(station.deliveryFee));
}

// Phần hiện cho người mua (bỏ kho, phí).
export function stationView(station: Station): StationOption {
  const { warehouseId: _warehouse, deliveryFee: _fee, freeDeliveryThreshold: _threshold, ...view } = station;
  return view;
}

// Trạm của đơn đã đặt để hiện cho người mua (không xét đang bật hay không).
export async function stationById(executor: Executor, stationId: string): Promise<StationOption | null> {
  const row = (
    await executor.execute<StationRow>(sql`
    SELECT s.id, s.display_name AS name, s.province_code, p.name AS province_name, s.ward_code, w.name AS ward_name, s.street_address, s.phone, s.opening_hours,
      s.warehouse_id, s.delivery_fee::text, s.free_delivery_threshold::text
    FROM retail.stores s JOIN marketplace.provinces p ON p.code = s.province_code JOIN marketplace.wards w ON w.code = s.ward_code
    WHERE s.id = ${stationId}`)
  ).rows[0];
  return row ? stationView(toStation(row, null)) : null;
}

// Số lượng cần theo biến thể (gồm hàng tặng) để kiểm tồn kho trạm.
export function neededQuantities(lines: { variantId: string; quantity: string }[]): Map<string, number> {
  const needed = new Map<string, number>();
  for (const line of lines) needed.set(line.variantId, (needed.get(line.variantId) ?? 0) + Number(line.quantity));
  return needed;
}
