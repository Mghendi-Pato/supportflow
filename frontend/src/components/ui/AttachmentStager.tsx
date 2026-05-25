'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Upload, X, FileText, FileSpreadsheet, Presentation, File as FileIcon, Image, Film,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StagedFileKind = 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'ppt' | 'other';

export interface StagedFile {
  id: string;
  file: File;
  kind: StagedFileKind;
  previewUrl: string | null; // object URL for image / video, null for docs
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getKind(mime: string): StagedFileKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'word';
  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'excel';
  if (
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) return 'ppt';
  return 'other';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Individual staged-file thumbnail ─────────────────────────────────────────

interface ThumbProps {
  staged: StagedFile;
  onRemove: (id: string) => void;
}

const DOC_META: Record<string, { label: string; bg: string; text: string; Icon: any }> = {
  pdf:   { label: 'PDF',  bg: 'bg-red-50',    text: 'text-red-600',    Icon: FileText },
  word:  { label: 'DOCX', bg: 'bg-blue-50',   text: 'text-blue-600',   Icon: FileText },
  excel: { label: 'XLSX', bg: 'bg-green-50',  text: 'text-green-600',  Icon: FileSpreadsheet },
  ppt:   { label: 'PPTX', bg: 'bg-orange-50', text: 'text-orange-600', Icon: Presentation },
  other: { label: 'FILE', bg: 'bg-gray-50',   text: 'text-gray-600',   Icon: FileIcon },
};

function StagedThumb({ staged, onRemove }: ThumbProps) {
  const { id, file, kind, previewUrl } = staged;

  return (
    <div className="relative group w-24 flex-shrink-0">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <X size={11} />
      </button>

      {kind === 'image' && previewUrl ? (
        /* Image thumbnail */
        <div className="w-24 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : kind === 'video' && previewUrl ? (
        /* Video thumbnail — shows first frame */
        <div className="w-24 h-20 rounded-xl overflow-hidden border border-gray-200 bg-black relative">
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Film size={20} className="text-white drop-shadow" />
          </div>
        </div>
      ) : (
        /* Document chip */
        <div className={`w-24 h-20 rounded-xl border border-gray-200 flex flex-col items-center justify-center gap-1 ${DOC_META[kind]?.bg ?? 'bg-gray-50'}`}>
          {(() => {
            const { Icon, text } = DOC_META[kind] ?? DOC_META.other;
            return <Icon size={22} className={text} />;
          })()}
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            {DOC_META[kind]?.label ?? 'FILE'}
          </span>
        </div>
      )}

      {/* Filename + size */}
      <p className="mt-1 text-[10px] text-gray-500 truncate w-full text-center" title={file.name}>
        {file.name}
      </p>
      <p className="text-[10px] text-gray-400 text-center">{formatBytes(file.size)}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AttachmentStagerProps {
  /** Controlled list of staged files from the parent */
  files: StagedFile[];
  /** Called whenever the list changes (add or remove) */
  onChange: (files: StagedFile[]) => void;
  /** Max files allowed (default: unlimited) */
  maxFiles?: number;
  /** Max file size in bytes (default: 10 MB) */
  maxBytes?: number;
  /** Accept string passed to <input> */
  accept?: string;
}

export function AttachmentStager({
  files,
  onChange,
  maxFiles,
  maxBytes = 10 * 1024 * 1024,
  accept = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
}: AttachmentStagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState('');

  // Revoke object URLs when files are removed or component unmounts
  useEffect(() => {
    return () => {
      files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(rawFiles: FileList | File[]) {
    setSizeError('');
    const incoming = Array.from(rawFiles);

    const oversize = incoming.filter(f => f.size > maxBytes);
    if (oversize.length) {
      setSizeError(`${oversize.map(f => f.name).join(', ')} exceed${oversize.length === 1 ? 's' : ''} the ${formatBytes(maxBytes)} limit.`);
    }

    const valid = incoming.filter(f => f.size <= maxBytes);
    const available = maxFiles ? maxFiles - files.length : Infinity;
    const toAdd = valid.slice(0, available);

    const staged: StagedFile[] = toAdd.map(f => {
      const kind = getKind(f.type);
      const previewUrl = (kind === 'image' || kind === 'video') ? URL.createObjectURL(f) : null;
      return { id: crypto.randomUUID(), file: f, kind, previewUrl };
    });

    onChange([...files, ...staged]);

    // Reset input so same file can be re-added after removal
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(id: string) {
    const target = files.find(f => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter(f => f.id !== id));
  }

  const canAddMore = maxFiles == null || files.length < maxFiles;

  return (
    <div className="space-y-3">
      {/* Drop zone / add button */}
      {canAddMore && (
        <label
          className={`flex flex-col items-center justify-center gap-2 w-full px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm ${
            dragOver
              ? 'border-primary-400 bg-primary-50 text-primary-600'
              : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <Upload size={20} />
          <span>
            {files.length === 0
              ? 'Drag & drop files here, or click to browse'
              : 'Add more files'}
          </span>
          {maxFiles && (
            <span className="text-xs text-gray-400">{files.length}/{maxFiles} files</span>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
      )}

      {/* Size error */}
      {sizeError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X size={11} /> {sizeError}
        </p>
      )}

      {/* Thumbnail grid */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {files.map(sf => (
            <StagedThumb key={sf.id} staged={sf} onRemove={removeFile} />
          ))}
        </div>
      )}
    </div>
  );
}
