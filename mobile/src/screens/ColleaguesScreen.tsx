import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listColleagues, type Colleague } from '../api/companies';
import { openDirectChat } from '../api/chat';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Colleagues'>;

export function ColleaguesScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const [rows, setRows] = useState<Colleague[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await listColleagues(companyId));
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }, [companyId]);

  React.useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  return (
    <View style={styles.root}>
      <Text style={styles.header}>{companyName}</Text>
      <Text style={styles.sub}>Написать лично</Text>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.userId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              try {
                const { conversationId } = await openDirectChat(
                  companyId,
                  item.userId,
                );
                navigation.navigate('ChatThread', {
                  companyId,
                  conversationId,
                  title: item.name,
                });
              } catch (e) {
                Alert.alert('Ошибка', String(e));
              }
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
    color: colors.text,
  },
  sub: { paddingHorizontal: 16, color: colors.subtext, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  email: { fontSize: 13, color: colors.subtext, marginTop: 2 },
});
