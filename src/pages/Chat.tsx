import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Conversation } from '@/types/chat';
import { api } from '@/lib/api';

export function Chat() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(agentId ? 'chat' : 'list');

  const loadConversations = async () => {
    try {
      const res = await api.chatConversations();
      setConversations(res.data || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConversations();
    const id = window.setInterval(() => void loadConversations(), 12000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      return;
    }
    setMobileView(agentId ? 'chat' : 'list');
  }, [agentId, isMobile]);

  const fallbackAgentId = useMemo(() => conversations[0]?.agentId || '', [conversations]);
  const selectedAgentId = agentId || fallbackAgentId;

  useEffect(() => {
    if (!agentId && fallbackAgentId) {
      navigate(`/chat/${fallbackAgentId}`, { replace: true });
    }
  }, [agentId, fallbackAgentId, navigate]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.agentId === selectedAgentId) || null,
    [conversations, selectedAgentId]
  );

  useEffect(() => {
    if (!selectedAgentId) return;
    void api.chatHistory(selectedAgentId)
      .then((res) => {
        const conv = res.data;
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.agentId === conv.agentId);
          if (idx < 0) return [conv, ...prev];
          const copy = [...prev];
          copy[idx] = conv;
          return copy;
        });
      })
      .catch(() => undefined);
  }, [selectedAgentId]);

  const handleSendMessage = async (content: string) => {
    if (!selectedAgentId || sending) return;
    setSending(true);

    const optimisticNow = new Date().toISOString();
    setConversations((prev) =>
      prev.map((conv) =>
        conv.agentId === selectedAgentId
          ? {
              ...conv,
              messages: [
                ...conv.messages,
                {
                  id: `optimistic-${Date.now()}`,
                  senderId: 'user',
                  senderName: 'Você',
                  content,
                  timestamp: optimisticNow,
                  isUser: true,
                },
              ],
              lastMessage: content,
              lastMessageTime: optimisticNow,
            }
          : conv
      )
    );

    try {
      const res = await api.chatSend(selectedAgentId, content);
      const updated = res.data;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.agentId === updated.agentId);
        if (idx < 0) return [updated, ...prev];
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      });
    } catch {
      // noop
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="h-[calc(100vh-150px)]">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 h-full">
          {(!isMobile || mobileView === 'list') && (
            <ConversationList
              conversations={conversations}
              onSelect={() => isMobile && setMobileView('chat')}
              className="h-full md:w-[360px] md:min-w-[320px] md:max-w-[380px] md:shrink-0"
            />
          )}

          {(!isMobile || mobileView === 'chat') && (
            <div className="h-full flex-1 min-w-0">
              {loading ? (
                <div className="bg-card border border-border rounded-xl h-full flex items-center justify-center text-muted-foreground">Carregando conversas...</div>
              ) : activeConversation ? (
                <ChatInterface
                  conversation={activeConversation}
                  onSendMessage={handleSendMessage}
                  sending={sending}
                  className="h-full"
                  showBackButton={isMobile}
                  onBack={() => setMobileView('list')}
                />
              ) : (
                <div className="bg-card border border-border rounded-xl h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">Selecione um agente</p>
                    <p className="text-sm text-muted-foreground">Abra a conversa na lista</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
