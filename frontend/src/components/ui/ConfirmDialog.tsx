'use client';
import { AlertTriangle, Info, LogOut, Trash2, X } from 'lucide-react';
import { Button } from './Button';

export type ConfirmVariant = 'danger' | 'warning' | 'default';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  Icon: React.ElementType;
  confirmBg: string;
}> = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    Icon: Trash2,
    confirmBg: 'danger',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    confirmBg: 'primary',
  },
  default: {
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    Icon: Info,
    confirmBg: 'primary',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  isLoading    = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const { iconBg, iconColor, Icon, confirmBg } = VARIANT_STYLES[variant];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
    >
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-auto p-6 flex flex-col gap-4">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
        >
          <X size={18} />
        </button>

        {/* Icon + title */}
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon size={26} className={iconColor} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmBg as any}
            className="flex-1"
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
