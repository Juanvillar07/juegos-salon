/**
 * Reloj del servidor estimado con muestras de ida y vuelta (`time:sync`): la hora del servidor
 * más la mitad del viaje. Las muestras se suavizan para que un paquete lento no mueva el reloj.
 */
export class ClockSync {
  /** Reloj del servidor − reloj local (ms). */
  offset = 0;
  /** Ida y vuelta medida (ms). */
  roundTrip = 0;
  private samples = 0;

  /** Estimación gruesa (sin medir el viaje), con la hora que trae el estado de la sala. */
  rough(serverTime: number, receivedAt: number): void {
    if (this.samples === 0) this.offset = serverTime - receivedAt;
  }

  sample(sentAt: number, receivedAt: number, serverTime: number): void {
    const trip = Math.max(0, receivedAt - sentAt);
    const offset = serverTime + trip / 2 - receivedAt;
    if (this.samples === 0) {
      this.offset = offset;
      this.roundTrip = trip;
    } else {
      this.offset += (offset - this.offset) * 0.2;
      this.roundTrip += (trip - this.roundTrip) * 0.2;
    }
    this.samples++;
  }
}
