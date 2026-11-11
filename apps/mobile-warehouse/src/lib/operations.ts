// Thao tác trên ứng dụng kho và quyền cần có (QUYTAC_NGHIEPVU_280, 283). Máy chủ vẫn kiểm quyền theo chi nhánh sở hữu kho.
import type { StockDocumentType } from "contracts";

export const operations = ["nhan-hang", "xuat-giao", "nhap-khac", "xuat-khac", "chuyen-kho", "kiem-ke"] as const;
export type Operation = (typeof operations)[number];

export const operationPermission: Record<Operation, string[]> = {
  "nhan-hang": ["inventory.purchase.receive"],
  "xuat-giao": ["inventory.sales.issue"],
  "nhap-khac": ["inventory.document.manage"],
  "xuat-khac": ["inventory.document.manage"],
  "chuyen-kho": ["inventory.document.manage"],
  "kiem-ke": ["inventory.stocktake.count", "inventory.stocktake.manage"],
};

// Loại phiếu kho của thao tác lập phiếu không theo đơn.
export const documentTypeOf: Partial<Record<Operation, StockDocumentType>> = {
  "nhap-khac": "receipt_other",
  "xuat-khac": "issue_other",
  "chuyen-kho": "transfer",
};

export const isOperation = (value: unknown): value is Operation => typeof value === "string" && (operations as readonly string[]).includes(value);
