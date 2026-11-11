// Số điện thoại dạng trong nước (0...) từ dạng quốc tế (+84...). Tách riêng để sales-team.service không nạp vòng với buyer-accounts.service.
export const localPhone = (phone: string) => (phone.startsWith("+84") ? `0${phone.slice(3)}` : phone);
