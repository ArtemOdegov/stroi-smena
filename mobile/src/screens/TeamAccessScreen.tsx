import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import {
  listMembers,
  patchMember,
  type MemberRow,
} from '../api/companies';
import {
  listBrigades,
  createBrigade,
  updateBrigade,
} from '../api/brigades';
import { me as fetchMe } from '../api/auth';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamAccess'>;

function roleSubtitle(role: string): string {
  switch (role) {
    case 'DIRECTOR':
      return 'Директор';
    case 'MASTER':
      return 'Мастер';
    default:
      return 'Работник';
  }
}

function roleChip(role: string): {
  label: string;
  style: ViewStyle;
  textStyle: TextStyle;
} {
  switch (role) {
    case 'DIRECTOR':
      return {
        label: 'Director',
        style: styles.chipDirector,
        textStyle: styles.chipDirectorText,
      };
    case 'MASTER':
      return {
        label: 'Master',
        style: styles.chipMaster,
        textStyle: styles.chipMasterText,
      };
    default:
      return {
        label: 'Worker',
        style: styles.chipWorker,
        textStyle: styles.chipWorkerText,
      };
  }
}

function employeesCountRu(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} человек`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20))
    return `${n} человека`;
  return `${n} человек`;
}

export function TeamAccessScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);

  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [masterPickerOpen, setMasterPickerOpen] = useState(false);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [brigadeMasterId, setBrigadeMasterId] = useState<string | null>(null);
  const [brigadeWorkerIds, setBrigadeWorkerIds] = useState<string[]>([]);
  const [currentBrigadeId, setCurrentBrigadeId] = useState<string | null>(null);
  const [savingBrigade, setSavingBrigade] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchMe();
      setMyName(me.name);
      setMembers(await listMembers(companyId));
      const bl = await listBrigades(companyId);
      const first = bl[0];
      if (first) {
        setCurrentBrigadeId(first.id);
        setBrigadeMasterId(first.masterUserId);
        setBrigadeWorkerIds(first.members.map((x) => x.userId));
      } else {
        setCurrentBrigadeId(null);
        setBrigadeMasterId(null);
        setBrigadeWorkerIds([]);
      }
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  const masters = useMemo(
    () =>
      members.filter((m) => m.role === 'MASTER' && m.status === 'ACTIVE'),
    [members],
  );

  const workersPool = useMemo(
    () =>
      members.filter(
        (m) =>
          m.role === 'EMPLOYEE' &&
          m.status === 'ACTIVE' &&
          m.userId !== brigadeMasterId,
      ),
    [members, brigadeMasterId],
  );

  const addableWorkers = useMemo(
    () => workersPool.filter((w) => !brigadeWorkerIds.includes(w.userId)),
    [workersPool, brigadeWorkerIds],
  );

  const selectedMaster = masters.find((m) => m.userId === brigadeMasterId);

  function onMemberMenu(m: MemberRow) {
    if (m.role === 'DIRECTOR') {
      Alert.alert(m.name, 'Роль директора не меняется из этого меню.');
      return;
    }
    if (m.role === 'EMPLOYEE') {
      Alert.alert(m.name, 'Действия', [
        {
          text: 'Назначить мастером',
          onPress: () =>
            void patchMember(companyId, m.userId, { role: 'MASTER' }).then(
              load,
              (e) => Alert.alert('Ошибка', String(e)),
            ),
        },
        {
          text: 'Отключить доступ',
          style: 'destructive',
          onPress: () =>
            void patchMember(companyId, m.userId, { status: 'INACTIVE' }).then(
              load,
              (e) => Alert.alert('Ошибка', String(e)),
            ),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
      return;
    }
    if (m.role === 'MASTER') {
      Alert.alert(m.name, 'Действия', [
        {
          text: 'Сделать сотрудником',
          onPress: () =>
            void patchMember(companyId, m.userId, { role: 'EMPLOYEE' }).then(
              load,
              (e) => Alert.alert('Ошибка', String(e)),
            ),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }

  async function submitBrigade() {
    if (!brigadeMasterId) {
      Alert.alert('Бригада', 'Выберите мастера.');
      return;
    }
    if (brigadeWorkerIds.length === 0) {
      Alert.alert('Бригада', 'Добавьте хотя бы одного рабочего.');
      return;
    }
    setSavingBrigade(true);
    try {
      if (currentBrigadeId) {
        await updateBrigade(companyId, currentBrigadeId, {
          masterUserId: brigadeMasterId,
          memberUserIds: brigadeWorkerIds,
        });
      } else {
        const created = await createBrigade(companyId, {
          masterUserId: brigadeMasterId,
          memberUserIds: brigadeWorkerIds,
        });
        setCurrentBrigadeId(created.id);
      }
      await load();
      Alert.alert('Готово', 'Состав бригады сохранён на сервере.');
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    } finally {
      setSavingBrigade(false);
    }
  }

  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: 12 },
        ]}
      >
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.iconBtn}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Команда</Text>
        </View>
        <View style={styles.topAvatar}>
          <Text style={styles.topAvatarText}>
            {(myName || '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      {loading && members.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: tabPad + 28,
            paddingTop: 8,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.directorCard}>
            <MaterialIcons
              name="verified-user"
              size={40}
              color={colors.onPrimaryContainer}
            />
            <Text style={styles.directorLabel}>Статус аккаунта</Text>
            <Text style={styles.directorRole}>ДИРЕКТОР</Text>
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Сотрудники</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {employeesCountRu(activeCount)}
              </Text>
            </View>
          </View>

          <View style={styles.listShell}>
            {members.map((m) => {
              const chip = roleChip(m.role);
              const dim = m.status !== 'ACTIVE';
              return (
                <View
                  key={m.userId}
                  style={[styles.row, dim && styles.rowDim]}
                >
                  <View style={[styles.rowAvatar, dim && styles.rowAvatarDim]}>
                    <Text style={styles.rowAvatarTxt}>
                      {m.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.rowName}>{m.name}</Text>
                    <Text style={styles.rowSub}>{roleSubtitle(m.role)}</Text>
                  </View>
                  <View style={[styles.roleChip, chip.style]}>
                    <Text style={[styles.roleChipText, chip.textStyle]}>
                      {chip.label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => onMemberMenu(m)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons
                      name="more-vert"
                      size={22}
                      color={colors.outline}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={styles.brigadeCard}>
            <View style={styles.brigadeHead}>
              <View style={styles.brigadeIconWrap}>
                <MaterialIcons
                  name="group-add"
                  size={22}
                  color={colors.onPrimary}
                />
              </View>
              <Text style={styles.brigadeTitle}>Создать бригаду</Text>
            </View>

            <Text style={styles.fieldLabel}>Выбор мастера</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setMasterPickerOpen(true)}
              activeOpacity={0.85}
            >
              <Text
                style={
                  selectedMaster ? styles.selectValue : styles.selectPlaceholder
                }
                numberOfLines={1}
              >
                {selectedMaster?.name ?? 'Выберите мастера'}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={26}
                color={colors.outline}
              />
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
              Добавить рабочих
            </Text>
            <View style={styles.chipsWrap}>
              {brigadeWorkerIds.map((id) => {
                const w = members.find((x) => x.userId === id);
                if (!w) return null;
                return (
                  <View key={id} style={styles.chipPerson}>
                    <Text style={styles.chipPersonText}>{w.name}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setBrigadeWorkerIds((prev) =>
                          prev.filter((x) => x !== id),
                        )
                      }
                      hitSlop={8}
                    >
                      <MaterialIcons name="close" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.addChipBtn}
                onPress={() => setWorkerPickerOpen(true)}
              >
                <MaterialIcons name="add" size={18} color={colors.primary} />
                <Text style={styles.addChipText}>Добавить</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.submitBrigade}
              onPress={() => void submitBrigade()}
              activeOpacity={0.92}
              disabled={savingBrigade}
            >
              {savingBrigade ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitBrigadeText}>
                  {currentBrigadeId ? 'Сохранить бригаду' : 'Сформировать бригаду'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={masterPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMasterPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMasterPickerOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Мастер бригады</Text>
            {masters.length === 0 ? (
              <Text style={styles.modalEmpty}>
                В компании пока нет мастеров. Назначьте мастера через меню ⋮ у
                сотрудника в списке выше.
              </Text>
            ) : (
              <FlatList
                style={{ maxHeight: 280 }}
                data={masters}
                keyExtractor={(i) => i.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setBrigadeMasterId(item.userId);
                      setBrigadeWorkerIds((ids) =>
                        ids.filter((id) => id !== item.userId),
                      );
                      setMasterPickerOpen(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{item.name}</Text>
                    {item.userId === brigadeMasterId ? (
                      <MaterialIcons name="check" size={22} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setMasterPickerOpen(false)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={workerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkerPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setWorkerPickerOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Рабочие в бригаду</Text>
            {addableWorkers.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Нет доступных сотрудников. Добавьте активных сотрудников или
                снимите их с других ролей.
              </Text>
            ) : (
              <FlatList
                style={{ maxHeight: 280 }}
                data={addableWorkers}
                keyExtractor={(i) => i.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setBrigadeWorkerIds((prev) => [...prev, item.userId]);
                      setWorkerPickerOpen(false);
                    }}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 6 },
  topTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  topAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topAvatarText: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  directorCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 22,
  },
  directorLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.onPrimaryContainer,
    opacity: 0.85,
    marginTop: 6,
  },
  directorRole: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.onPrimaryContainer,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.4,
  },
  countBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: fonts.label,
    color: colors.onSecondaryContainer,
  },
  listShell: {
    backgroundColor: colors.surfaceLow,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    marginTop: 1,
  },
  rowDim: { opacity: 0.72 },
  rowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowAvatarDim: { opacity: 0.8 },
  rowAvatarTxt: {
    color: colors.onPrimary,
    fontFamily: fonts.headlineBold,
    fontSize: 18,
  },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: {
    fontFamily: fonts.label,
    fontSize: 16,
    color: colors.text,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.outline,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 4,
  },
  roleChipText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.8,
  },
  chipDirector: { backgroundColor: colors.primary },
  chipDirectorText: { color: colors.onPrimary },
  chipMaster: { backgroundColor: colors.tertiaryFixed },
  chipMasterText: { color: colors.onTertiaryFixedVariant },
  chipWorker: { backgroundColor: colors.secondaryContainer },
  chipWorkerText: { color: colors.onSecondaryFixedVariant },
  moreBtn: { padding: 4 },
  brigadeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  brigadeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  brigadeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brigadeTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: fonts.label,
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.outline,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    padding: 12,
  },
  chipPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipPersonText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  addChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 97, 147, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addChipText: {
    fontSize: 14,
    fontFamily: fonts.label,
    color: colors.primary,
  },
  submitBrigade: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  submitBrigadeText: {
    color: colors.onPrimary,
    fontFamily: fonts.headlineBold,
    fontSize: 16,
    letterSpacing: 0.3,
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
