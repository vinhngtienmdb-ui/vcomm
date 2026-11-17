// Smart OTP trên máy (CONG_VIEC_53 lát L6; CONG_VIEC_72 QUYTAC_NGHIEPVU_562, 563).
// Khóa TOTP và mã khóa (đã băm) lưu trong bộ nhớ an toàn của máy; mã khóa không gửi lên máy chủ.
// Mã khóa băm PBKDF2-SHA256 có muối (@noble/hashes, người dùng duyệt 2026-11-17); sai 5 lần liên tiếp thì xóa Smart OTP trên máy.
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { SmartOtpPlatform } from "contracts";
import * as LocalAuthentication from "expo-local-authentication";
import { Secret, TOTP } from "otpauth";
import { Platform } from "react-native";
import { read, write } from "./api";

const storageKey = "vcomm.smartOtp";
export const pinLength = 6;
export const maximumPinFailures = 5;
// Số vòng băm: đủ chậm để dò mã khóa khó hơn, vẫn dưới một giây trên điện thoại tầm trung (thư viện chạy bằng JavaScript).
const pinIterations = 20_000;
// Mỗi lần mở Smart OTP hiện mã trong 60 giây (QUYTAC_NGHIEPVU_563).
export const unlockSeconds = 60;

export interface StoredSmartOtp {
  secret: string;
  activatedAt: string;
  pin?: { hash: string; salt: string; iterations: number };
  biometric?: boolean;
  failures?: number;
}

export async function loadSmartOtp(): Promise<StoredSmartOtp | null> {
  const value = await read(storageKey);
  return value ? (JSON.parse(value) as StoredSmartOtp) : null;
}

export async function saveSmartOtp(value: StoredSmartOtp | null): Promise<void> {
  await write(storageKey, value ? JSON.stringify(value) : null);
}

// Nền tảng gửi máy chủ; bản web không kích hoạt được.
export const currentPlatform = (): SmartOtpPlatform => (Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web");
export const currentDeviceName = () => (Platform.OS === "ios" ? "iPhone" : Platform.OS === "android" ? "Điện thoại Android" : "Trình duyệt");

export const codeOf = (secret: string, timestamp: number) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp });

// Mã khóa yếu: 6 số giống nhau, dãy tăng, giảm liên tiếp, trùng 6 số cuối số điện thoại (QUYTAC_NGHIEPVU_563).
export function weakPin(pin: string, phoneDigits: string | null): boolean {
  const digits = [...pin].map(Number);
  const same = digits.every((digit) => digit === digits[0]);
  const step = (direction: 1 | -1) => digits.every((digit, index) => index === 0 || digit === (digits[index - 1]! + direction + 10) % 10);
  const phoneTail = phoneDigits ? phoneDigits.replace(/\D/g, "").slice(-pinLength) : null;
  return same || step(1) || step(-1) || pin === phoneTail;
}

function randomBytes(length: number): Uint8Array {
  const values = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < length; index += 1) values[index] = Math.floor(Math.random() * 256);
  return values;
}

const derive = (pin: string, salt: string, iterations: number) => bytesToHex(pbkdf2(sha256, utf8ToBytes(pin), hexToBytes(salt), { c: iterations, dkLen: 32 }));

export function hashPin(pin: string): NonNullable<StoredSmartOtp["pin"]> {
  const salt = bytesToHex(randomBytes(16));
  return { hash: derive(pin, salt, pinIterations), salt, iterations: pinIterations };
}

// So khớp không lộ thời gian theo vị trí ký tự sai.
export function pinMatches(stored: NonNullable<StoredSmartOtp["pin"]>, pin: string): boolean {
  const candidate = derive(pin, stored.salt, stored.iterations);
  let difference = candidate.length ^ stored.hash.length;
  for (let index = 0; index < Math.min(candidate.length, stored.hash.length); index += 1) difference |= candidate.charCodeAt(index) ^ stored.hash.charCodeAt(index);
  return difference === 0;
}

// Máy có phần cứng và đã cài vân tay hoặc khuôn mặt.
export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

// Hộp sinh trắc học của hệ điều hành; không cho dùng mật mã máy thay thế: phương án thay thế là mã khóa Smart OTP.
export async function biometricUnlock(promptMessage: string, cancelLabel: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: true });
  return result.success;
}
