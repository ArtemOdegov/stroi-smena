import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import type { Colleague } from '../api/companies';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  navigation: Nav;
  companyId: string;
  companyName: string;
  colleagues: Colleague[];
  myName: string;
  loading: boolean;
  onOpenChat: (userId: string, name: string) => void;
};

function roleSubtitle(role: string): string {
  switch (role) {
    case 'DIRECTOR':
      return 'Директор компании';
    case 'MASTER':
      return 'Мастер смены';
    default:
      return 'Сотрудник';
  }
}

function peopleCountRu(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} человек`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20))
    return `${n} человека`;
  return `${n} человек`;
}

function colleagueMeta(
  c: Colleague,
  companyName: string,
): { chip: string; chipStyle: 'office' | 'site'; line2: string } {
  const short = companyName.length > 18 ? `${companyName.slice(0, 16)}…` : companyName;
  switch (c.role) {
    case 'DIRECTOR':
      return { chip: 'ОФИС', chipStyle: 'office', line2: 'Управление' };
    case 'MASTER':
      return {
        chip: 'НА ОБЪЕКТЕ',
        chipStyle: 'site',
        line2: `Проект: «${short}»`,
      };
    default:
      return {
        chip: 'ОФИС',
        chipStyle: 'office',
        line2: `Проект: «${short}»`,
      };
  }
}

/** Вкладка «Команда» для роли EMPLOYEE — макет stitch_remix_of 6 */
export function EmployeeColleaguesView({
  navigation,
  companyId,
  companyName,
  colleagues,
  myName,
  loading,
  onOpenChat,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return colleagues;
    return colleagues.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        roleSubtitle(c.role).toLowerCase().includes(s),
    );
  }, [colleagues, search]);

  const listHeader = (
    <View style={styles.blockTop}>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Коллеги</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {peopleCountRu(colleagues.length)}
          </Text>
        </View>
      </View>
      <View style={styles.searchWrap}>
        <MaterialIcons
          name="search"
          size={22}
          color={colors.outline}
          style={styles.searchIcon}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по имени или роли"
          placeholderTextColor={colors.outline}
          style={styles.searchInput}
        />
      </View>
    </View>
  );

  const topBar = (
    <View
      style={[
        styles.header,
        { paddingTop: Math.max(insets.top, 10), paddingBottom: 12 },
      ]}
    >
      <View style={styles.headerLeft}>
        <View style={styles.headerIconSpacer} />
        <Text style={styles.headerTitle}>Команда</Text>
      </View>
      <View style={styles.headerAvatar}>
        <Text style={styles.headerAvatarTxt}>
          {(myName || '?').slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {topBar}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.userId}
        ListHeaderComponent={
          <>
            {listHeader}
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />
            ) : null}
          </>
        }
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: tabPad + 24,
          paddingTop: 4,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item: c }) => {
          const meta = colleagueMeta(c, companyName);
          const dotColor =
            c.role === 'MASTER'
              ? '#fb923c'
              : c.role === 'DIRECTOR'
                ? 'transparent'
                : '#22c55e';
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => onOpenChat(c.userId, c.name)}
            >
              <View style={styles.avatarBlock}>
                <View style={styles.avatarSq}>
                  <Text style={styles.avatarSqTxt}>
                    {c.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                {dotColor !== 'transparent' ? (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: dotColor, borderColor: colors.surfaceLow },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.cardMid}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardRole}>{roleSubtitle(c.role)}</Text>
              </View>
              <View style={styles.cardRight}>
                <View
                  style={[
                    styles.tag,
                    meta.chipStyle === 'site' ? styles.tagSite : styles.tagOffice,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      meta.chipStyle === 'site'
                        ? styles.tagTextSite
                        : styles.tagTextOffice,
                    ]}
                  >
                    {meta.chip}
                  </Text>
                </View>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {meta.line2}
                </Text>
              </View>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconSpacer: { width: 32, height: 32 },
  headerTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
    letterSpacing: -0.2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.primary,
  },
  blockTop: { marginBottom: 22 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: {
    fontFamily: fonts.headline,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.5,
  },
  countPill: {
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 14,
    fontFamily: fonts.label,
    color: colors.secondary,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLow,
    borderRadius: 14,
    padding: 18,
    gap: 16,
  },
  avatarBlock: { position: 'relative' },
  avatarSq: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSqTxt: {
    fontFamily: fonts.headlineBold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  cardMid: { flex: 1, minWidth: 0 },
  cardName: {
    fontFamily: fonts.label,
    fontSize: 18,
    color: colors.text,
    lineHeight: 22,
  },
  cardRole: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.secondary,
  },
  cardRight: { alignItems: 'flex-end', maxWidth: '38%', gap: 4 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagOffice: { backgroundColor: colors.secondaryContainer },
  tagSite: { backgroundColor: colors.tertiaryContainer },
  tagText: {
    fontSize: 10,
    fontFamily: fonts.label,
    letterSpacing: 0.3,
  },
  tagTextOffice: { color: colors.onSecondaryContainer },
  tagTextSite: { color: colors.onTertiaryContainer },
  cardMeta: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.outline,
    textAlign: 'right',
  },
});
