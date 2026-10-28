import { useEffect, useState } from 'react';
import { serverNow } from '../../state/store';

/** Hora del servidor que se actualiza cada `intervalMs`, para cuentas regresivas y WPM en vivo. */
export function useServerClock(intervalMs = 100): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
