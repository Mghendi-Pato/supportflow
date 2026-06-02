interface Props {
  html: string;
  className?: string;
}

/**
 * Renders rich-text HTML (produced by RichTextEditor / Tiptap) with
 * consistent prose styling that matches the app's design system.
 * Falls back to plain whitespace-preserved text for legacy plain-text descriptions.
 */
export function RichTextContent({ html, className = '' }: Props) {
  // If it doesn't look like HTML, treat as plain text (backward compat)
  const isHtml = html?.trim().startsWith('<');

  if (!isHtml) {
    return (
      <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${className}`}>
        {html}
      </p>
    );
  }

  return (
    <div
      className={`rich-content text-sm text-gray-700 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
