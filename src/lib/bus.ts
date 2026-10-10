// Минимальная типизированная шина событий приложения.
// Заменяет window.dispatchEvent(new Event('supame:*')) / addEventListener —
// типы событий и издатели/подписчики связаны картой BusEvents.
// Нынешние события без полезной нагрузки (void); карту можно расширить payload'ами.
export type BusEvents = {
  'open-file-dialog': void;
  'assets-changed': void;
};

const listeners = new Map<keyof BusEvents, Set<() => void>>();

/** Подписаться; возвращает отписку (удобно передавать в useEffect) */
export function on<E extends keyof BusEvents>(event: E, handler: () => void): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

/** Издать событие (копия множества — на случай изменения подписчиков во время вызова) */
export function emit<E extends keyof BusEvents>(event: E): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of [...set]) handler();
}
