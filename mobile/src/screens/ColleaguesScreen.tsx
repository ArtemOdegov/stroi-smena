import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Linking,
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
import {
  listColleagues,
  listMembers,
  listMyCompanies,
  patchMember,
  regenerateInviteCode,
  type Colleague,
  type CompanyRole,
  type MemberRow,
} from '../api/companies';
import { me as fetchMe } from '../api/auth';
import { openDirectChat } from '../api/chat';
import {
  listBrigades,
  type BrigadeDto,
} from '../api/brigades';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { MasterBrigadeView } from './MasterBrigadeView';
import { EmployeeColleaguesView } from './EmployeeColleaguesView';

type Props = NativeStackScreenProps<RootStackParamList, 'Colleagues'>;

function roleLabel(role: string): string {
  switch (role) {
    case 'DIRECTOR':
      return 'Директор';
    case 'MASTER':
      return 'Мастер';
    default:
      return 'Сотрудник';
  }
}

function formatInviteDisplay(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (c.length <= 4) return c;
  return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
}

function statusChip(status: string): { label: string; active: boolean } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Активен', active: true };
    case 'PENDING':
      return { label: 'Ожидает', active: false };
    default:
      return { label: 'Офлайн', active: false };
  }
}

function membersCountLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} участник`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20))
    return `${n} участника`;
  return `${n} участников`;
}

export function ColleaguesScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);

  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [myRole, setMyRole] = useState<CompanyRole | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [search, setSearch] = useState('');
  const [masterBrigade, setMasterBrigade] = useState<BrigadeDto | null>(null);

  const isManager = myRole === 'DIRECTOR' || myRole === 'MASTER';
  const isDirector = myRole === 'DIRECTOR';

  const load = useCallback(async () => {
    setLoading(true);
    setMembers([]);
    setColleagues([]);
    try {
      const profile = await fetchMe();
      setMyUserId(profile.userId);
      setMyName(profile.name);

      const companies = await listMyCompanies();
      const row = companies.find((c) => c.companyId === companyId);
      const role = (row?.role ?? 'EMPLOYEE') as CompanyRole;
      setMyRole(role);
      setInviteCode(row?.inviteCode ?? null);

      if (role === 'DIRECTOR' || role === 'MASTER') {
        setMembers(await listMembers(companyId));
        setColleagues([]);
        if (role === 'MASTER') {
          const bl = await listBrigades(companyId);
          setMasterBrigade(bl[0] ?? null);
        } else {
          setMasterBrigade(null);
        }
      } else {
        setColleagues(await listColleagues(companyId));
        setMembers([]);
        setMasterBrigade(null);
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

  const filteredMembers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s),
    );
  }, [members, search]);

  const filteredColleagues = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return colleagues;
    return colleagues.filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s),
    );
  }, [colleagues, search]);

  const memberCount = isManager ? members.length : colleagues.length;

  async function openChat(userId: string, title: string) {
    try {
      const { conversationId } = await openDirectChat(companyId, userId);
      navigation.navigate('ChatThread', {
        companyId,
        companyName,
        conversationId,
        title,
      });
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }

  function canManageTarget(m: MemberRow): boolean {
    if (m.userId === myUserId) return false;
    if (myRole === 'DIRECTOR') return true;
    if (myRole === 'MASTER') return m.role === 'EMPLOYEE';
    return false;
  }

  function onEditMember(m: MemberRow) {
    if (!canManageTarget(m)) return;
    if (myRole === 'MASTER') {
      Alert.alert(m.name, 'Статус участника', [
        {
          text: 'Активен',
          onPress: () =>
            void patchMember(companyId, m.userId, { status: 'ACTIVE' }).then(
              load,
              (e) => Alert.alert('Ошибка', String(e)),
            ),
        },
        {
          text: 'Неактивен',
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
    Alert.alert(m.name, 'Роль в компании', [
      {
        text: 'Сотрудник',
        onPress: () =>
          void patchMember(companyId, m.userId, { role: 'EMPLOYEE' }).then(
            load,
            (e) => Alert.alert('Ошибка', String(e)),
          ),
      },
      {
        text: 'Мастер',
        onPress: () =>
          void patchMember(companyId, m.userId, { role: 'MASTER' }).then(
            load,
            (e) => Alert.alert('Ошибка', String(e)),
          ),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  function onDeactivateMember(m: MemberRow) {
    if (!canManageTarget(m)) return;
    Alert.alert(
      'Отключить доступ?',
      `${m.name} не сможет пользоваться приложением по этой компании.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отключить',
          style: 'destructive',
          onPress: () =>
            void patchMember(companyId, m.userId, { status: 'INACTIVE' }).then(
              load,
              (e) => Alert.alert('Ошибка', String(e)),
            ),
        },
      ],
    );
  }

  async function onRegenerateInvite() {
    Alert.alert(
      'Новый код',
      'Старые коды перестанут работать. Продолжить?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сгенерировать',
          onPress: async () => {
            try {
              const r = await regenerateInviteCode(companyId);
              setInviteCode(r.inviteCode);
            } catch (e) {
              Alert.alert('Ошибка', String(e));
            }
          },
        },
      ],
    );
  }

  function onInviteMail() {
    const code = inviteCode?.trim();
    if (!code) {
      Alert.alert(
        'Нет кода',
        'Код приглашения доступен директору компании.',
      );
      return;
    }
    const subject = encodeURIComponent(`Приглашение в ${companyName}`);
    const body = encodeURIComponent(
      `Присоединяйтесь к команде «${companyName}» в приложении Строй-Смена.\n\nКод приглашения: ${formatInviteDisplay(code)}`,
    );
    void Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  const header = (
    <View
      style={[
        styles.shellHeader,
        { paddingTop: Math.max(insets.top, 10), paddingBottom: 10 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backWrap}
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={colors.primaryDark}
              />
            </TouchableOpacity>
          ) : null}
          <View style={styles.brandAvatar}>
            <Text style={styles.brandAvatarText}>
              {(myName || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {companyName}
          </Text>
        </View>
        <MaterialIcons name="search" size={22} color={colors.primaryDark} />
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск по имени или почте"
        placeholderTextColor={colors.outline}
        style={styles.searchInput}
      />
    </View>
  );

  const listHeader = (
    <View style={styles.sectionHead}>
      <View>
        <Text style={styles.sectionTitle}>
          Команда{' '}
          <Text style={styles.sectionCount}>
            ({membersCountLabel(memberCount)})
          </Text>
        </Text>
      </View>
      <TouchableOpacity hitSlop={12} style={styles.filterBtn}>
        <MaterialIcons name="filter-list" size={22} color={colors.subtext} />
      </TouchableOpacity>
    </View>
  );

  const managementFooter =
    isManager ? (
      <View style={styles.manageCard}>
        <MaterialIcons
          name="architecture"
          size={120}
          color={colors.primary}
          style={styles.manageWatermark}
        />
        <Text style={styles.manageTitle}>Управление командой</Text>
        {isDirector ? (
          <View style={styles.manageRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Код компании</Text>
              <Text style={styles.codeValue}>
                {inviteCode ? formatInviteDisplay(inviteCode) : '—'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={onRegenerateInvite}
            >
              <MaterialIcons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={onInviteMail}
              activeOpacity={0.9}
            >
              <MaterialIcons name="mail" size={20} color={colors.onPrimary} />
              <Text style={styles.inviteBtnText}>Пригласить по почте</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.masterHint}>
            Код приглашения и его смена доступны только директору. Вы можете
            просматривать состав и менять статус сотрудников.
          </Text>
        )}
      </View>
    ) : null;

  const permissionsFooter =
    isDirector ? (
      <TouchableOpacity
        style={styles.permCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('TeamAccess', { companyId, companyName })
        }
      >
        <MaterialIcons name="security" size={40} color={colors.primary} />
        <Text style={styles.permTitle}>Права доступа</Text>
        <Text style={styles.permSub}>
          Настройка уровней доступа для участников команды.
        </Text>
      </TouchableOpacity>
    ) : myRole === 'MASTER' ? (
      <TouchableOpacity
        style={styles.permCard}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert(
            'Права доступа',
            'Глобальные уровни доступа настраивает директор компании.',
          )
        }
      >
        <MaterialIcons name="security" size={40} color={colors.primary} />
        <Text style={styles.permTitle}>Права доступа</Text>
        <Text style={styles.permSub}>
          Настройка уровней доступа для участников команды.
        </Text>
      </TouchableOpacity>
    ) : null;

  if (loading && !myUserId) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <CompanyBottomTabBar
          navigation={navigation}
          companyId={companyId}
          companyName={companyName}
          active="team"
        />
      </View>
    );
  }

  if (myRole === 'MASTER') {
    return (
      <MasterBrigadeView
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        members={members}
        brigade={masterBrigade}
        myUserId={myUserId}
        myName={myName}
        loading={loading}
        onBrigadeUpdated={load}
        onOpenChat={(userId, name) => void openChat(userId, name)}
      />
    );
  }

  if (myRole === 'EMPLOYEE') {
    return (
      <EmployeeColleaguesView
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        colleagues={colleagues}
        myName={myName}
        loading={loading}
        onOpenChat={(userId, name) => void openChat(userId, name)}
      />
    );
  }

  if (isManager) {
    return (
      <View style={styles.root}>
        {header}
        <FlatList
          data={filteredMembers}
          keyExtractor={(i) => i.userId}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: tabPad + 24,
            paddingTop: 8,
          }}
          ListHeaderComponent={
            <>
              {listHeader}
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />
              ) : null}
            </>
          }
          ListFooterComponent={
            <>
              {managementFooter}
              {permissionsFooter}
            </>
          }
          renderItem={({ item: m }) => {
            const chip = statusChip(m.status);
            const isSelf = m.userId === myUserId;
            const dimmed = m.status !== 'ACTIVE';
            return (
              <View
                style={[
                  styles.memberCard,
                  dimmed && styles.memberCardDim,
                ]}
              >
                <TouchableOpacity
                  style={styles.memberMain}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (!isSelf) void openChat(m.userId, m.name);
                  }}
                  disabled={isSelf}
                >
                  <View style={styles.avatarWrap}>
                    <View
                      style={[
                        styles.avatar,
                        dimmed && styles.avatarInactive,
                      ]}
                    >
                      <Text style={styles.avatarTxt}>
                        {m.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.presenceDot,
                        {
                          backgroundColor: chip.active
                            ? '#34d399'
                            : colors.outline,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.memberText}>
                    <Text style={styles.memberName}>
                      {m.name}
                      {isSelf ? ' (вы)' : ''}
                    </Text>
                    <Text style={styles.memberSub} numberOfLines={1}>
                      {roleLabel(m.role)} · {m.email}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.memberRight}>
                  <View
                    style={[
                      styles.chip,
                      chip.active ? styles.chipOn : styles.chipOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        chip.active
                          ? styles.chipTextOn
                          : styles.chipTextOff,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </View>
                  {canManageTarget(m) ? (
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        style={styles.iconAct}
                        onPress={() => onEditMember(m)}
                      >
                        <MaterialIcons
                          name="edit"
                          size={20}
                          color={colors.subtext}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconActDanger}
                        onPress={() => onDeactivateMember(m)}
                      >
                        <MaterialIcons
                          name="person-off"
                          size={20}
                          color={colors.subtext}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
        <CompanyBottomTabBar
          navigation={navigation}
          companyId={companyId}
          companyName={companyName}
          active="team"
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <FlatList
        data={filteredColleagues}
        keyExtractor={(i) => i.userId}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: tabPad + 24,
          paddingTop: 8,
        }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={null}
        renderItem={({ item: m }) => (
          <TouchableOpacity
            style={styles.memberCard}
            activeOpacity={0.8}
            onPress={() => void openChat(m.userId, m.name)}
          >
            <View style={styles.memberMain}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>
                    {m.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.presenceDot, { backgroundColor: '#34d399' }]} />
              </View>
              <View style={styles.memberText}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSub} numberOfLines={1}>
                  {roleLabel(m.role)} · {m.email}
                </Text>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={colors.outline}
            />
          </TouchableOpacity>
        )}
      />
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
  centered: { justifyContent: 'center', alignItems: 'center' },
  shellHeader: {
    paddingHorizontal: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  backWrap: { marginRight: 2, padding: 4 },
  brandAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandAvatarText: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  brandTitle: {
    flex: 1,
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  searchInput: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '400',
  },
  filterBtn: { padding: 6 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#1a1c1c',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  memberCardDim: { backgroundColor: colors.surfaceLow },
  memberMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInactive: { opacity: 0.75 },
  avatarTxt: {
    color: colors.onPrimary,
    fontFamily: fonts.headlineBold,
    fontSize: 18,
  },
  presenceDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.card,
  },
  memberText: { flex: 1, minWidth: 0 },
  memberName: {
    fontFamily: fonts.label,
    fontSize: 16,
    color: colors.text,
  },
  memberSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.subtext,
    fontFamily: fonts.body,
  },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipOn: { backgroundColor: colors.secondaryContainer },
  chipOff: { backgroundColor: colors.surfaceHighest },
  chipText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.6,
  },
  chipTextOn: { color: colors.onSecondaryContainer },
  chipTextOff: { color: colors.subtext },
  rowActions: { flexDirection: 'row', gap: 4 },
  iconAct: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },
  iconActDanger: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },
  manageCard: {
    marginTop: 28,
    backgroundColor: colors.surfaceLow,
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
  },
  manageWatermark: {
    position: 'absolute',
    right: -36,
    top: -28,
    opacity: 0.06,
  },
  manageTitle: {
    fontFamily: fonts.headline,
    fontSize: 26,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  manageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  codeBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexGrow: 1,
    minWidth: 140,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 1,
    color: colors.subtext,
  },
  codeValue: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
    letterSpacing: 1,
    marginTop: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  inviteBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.label,
    fontSize: 15,
  },
  masterHint: {
    fontSize: 14,
    color: colors.subtext,
    fontFamily: fonts.body,
    lineHeight: 20,
    marginTop: 4,
  },
  permCard: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 18,
    padding: 22,
  },
  permTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 20,
    color: colors.text,
    marginTop: 8,
  },
  permSub: {
    marginTop: 6,
    fontSize: 14,
    color: colors.subtext,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
});
