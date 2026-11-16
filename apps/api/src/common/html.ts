// Thoát ký tự đặc biệt trước khi đưa giá trị vào HTML (trang trả về thanh toán, trang chia sẻ sản phẩm).
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
