import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listDayEntries } from '../api/dayEntries';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

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

/** Сетка месяца без react-native-calendars (Fabric / Expo Go). */
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

export function CalendarScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  const loadMonth = useCallback(
    async (y: number, month: number) => {
      const { from, to } = monthRange(y, month);
      try {
        const entries = await listDayEntries(companyId, from, to);
        const next: Record<string, boolean> = {};
        for (const e of entries) {
          next[e.date] = true;
        }
        setMarked(next);
      } catch (e) {
        Alert.alert('Ошибка', String(e));
      }
    },
    [companyId],
  );

  React.useEffect(() => {
    void loadMonth(cursor.y, cursor.m);
  }, [cursor, loadMonth]);

  const cells = useMemo(
    () => buildCells(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const title = useMemo(() => {
    const d = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
    return d.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [cursor.y, cursor.m]);

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>{companyName}</Text>
        <View style={styles.toolbarRow}>
          <TouchableOpacity
            style={styles.tb}
            onPress={() =>
              navigation.navigate('ChatList', { companyId, companyName })
            }
          >
            <Text style={styles.tbText}>Чаты</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tb}
            onPress={() =>
              navigation.navigate('Colleagues', { companyId, companyName })
            }
          >
            <Text style={styles.tbText}>Коллеги</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.calCard}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.arrow}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{title}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.arrow}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
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
                  style={[
                    styles.dayBtn,
                    marked[cell.iso] ? styles.dayMarked : null,
                  ]}
                  onPress={() =>
                    navigation.navigate('DayEntry', {
                      companyId,
                      companyName,
                      date: cell.iso,
                    })
                  }
                >
                  <Text style={styles.dayNum}>{cell.day}</Text>
                  {marked[cell.iso] ? <View style={styles.dot} /> : null}
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  toolbar: { padding: 16, paddingBottom: 0 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  toolbarRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tb: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tbText: { color: colors.primary, fontWeight: '600' },
  calCard: {
    margin: 16,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  arrow: { paddingHorizontal: 12, paddingVertical: 6 },
  arrowText: { fontSize: 28, color: colors.primary, fontWeight: '300' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
  },
  dayBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  dayMarked: { backgroundColor: 'rgba(51, 144, 236, 0.12)' },
  dayNum: { fontSize: 16, color: colors.text, fontWeight: '500' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
});
