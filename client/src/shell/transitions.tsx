import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/*
 * Orquestación en React de las recetas de transitions.dev (estilos en styles/transitions.css).
 */

/** Text states swap, solo la entrada: el texto nuevo sube desde abajo con desenfoque. Cambia la `key` para repetirlo. */
export function SwapIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    void el.offsetHeight; // fija el estado inicial para que quitar la clase se anime
    el.classList.remove('is-enter-start');
  }, []);
  return (
    <span ref={ref} className={`t-text-swap is-enter-start ${className}`}>
      {children}
    </span>
  );
}

/**
 * Toast open / close: entra al montarse y, con `closeAfterMs`, sale sola antes de que la quiten
 * (el cierre usa el reloj corto, --toast-close).
 */
export function Toast({
  children,
  className = '',
  closeAfterMs,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  closeAfterMs?: number;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    // Igual que useReveal: reflow en lugar de requestAnimationFrame, para que se vea siempre.
    void document.body.offsetHeight;
    setOpen(true);
    const timer = closeAfterMs === undefined ? undefined : window.setTimeout(() => setOpen(false), closeAfterMs);
    return () => window.clearTimeout(timer);
  }, [closeAfterMs]);
  return (
    <div className={`t-toast ${open ? 'is-open' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

function sharedPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Number pop-in: cuando el valor cambia, las cifras nuevas entran con un salto desenfocado;
 * las del principio que no cambian se quedan quietas.
 */
export function PopNumber({ value }: { value: string }) {
  const [state, setState] = useState({ shown: value, same: value.length, run: 0 });
  if (state.shown !== value) {
    // Estado derivado del valor anterior: React vuelve a renderizar antes de pintar.
    setState({ shown: value, same: sharedPrefix(state.shown, value), run: state.run + 1 });
  }
  const chars = state.shown.split('');
  return (
    <span className={`t-digit-group ${state.run > 0 ? 'is-animating' : ''}`}>
      {chars.map((ch, i) => (
        <span
          // Una key nueva en cada cambio vuelve a montar las cifras y repite la animación.
          key={`${state.run}-${i}`}
          className="t-digit"
          data-same={i < state.same ? '' : undefined}
          data-stagger={i === chars.length - 2 ? '1' : i === chars.length - 1 ? '2' : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

/**
 * Texts reveal: clase para el contenedor; sus elementos `.t-stagger-line` entran escalonados
 * al montarse (cada uno con su `revealDelay`).
 */
export function useReveal(): string {
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    // Sin requestAnimationFrame: en pestañas en segundo plano no se dispara y el texto quedaría
    // invisible. Basta con fijar el estilo inicial (reflow) antes de añadir la clase.
    void document.body.offsetHeight;
    setShown(true);
  }, []);
  return shown ? 't-stagger is-shown' : 't-stagger';
}

/** Retraso de la línea número `index` (0, 1, 2…) dentro de un contenedor con useReveal. */
export function revealDelay(index: number): CSSProperties {
  return { transitionDelay: `calc(var(--stagger-stagger) * ${index})` };
}

function cssMs(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Error state shake sobre el elemento `.t-input` del ref: sacude y marca `.is-error`
 * durante --revert-hold. `clear()` quita el error antes (p. ej. al volver a escribir).
 */
export function useShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const timer = useRef<number>();

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    ref.current?.classList.remove('is-error');
  }, []);

  const shake = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-shaking');
    void el.offsetWidth; // reinicia la animación aunque ya estuviera sacudiéndose
    el.classList.add('is-shaking', 'is-error');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => el.classList.remove('is-error'), cssMs('--revert-hold', 3000));
  }, []);

  useEffect(() => {
    const el = ref.current;
    const done = () => el?.classList.remove('is-shaking');
    el?.addEventListener('animationend', done);
    return () => {
      el?.removeEventListener('animationend', done);
      window.clearTimeout(timer.current);
    };
  }, []);

  return { ref, shake, clear };
}

/**
 * Tabs sliding para un selector `.segmented` con una `<span className="t-tabs-pill" />` dentro:
 * coloca la píldora bajo la opción con aria-pressed="true" y la desliza cuando cambia `active`.
 * Al montar y al redimensionar se coloca sin animación.
 */
export function useSlidingPill<T extends HTMLElement>(active: unknown) {
  const ref = useRef<T>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const bar = ref.current;
    const pill = bar?.querySelector<HTMLElement>('.t-tabs-pill');
    if (!bar || !pill) return;

    const place = (animate: boolean) => {
      const tab = bar.querySelector<HTMLElement>('[aria-pressed="true"]');
      pill.style.opacity = tab ? '1' : '0';
      if (!tab) return;
      if (!animate) pill.style.transition = 'none';
      pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      pill.style.height = `${tab.offsetHeight}px`;
      if (!animate) {
        void pill.offsetWidth;
        pill.style.transition = '';
      }
    };

    place(placed.current);
    placed.current = true;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [active]);

  return ref;
}
