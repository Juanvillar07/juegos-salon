import { useEffect, useRef } from 'react';
import { PROGRESS_THROTTLE_MS } from '@typeracer/shared';
import { sendProgress, serverNow } from '../../state/store';

const RETRY_MS = 1000;

/**
 * Envía el progreso al servidor como mucho cada PROGRESS_THROTTLE_MS, no en cada tecla.
 * Si el servidor no confirmó el avance (p. ej. lo rechazó por ir demasiado rápido), se reintenta.
 */
export function useProgressSync(startAt: number, correctChars: number, errors: number, serverProgress: number): void {
  const latest = useRef({ correctChars, errors, serverProgress });
  latest.current = { correctChars, errors, serverProgress };

  useEffect(() => {
    // Lo que el servidor ya tiene cuenta como enviado (importa al volver tras recargar).
    let sent = { chars: latest.current.serverProgress, errors: -1, at: 0 };
    const id = setInterval(() => {
      if (serverNow() < startAt) return;
      const { correctChars: chars, errors: errs, serverProgress: confirmed } = latest.current;
      const changed = chars !== sent.chars || errs !== sent.errors;
      const unconfirmed = chars > confirmed && Date.now() - sent.at > RETRY_MS;
      if (!changed && !unconfirmed) return;
      sendProgress(chars, errs);
      sent = { chars, errors: errs, at: Date.now() };
    }, PROGRESS_THROTTLE_MS);
    return () => clearInterval(id);
  }, [startAt]);
}
