import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HEADER_SLOT_ID = 'header-slot';

/** Pinta su contenido en la parte derecha de la cabecera común del portal. */
export function HeaderSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.getElementById(HEADER_SLOT_ID)), []);
  return target ? createPortal(children, target) : null;
}
