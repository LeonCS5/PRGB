import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ErrorNoticeProps {
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export const ErrorNotice: React.FC<ErrorNoticeProps> = ({
  message, onDismiss, actionLabel, onAction, actionDisabled
}) => (
  <div className="flex gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 text-left text-sm text-miss shadow-panel">
    <AlertCircle size={20} aria-hidden="true" className="shrink-0" />
    <div className="min-w-0 flex-1">
      <p role="alert" aria-atomic="true">{message}</p>
      {onAction && actionLabel && (
        <button type="button" onClick={onAction} disabled={actionDisabled}
          className="min-h-10 mt-2 rounded px-2 py-1 font-bold text-signal-300 underline hover:text-signal-200 focus-visible:outline-2 focus-visible:outline-signal-400 disabled:opacity-50 cursor-pointer">
          {actionLabel}
        </button>
      )}
    </div>
    <button type="button" onClick={onDismiss} aria-label="Dispensar aviso"
      className="flex size-10 shrink-0 items-center justify-center self-start rounded-xl hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-signal-400 cursor-pointer">
      <X size={18} aria-hidden="true" />
    </button>
  </div>
);
