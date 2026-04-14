import { apiFetch } from './client';

export type ConversationSummary = {
  id: string;
  type: 'COMPANY' | 'DIRECT';
  title: string;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: string;
  senderId: string;
  senderName: string;
};

export function listConversations(companyId: string) {
  return apiFetch<ConversationSummary[]>(
    `/chat/conversations?companyId=${companyId}`,
  );
}

export function openDirectChat(companyId: string, peerUserId: string) {
  return apiFetch<{ conversationId: string }>('/chat/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ companyId, peerUserId }),
  });
}

export function listMessages(conversationId: string, cursor?: string) {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages${q}`,
  );
}

export function sendMessage(
  conversationId: string,
  body: string,
  attachmentUrl?: string,
  attachmentType?: string,
) {
  return apiFetch<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body, attachmentUrl, attachmentType }),
    },
  );
}

export function markRead(conversationId: string) {
  return apiFetch<{ ok: boolean }>(
    `/chat/conversations/${conversationId}/read`,
    { method: 'POST' },
  );
}
