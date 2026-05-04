import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Switch,
  Alert,
  Keyboard,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from '../util/uuid';
import { putFileToPresignedUrl } from '../util/putFileToPresignedUrl';
import {
  listDayEntries,
  presignUpload,
  upsertDayEntry,
  type DayEntryDto,
} from '../api/dayEntries';
import { me } from '../api/auth';
import { enqueueDaySave } from '../sync/offlineQueue';
import { GeoPickerModal } from '../components/GeoPickerModal';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImageUri } from '../util/resolveImageUri';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DayEntry'>;

type LocalPhoto =
  | { kind: 'local'; uri: string }
  | { kind: 'remote'; uri: string; storageKey: string };

async function uploadLocalFile(uri: string): Promise<string> {
  const ext = uri.split('.').pop() || 'jpg';
  const isPng = ext.toLowerCase() === 'png';
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const { uploadUrl, storageKey } = await presignUpload(contentType, ext);
  await putFileToPresignedUrl(uri, uploadUrl, contentType);
  return storageKey;
}

function ColleagueCard({
  entry,
  onOpenPreview,
}: {
  entry: DayEntryDto;
  onOpenPreview: (uri: string) => void;
}) {
  const title = entry.authorName || `Сотрудник ${entry.userId.slice(0, 8)}…`;
  return (
    <View style={styles.colCard}>
      <Text style={styles.colTitle}>{title}</Text>
      <Text style={styles.colNotes}>{entry.notes?.trim() ? entry.notes : '—'}</Text>
      {entry.lat != null && entry.lng != null ? (
        <Text style={styles.colGeo}>
          Гео: {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
        </Text>
      ) : null}
      {entry.photos.length > 0 ? (
        <View style={styles.colThumbsRow}>
          {entry.photos.map((p) => {
            const uri = resolveImageUri(p.url);
            return (
              <Pressable key={p.id} onPress={() => onOpenPreview(uri)}>
                <Image source={{ uri }} style={styles.colThumb} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function DayEntryScreen({ route, navigation }: Props) {
  const { companyId, companyName, date } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const [others, setOthers] = useState<DayEntryDto[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [autoGeo, setAutoGeo] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingHint, setPendingHint] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const refreshOthersOnly = useCallback(async () => {
    try {
      const profile = await me();
      const all = await listDayEntries(companyId, date, date);
      setOthers(all.filter((x) => x.userId !== profile.userId));
    } catch {
      /* не сбрасываем мои фото/текст */
    }
  }, [companyId, date]);

  const load = useCallback(async () => {
    try {
      const [profile, all] = await Promise.all([
        me(),
        listDayEntries(companyId, date, date),
      ]);
      const mine = all.find((x) => x.userId === profile.userId);
      setOthers(all.filter((x) => x.userId !== profile.userId));
      if (mine) {
        applyEntry(mine);
      } else {
        setNotes('');
        setPhotos([]);
        setVersion(null);
        setLat(null);
        setLng(null);
      }
    } catch {
      setOthers([]);
      setNotes('');
      setPhotos([]);
      setVersion(null);
      setLat(null);
      setLng(null);
    }
  }, [companyId, date]);

  function applyEntry(e: DayEntryDto) {
    setNotes(e.notes);
    setVersion(e.version);
    setLat(e.lat);
    setLng(e.lng);
    setPhotos(
      e.photos.map((p) => ({
        kind: 'remote' as const,
        uri: p.url,
        storageKey: p.storageKey,
      })),
    );
  }

  React.useEffect(() => {
    void load();
  }, [load]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа к фото');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotos((p) => [...p, { kind: 'local', uri: res.assets[0].uri }]);
    }
  }

  async function save() {
    const clientMutationId = randomUUID();
    const remoteStorageKeys = photos
      .filter((x): x is Extract<LocalPhoto, { kind: 'remote' }> => x.kind === 'remote')
      .map((x) => x.storageKey);
    const localPhotoUris = photos
      .filter((x): x is Extract<LocalPhoto, { kind: 'local' }> => x.kind === 'local')
      .map((x) => x.uri);

    const net = await NetInfo.fetch();
    const online = Boolean(net.isConnected && net.isInternetReachable !== false);

    if (!online) {
      await enqueueDaySave({
        companyId,
        date,
        notes,
        remoteStorageKeys,
        localPhotoUris,
        lat,
        lng,
        geoSource: lat != null && lng != null ? 'MANUAL' : null,
        autoGeoOnSave: autoGeo,
        clientMutationId,
        expectedVersion: version,
      });
      setPendingHint(true);
      Alert.alert('Офлайн', 'Запись поставлена в очередь синхронизации.');
      return;
    }

    try {
      const uploaded: { storageKey: string }[] = remoteStorageKeys.map(
        (storageKey) => ({ storageKey }),
      );
      for (const uri of localPhotoUris) {
        uploaded.push({ storageKey: await uploadLocalFile(uri) });
      }

      const body: Record<string, unknown> = {
        notes,
        photos: uploaded,
        clientMutationId,
        expectedVersion: version ?? undefined,
      };

      if (autoGeo) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          body.lat = pos.coords.latitude;
          body.lng = pos.coords.longitude;
          body.geoSource = 'AUTO';
          body.geoAccuracy = pos.coords.accuracy;
          body.geoCapturedAt = new Date().toISOString();
        }
      } else if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
        body.geoSource = 'MANUAL';
        body.geoCapturedAt = new Date().toISOString();
      }

      const saved = await upsertDayEntry(companyId, date, body);
      applyEntry(saved);
      setPendingHint(false);
      void refreshOthersOnly();
      Alert.alert('Сохранено');
    } catch (e) {
      await enqueueDaySave({
        companyId,
        date,
        notes,
        remoteStorageKeys,
        localPhotoUris,
        lat,
        lng,
        geoSource: lat != null && lng != null ? 'MANUAL' : null,
        autoGeoOnSave: autoGeo,
        clientMutationId,
        expectedVersion: version,
      });
      setPendingHint(true);
      Alert.alert('Очередь', `Ошибка сети: ${e}. Сохранено офлайн.`);
    }
  }

  return (
    <View style={styles.screenWrap}>
    <Pressable style={styles.pressRoot} onPress={Keyboard.dismiss}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 40 + tabPad }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
      >
        <Text style={styles.date}>{date}</Text>

        {others.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Записи коллег</Text>
            {others.map((e) => (
              <ColleagueCard
                key={e.id}
                entry={e}
                onOpenPreview={(uri) => setPreviewUri(uri)}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Моя запись</Text>
        <TextInput
          style={styles.notes}
          multiline
          placeholder="Текст за день..."
          placeholderTextColor={colors.subtext}
          value={notes}
          onChangeText={setNotes}
        />
        <View style={styles.row}>
          <Text style={styles.label}>Авто-гео при сохранении (онлайн)</Text>
          <Switch
            value={Boolean(autoGeo)}
            onValueChange={(v) => setAutoGeo(Boolean(v))}
          />
        </View>
        <TouchableOpacity style={styles.mapBtn} onPress={() => setMapOpen(true)}>
          <Text style={styles.mapBtnText}>
            {lat != null && lng != null
              ? `Гео · ${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : 'Задать координаты'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
          <Text style={styles.addPhotoText}>+ Фото</Text>
        </TouchableOpacity>
        <ScrollView horizontal style={styles.thumbs} keyboardShouldPersistTaps="handled">
          {photos.map((p, i) => {
            const displayUri =
              p.kind === 'remote' ? resolveImageUri(p.uri) : p.uri;
            return (
              <View
                key={p.kind === 'remote' ? p.storageKey : `${p.uri}:${i}`}
                style={styles.thumbWrap}
              >
                <Pressable onPress={() => setPreviewUri(displayUri)}>
                  <Image
                    source={{ uri: displayUri }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                </Pressable>
                <TouchableOpacity
                  style={styles.del}
                  onPress={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                >
                  <Text style={styles.delText}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        {pendingHint ? (
          <Text style={styles.hint}>Есть записи в офлайн-очереди.</Text>
        ) : null}
        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Сохранить</Text>
        </TouchableOpacity>
      </ScrollView>
    </Pressable>
      <CompanyBottomTabBar
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        active="calendar"
      />

      <GeoPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        initialLat={lat}
        initialLng={lng}
        onApply={(la, ln) => {
          setLat(la);
          setLng(ln);
        }}
      />

      <Modal
        visible={previewUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={previewImageBoxStyle}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.previewHint}>Нажмите, чтобы закрыть</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const { width: winW, height: winH } = Dimensions.get('window');
const previewImageBoxStyle = {
  width: winW - 32,
  height: Math.round(winH * 0.72),
};

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.bg },
  pressRoot: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  date: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: colors.text },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  colCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  colNotes: { fontSize: 15, color: colors.text, marginBottom: 6 },
  colGeo: { fontSize: 13, color: colors.subtext, marginBottom: 6 },
  colThumbsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  colThumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: '#000d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewHint: {
    position: 'absolute',
    bottom: 36,
    color: '#fff9',
    fontSize: 14,
  },
  notes: {
    minHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    fontSize: 16,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  label: { flex: 1, color: colors.text, fontSize: 15 },
  mapBtn: {
    marginTop: 14,
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapBtnText: { color: colors.primary, fontWeight: '600' },
  addPhoto: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addPhotoText: { color: colors.primary, fontWeight: '600' },
  thumbs: { marginTop: 12 },
  thumbWrap: { marginRight: 10 },
  thumb: { width: 88, height: 88, borderRadius: 8 },
  del: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#0008',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { marginTop: 12, color: colors.subtext },
  save: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
