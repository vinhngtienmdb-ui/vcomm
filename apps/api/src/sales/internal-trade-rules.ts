// Quy tắc giao dịch nội bộ dùng chung cho Bán hàng và Mua hàng (CONG_VIEC_09; QUYTAC_NGHIEPVU_73, 75). Chỉ đọc dữ liệu.
import type { VatRate } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import { lookupPrice } from "../catalog/price-lists.service";
import { linkedVariant } from "../catalog/variant-links.service";
import { internalCompanyOf, internalPartnerOf } from "../crm/partners.service";
import type { Database } from "../database/database.module";
import { variantUnitFactor } from "../purchasing/purchasing-context";
import { companyCurrency } from "../purchasing/requisitions.service";

type Reader = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;

export const internalChannelCode = "NOI_BO";
const vatFraction = (rate: string) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);

export async function internalChannel(executor: Reader, companyId: string): Promise<string | null> {
  return (
    (await executor.execute<{ id: string }>(sql`SELECT id FROM catalog.sales_channels WHERE company_id = ${companyId} AND code = ${internalChannelCode} AND status = 'active'`)).rows[0]?.id ?? null
  );
}

async function activeProfile(executor: Reader, companyId: string, partnerId: string | null, role: "customer" | "supplier"): Promise<{ customer_group_id: string | null } | null> {
  if (!partnerId) return null;
  return (
    (
      await executor.execute<{ customer_group_id: string | null }>(sql`
      SELECT pr.customer_group_id FROM crm.partner_profiles pr JOIN crm.partners p ON p.id = pr.partner_id
      WHERE pr.company_id = ${companyId} AND pr.partner_id = ${partnerId} AND pr.status = 'active' AND p.status = 'active'
        AND ${role === "customer" ? sql`pr.is_customer` : sql`pr.is_supplier`}`)
    ).rows[0] ?? null
  );
}

// Giá nội bộ của một dòng đơn mua: giá chưa thuế theo bảng giá kênh Nội bộ của công ty bán, nhóm khách của công ty mua tại công ty bán, quy về mặt hàng, đơn vị bên mua.
export async function internalPrice(
  executor: Reader,
  buyerCompanyId: string,
  sellerCompanyId: string,
  variantId: string,
  unitId: string,
  date: string,
): Promise<{ unitPrice: string; vatRate: VatRate } | null> {
  const unit = await variantUnitFactor(executor, buyerCompanyId, variantId, unitId);
  const link = await linkedVariant(executor, variantId, sellerCompanyId);
  const channelId = await internalChannel(executor, sellerCompanyId);
  if (!unit || !link || !channelId) return null;
  const profile = await activeProfile(executor, sellerCompanyId, await internalPartnerOf(executor, buyerCompanyId), "customer");
  const sellerUnit = await variantUnitFactor(executor, sellerCompanyId, link.variantId, link.baseUnitId);
  if (!sellerUnit) return null;
  const price = await lookupPrice(
    executor,
    sellerCompanyId,
    { variantId: link.variantId, unitId: link.baseUnitId, channelId, customerGroupId: profile?.customer_group_id ?? undefined, currency: await companyCurrency(executor, sellerCompanyId) },
    date,
  );
  if (!price || price === "variantNotFound") return null;
  const perSellerBase = price.includesVat ? Number(price.price) / (1 + vatFraction(sellerUnit.vatRate)) : Number(price.price);
  return { unitPrice: (perSellerBase * link.factor * unit.factor).toFixed(4), vatRate: sellerUnit.vatRate as VatRate };
}

// Đơn bán nội bộ: kênh Nội bộ; công ty mua có hồ sơ nhà cung cấp cho công ty bán; cùng tiền tệ; mọi mặt hàng có liên kết.
export async function internalSalesErrors(executor: Reader, sellerCompanyId: string, customerId: string, channelId: string, variantIds: string[]): Promise<FieldErrors> {
  const buyerCompanyId = await internalCompanyOf(executor, customerId);
  if (!buyerCompanyId) return {};
  const fields: FieldErrors = {};
  if (channelId !== (await internalChannel(executor, sellerCompanyId))) fields.channelId = "internalChannelRequired";
  if (!(await activeProfile(executor, buyerCompanyId, await internalPartnerOf(executor, sellerCompanyId), "supplier"))) fields.customerId = "internalProfileMissing";
  if ((await companyCurrency(executor, buyerCompanyId)) !== (await companyCurrency(executor, sellerCompanyId))) fields.customerId = "internalCurrencyMismatch";
  for (const [index, variantId] of variantIds.entries()) {
    if (!(await linkedVariant(executor, variantId, buyerCompanyId))) fields[`lines.${index}.variantId`] = "internalVariantNotLinked";
  }
  return fields;
}

// Đơn mua nội bộ: công ty bán có kênh Nội bộ và hồ sơ khách hàng cho công ty mua; cùng tiền tệ; mọi mặt hàng có liên kết.
export async function internalPurchaseErrors(executor: Reader, buyerCompanyId: string, supplierId: string, variantIds: string[]): Promise<FieldErrors> {
  const sellerCompanyId = await internalCompanyOf(executor, supplierId);
  if (!sellerCompanyId) return {};
  const fields: FieldErrors = {};
  if (!(await internalChannel(executor, sellerCompanyId))) fields.supplierId = "internalChannelMissing";
  if (!(await activeProfile(executor, sellerCompanyId, await internalPartnerOf(executor, buyerCompanyId), "customer"))) fields.supplierId = "internalProfileMissing";
  if ((await companyCurrency(executor, buyerCompanyId)) !== (await companyCurrency(executor, sellerCompanyId))) fields.supplierId = "internalCurrencyMismatch";
  for (const [index, variantId] of variantIds.entries()) {
    if (!(await linkedVariant(executor, variantId, sellerCompanyId))) fields[`lines.${index}.variantId`] = "internalVariantNotLinked";
  }
  return fields;
}
