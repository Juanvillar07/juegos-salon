/** Temporizadores identificados por clave: programar uno nuevo reemplaza al anterior. */
export class KeyedTimers {
  private timers = new Map<string, NodeJS.Timeout>();

  set(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, ms),
    );
  }

  clear(key: string): void {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  clearAll(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }
}
