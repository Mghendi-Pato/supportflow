'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Heading2, Minus, RotateCcw, RotateCw,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // don't blur editor
        onClick();
      }}
      className={`h-7 w-7 flex items-center justify-center rounded-lg text-sm transition-colors
        ${active
          ? 'bg-primary-100 text-primary-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder, error, disabled }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading levels we don't need
        heading: { levels: [2, 3] },
        // Keep: bold, italic, bulletList, orderedList, blockquote, code, codeBlock, horizontalRule
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Write your description here…',
      }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      // Return empty string instead of bare <p></p> so validation works correctly
      const html = editor.isEmpty ? '' : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[120px] px-3.5 py-3 text-sm text-gray-900 leading-relaxed',
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className={`rounded-xl border bg-gray-50 transition overflow-hidden
        ${error
          ? 'border-red-400'
          : 'border-gray-200 focus-within:border-primary-500 focus-within:bg-white'
        }
        ${disabled ? 'opacity-60' : ''}
      `}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white flex-wrap">
        <ToolbarButton
          title="Bold (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={13} />
        </ToolbarButton>

        <ToolbarButton
          title="Italic (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          title="Heading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={13} />
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton
          title="Divider line"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={13} />
        </ToolbarButton>

        {/* Undo / redo pushed to right */}
        <div className="flex-1" />

        <ToolbarButton
          title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <RotateCcw size={12} />
        </ToolbarButton>

        <ToolbarButton
          title="Redo (Ctrl+Y)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RotateCw size={12} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {error && <p className="px-3.5 pb-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
