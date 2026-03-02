import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types/chat';
import { format } from 'date-fns';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';

interface ChatInterfaceProps {
  conversation: Conversation;
  onSendMessage: (content: string) => void;
  sending?: boolean;
  className?: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatInterface({ conversation, onSendMessage, sending = false, className, onBack, showBackButton = false }: ChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.messages, sending]);

  const handleSend = () => {
    if (!message.trim() || sending) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.02)]', className)}>
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-background/40 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 h-9 w-9"
              aria-label="Voltar para agentes"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="relative">
            <Avatar className="w-11 h-11 ring-2 ring-emerald-500/30">
              <AvatarImage src={conversation.agentAvatar} alt={conversation.agentName} />
              <AvatarFallback className="bg-card">{conversation.agentName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', conversation.agentStatus === 'active' ? 'bg-emerald-400' : conversation.agentStatus === 'offline' ? 'bg-gray-500' : 'bg-amber-400')} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{conversation.agentName}</h3>
            <p className="text-xs text-muted-foreground truncate">Canal direto • {conversation.agentId}</p>
          </div>
        </div>

        <div className="text-xs px-2 py-1 rounded-full border border-border bg-background text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {sending ? 'Processando...' : 'Online'}
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-gradient-to-b from-background to-background/70">
        <div className="space-y-4">
          <AnimatePresence>
            {conversation.messages.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <p>Nenhuma mensagem ainda</p>
                <p className="text-sm">Comece uma conversa com {conversation.agentName}</p>
              </div>
            ) : (
              conversation.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-background/50">
        <div className="flex items-end gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Mensagem para ${conversation.agentName}...`}
            className="min-h-[46px] max-h-[140px] bg-background border-border resize-none rounded-xl"
            rows={1}
          />
          <Button onClick={handleSend} disabled={!message.trim() || sending} className="h-11 px-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('flex gap-3', message.isUser && 'flex-row-reverse')}
    >
      {!message.isUser && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={message.senderAvatar} alt={message.senderName} />
          <AvatarFallback className="bg-card text-xs">{message.senderName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn('max-w-[78%]', message.isUser && 'text-right')}>
        <div className={cn('inline-block px-4 py-2 rounded-2xl text-sm', message.isUser ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-background border border-border text-foreground rounded-bl-md')}>
          {message.content}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{format(new Date(message.timestamp), 'HH:mm')}</p>
      </div>
    </motion.div>
  );
}
