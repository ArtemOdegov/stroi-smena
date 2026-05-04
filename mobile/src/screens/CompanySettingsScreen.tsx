import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import { me, type MeDto } from '../api/auth';
import { useSession } from '../context/SessionContext';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanySettings'>;

export function CompanySettingsScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const insets = useSafeAreaInsets();
  const tabPad = companyTabBarTotalHeight(insets.bottom);
  const { setTokens } = useSession();
  const [profile, setProfile] = useState<MeDto | null>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await me());
    } catch {
      setProfile(null);
    }
  }, []);

  React.useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', 'Потребуется войти снова.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => setTokens(null),
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: 12 },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: tabPad + 24,
        }}
      >
        <Text style={styles.section}>Компания</Text>
        <View style={styles.card}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.hint}>Текущая организация во вкладках ниже</Text>
        </View>

        <Text style={[styles.section, { marginTop: 24 }]}>Профиль</Text>
        <View style={styles.card}>
          {profile ? (
            <>
              <Row label="Имя" value={profile.name} />
              <Row label="Email" value={profile.email} />
            </>
          ) : (
            <Text style={styles.hint}>Не удалось загрузить профиль</Text>
          )}
        </View>

        <Text style={[styles.section, { marginTop: 24 }]}>Уведомления</Text>
        <TouchableOpacity
          style={styles.rowBtn}
          onPress={() =>
            Alert.alert(
              'Уведомления',
              'Push-уведомления появятся после подключения FCM/APNs на сервере.',
            )
          }
        >
          <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
          <Text style={styles.rowBtnText}>Настроить уведомления</Text>
          <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
        </TouchableOpacity>

        <Text style={[styles.section, { marginTop: 24 }]}>О приложении</Text>
        <View style={styles.card}>
          <Text style={styles.about}>Строй-Смена — учёт смен, дней на объекте и чаты команды.</Text>
          <Text style={styles.version}>Версия интерфейса 1.0 (MVP)</Text>
        </View>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>

      <CompanyBottomTabBar
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        active="settings"
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
  },
  section: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: colors.subtext,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  companyName: {
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    color: colors.text,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    color: colors.subtext,
    fontFamily: fonts.body,
  },
  row: { marginBottom: 12 },
  rowLabel: {
    fontSize: 12,
    color: colors.outline,
    fontFamily: fonts.bodyMedium,
  },
  rowValue: {
    marginTop: 4,
    fontSize: 16,
    color: colors.text,
    fontFamily: fonts.body,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowBtnText: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  about: {
    fontSize: 15,
    color: colors.subtext,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  version: {
    marginTop: 10,
    fontSize: 13,
    color: colors.outline,
    fontFamily: fonts.body,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    ...Platform.select({
      ios: { marginBottom: 8 },
      android: { marginBottom: 4 },
    }),
  },
  logoutText: {
    fontSize: 16,
    fontFamily: fonts.label,
    color: colors.danger,
  },
});
