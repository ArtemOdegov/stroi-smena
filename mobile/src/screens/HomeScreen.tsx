import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { joinCompany, listMyCompanies, type CompanyRow } from '../api/companies';
import { useSession } from '../context/SessionContext';
import { tryRegisterPushToken } from '../push/registerPushToken';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { setTokens, setSelectedCompanyId, takeOpenCreateCompanyAfterAuth } =
    useSession();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyCompanies());
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const u = navigation.addListener('focus', () => {
      void load();
      void tryRegisterPushToken();
    });
    return u;
  }, [navigation, load]);

  React.useEffect(() => {
    if (takeOpenCreateCompanyAfterAuth()) {
      navigation.navigate('CreateCompany');
    }
  }, [navigation, takeOpenCreateCompanyAfterAuth]);

  async function onJoin() {
    if (!invite.trim()) return;
    try {
      await joinCompany(invite.trim());
      setInvite('');
      await load();
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Компании</Text>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.companyId}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        ListHeaderComponent={
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.createRow}
              onPress={() => navigation.navigate('CreateCompany')}
              activeOpacity={0.85}
            >
              <View style={styles.createRowLeft}>
                <View style={styles.createIconWrap}>
                  <MaterialIcons name="domain" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.createTitle}>Создать компанию</Text>
                  <Text style={styles.createSub}>Новая организация и код приглашения</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={26} color={colors.subtext} />
            </TouchableOpacity>
            <Text style={[styles.section, { marginTop: 20 }]}>Войти по коду</Text>
            <TextInput
              style={styles.input}
              placeholder="Код приглашения"
              autoCapitalize="characters"
              value={invite}
              onChangeText={setInvite}
            />
            <TouchableOpacity style={styles.btnSecondary} onPress={onJoin}>
              <Text style={styles.btnSecondaryText}>Присоединиться</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              setSelectedCompanyId(item.companyId);
              navigation.navigate('Calendar', {
                companyId: item.companyId,
                companyName: item.companyName,
              });
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.companyName}</Text>
              <Text style={styles.rowSub}>
                {item.role === 'DIRECTOR'
                  ? 'Директор'
                  : item.role === 'MASTER'
                    ? 'Мастер'
                    : 'Сотрудник'}
                {item.inviteCode ? ` · код: ${item.inviteCode}` : ''}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.logout}
            onPress={() => setTokens(null)}
          >
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    color: colors.text,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  createRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  createSub: { marginTop: 2, fontSize: 13, color: colors.subtext },
  section: { fontWeight: '600', marginBottom: 8, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  rowSub: { marginTop: 4, color: colors.subtext, fontSize: 14 },
  chev: { fontSize: 22, color: colors.subtext },
  logout: { margin: 24, alignItems: 'center' },
  logoutText: { color: colors.danger, fontSize: 16 },
});
