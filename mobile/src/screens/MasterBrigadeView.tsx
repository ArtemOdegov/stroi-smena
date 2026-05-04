import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import type { MemberRow } from '../api/companies';
import { updateBrigade, type BrigadeDto } from '../api/brigades';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  navigation: Nav;
  companyId: string;
  companyName: string;
  members: MemberRow[];
  brigade: BrigadeDto | null;
  myUserId: string | null;
  myName: string;
  loading: boolean;
  onBrigadeUpdated: () => void | Promise<void>;
  onOpenChat: (userId: string, name: string) => void;
};

/** Вкладка «Команда» для роли MASTER — макет stitch_remix_of 5 */
export function MasterBrigadeView({
  navigation,
  companyId,
  companyName,
  members,
  brigade,
  myUserId,
  myName,
  loading,
  onBrigadeUpdated,
  onOpenChat,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [savingMember, setSavingMember] = useState(false);

  const brigadeRows = useMemo(() => {
    const rows = [...(brigade?.members ?? [])];
    rows.sort((a, b) => {
      if (a.status === b.status) return a.name.localeCompare(b.name, 'ru');
      return a.status === 'ACTIVE' ? -1 : 1;
    });
    return rows;
  }, [brigade]);

  const addableWorkers = useMemo(() => {
    const inBrigade = new Set(brigadeRows.map((m) => m.userId));
    return members.filter(
      (m) =>
        m.role === 'EMPLOYEE' &&
        m.status === 'ACTIVE' &&
        !inBrigade.has(m.userId),
    );
  }, [members, brigadeRows]);

  const totalWorkers = brigadeRows.length;
  const activeWorkers = brigadeRows.filter((m) => m.status === 'ACTIVE').length;

  const addWorker = useCallback(
    async (userId: string) => {
      if (!brigade) return;
      setSavingMember(true);
      try {
        const nextIds = [...brigade.members.map((m) => m.userId), userId];
        await updateBrigade(companyId, brigade.id, { memberUserIds: nextIds });
        await Promise.resolve(onBrigadeUpdated());
        setWorkerPickerOpen(false);
      } catch (e) {
        Alert.alert('Ошибка', String(e));
      } finally {
        setSavingMember(false);
      }
    },
    [brigade, companyId, onBrigadeUpdated],
  );

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: 12 },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIconSpacer} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Моя бригада
          </Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarTxt}>
            {(myName || '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: tabPad + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : null}

        {!loading && !brigade ? (
          <Text style={styles.noBrigadeBanner}>
            Директор ещё не создал бригаду для вас в разделе «Права доступа». Когда
            состав появится, список сотрудников отобразится здесь.
          </Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statLabel}>Сотрудников</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {totalWorkers}
            </Text>
          </View>
          <View style={[styles.statCard, styles.statCardTertiary]}>
            <Text style={styles.statLabel}>На объекте</Text>
            <Text style={[styles.statValue, { color: colors.tertiary }]}>
              {activeWorkers}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Состав бригады</Text>
          <Text style={styles.sectionTag}>Активны сейчас</Text>
        </View>

        {brigadeRows.map((m) => {
          const onShift = m.status === 'ACTIVE';
          return (
            <View key={m.userId} style={styles.personCard}>
              <View style={styles.avatarBlock}>
                <View style={styles.avatarLg}>
                  <Text style={styles.avatarLgTxt}>
                    {m.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.presenceLg,
                    {
                      backgroundColor: onShift ? '#22c55e' : colors.outline,
                    },
                  ]}
                />
              </View>
              <View style={styles.personMid}>
                <Text style={styles.personName}>{m.name}</Text>
                <Text style={styles.personSub} numberOfLines={2}>
                  Сотрудник · {m.email}
                </Text>
              </View>
              <View style={styles.personRight}>
                <View
                  style={[
                    styles.statusPill,
                    onShift ? styles.pillOn : styles.pillOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      onShift ? styles.pillOnText : styles.pillOffText,
                    ]}
                  >
                    {onShift ? 'На связи' : 'Вне смены'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.chatIconBtn}
                  onPress={() => onOpenChat(m.userId, m.name)}
                  hitSlop={8}
                >
                  <MaterialIcons name="chat" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {brigade && brigadeRows.length === 0 && !loading ? (
          <Text style={styles.empty}>
            В бригаде пока никого нет. Добавьте активных сотрудников ниже.
          </Text>
        ) : null}

        <View style={styles.accessCard}>
          <View style={styles.accessHead}>
            <MaterialIcons name="manage-accounts" size={26} color={colors.tertiary} />
            <Text style={styles.accessTitle}>Права доступа</Text>
          </View>
          <Text style={styles.accessText}>
            Вы можете добавлять новых сотрудников в свою бригаду. Они получат
            доступ к чату группы и документации по объектам.
          </Text>
          <TouchableOpacity
            style={styles.accessBtn}
            activeOpacity={0.92}
            disabled={!brigade || savingMember}
            onPress={() => {
              if (!brigade) {
                Alert.alert(
                  'Бригада',
                  'Директор должен сначала создать бригаду и назначить вас мастером.',
                );
                return;
              }
              setWorkerPickerOpen(true);
            }}
          >
            <MaterialIcons name="person-add" size={22} color={colors.onPrimary} />
            <Text style={styles.accessBtnText}>Добавить в бригаду</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={workerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkerPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !savingMember && setWorkerPickerOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Добавить сотрудника</Text>
            {addableWorkers.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Нет свободных активных сотрудников. Они могут быть в другой бригаде
                или иметь другую роль.
              </Text>
            ) : (
              <FlatList
                style={{ maxHeight: 280 }}
                data={addableWorkers}
                keyExtractor={(i) => i.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    disabled={savingMember}
                    onPress={() => void addWorker(item.userId)}
                  >
                    <Text style={styles.modalRowText}>{item.name}</Text>
                    <MaterialIcons name="add" size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setWorkerPickerOpen(false)}
              disabled={savingMember}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <CompanyBottomTabBar
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        active="team"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerIconSpacer: { width: 32, height: 32 },
  noBrigadeBanner: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.subtext,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 20,
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerAvatarTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    padding: 18,
  },
  statCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statCardTertiary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.tertiary,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.subtext,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: fonts.headline,
    fontSize: 30,
    letterSpacing: -0.5,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.4,
  },
  sectionTag: {
    fontSize: 11,
    fontFamily: fonts.label,
    color: colors.subtext,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#1a1c1c',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  avatarBlock: { position: 'relative', marginRight: 14 },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceHighest,
  },
  avatarLgTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  presenceLg: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.card,
  },
  personMid: { flex: 1, minWidth: 0 },
  personName: {
    fontFamily: fonts.label,
    fontSize: 16,
    color: colors.text,
  },
  personSub: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.subtext,
    lineHeight: 18,
  },
  personRight: { alignItems: 'flex-end', gap: 6 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillOn: { backgroundColor: colors.secondaryContainer },
  pillOff: { backgroundColor: colors.surfaceHighest },
  statusPillText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.6,
  },
  pillOnText: { color: colors.onSecondaryContainer },
  pillOffText: { color: colors.subtext },
  chatIconBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 97, 147, 0.08)',
  },
  empty: {
    textAlign: 'center',
    color: colors.subtext,
    fontFamily: fonts.body,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  accessCard: {
    marginTop: 20,
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    padding: 22,
  },
  accessHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  accessTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
  },
  accessText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.subtext,
    lineHeight: 21,
    marginBottom: 16,
  },
  accessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  accessBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.headlineBold,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  modalEmpty: {
    fontSize: 14,
    color: colors.subtext,
    fontFamily: fonts.body,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalRowText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  modalClose: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalCloseText: {
    fontSize: 16,
    fontFamily: fonts.label,
    color: colors.primary,
  },
});
