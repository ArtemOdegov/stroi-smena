import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompanyBottomTabBar,
  companyTabBarTotalHeight,
} from '../components/CompanyBottomTabBar';
import { listConversations, type ConversationSummary } from '../api/chat';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function ChatListScreen({ navigation, route }: Props) {
  const { companyId, companyName } = route.params;
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listConversations(companyId));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(s));
  }, [rows, q]);

  const headerBlock = (
    <>
      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: 12 },
        ]}
      >
        <View style={styles.topBarRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.brandRow}>
            <View style={styles.brandAvatar}>
              <Text style={styles.brandAvatarText}>
                {companyName.trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {companyName}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.searchShell}>
        <MaterialIcons name="search" size={22} color={colors.outline} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск сообщений…"
          placeholderTextColor="rgba(111, 120, 129, 0.75)"
          value={q}
          onChangeText={setQ}
        />
      </View>
    </>
  );

  const tabH = companyTabBarTotalHeight(insets.bottom);
  const fabBottom = tabH + 12;

  return (
    <View style={styles.root}>
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={headerBlock}
        ListHeaderComponentStyle={styles.listHeaderWrap}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabH + fabBottom + 8 },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              item.type === 'COMPANY' ? styles.rowCompanyBg : styles.rowDirectBg,
              pressed && styles.rowPressed,
            ]}
            onPress={() =>
              navigation.navigate('ChatThread', {
                companyId,
                companyName,
                conversationId: item.id,
                title: item.title,
              })
            }
            android_ripple={{ color: 'rgba(0,97,147,0.08)' }}
          >
            <ConversationAvatar item={item} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.lastMessage ? (
                  <Text style={[styles.rowTime, { marginLeft: 8 }]}>
                    {formatListTime(item.lastMessage.createdAt)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {item.lastMessage ? (
                  <>
                    <Text style={styles.previewName}>
                      {item.lastMessage.senderName}:{' '}
                    </Text>
                    {item.lastMessage.body}
                  </>
                ) : (
                  'Нет сообщений'
                )}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <CompanyBottomTabBar
        navigation={navigation}
        companyId={companyId}
        companyName={companyName}
        active="chats"
      />
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() =>
          navigation.navigate('Colleagues', { companyId, companyName })
        }
        activeOpacity={0.9}
      >
        <MaterialIcons name="edit" size={26} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function ConversationAvatar({ item }: { item: ConversationSummary }) {
  if (item.type === 'COMPANY') {
    return (
      <View style={[styles.avatarBox, { borderRadius: 16 }, styles.avatarCompany]}>
        <MaterialIcons name="groups" size={28} color={colors.onPrimary} />
      </View>
    );
  }
  return (
    <View style={[styles.avatarBox, { borderRadius: 28 }, styles.avatarDirect]}>
      <Text style={styles.avatarLetter}>
        {item.title.trim().slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  topBar: {
    paddingHorizontal: 12,
    backgroundColor: 'rgba(249, 249, 249, 0.92)',
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6, marginRight: 4 },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  brandAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarText: {
    fontFamily: fonts.headlineBold,
    fontSize: 17,
    color: colors.onPrimary,
  },
  brandTitle: {
    flex: 1,
    fontFamily: fonts.headlineBold,
    fontSize: 19,
    letterSpacing: -0.3,
    color: colors.primary,
  },
  listHeaderWrap: { marginBottom: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        marginTop: 4,
        marginBottom: 18,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  rowCompanyBg: { backgroundColor: colors.surfaceLow },
  rowDirectBg: { backgroundColor: colors.card },
  rowPressed: { opacity: 0.92 },
  avatarBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCompany: {
    backgroundColor: colors.primary,
  },
  avatarDirect: {
    backgroundColor: colors.tertiaryContainer,
  },
  avatarLetter: {
    fontFamily: fonts.headlineBold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  rowBody: { flex: 1, marginLeft: 14, overflow: 'hidden' },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.headlineBold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.text,
  },
  rowTime: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  preview: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 19,
    color: colors.subtext,
  },
  previewName: {
    fontFamily: fonts.label,
    color: colors.primary,
  },
  fab: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
});
