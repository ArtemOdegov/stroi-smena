import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import {
  listDayEntries,
  listDayEntriesForDate,
  type DayEntryDto,
} from '../api/dayEntries';
import { me as fetchMe } from '../api/auth';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { resolveImageUri } from '../util/resolveImageUri';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function toISODate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayISO(): string {
  const t = new Date();
  return toISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function buildCells(y: number, m: number): ({ iso: string; day: number } | null)[] {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (first.getUTCDay() + 6) % 7;
  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, iso: toISODate(y, m, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMonthTitle(y: number, month: number): string {
  const d = new Date(Date.UTC(y, month - 1, 1));
  return d.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDayHeading(iso: string): string {
  const d = new Date(iso + 'T12:00:00.000Z');
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function entryHeadline(e: DayEntryDto): string {
  const n = e.notes?.trim() ?? '';
  if (n.length > 0) {
    const line = n.split('\n')[0];
    return line.length > 48 ? `${line.slice(0, 46)}…` : line;
  }
  if (e.authorName) return `День · ${e.authorName}`;
  return 'Запись дня';
}

function entryStatus(e: DayEntryDto): 'done' | 'pending' {
  const has =
    (e.photos?.length ?? 0) > 0 || (e.notes?.trim().length ?? 0) > 8;
  return has ? 'done' : 'pending';
}

export function CalendarScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const fabBottom = tabPad + 16;

  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [dayEntries, setDayEntries] = useState<DayEntryDto[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [myName, setMyName] = useState('');
  const [feedSearch, setFeedSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const loadMonth = useCallback(
    async (y: number, month: number) => {
      setLoadingMonth(true);
      try {
        const { from, to } = monthRange(y, month);
        const entries = await listDayEntries(companyId, from, to);
        const next: Record<string, boolean> = {};
        for (const e of entries) {
          next[e.date] = true;
        }
        setMarked(next);
      } catch {
        setMarked({});
      } finally {
        setLoadingMonth(false);
      }
    },
    [companyId],
  );

  const loadDay = useCallback(
    async (date: string) => {
      setLoadingDay(true);
      try {
        const rows = await listDayEntriesForDate(companyId, date);
        setDayEntries(rows);
      } catch {
        setDayEntries([]);
      } finally {
        setLoadingDay(false);
      }
    },
    [companyId],
  );

  React.useEffect(() => {
    void loadMonth(cursor.y, cursor.m);
  }, [cursor, loadMonth]);

  React.useEffect(() => {
    void loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  React.useEffect(() => {
    void (async () => {
      try {
        const me = await fetchMe();
        setMyName(me.name);
      } catch {
        setMyName('');
      }
    })();
  }, []);

  const cells = useMemo(
    () => buildCells(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const monthTitle = useMemo(
    () => formatMonthTitle(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const isToday = selectedDate === todayISO();

  const filteredDayEntries = useMemo(() => {
    const s = feedSearch.trim().toLowerCase();
    if (!s) return dayEntries;
    return dayEntries.filter(
      (e) =>
        (e.notes || '').toLowerCase().includes(s) ||
        (e.authorName || '').toLowerCase().includes(s),
    );
  }, [dayEntries, feedSearch]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      let { y, m } = c;
      m += delta;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return { y, m };
    });
  }

  const headerBottom = Math.max(insets.top, 10) + (showSearch ? 108 : 56);

  return (
    <View style={styles.screenRoot}>
      <View
        style={[
          styles.headerShell,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingBottom: showSearch ? 10 : 12,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {navigation.canGoBack() ? (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={12}
                style={styles.backInHeader}
              >
                <MaterialIcons name="arrow-back" size={22} color={colors.primaryDark} />
              </TouchableOpacity>
            ) : null}
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarTxt}>
                {(myName || companyName).slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.brandTitle} numberOfLines={1}>
                {companyName}
              </Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineLabel}>Online</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.searchHit}
            onPress={() => setShowSearch((v) => !v)}
            hitSlop={10}
          >
            <MaterialIcons name="search" size={24} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
        {showSearch ? (
          <TextInput
            value={feedSearch}
            onChangeText={setFeedSearch}
            placeholder="Поиск в записях за день"
            placeholderTextColor={colors.outline}
            style={styles.headerSearch}
          />
        ) : null}
      </View>

      <View style={[styles.syncPill, { top: headerBottom + 6 }]}>
        <MaterialIcons name="sync" size={16} color="#16a34a" />
        <Text style={styles.syncPillText}>Синхронизировано</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: headerBottom + 36,
          paddingHorizontal: 16,
          paddingBottom: fabBottom + 72,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calShell}>
          <View style={styles.monthRow}>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <View style={styles.monthArrows}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
                <MaterialIcons name="chevron-left" size={28} color={colors.outline} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
                <MaterialIcons name="chevron-right" size={28} color={colors.outline} />
              </TouchableOpacity>
            </View>
          </View>
          {loadingMonth ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : null}
          <View style={styles.weekRow}>
            {WEEK.map((w) => (
              <Text key={w} style={styles.weekDay}>
                {w}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((cell, idx) => (
              <View key={idx} style={styles.cell}>
                {cell ? (
                  <TouchableOpacity
                    style={styles.dayCellHit}
                    onPress={() => setSelectedDate(cell.iso)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.dayBubble,
                        selectedDate === cell.iso && styles.dayBubbleSelected,
                        marked[cell.iso] &&
                          selectedDate !== cell.iso &&
                          styles.dayBubbleMarked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          selectedDate === cell.iso && styles.dayNumSelected,
                          !marked[cell.iso] &&
                            selectedDate !== cell.iso &&
                            styles.dayNumMuted,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.dayCellHit} />
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.feedHead}>
          <Text style={styles.feedHeadTitle}>Активность за день</Text>
          {isToday ? (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Сегодня</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.feedSubDate}>{formatDayHeading(selectedDate)}</Text>

        {loadingDay ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : filteredDayEntries.length === 0 ? (
          <Text style={styles.emptyFeed}>
            Нет записей за выбранный день. Нажмите «+», чтобы добавить день.
          </Text>
        ) : (
          filteredDayEntries.map((e) => {
            const st = entryStatus(e);
            const thumbRaw = e.photos?.[0]?.url;
            const thumb = thumbRaw ? resolveImageUri(thumbRaw) : null;
            const time = formatTime(e.updatedAt || e.geoCapturedAt);
            return (
              <TouchableOpacity
                key={e.id}
                style={styles.logCard}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('ActivityDetail', {
                    companyId,
                    companyName,
                    date: e.date,
                    entryId: e.id,
                  })
                }
              >
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <MaterialIcons name="image" size={28} color={colors.outline} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.statusIcon,
                      st === 'done' ? styles.statusDone : styles.statusPending,
                    ]}
                  >
                    <MaterialIcons
                      name={st === 'done' ? 'check-circle' : 'pending'}
                      size={16}
                      color={st === 'done' ? colors.onPrimary : colors.onPrimary}
                    />
                  </View>
                </View>
                <View style={styles.logBody}>
                  <View style={styles.logTitleRow}>
                    <Text style={styles.logTitle} numberOfLines={2}>
                      {entryHeadline(e)}
                    </Text>
                    {time ? (
                      <Text style={styles.logTime}>{time}</Text>
                    ) : null}
                  </View>
                  {e.notes?.trim() ? (
                    <Text style={styles.logNotes} numberOfLines={3}>
                      «{e.notes.trim()}»
                    </Text>
                  ) : null}
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Журнал</Text>
                    </View>
                    {e.authorName ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText} numberOfLines={1}>
                          {e.authorName}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate('DayEntry', {
            companyId,
            companyName,
            date: selectedDate,
          })
        }
      >
        <MaterialIcons name="add" size={30} color={colors.onPrimary} />
      </TouchableOpacity>

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
  screenRoot: { flex: 1, backgroundColor: colors.bg },
  headerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  backInHeader: { padding: 4, marginRight: 2 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primaryFixed,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  headerTitles: { flex: 1, minWidth: 0 },
  brandTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  onlineLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.subtext,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  searchHit: { padding: 8 },
  headerSearch: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
  },
  syncPill: {
    position: 'absolute',
    right: 16,
    zIndex: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  syncPillText: {
    fontSize: 10,
    fontFamily: fonts.label,
    color: colors.subtext,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scroll: { flex: 1 },
  calShell: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 22,
    marginBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
      },
      android: { elevation: 3 },
    }),
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  monthTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
    textTransform: 'capitalize',
    letterSpacing: -0.3,
    flex: 1,
  },
  monthArrows: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 10 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fonts.label,
    color: colors.outline,
    letterSpacing: -0.2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellHit: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    backgroundColor: colors.primaryContainer,
  },
  dayBubbleMarked: {
    backgroundColor: 'rgba(0, 97, 147, 0.08)',
  },
  dayNum: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  dayNumSelected: {
    color: colors.onPrimaryContainer,
    fontFamily: fonts.label,
  },
  dayNumMuted: {
    color: colors.outline,
  },
  feedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  feedHeadTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 12,
    color: colors.subtext,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  todayBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 10,
    fontFamily: fonts.label,
    color: colors.onSecondaryContainer,
  },
  feedSubDate: {
    fontFamily: fonts.headlineBold,
    fontSize: 12,
    color: colors.subtext,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  emptyFeed: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  statusDone: { backgroundColor: colors.primary },
  statusPending: { backgroundColor: colors.tertiary },
  logBody: { flex: 1, minWidth: 0 },
  logTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  logTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.label,
    color: colors.text,
  },
  logTime: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.outline,
  },
  logNotes: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.subtext,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: {
    backgroundColor: colors.surfaceHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    fontFamily: fonts.label,
    color: colors.subtext,
    maxWidth: 140,
  },
  fab: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 18,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
});
