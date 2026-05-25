'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { gql, useQuery, useMutation, useSubscription } from '@apollo/client';
import { formatDistanceToNow } from 'date-fns';
import { Send, Check, CheckCheck, Paperclip, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

// ── GraphQL operations ──────────────────────────────────────────────────────

const MESSAGES_QUERY = gql`
  query Messages($ticketId: ID!, $cursor: String, $limit: Int) {
    messages(ticketId: $ticketId, cursor: $cursor, limit: $limit) {
      hasMore
      nextCursor
      items {
        id
        ticketId
        content
        commentType
        createdAt
        author {
          id
          firstName
          lastName
          avatarUrl
        }
        receipts {
          userId
          status
          updatedAt
        }
      }
    }
  }
`;

const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      ticketId
      content
      commentType
      createdAt
      author {
        id
        firstName
        lastName
        avatarUrl
      }
      receipts {
        userId
        status
        updatedAt
      }
    }
  }
`;

const MARK_DELIVERED_MUTATION = gql`
  mutation MarkDelivered($ticketId: ID!) {
    markDelivered(ticketId: $ticketId)
  }
`;

const MARK_SEEN_MUTATION = gql`
  mutation MarkSeen($ticketId: ID!, $messageIds: [ID!]!) {
    markSeen(ticketId: $ticketId, messageIds: $messageIds)
  }
`;

const MESSAGE_SENT_SUBSCRIPTION = gql`
  subscription MessageSent($ticketId: ID!) {
    messageSent(ticketId: $ticketId) {
      id
      ticketId
      content
      commentType
      createdAt
      author {
        id
        firstName
        lastName
        avatarUrl
      }
      receipts {
        userId
        status
        updatedAt
      }
    }
  }
`;

const RECEIPT_UPDATED_SUBSCRIPTION = gql`
  subscription ReceiptUpdated($ticketId: ID!) {
    receiptUpdated(ticketId: $ticketId) {
      messageId
      userId
      status
    }
  }
`;

// ── Types ───────────────────────────────────────────────────────────────────

interface Receipt {
  userId: string;
  status: 'SENT' | 'DELIVERED' | 'SEEN';
  updatedAt: string;
}

interface Message {
  id: string;
  ticketId: string;
  content: string;
  commentType: 'PUBLIC' | 'INTERNAL';
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  receipts: Receipt[];
}

interface ChatPanelProps {
  ticketId: string;
  /** When true the user is a client — hides internal notes toggle */
  isClient?: boolean;
}

// ── Delivery status icon ─────────────────────────────────────────────────────

function DeliveryIcon({ receipts, authorId }: { receipts: Receipt[]; authorId: string }) {
  // Only show for the current author
  const others = receipts.filter((r) => r.userId !== authorId);
  if (!others.length) return <Check size={12} className="text-gray-300" />;

  const allSeen      = others.every((r) => r.status === 'SEEN');
  const anyDelivered = others.some((r) => r.status === 'DELIVERED' || r.status === 'SEEN');

  if (allSeen)      return <CheckCheck size={12} className="text-primary-500" aria-label="Seen" />;
  if (anyDelivered) return <CheckCheck size={12} className="text-gray-400"    aria-label="Delivered" />;
  return               <Check       size={12} className="text-gray-300"    aria-label="Sent" />;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ author }: { author: Message['author'] }) {
  if (author.avatarUrl) {
    return (
      <img
        src={author.avatarUrl}
        alt={`${author.firstName} ${author.lastName}`}
        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold flex-shrink-0">
      {author.firstName[0]}{author.lastName[0]}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatPanel({ ticketId, isClient = false }: ChatPanelProps) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [content, setContent]           = useState('');
  const [commentType, setCommentType]   = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [messages, setMessages]         = useState<Message[]>([]);
  const [nextCursor, setNextCursor]     = useState<string | undefined>();
  const [hasMore, setHasMore]           = useState(false);
  const seenRef                         = useRef<Set<string>>(new Set());

  // ── Query initial messages ─────────────────────────────────────────────
  // NOTE: onCompleted is deprecated in Apollo 3.11 and has known bugs — use
  // a useEffect watching `data` instead.
  const { loading, data: messagesData, fetchMore } = useQuery(MESSAGES_QUERY, {
    variables: { ticketId, limit: 30 },
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  });

  useEffect(() => {
    const page = messagesData?.messages;
    if (!page) return;
    setMessages(page.items);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  }, [messagesData]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE_MUTATION);
  const [markDelivered] = useMutation(MARK_DELIVERED_MUTATION);
  const [markSeen]      = useMutation(MARK_SEEN_MUTATION);

  // ── Subscriptions ─────────────────────────────────────────────────────
  useSubscription(MESSAGE_SENT_SUBSCRIPTION, {
    variables: { ticketId },
    errorPolicy: 'all',
    onData: ({ data }) => {
      const msg: Message = data.data?.messageSent;
      if (!msg) return;
      setMessages((prev) => {
        // Deduplicate
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
  });

  useSubscription(RECEIPT_UPDATED_SUBSCRIPTION, {
    variables: { ticketId },
    errorPolicy: 'all',
    onData: ({ data }) => {
      const events: { messageId: string; userId: string; status: string }[] =
        data.data?.receiptUpdated ?? [];

      setMessages((prev) =>
        prev.map((msg) => {
          const updates = events.filter((e) => e.messageId === msg.id);
          if (!updates.length) return msg;
          const updatedReceipts = msg.receipts.map((r) => {
            const upd = updates.find((e) => e.userId === r.userId);
            return upd ? { ...r, status: upd.status as Receipt['status'] } : r;
          });
          // Add new receipts that didn't exist yet
          updates.forEach((e) => {
            if (!updatedReceipts.some((r) => r.userId === e.userId)) {
              updatedReceipts.push({ userId: e.userId, status: e.status as Receipt['status'], updatedAt: new Date().toISOString() });
            }
          });
          return { ...msg, receipts: updatedReceipts };
        }),
      );
    },
  });

  // ── Mark delivered on mount ───────────────────────────────────────────
  useEffect(() => {
    markDelivered({ variables: { ticketId } }).catch(() => {
      // Fire-and-forget — delivery receipt failure is non-critical
    });
  }, [ticketId]); // eslint-disable-line

  // ── Mark visible messages as seen (IntersectionObserver) ─────────────
  const markVisibleSeen = useCallback(() => {
    const unseen = messages
      .filter(
        (m) =>
          m.author.id !== user?.id &&
          !seenRef.current.has(m.id) &&
          m.receipts.some(
            (r) => r.userId === user?.id && r.status !== 'SEEN',
          ),
      )
      .map((m) => m.id);

    if (!unseen.length) return;
    unseen.forEach((id) => seenRef.current.add(id));
    markSeen({ variables: { ticketId, messageIds: unseen } }).catch(() => {
      // Fire-and-forget — seen receipt failure is non-critical; undo optimistic add
      unseen.forEach((id) => seenRef.current.delete(id));
    });
  }, [messages, user?.id, ticketId, markSeen]);

  useEffect(() => {
    markVisibleSeen();
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]); // eslint-disable-line

  // ── Load more ────────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!hasMore || !nextCursor) return;
    const { data } = await fetchMore({
      variables: { ticketId, cursor: nextCursor, limit: 30 },
    });
    const page = data?.messages;
    if (!page) return;
    setMessages((prev) => [...page.items, ...prev]);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  };

  // ── Send ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    try {
      await sendMessage({
        variables: {
          input: { ticketId, content: trimmed, commentType },
        },
      });
      setContent('');
    } catch (err) {
      console.error('Send message failed', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              className="text-xs text-primary-600 hover:underline"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {loading && !messages.length && (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.author.id === user?.id;
          const isInternal = msg.commentType === 'INTERNAL';

          return (
            <div
              key={msg.id}
              className={clsx(
                'flex items-end gap-2',
                isOwn ? 'justify-end' : 'justify-start',
              )}
            >
              {/* Avatar — other party */}
              {!isOwn && <Avatar author={msg.author} />}

              <div className={clsx('max-w-[70%] space-y-0.5', isOwn && 'items-end flex flex-col')}>
                {/* Author name — only for staff side on non-own messages */}
                {!isOwn && (
                  <p className="text-xs text-gray-500 px-1">
                    {msg.author.firstName} {msg.author.lastName}
                  </p>
                )}

                {/* Bubble */}
                <div
                  className={clsx(
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    isOwn
                      ? isInternal
                        ? 'bg-amber-100 text-amber-900 rounded-br-sm'
                        : 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm',
                  )}
                >
                  {/* Internal badge */}
                  {isInternal && (
                    <span className="flex items-center gap-1 text-xs text-amber-700 font-medium mb-1">
                      <Lock size={10} /> Internal note
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>

                {/* Timestamp + delivery status */}
                <div
                  className={clsx(
                    'flex items-center gap-1 px-1',
                    isOwn ? 'justify-end' : 'justify-start',
                  )}
                >
                  <span className="text-[10px] text-gray-400">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                  {isOwn && (
                    <DeliveryIcon receipts={msg.receipts} authorId={user!.id} />
                  )}
                </div>
              </div>

              {/* Avatar — own messages */}
              {isOwn && <Avatar author={msg.author} />}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        {/* Internal / Public toggle — staff only */}
        {!isClient && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setCommentType('PUBLIC')}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                commentType === 'PUBLIC'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              Reply to client
            </button>
            <button
              onClick={() => setCommentType('INTERNAL')}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
                commentType === 'INTERNAL'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Lock size={10} /> Internal note
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              commentType === 'INTERNAL'
                ? 'Write an internal note (only visible to staff)…'
                : 'Write a message… (Enter to send, Shift+Enter for new line)'
            }
            rows={1}
            className={clsx(
              'flex-1 resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all',
              commentType === 'INTERNAL'
                ? 'border-amber-300 focus:ring-amber-300 bg-amber-50'
                : 'border-gray-200 focus:ring-primary-300 bg-white',
            )}
            style={{ minHeight: '40px', maxHeight: '120px' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            isLoading={sending}
            disabled={!content.trim()}
            className="h-10 w-10 p-0 flex items-center justify-center rounded-xl"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
