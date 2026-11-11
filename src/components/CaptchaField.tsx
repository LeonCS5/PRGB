import React, { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { secondaryButton } from './rankingStyles';
import { renderCaptcha, type CaptchaWidget } from '../services/turnstile';

export interface CaptchaFieldProps {
  siteKey: string;
  onToken: (token: string | null) => void; // null: no valid token right now
}

type CaptchaStatus = 'loading' | 'ready' | 'failed';

// Remount it (change its key) to ask for a new token after one was spent
export const CaptchaField: React.FC<CaptchaFieldProps> = ({ siteKey, onToken }) => {
  const labelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CaptchaWidget | null>(null);
  const [status, setStatus] = useState<CaptchaStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const reportToken = useEffectEvent(onToken);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let widget: CaptchaWidget | null = null;
    const abort = new AbortController();
    renderCaptcha(container, {
      siteKey,
      signal: abort.signal,
      onToken: (token) => {
        if (!active) return;
        setStatus('ready');
        reportToken(token);
      },
      onExpire: () => {
        if (active) reportToken(null);
      },
      onError: () => {
        if (!active) return;
        reportToken(null);
        setStatus('failed');
      }
    }).then((rendered) => {
      if (!active) {
        rendered?.remove();
        return;
      }
      widget = rendered;
      widgetRef.current = rendered;
      setStatus((current) => current === 'loading' ? 'ready' : current);
    }, () => {
      if (active) setStatus('failed');
    });
    return () => {
      active = false;
      abort.abort();
      widget?.remove();
      widgetRef.current = null;
      reportToken(null);
    };
  }, [siteKey, attempt]);

  const retry = () => {
    setStatus('loading');
    // The prop, not the effect event: effect events can only be called from effects
    onToken(null);
    // A rendered widget asks for a new challenge; a script that never loaded is tried again
    if (widgetRef.current) widgetRef.current.reset();
    else setAttempt((value) => value + 1);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="rounded-xl border border-ink-700 bg-ink-850 p-3">
      <p id={labelId} className="text-xs leading-5 text-ink-300">Verificação contra robôs, feita pela Cloudflare.</p>
      <div ref={containerRef} className="mt-2 min-h-16" />
      {status === 'loading' && (
        <p className="flex items-center gap-2 text-xs text-ink-300">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Carregando a verificação…
        </p>
      )}
      {status === 'failed' && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-xs leading-5 text-miss">Não foi possível fazer a verificação. Confira sua internet.</p>
          <button type="button" onClick={retry} className={secondaryButton}>
            <RotateCcw size={16} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
};
