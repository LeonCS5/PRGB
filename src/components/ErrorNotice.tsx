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
  <div className="flex gap-3 rounded-xl border border-rose-500/50 bg-slate-950 p-4 text-left text-sm text-rose-200 shadow-xl">
    <AlertCircle size={20} aria-hidden="true" className="shrink-0" />
    <div className="min-w-0 flex-1">
      <p role="alert" aria-atomic="true">{message}</p>
      {onAction && actionLabel && (
        <button type="button" onClick={onAction} disabled={actionDisabled}
          className="mt-2 rounded px-2 py-1 font-bold text-cyan-300 underline hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-50 cursor-pointer">
          {actionLabel}
        </button>
      )}
    </div>
    <button type="button" onClick={onDismiss} aria-label="Dispensar aviso"
      className="self-start rounded p-1 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-400 cursor-pointer">
      <X size={18} aria-hidden="true" />
    </button>
  </div>
);
