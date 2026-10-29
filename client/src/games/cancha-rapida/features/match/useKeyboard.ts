import { useEffect, useRef } from 'react';
import { KEY } from '@typeracer/shared/cancha-rapida';
import { sendInput } from '../../state/store';

/** Teclas del partido: flechas o WASD para moverse; X o espacio para patear. */
const CODES: Record<string, number> = {
  ArrowUp: KEY.up,
  KeyW: KEY.up,
  ArrowDown: KEY.down,
  KeyS: KEY.down,
  ArrowLeft: KEY.left,
  KeyA: KEY.left,
  ArrowRight: KEY.right,
  KeyD: KEY.right,
  KeyX: KEY.kick,
  Space: KEY.kick,
};

/** ¿Se está escribiendo en un campo (el chat)? Entonces las teclas no mueven al jugador. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

/**
 * Lleva el estado de las teclas como máscara de bits: se manda al servidor solo cuando cambia y
 * queda en la ref para la predicción del jugador propio. Al perder el foco (otra ventana, otra
 * pestaña, el chat) se sueltan todas: si no, el jugador seguiría corriendo solo.
 */
export function useKeyboard(enabled: boolean) {
  const keys = useRef(0);

  useEffect(() => {
    const pressed = new Set<string>();
    const update = () => {
      let mask = 0;
      for (const code of pressed) mask |= CODES[code];
      keys.current = mask;
      sendInput(mask);
    };
    const release = () => {
      pressed.clear();
      update();
    };
    if (!enabled) {
      release();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const bit = CODES[e.code];
      if (!bit || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (pressed.has(e.code)) return;
      pressed.add(e.code);
      update();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (pressed.delete(e.code)) update();
    };
    const onVisibility = () => {
      if (document.hidden) release();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isTyping(e.target)) release();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocusIn);
      release();
    };
  }, [enabled]);

  return keys;
}
