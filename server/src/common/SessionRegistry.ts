import { randomUUID } from 'node:crypto';

export interface Session {
  /** Secreto que guarda el cliente (sessionStorage) para recuperar su identidad al recargar. */
  sessionId: string;
  /** Id público del jugador, el que ven los demás. */
  playerId: string;
  /** Socket actualmente asociado a la sesión, o null si está desconectada. */
  socketId: string | null;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/** Relaciona sesiones (estables entre recargas) con sockets (efímeros). */
export class SessionRegistry {
  private sessions = new Map<string, Session>();

  constructor(private newId: () => string = randomUUID) {}

  get size(): number {
    return this.sessions.size;
  }

  /** Recupera la sesión pedida por el cliente o crea una nueva si no existe o no es válida. */
  resolve(requested: unknown): Session {
    if (typeof requested === 'string' && SESSION_ID_PATTERN.test(requested)) {
      return this.sessions.get(requested) ?? this.create(requested);
    }
    return this.create(this.newId());
  }

  /** Asocia un socket a la sesión. Devuelve el socket anterior si seguía conectado. */
  attach(session: Session, socketId: string): string | null {
    const previous = session.socketId;
    session.socketId = socketId;
    return previous !== null && previous !== socketId ? previous : null;
  }

  /** Desasocia el socket. Devuelve false si la sesión ya pertenece a otro socket más nuevo. */
  detach(sessionId: string, socketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.socketId !== socketId) return false;
    session.socketId = null;
    return true;
  }

  isConnected(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.socketId != null;
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private create(sessionId: string): Session {
    const session: Session = { sessionId, playerId: this.newId(), socketId: null };
    this.sessions.set(sessionId, session);
    return session;
  }
}
