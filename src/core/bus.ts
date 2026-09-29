/**
 * Tiny typed event bus. The presentation layer uses it to react to sim domain events (sounds,
 * VFX, toasts) without the sim knowing anything about the UI (docs/06 §6).
 */
export type Handler<T> = (payload: T) => void;

export interface Bus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void;
  onAny(
    handler: Handler<{ [K in keyof Events]: { type: K; payload: Events[K] } }[keyof Events]>,
  ): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  clear(): void;
}

export function createBus<Events extends Record<string, unknown>>(): Bus<Events> {
  const handlers = new Map<keyof Events, Set<Handler<never>>>();
  const anyHandlers = new Set<Handler<never>>();

  return {
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler as Handler<never>);
      return () => set.delete(handler as Handler<never>);
    },
    onAny(handler) {
      anyHandlers.add(handler as Handler<never>);
      return () => anyHandlers.delete(handler as Handler<never>);
    },
    emit(type, payload) {
      for (const handler of handlers.get(type) ?? []) (handler as Handler<typeof payload>)(payload);
      for (const handler of anyHandlers) (handler as Handler<unknown>)({ type, payload });
    },
    clear() {
      handlers.clear();
      anyHandlers.clear();
    },
  };
}
