// Минимальная типизированная шина событий приложения.
// Заменяет window.dispatchEvent(new Event('supame:*')) / addEventListener —
// типы событий и payload'ы связаны картой BusEvents.
// void-events можно издавать без payload'а (undefined); подписчики получают payload.
export type BusEvents = {
  'open-file-dialog': void;
  'assets-changed': void;
  /** Клик по заглушке-изображению шаблона: payload = id объекта для замены */
  'pick-image-for-placeholder': string;
};

type Handler<E extends keyof BusEvents> = (payload: BusEvents[E]) => void;

const listeners = new Map<keyof BusEvents, Set<Handler<keyof BusEvents>>>();

/** Подписаться; возвращает отписку (удобно передавать в useEffect) */
export function on<E extends keyof BusEvents>(event: E, handler: Handler<E>): () => void {
  let set = listeners.get(event) as Set<Handler<E>> | undefined;
  if (!set) {
    set = new Set();
    listeners.set(event, set as Set<Handler<keyof BusEvents>>);
  }
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

/** Издать событие с payload (копия множества — на случай изменения подписчиков во время вызова) */
export function emit<E extends keyof BusEvents>(event: E, payload: BusEvents[E]): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of [...set]) (handler as Handler<E>)(payload);
}
