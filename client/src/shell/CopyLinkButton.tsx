import { useState } from 'react';

/** Copia el enlace de la sala para invitar a otros. */
export default function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible: el código de la sala sigue visible para compartirlo
    }
  };

  return (
    <button className="btn" onClick={copy}>
      {copied ? 'Enlace copiado' : 'Copiar enlace'}
    </button>
  );
}
