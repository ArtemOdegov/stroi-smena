import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../config';
import { useSession } from '../context/SessionContext';
import { me } from '../api/auth';
import {
  listMessages,
  markRead,
  sendMessage,
  type ChatMessage,
} from '../api/chat';
import { presignUpload } from '../api/dayEntries';
import { putFileToPresignedUrl } from '../util/putFileToPresignedUrl';
import { resolveImageUri } from '../util/resolveImageUri';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

/** Скругления как в макете: `lg` + «pinch» `sm` у одного нижнего угла. */
const LG = 16;
const SM = 6;

type ListRow =
  | { kind: 'divider'; id: string; label: string }
  | { kind: 'msg'; id: string; item: ChatMessage };

type PendingChatImage = {
  localUri: string;
  publicUrl: string;
  contentType: string;
};

async function uploadChatImage(uri: string): Promise<PendingChatImage> {
  const ext = uri.split('.').pop() || 'jpg';
  const isPng = ext.toLowerCase() === 'png';
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const { uploadUrl, publicUrl } = await presignUpload(contentType, ext);
  await putFileToPresignedUrl(uri, uploadUrl, contentType);
  return { localUri: uri, publicUrl, contentType };
}

function formatDayDivider(d: Date): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'ВЧЕРА';
  return d
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    .toUpperCase();
}

function buildRows(msgs: ChatMessage[]): ListRow[] {
  const sorted = [...msgs].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const rows: ListRow[] = [];
  let lastDay = '';
  for (const m of sorted) {
    const dayKey = new Date(m.createdAt).toDateString();
    if (dayKey !== lastDay) {
      lastDay = dayKey;
      rows.push({
        kind: 'divider',
        id: `day-${dayKey}`,
        label: formatDayDivider(new Date(m.createdAt)),
      });
    }
    rows.push({ kind: 'msg', id: m.id, item: m });
  }
  return rows;
}

export function ChatThreadScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { getAccessToken } = useSession();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ListRow>>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingChatImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mutedLocal, setMutedLocal] = useState(false);

  const rows = useMemo(() => buildRows(msgs), [msgs]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return [...msgs]
      .filter(
        (m) =>
          m.body.toLowerCase().includes(q) ||
          m.senderName.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [msgs, searchQuery]);

  function showChatInfo() {
    Alert.alert(
      title,
      `Беседа: ${conversationId.slice(0, 8)}…\n\nУведомления о новых сообщениях можно настроить в разделе «Настройки» компании.`,
    );
  }

  function openThreadMenu() {
    const muteLabel = mutedLocal ? 'Включить уведомления (локально)' : 'Без звука (локально)';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Отмена', 'Информация о чате', 'Поиск по сообщениям', muteLabel],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) showChatInfo();
          else if (idx === 2) setSearchOpen(true);
          else if (idx === 3) setMutedLocal((m) => !m);
        },
      );
      return;
    }
    Alert.alert('Чат', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Информация о чате', onPress: showChatInfo },
      { text: 'Поиск по сообщениям', onPress: () => setSearchOpen(true) },
      { text: muteLabel, onPress: () => setMutedLocal((m) => !m) },
    ]);
  }

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  const load = useCallback(async () => {
    const u = await me();
    setMyId(u.userId);
    const list = await listMessages(conversationId);
    setMsgs(list);
    await markRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return undefined;
    const base = getApiBaseUrl();
    const s = io(`${base}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = s;
    s.on('connect', () => {
      s.emit('join', { conversationId });
    });
    s.on('message', (m: ChatMessage) => {
      setMsgs((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    });
    s.on('typing', (p: { userId: string; typing: boolean }) => {
      if (p.userId === myIdRef.current) return;
      setTyping(p.typing);
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, getAccessToken]);

  function emitTyping(active: boolean) {
    const sock = socketRef.current;
    if (!sock?.connected) return;
    sock.emit('typing', { conversationId, typing: active });
  }

  function onChangeText(t: string) {
    setText(t);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1200);
  }

  async function onSend() {
    const body = text.trim();
    if (!body && !pendingImage) return;
    emitTyping(false);
    Keyboard.dismiss();
    try {
      if (pendingImage) {
        const m = await sendMessage(
          conversationId,
          body,
          pendingImage.publicUrl,
          pendingImage.contentType,
        );
        setPendingImage(null);
        setText('');
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        return;
      }
      setText('');
      const m = await sendMessage(conversationId, body);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }

  async function onPickAttachment() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const uri = res.assets[0].uri;
    setUploadingImage(true);
    try {
      const uploaded = await uploadChatImage(uri);
      setPendingImage(uploaded);
    } catch (e) {
      Alert.alert('Ошибка загрузки', String(e));
    } finally {
      setUploadingImage(false);
    }
  }

  function onPrimaryAction() {
    const body = text.trim();
    if (body || pendingImage) void onSend();
  }

  const headerTop = Math.max(insets.top, 8);
  /** С клавиатурой не дублируем safe-area снизу — иначе большой зазор над клавиатурой (iOS). */
  const inputBottomPad = keyboardOpen
    ? Platform.OS === 'ios'
      ? 10
      : 8
    : Math.max(insets.bottom, 12);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.iconHit}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.peerBlock}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarLetter}>
                {title.trim().slice(0, 1).toUpperCase()}
              </Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.peerText}>
              <Text style={styles.peerName} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.peerStatus}>
                {typing
                  ? 'печатает…'
                  : mutedLocal
                    ? 'уведомления выключены (на устройстве)'
                    : 'в сети'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.iconHit}
          onPress={openThreadMenu}
          hitSlop={10}
        >
          <MaterialIcons name="more-vert" size={24} color={colors.subtext} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) =>
            item.kind === 'divider' ? (
              <View style={styles.dividerWrap}>
                <View style={styles.dividerPill}>
                  <Text style={styles.dividerText}>{item.label}</Text>
                </View>
              </View>
            ) : (
              <MessageBubble
                item={item.item}
                mine={myId != null && item.item.senderId === myId}
              />
            )
          }
        />

        <View style={[styles.inputShell, { paddingBottom: inputBottomPad }]}>
          {pendingImage ? (
            <View style={styles.pendingRow}>
              <Image
                source={{ uri: pendingImage.localUri }}
                style={styles.pendingThumb}
              />
              <TouchableOpacity
                style={styles.pendingRemove}
                onPress={() => setPendingImage(null)}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={onChangeText}
                placeholder="Сообщение..."
                placeholderTextColor="rgba(63, 72, 80, 0.45)"
                multiline
                maxLength={4000}
              />
              <TouchableOpacity
                style={styles.attachInside}
                activeOpacity={0.65}
                onPress={() => void onPickAttachment()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialIcons
                    name="attach-file"
                    size={22}
                    color={colors.subtext}
                  />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.micFab}
              onPress={onPrimaryAction}
              activeOpacity={0.88}
            >
              <MaterialIcons
                name={(text.trim() || pendingImage) ? 'send' : 'mic'}
                size={32}
                color={colors.onPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={searchOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSearchOpen(false)}
      >
        <View style={styles.searchOverlay}>
          <View style={styles.searchSheet}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Поиск по сообщениям</Text>
              <TouchableOpacity onPress={() => setSearchOpen(false)} hitSlop={10}>
                <Text style={styles.searchClose}>Закрыть</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Текст или имя отправителя…"
              placeholderTextColor="rgba(63, 72, 80, 0.45)"
              autoFocus
            />
            <FlatList
              data={searchResults}
              keyExtractor={(m) => m.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.trim() ? (
                  <Text style={styles.searchEmpty}>Ничего не найдено</Text>
                ) : (
                  <Text style={styles.searchEmpty}>Введите запрос</Text>
                )
              }
              renderItem={({ item: m }) => (
                <View style={styles.searchHit}>
                  <Text style={styles.searchHitMeta}>
                    {m.senderName} ·{' '}
                    {new Date(m.createdAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={styles.searchHitBody} numberOfLines={4}>
                    {m.body.trim() || (m.attachmentUrl ? 'Вложение' : '')}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MessageBubble({ item, mine }: { item: ChatMessage; mine: boolean }) {
  const hasImage =
    Boolean(item.attachmentUrl) &&
    (item.attachmentType == null ||
      item.attachmentType.startsWith('image/'));

  const incomingShape = {
    backgroundColor: colors.surfaceHighest,
    borderTopLeftRadius: LG,
    borderTopRightRadius: LG,
    borderBottomRightRadius: LG,
    borderBottomLeftRadius: SM,
  };
  const outgoingShape = {
    backgroundColor: colors.primaryContainer,
    borderTopLeftRadius: LG,
    borderTopRightRadius: LG,
    borderBottomLeftRadius: LG,
    borderBottomRightRadius: SM,
  };

  const timeStr = new Date(item.createdAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (hasImage && item.attachmentUrl) {
    const uri = resolveImageUri(item.attachmentUrl);
    return (
      <View
        style={[
          styles.bubbleRow,
          mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
        ]}
      >
        <View
          style={[
            styles.mediaBubble,
            mine ? outgoingShape : incomingShape,
            { maxWidth: '70%' },
          ]}
        >
          {item.body.trim() ? (
            <Text style={[styles.msgText, mine && styles.msgTextMine, styles.mediaCaption]}>
              {item.body}
            </Text>
          ) : null}
          <View style={styles.mediaInner}>
            <Image source={{ uri }} style={styles.mediaImg} resizeMode="cover" />
            <View style={styles.mediaMeta}>
              <Text style={styles.mediaMetaTime}>{timeStr}</Text>
              {mine ? (
                <MaterialIcons
                  name="done-all"
                  size={14}
                  color="#fff"
                  style={styles.doneIcon}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubbleRow,
        mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.textBubble,
          mine ? outgoingShape : incomingShape,
        ]}
      >
        <Text style={[styles.msgText, mine && styles.msgTextMine]}>
          {item.body}
        </Text>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, mine && styles.timeTextMine]}>
            {timeStr}
          </Text>
          {mine ? (
            <MaterialIcons
              name="done-all"
              size={14}
              color="rgba(255,255,255,0.92)"
              style={styles.doneIcon}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(249, 249, 249, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 28, 28, 0.06)',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  iconHit: { padding: 8, borderRadius: 999 },
  peerBlock: { flexDirection: 'row', alignItems: 'center', marginLeft: 4, flex: 1 },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.headlineBold,
    fontSize: 17,
    color: colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  peerText: { marginLeft: 10, flex: 1, minWidth: 0 },
  peerName: {
    fontFamily: fonts.headlineBold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.text,
  },
  peerStatus: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  kav: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexGrow: 1,
  },
  dividerWrap: { alignItems: 'center', marginVertical: 12 },
  dividerPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceLow,
  },
  dividerText: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.subtext,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  textBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  msgText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  msgTextMine: { color: colors.onPrimary },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  doneIcon: { marginLeft: 4 },
  timeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(63, 72, 80, 0.7)',
  },
  timeTextMine: { color: 'rgba(255,255,255,0.8)' },
  mediaBubble: {
    padding: 4,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  mediaCaption: { marginBottom: 8, paddingHorizontal: 12, paddingTop: 10 },
  mediaInner: { borderRadius: LG - 4, overflow: 'hidden' },
  mediaImg: {
    width: '100%',
    aspectRatio: 1,
  },
  mediaMeta: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  mediaMetaTime: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: '#fff',
  },
  inputShell: {
    backgroundColor: 'rgba(249, 249, 249, 0.92)',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 28, 28, 0.05)',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pendingThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.surfaceLow,
    marginRight: 8,
  },
  pendingRemove: {
    padding: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(191, 199, 210, 0.12)',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  attachInside: { padding: 8, borderRadius: 999 },
  micFab: {
    marginLeft: 10,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  searchSheet: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  searchTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 17,
    color: colors.text,
  },
  searchClose: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.primary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(191, 199, 210, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  searchEmpty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 24,
  },
  searchHit: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 28, 28, 0.08)',
  },
  searchHitMeta: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.subtext,
    marginBottom: 4,
  },
  searchHitBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
});
