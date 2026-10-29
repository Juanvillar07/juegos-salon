import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { ChatIcon, LockIcon, QrIcon } from './icons';
import styles from './InvitePanel.module.css';

interface Props {
  /** Enlace de la sala (sin contraseña: se pide al entrar). */
  link: string;
  code: string;
  gameName: string;
  locked: boolean;
}

/** Invitar a la sala: copiar el enlace, compartirlo por WhatsApp o mostrar un QR para quien está al lado. */
export default function InvitePanel({ link, code, gameName, locked }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`¡Únete a mi sala de ${gameName}! ${link}`)}`;

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible: el enlace se puede compartir por WhatsApp o con el QR
    }
  };

  return (
    <div className={styles.invite}>
      <button className="btn" onClick={copy}>
        {copied ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
      <a
        className={`btn ${styles.icon}`}
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir por WhatsApp"
        title="Compartir por WhatsApp"
      >
        <ChatIcon />
      </a>
      <button className={`btn ${styles.icon}`} onClick={() => setQrOpen(true)} aria-label="Mostrar código QR" title="Código QR">
        <QrIcon />
      </button>

      {qrOpen && (
        <div className={styles.backdrop} onClick={() => setQrOpen(false)}>
          <div
            className={styles.card}
            role="dialog"
            aria-modal="true"
            aria-label={`Código QR de la sala ${code}`}
            onClick={(e) => e.stopPropagation()}
          >
            <QrCode text={link} />
            <span className={`${styles.code} num`}>{code}</span>
            <p className="muted">Escanéalo con la cámara del móvil para entrar a la sala.</p>
            {locked && (
              <p className={styles.locked}>
                <LockIcon /> La sala tiene contraseña: dísela a quien invites.
              </p>
            )}
            <button className="btn wide" onClick={() => setQrOpen(false)} autoFocus>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** QR como SVG: siempre negro sobre blanco (con su margen) para que la cámara lo lea en cualquier tema. */
function QrCode({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
    return { size: n, path: d };
  }, [text]);
  const margin = 3;
  return (
    <svg
      className={styles.qr}
      viewBox={`${-margin} ${-margin} ${size + margin * 2} ${size + margin * 2}`}
      role="img"
      aria-label="Código QR de la sala"
      shapeRendering="crispEdges"
    >
      <rect x={-margin} y={-margin} width={size + margin * 2} height={size + margin * 2} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
