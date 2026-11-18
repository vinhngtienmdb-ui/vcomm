// Vẽ mã QR bằng ô vuông của React Native (thư viện qrcode-generator, người dùng duyệt 2026-11-17): mỗi hàng gộp các ô tối liền nhau thành một khối.
import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { View } from "react-native";

export function QrView({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const rows = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value, "Byte");
    code.make();
    const count = code.getModuleCount();
    const runs: { row: number; start: number; length: number }[][] = [];
    for (let row = 0; row < count; row += 1) {
      const line: { row: number; start: number; length: number }[] = [];
      let start = -1;
      for (let column = 0; column <= count; column += 1) {
        const dark = column < count && code.isDark(row, column);
        if (dark && start < 0) start = column;
        if (!dark && start >= 0) {
          line.push({ row, start, length: column - start });
          start = -1;
        }
      }
      runs.push(line);
    }
    return { count, runs };
  }, [value]);
  // Viền trắng 4 ô theo chuẩn QR.
  const cell = size / (rows.count + 8);
  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, backgroundColor: "#FFFFFF", padding: cell * 4 }}>
      {rows.runs.map((line, row) => (
        <View key={row} style={{ height: cell, flexDirection: "row" }}>
          {line.map((run) => (
            <View key={run.start} style={{ position: "absolute", left: run.start * cell, width: run.length * cell, height: cell, backgroundColor: "#000000" }} />
          ))}
        </View>
      ))}
    </View>
  );
}
