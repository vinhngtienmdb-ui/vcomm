// Lưu trên máy: bộ nhớ an toàn của máy; bản web dùng sessionStorage (token) hoặc localStorage (lựa chọn kho).
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function readValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return (key.startsWith("kho.token") ? globalThis.sessionStorage : globalThis.localStorage)?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function writeValue(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    const store = key.startsWith("kho.token") ? globalThis.sessionStorage : globalThis.localStorage;
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
