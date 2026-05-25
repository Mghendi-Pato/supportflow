import { TextareaHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'w-full px-3 py-2 text-sm border rounded-lg shadow-sm transition-colors resize-y min-h-[80px]',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
