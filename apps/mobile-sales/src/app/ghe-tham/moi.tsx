// MAN_HINH_71 Ghi lượt ghé thăm (CHUC_NANG_103; API_114; QUYTAC_NGHIEPVU_138): vị trí bắt buộc lấy từ máy lúc ghi, ảnh chụp bằng máy ảnh (0 đến 3), ghi chú bắt buộc.
import type { VisitItem } from "contracts";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

type Photo = { uri: string; mimeType: string };
type Position = { latitude: number; longitude: number; accuracy: number };

export default function NewVisitScreen() {
  const t = translator("salesApp");
  const router = useRouter();
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId: string; partnerName?: string }>();
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Xin quyền vị trí lúc dùng; không cho phép hoặc không lấy được thì không ghi được (QUYTAC_NGHIEPVU_138).
  async function locate() {
    setLocating(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error(t("locationDenied"));
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude, accuracy: Math.min(current.coords.accuracy ?? 0, 10000) });
    } catch (failure) {
      setPosition(null);
      setLocationError(failure instanceof Error && failure.message === t("locationDenied") ? failure.message : t("locationFailed"));
    } finally {
      setLocating(false);
    }
  }
  useEffect(() => void locate(), []);

  // Chỉ mở máy ảnh, không chọn từ thư viện ảnh.
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError(t("cameraDenied"));
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhotos((existing) => [...existing, { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }].slice(0, 3));
  }

  async function save() {
    if (!position) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const form = new FormData();
      form.append("partnerId", partnerId);
      form.append("latitude", position.latitude.toFixed(6));
      form.append("longitude", position.longitude.toFixed(6));
      form.append("accuracyMeters", position.accuracy.toFixed(1));
      form.append("note", note.trim());
      for (const [index, photo] of photos.entries()) {
        const name = `anh-${index + 1}.${photo.mimeType === "image/png" ? "png" : "jpg"}`;
        if (Platform.OS === "web") form.append("photos", await (await fetch(photo.uri)).blob(), name);
        else form.append("photos", { uri: photo.uri, name, type: photo.mimeType } as unknown as Blob);
      }
      await api<VisitItem>("/crm/visits", { method: "POST", body: form });
      router.back();
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setError(failure.message);
        setFields(failure.fields);
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const photoError = Object.entries(fields).find(([key]) => key.startsWith("photos"))?.[1];
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t("newVisit") }} />
      <Screen>
        {partnerName ? <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{partnerName}</Text> : null}
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("location")}</Text>
          {position ? (
            <Muted>
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)} · ±{Math.round(position.accuracy)} m
            </Muted>
          ) : locating ? (
            <Muted>{t("locating")}</Muted>
          ) : null}
          {locationError ? <Notice tone="warning" text={locationError} /> : null}
          <Button label={t("relocate")} kind="secondary" busy={locating} onPress={() => void locate()} />
        </Card>
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("photos", { count: photos.length })}</Text>
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={{ gap: space[1], alignItems: "center" }}>
                <Image source={{ uri: photo.uri }} style={{ width: 90, height: 90, borderRadius: 6 }} accessibilityLabel={t("photoNumber", { number: index + 1 })} />
                <Text accessibilityRole="button" style={{ color: colors.error }} onPress={() => setPhotos(photos.filter((other) => other.uri !== photo.uri))}>
                  {t("remove")}
                </Text>
              </View>
            ))}
          </View>
          {photoError ? <Text style={{ color: colors.error }}>{photoError}</Text> : null}
          <Button label={t("takePhoto")} kind="secondary" disabled={photos.length >= 3} onPress={() => void takePhoto()} />
        </Card>
        <Field label={t("visitNote")} value={note} onChangeText={setNote} multiline maxLength={1000} error={fields.note} />
        {error ? <Notice text={error} /> : null}
        <Button label={t("saveVisit")} busy={busy} disabled={!position || !note.trim()} onPress={() => void save()} />
      </Screen>
    </ScrollView>
  );
}
