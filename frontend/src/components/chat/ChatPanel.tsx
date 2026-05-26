'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { gql, useQuery, useMutation, useSubscription } from '@apollo/client';
import { formatDistanceToNow } from 'date-fns';
import { Send, Check, CheckCheck, Paperclip, Lock, X, FileText, Download, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

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
        attachments {
          id
          fileName
          fileUrl
          mimeType
          fileSizeBytes
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
      attachments {
        id
        fileName
        fileUrl
        mimeType
        fileSizeBytes
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
      attachments {
        id
        fileName
        fileUrl
        mimeType
        fileSizeBytes
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

interface MessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
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
  attachments: MessageAttachment[];
}

interface StagedAttachment {
  localId: string;
  file: File;
  previewUrl?: string;
  /** Set only if the individual file failed to upload when Send was clicked */
  error?: string;
}

interface ChatPanelProps {
  ticketId: string;
  /** When true the user is a client — hides internal notes toggle */
  isClient?: boolean;
  /** When provided, a "Request Payment" button appears in the bottom bar (staff only) */
  onRequestPayment?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

// ── Delivery status icon ─────────────────────────────────────────────────────

function DeliveryIcon({ receipts, authorId }: { receipts: Receipt[]; authorId: string }) {
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

// ── Attachment bubble (inside message) ───────────────────────────────────────

function AttachmentBubble({ attachment, isOwn }: { attachment: MessageAttachment; isOwn: boolean }) {
  if (isImage(attachment.mimeType)) {
    return (
      // No filename label — the image speaks for itself; URLs would be noisy
      <div className="mt-1.5 relative group inline-block">
        <img
          src={attachment.fileUrl}
          alt={attachment.fileName}
          className="max-w-[220px] max-h-[200px] rounded-xl object-cover border border-black/5 block"
        />
        {/* Hover overlay — open + download */}
        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-2.5 pointer-events-none group-hover:pointer-events-auto">
          <a
            href={attachment.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full size"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-white drop-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </a>
          <a
            href={attachment.fileUrl}
            download={attachment.fileName}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-white drop-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={18} />
          </a>
        </div>
      </div>
    );
  }

  // File card (PDF, docs, etc.) — uses muted primary tones on own-messages (light bg)
  return (
    <div
      className={clsx(
        'flex items-center gap-2 mt-1.5 rounded-xl px-3 py-2 text-xs',
        isOwn
          ? 'bg-primary-200/50 text-primary-900 border border-primary-200'
          : 'bg-white border border-gray-200 text-gray-700',
      )}
    >
      <FileText size={14} className="flex-shrink-0 opacity-70" />
      <span className="flex flex-col min-w-0 flex-1">
        <span className="truncate font-medium max-w-[140px]">{attachment.fileName}</span>
        <span className={clsx('text-[10px]', isOwn ? 'text-primary-500' : 'text-gray-400')}>
          {formatBytes(attachment.fileSizeBytes)}
        </span>
      </span>
      <a
        href={attachment.fileUrl}
        download={attachment.fileName}
        target="_blank"
        rel="noopener noreferrer"
        title="Download"
        className={clsx(
          'flex-shrink-0 p-1 rounded-lg transition-colors',
          isOwn
            ? 'text-primary-500 hover:text-primary-700 hover:bg-primary-200'
            : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={14} />
      </a>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatPanel({ ticketId, isClient = false, onRequestPayment }: ChatPanelProps) {
  const { user }            = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const bottomRef           = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);

  const [content, setContent]           = useState('');
  const [commentType, setCommentType]   = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [messages, setMessages]         = useState<Message[]>([]);
  const [nextCursor, setNextCursor]     = useState<string | undefined>();
  const [hasMore, setHasMore]           = useState(false);
  const [staged, setStaged]             = useState<StagedAttachment[]>([]);
  const [isSending, setIsSending]       = useState(false);
  const seenRef                         = useRef<Set<string>>(new Set());
  // Guard: only initialise messages from the query ONCE per mount.
  // Without this, every Apollo cache update (e.g. from fetchMore) would
  // re-run setMessages and overwrite the accumulated local state.
  const initialLoadRef                  = useRef(false);

  // ── Query initial messages ─────────────────────────────────────────────
  const { loading, data: messagesData, fetchMore } = useQuery(MESSAGES_QUERY, {
    variables: { ticketId, limit: 30 },
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
    onError: (err) => {
      enqueueSnackbar(`Could not load messages: ${err.message}`, { variant: 'error' });
    },
  });

  useEffect(() => {
    const page = messagesData?.messages;
    if (!page) return;
    // Only seed local state from the query on the very first data arrival.
    // Subsequent cache writes (e.g. from fetchMore) must not overwrite the
    // accumulated local message list — loadMore manages its own state update.
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    setMessages(page.items);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  }, [messagesData]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const [sendMessage] = useMutation(SEND_MESSAGE_MUTATION);
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
          updates.forEach((e) => {
            if (!updatedReceipts.some((r) => r.userId === e.userId)) {
              updatedReceipts.push({
                userId: e.userId,
                status: e.status as Receipt['status'],
                updatedAt: new Date().toISOString(),
              });
            }
          });
          return { ...msg, receipts: updatedReceipts };
        }),
      );
    },
  });

  // ── Mark delivered on mount ───────────────────────────────────────────
  useEffect(() => {
    markDelivered({ variables: { ticketId } }).catch(() => {});
  }, [ticketId]); // eslint-disable-line

  // ── Mark visible messages as seen ────────────────────────────────────
  const markVisibleSeen = useCallback(() => {
    const unseen = messages
      .filter(
        (m) =>
          m.author.id !== user?.id &&
          !seenRef.current.has(m.id) &&
          m.receipts.some((r) => r.userId === user?.id && r.status !== 'SEEN'),
      )
      .map((m) => m.id);

    if (!unseen.length) return;
    unseen.forEach((id) => seenRef.current.add(id));
    markSeen({ variables: { ticketId, messageIds: unseen } }).catch(() => {
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
    // Deduplicate: the Apollo cache merge may include items already in local
    // state, so only prepend genuinely new messages.
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newItems = (page.items as Message[]).filter((m) => !existingIds.has(m.id));
      return [...newItems, ...prev];
    });
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
  };

  // ── File select — stage locally, upload on send ───────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';

    const newStaged: StagedAttachment[] = files.map((file) => ({
      localId: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: isImage(file.type) ? URL.createObjectURL(file) : undefined,
    }));

    setStaged((prev) => [...prev, ...newStaged]);
  };

  const removeStaged = (localId: string) => {
    setStaged((prev) => {
      const item = prev.find((s) => s.localId === localId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((s) => s.localId !== localId);
    });
  };

  // ── Derived state ─────────────────────────────────────────────────────
  const hasContent     = content.trim().length > 0;
  const isSendDisabled = (!hasContent && staged.length === 0) || isSending;

  // ── Send — upload staged files then send message atomically ──────────
  const handleSend = async () => {
    if (isSendDisabled) return;

    const trimmed = content.trim();
    setIsSending(true);

    try {
      // 1. Upload any staged files first
      let attachmentIds: string[] | undefined;
      if (staged.length > 0) {
        const uploads = await Promise.all(
          staged.map(async (s) => {
            const formData = new FormData();
            formData.append('file', s.file);
            const res = await api.post(`/uploads/tickets/${ticketId}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            // ResponseInterceptor wraps REST responses: { success, data, timestamp }
            // so the actual attachment object is at res.data.data
            return (res.data?.data?.id ?? res.data?.id) as string;
          }),
        );
        attachmentIds = uploads.filter(Boolean);
      }

      // 2. Send the message (text + uploaded attachment IDs)
      await sendMessage({
        variables: {
          input: {
            ticketId,
            content:       trimmed || undefined,
            commentType,
            attachmentIds: attachmentIds?.length ? attachmentIds : undefined,
          },
        },
      });

      // 3. Clear on success
      setContent('');
      staged.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
      setStaged([]);
    } catch (err: any) {
      // Distinguish upload errors from GraphQL errors
      const msg =
        err?.response?.data?.message ??       // Axios upload error
        err?.graphQLErrors?.[0]?.message ??   // Apollo GraphQL error
        err?.networkError?.message ??
        err?.message ??
        'Failed to send message';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSendDisabled) void handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

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
          const isOwn      = msg.author.id === user?.id;
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
                {/* Author name — only for non-own messages */}
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
                        : 'bg-primary-100 text-primary-900 rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm',
                  )}
                >
                  {/* Internal badge */}
                  {isInternal && (
                    <span className="flex items-center gap-1 text-xs text-amber-700 font-medium mb-1">
                      <Lock size={10} /> Internal note
                    </span>
                  )}

                  {/* Text content */}
                  {msg.content && (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}

                  {/* Message-linked attachments, in chronological order within the bubble */}
                  {(msg.attachments ?? []).map((att) => (
                    <AttachmentBubble key={att.id} attachment={att} isOwn={isOwn} />
                  ))}
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

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        {/* Internal / Public toggle — staff only */}
        {!isClient && (
          <div className="flex items-center gap-2 mb-2">
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
            {onRequestPayment && (
              <button
                onClick={onRequestPayment}
                className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-green-700 hover:bg-green-50 transition-colors border border-green-200"
              >
                <DollarSign size={10} /> Request Payment
              </button>
            )}
          </div>
        )}

        {/* Staged attachments preview strip — files queued for send */}
        {staged.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {staged.map((s) => (
              <div
                key={s.localId}
                className={clsx(
                  'relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs',
                  s.error
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-primary-100 bg-primary-50 text-primary-800',
                )}
              >
                {/* Thumbnail (images) or file icon */}
                {s.previewUrl ? (
                  <img
                    src={s.previewUrl}
                    alt={s.file.name}
                    className="h-8 w-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <FileText size={14} className="flex-shrink-0 text-primary-400" />
                )}

                <span className="flex flex-col">
                  <span className="max-w-[120px] truncate font-medium">{s.file.name}</span>
                  {s.error
                    ? <span className="text-[10px] text-red-500">{s.error}</span>
                    : <span className="text-[10px] text-primary-400">{formatBytes(s.file.size)}</span>
                  }
                </span>

                {/* Remove button — disabled while sending */}
                <button
                  onClick={() => removeStaged(s.localId)}
                  disabled={isSending}
                  className="ml-1 text-primary-300 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text input row */}
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a file (images or PDF)"
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-primary-600 hover:border-primary-300 transition-colors"
          >
            <Paperclip size={16} />
          </button>

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
            onClick={() => void handleSend()}
            isLoading={isSending}
            disabled={isSendDisabled}
            title="Send message"
            className="h-10 w-10 p-0 flex items-center justify-center rounded-xl flex-shrink-0"
          >
            {!isSending && <Send size={16} />}
          </Button>
        </div>

        {isSending && staged.length > 0 && (
          <p className="text-[10px] text-primary-500 mt-1.5 text-center">
            Uploading attachments and sending…
          </p>
        )}
      </div>
    </div>
  );
}
