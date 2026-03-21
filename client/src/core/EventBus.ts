type Handler = (...args: unknown[]) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    if (ENGINE_DEBUG) {
      console.log(`[EventBus] ${event}`, ...args);
    }
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }

  clear(): void {
    this.listeners.clear();
  }
}

declare const ENGINE_DEBUG: boolean;

export const eventBus = new EventBus();
