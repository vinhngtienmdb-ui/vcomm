// Địa chỉ người mua vừa chọn ở sổ địa chỉ để màn hình đặt hàng đọc khi quay lại.
let chosenAddressId: string | null = null;
export const chooseAddress = (id: string) => {
  chosenAddressId = id;
};
export const takeChosenAddress = (): string | null => {
  const value = chosenAddressId;
  chosenAddressId = null;
  return value;
};
