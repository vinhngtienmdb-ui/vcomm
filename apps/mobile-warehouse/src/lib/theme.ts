// Giá trị giao diện chép từ tài liệu 15 (packages/ui/src/styles.css) như apps/mobile-vcomm; React Native không đọc được biến CSS.
export const colors = {
  primary: "#047857",
  primaryDark: "#065F46",
  primaryLight: "#E8F6F0",
  topBar: "#064E3B",
  background: "#F6FAF8",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  inputBorder: "#64748B",
  text: "#0F172A",
  textMuted: "#475569",
  success: "#14532D",
  successBackground: "#E9F7EE",
  warning: "#7A4A05",
  warningBackground: "#FDF6E3",
  error: "#B91C1C",
  errorBackground: "#FDECEC",
  info: "#1E40AF",
  infoBackground: "#EEF3FF",
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 } as const;
export const radius = { small: 6, medium: 10, round: 999 } as const;
