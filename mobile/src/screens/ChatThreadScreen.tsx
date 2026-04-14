import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

export function ChatThreadScreen({ route }: Props) {
  const { conversationId, title } = route.params;
  const { getAccessToken } = useSession();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!body) return;
    setText('');
    emitTyping(false);
    Keyboard.dismiss();
    const m = await sendMessage(conversationId, body);
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  const bottomPad = Math.max(insets.bottom, 10);
  const kvo =
    Platform.OS === 'ios' ? headerHeight + (insets.top > 20 ? 0 : 8) : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={kvo}
    >
      <Text style={styles.title}>{title}</Text>
      {typing ? (
        <Text style={styles.typing}>собеседник печатает…</Text>
      ) : (
        <View style={{ height: 18 }} />
      )}
      <FlatList
        style={{ flex: 1 }}
        data={msgs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        renderItem={({ item }) => (
          <MessageBubble item={item} mine={myId != null && item.senderId === myId} />
        )}
      />
      <View style={[styles.inputRow, { paddingBottom: bottomPad }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder="Сообщение"
          placeholderTextColor={colors.subtext}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity style={styles.send} onPress={onSend}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ item, mine }: { item: ChatMessage; mine: boolean }) {
  return (
    <View
      style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}
    >
      <View
        style={[
          styles.bubble,
          { backgroundColor: mine ? colors.bubbleOut : colors.bubbleIn },
        ]}
      >
        {!mine ? (
          <Text style={styles.bubbleMeta}>{item.senderName}</Text>
        ) : null}
        <Text style={styles.bubbleText}>{item.body}</Text>
        <Text style={styles.bubbleTime}>
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  typing: { paddingLeft: 16, color: colors.subtext, fontSize: 13 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMeta: { fontSize: 12, color: colors.primary, marginBottom: 4 },
  bubbleText: { fontSize: 16, color: colors.text },
  bubbleTime: {
    fontSize: 11,
    color: colors.subtext,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendText: { color: '#fff', fontSize: 18 },
});
