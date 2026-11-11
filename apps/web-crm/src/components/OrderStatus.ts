// Màu nhãn trạng thái đơn VComm (CONG_VIEC_24, CONG_VIEC_25).
export const orderTone = {
  awaiting_payment: "canh-bao",
  awaiting_shipment: "thong-tin",
  awaiting_pickup: "thong-tin",
  shipping: "canh-bao",
  delivered: "thanh-cong",
  completed: "thanh-cong",
  cancelled: "trung-tinh",
} as const;
