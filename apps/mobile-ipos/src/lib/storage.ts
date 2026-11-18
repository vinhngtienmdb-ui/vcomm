// Lưu trên máy: bộ nhớ an toàn của máy. Bản web xem trước: khóa thiết bị trong localStorage, token phiên trong sessionStorage.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function readValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return (key.startsWith("ipos.token") ? globalThis.sessionStorage : globalThis.localStorage)?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function writeValue(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    const store = key.startsWith("ipos.token") ? globalThis.sessionStorage : globalThis.localStorage;
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
