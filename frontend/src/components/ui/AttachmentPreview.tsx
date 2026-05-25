'use client';
import { useState } from 'react';
import { Download, X, FileText, FileSpreadsheet, Presentation, File, ZoomIn } from 'lucide-react';
import type { TicketAttachment } from '@/types';

// ── ZIP download helper ───────────────────────────────────────────────────────

export async function downloadAllAsZip(attachments: TicketAttachment[], zipName = 'attachments.zip') {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  await Promise.all(
    attachments.map(async (a) => {
      const url = a.fileUrl ?? a.url ?? '';
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        zip.file(a.fileName, blob);
      } catch {
        // Skip files that fail to fetch (CORS etc.)
      }
    }),
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const href = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = href;
  link.download = zipName;
  link.click();
  URL.revokeObjectURL(href);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(a: TicketAttachment) {
  return a.fileUrl ?? a.url ?? '';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaKind(mimeType: string): 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'ppt' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'word';
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'excel';
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) return 'ppt';
  return 'other';
}

// ── Doc icon chip ─────────────────────────────────────────────────────────────

interface DocChipProps { attachment: TicketAttachment }

function DocChip({ attachment }: DocChipProps) {
  const url  = resolveUrl(attachment);
  const kind = mediaKind(attachment.mimeType);

  const meta: Record<string, { label: string; bg: string; text: string; Icon: any }> = {
    pdf:   { label: 'PDF',  bg: 'bg-red-50',    text: 'text-red-700',    Icon: FileText },
    word:  { label: 'DOCX', bg: 'bg-blue-50',   text: 'text-blue-700',   Icon: FileText },
    excel: { label: 'XLSX', bg: 'bg-green-50',  text: 'text-green-700',  Icon: FileSpreadsheet },
    ppt:   { label: 'PPTX', bg: 'bg-orange-50', text: 'text-orange-700', Icon: Presentation },
    other: { label: 'FILE', bg: 'bg-gray-50',   text: 'text-gray-700',   Icon: File },
  };

  const { label, bg, text, Icon } = meta[kind] ?? meta.other;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 ${bg} max-w-xs`}>
      <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${bg}`}>
        <Icon size={20} className={text} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 truncate" title={attachment.fileName}>
          {attachment.fileName}
        </p>
        <p className="text-xs text-gray-400">
          {label} · {formatBytes(attachment.fileSizeBytes)}
        </p>
      </div>
      <a
        href={url}
        download={attachment.fileName}
        target="_blank"
        rel="noreferrer"
        className={`flex-shrink-0 p-1.5 rounded-lg hover:bg-white transition-colors ${text}`}
        title="Download"
        onClick={e => e.stopPropagation()}
      >
        <Download size={15} />
      </a>
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps { src: string; alt: string; onClose: () => void }

function Lightbox({ src, alt, onClose }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AttachmentPreviewProps {
  attachment: TicketAttachment;
  /** Controls max image width. Defaults to 'md' */
  size?: 'sm' | 'md' | 'lg';
}

export function AttachmentPreview({ attachment, size = 'md' }: AttachmentPreviewProps) {
  const [lightbox, setLightbox] = useState(false);
  const url  = resolveUrl(attachment);
  const kind = mediaKind(attachment.mimeType);

  const maxW = { sm: 'max-w-[200px]', md: 'max-w-[320px]', lg: 'max-w-full' }[size];

  if (kind === 'image') {
    return (
      <>
        <div className={`relative group inline-block ${maxW} cursor-zoom-in`} onClick={() => setLightbox(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.fileName}
            className="rounded-xl border border-gray-200 object-cover w-full"
            style={{ maxHeight: 260 }}
          />
          {/* Hover overlay with zoom + download */}
          <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3">
            <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            <a
              href={url}
              download={attachment.fileName}
              target="_blank"
              rel="noreferrer"
              className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
              title="Download"
              onClick={e => e.stopPropagation()}
            >
              <Download size={20} />
            </a>
          </div>
          {/* Filename caption */}
          <p className="text-xs text-gray-400 mt-1 truncate">{attachment.fileName}</p>
        </div>
        {lightbox && <Lightbox src={url} alt={attachment.fileName} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (kind === 'video') {
    return (
      <div className={`${maxW} space-y-1`}>
        <video
          src={url}
          controls
          className="rounded-xl border border-gray-200 w-full bg-black"
          style={{ maxHeight: 280 }}
        />
        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs text-gray-400 truncate">{attachment.fileName}</p>
          <a href={url} download={attachment.fileName} target="_blank" rel="noreferrer"
            className="text-xs text-primary-600 hover:underline flex items-center gap-1 ml-2 flex-shrink-0">
            <Download size={11} /> Download
          </a>
        </div>
      </div>
    );
  }

  // PDF, DOCX, XLSX, PPTX, other — DocChip already has a download button
  return <DocChip attachment={attachment} />;
}

// ── Attachment list helper ────────────────────────────────────────────────────
// Renders all attachments for a comment, inline in the chat bubble.

interface CommentAttachmentsProps {
  attachments: TicketAttachment[];
  commentId: string;
}

export function CommentAttachments({ attachments, commentId }: CommentAttachmentsProps) {
  const mine = attachments.filter(a => a.commentId === commentId);
  if (!mine.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {mine.map(a => (
        <AttachmentPreview key={a.id} attachment={a} />
      ))}
    </div>
  );
}
