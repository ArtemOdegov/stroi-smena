import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import { listDayEntriesForDate, type DayEntryDto } from '../api/dayEntries';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { resolveImageUri } from '../util/resolveImageUri';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityDetail'>;

const SLIDE_WIDTH = Dimensions.get('window').width - 32;

function formatRuDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00.000Z');
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function entryStatus(e: DayEntryDto): 'done' | 'pending' {
  const has =
    (e.photos?.length ?? 0) > 0 || (e.notes?.trim().length ?? 0) > 8;
  return has ? 'done' : 'pending';
}

export function ActivityDetailScreen({ navigation, route }: Props) {
  const { companyId, companyName, date, entryId } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const listRef = useRef<FlatList<string>>(null);

  const [entry, setEntry] = useState<DayEntryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listDayEntriesForDate(companyId, date);
      const found = rows.find((r) => r.id === entryId) ?? null;
      setEntry(found);
      setPhotoIndex(0);
    } catch {
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, date, entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const photos = (entry?.photos ?? []).map((p) => resolveImageUri(p.url));
  const totalPhotos = photos.length;
  const st = entry ? entryStatus(entry) : 'pending';

  function scrollPhoto(delta: number) {
    if (totalPhotos === 0) return;
    const next = Math.max(0, Math.min(totalPhotos - 1, photoIndex + delta));
    setPhotoIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SLIDE_WIDTH);
    if (idx >= 0 && idx < totalPhotos) setPhotoIndex(idx);
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.missText}>Запись не найдена</Text>
        <TouchableOpacity style={styles.missBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.missBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 8), paddingBottom: 10 },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Детали активности
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: tabPad + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sliderSection}>
          <View style={styles.sliderFrame}>
            {totalPhotos > 0 ? (
              <>
                <FlatList
                  ref={listRef}
                  data={photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(uri, i) => `${i}-${uri}`}
                  onMomentumScrollEnd={onScrollEnd}
                  onScrollToIndexFailed={() => {}}
                  getItemLayout={(_, index) => ({
                    length: SLIDE_WIDTH,
                    offset: SLIDE_WIDTH * index,
                    index,
                  })}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={styles.slideImage}
                      resizeMode="cover"
                    />
                  )}
                />
                {totalPhotos > 1 ? (
                  <>
                    <TouchableOpacity
                      style={[styles.sliderArrow, styles.sliderArrowLeft]}
                      onPress={() => scrollPhoto(-1)}
                    >
                      <MaterialIcons name="chevron-left" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sliderArrow, styles.sliderArrowRight]}
                      onPress={() => scrollPhoto(1)}
                    >
                      <MaterialIcons name="chevron-right" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.pagePillWrap}>
                      <View style={styles.pagePill}>
                        <Text style={styles.pagePillText}>
                          {photoIndex + 1} из {totalPhotos}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              <View style={styles.slidePlaceholder}>
                <MaterialIcons name="photo-library" size={48} color={colors.outline} />
                <Text style={styles.slidePlaceholderText}>Нет фото</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.personRow}>
          <View style={styles.personCard}>
            <View style={styles.personAvatar}>
              <Text style={styles.personAvatarTxt}>
                {(entry.authorName || entry.userId).slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.personLabel}>Автор записи</Text>
              <Text style={styles.personName} numberOfLines={2}>
                {entry.authorName || `Сотрудник ${entry.userId.slice(0, 8)}…`}
              </Text>
            </View>
          </View>
          <View style={styles.personCard}>
            <View style={styles.personAvatar}>
              <Text style={styles.personAvatarTxt}>
                {companyName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.personLabel}>Компания</Text>
              <Text style={styles.personName} numberOfLines={2}>
                {companyName}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.descCard}>
          <View style={styles.descHead}>
            <MaterialIcons name="description" size={22} color={colors.primary} />
            <Text style={styles.descTitle}>Описание работ</Text>
          </View>
          <Text style={styles.descBody}>
            {entry.notes?.trim()
              ? entry.notes.trim()
              : 'Описание не заполнено.'}
          </Text>
        </View>

        <View style={styles.shiftCard}>
          <View style={styles.shiftLeft}>
            <View style={styles.shiftIconWrap}>
              <MaterialIcons name="schedule" size={22} color={colors.onPrimaryContainer} />
            </View>
            <View>
              <Text style={styles.shiftTitle}>Запись за день</Text>
              <Text style={styles.shiftSub}>
                {formatTime(entry.updatedAt || entry.geoCapturedAt) || '—'} ·{' '}
                {formatRuDate(entry.date)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.shiftChip,
              st === 'done' ? styles.shiftChipOn : styles.shiftChipOff,
            ]}
          >
            <Text
              style={[
                styles.shiftChipText,
                st === 'done' ? styles.shiftChipTextOn : styles.shiftChipTextOff,
              ]}
            >
              {st === 'done' ? 'Активна' : 'Черновик'}
            </Text>
          </View>
        </View>

        <View style={styles.bentoRow}>
          <View style={styles.bentoCell}>
            <MaterialIcons name="business" size={22} color={colors.tertiary} style={{ marginBottom: 8 }} />
            <Text style={styles.bentoLabel}>Объект</Text>
            <Text style={styles.bentoValue} numberOfLines={3}>
              «{companyName}»
            </Text>
          </View>
          <View style={styles.bentoCell}>
            <MaterialIcons name="event" size={22} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.bentoLabel}>Дата</Text>
            <Text style={styles.bentoValue}>{formatRuDate(entry.date)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editLink}
          onPress={() =>
            navigation.navigate('DayEntry', {
              companyId,
              companyName,
              date: entry.date,
            })
          }
        >
          <MaterialIcons name="edit" size={18} color={colors.primary} />
          <Text style={styles.editLinkText}>Открыть день для редактирования</Text>
        </TouchableOpacity>
      </ScrollView>

      <CompanyBottomTabBar
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        active="calendar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 6 },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
    letterSpacing: -0.2,
  },
  missText: { fontSize: 16, color: colors.subtext, marginBottom: 16 },
  missBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  missBtnText: { color: colors.primary, fontFamily: fonts.label, fontSize: 16 },
  sliderSection: { marginBottom: 20 },
  sliderFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  slideImage: {
    width: SLIDE_WIDTH,
    height: '100%',
  },
  slidePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  slidePlaceholderText: { color: colors.outline, fontFamily: fonts.body },
  sliderArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderArrowLeft: { left: 12 },
  sliderArrowRight: { right: 12 },
  pagePillWrap: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pagePill: {
    backgroundColor: 'rgba(26,28,28,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pagePillText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1,
  },
  personRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  personCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceLow,
    borderWidth: 2,
    borderColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  personLabel: {
    fontSize: 10,
    fontFamily: fonts.label,
    color: colors.outline,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  personName: {
    fontFamily: fonts.headlineBold,
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  descCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  descHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  descTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
  },
  descBody: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.subtext,
    lineHeight: 22,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  shiftLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  shiftIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 16,
    color: colors.text,
  },
  shiftSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.subtext,
  },
  shiftChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  shiftChipOn: { backgroundColor: colors.secondaryContainer },
  shiftChipOff: { backgroundColor: colors.surfaceHighest },
  shiftChipText: { fontSize: 10, fontFamily: fonts.label, letterSpacing: 0.5 },
  shiftChipTextOn: { color: colors.onSecondaryContainer },
  shiftChipTextOff: { color: colors.subtext },
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  bentoCell: {
    flex: 1,
    backgroundColor: 'rgba(226, 226, 226, 0.5)',
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: fonts.label,
    color: colors.outline,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bentoValue: {
    fontFamily: fonts.headlineBold,
    fontSize: 14,
    color: colors.text,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 12,
  },
  editLinkText: {
    fontSize: 15,
    fontFamily: fonts.label,
    color: colors.primary,
  },
});
