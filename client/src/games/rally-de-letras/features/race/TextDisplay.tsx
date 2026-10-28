import { useLayoutEffect, useRef } from 'react';
import styles from './Race.module.css';

interface Props {
  text: string;
  /** Caracteres de las palabras ya completadas. */
  committed: number;
  /** Cuántos caracteres del input actual coinciden con el texto. */
  correctInWord: number;
  /** Longitud del input actual. */
  typedInWord: number;
}

/** Texto de la carrera: lo escrito resalta, los errores en rojo y un cursor en la letra actual. */
export default function TextDisplay({ text, committed, correctInWord, typedInWord }: Props) {
  const correctEnd = committed + correctInWord;
  const typedEnd = Math.min(text.length, committed + typedInWord);
  const boxRef = useRef<HTMLParagraphElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  // La caja muestra pocas líneas: se desplaza para dejar la línea actual como segunda visible
  // (así también se ve la anterior) cuando el texto no cabe entero.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const caret = caretRef.current;
    if (!box || !caret) return;
    const lineHeight = parseFloat(getComputedStyle(box).lineHeight) || caret.offsetHeight;
    // Siempre en líneas enteras, para no dejar ninguna cortada.
    const line = Math.round(caret.offsetTop / lineHeight);
    box.scrollTop = Math.max(0, (line - 1) * lineHeight);
  }, [typedEnd]);

  return (
    <p className={styles.text} ref={boxRef}>
      {Array.from(text).map((ch, i) => {
        let cls = '';
        if (i < correctEnd) cls = styles.done;
        else if (i < typedEnd) cls = styles.wrong;
        else if (i === typedEnd) cls = styles.current;
        return (
          <span key={i} className={cls} ref={i === typedEnd ? caretRef : undefined}>
            {ch}
          </span>
        );
      })}
    </p>
  );
}
