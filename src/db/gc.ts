// Сборщик мусора «сиротских» ассетов (по код-ревью: целостность данных).
//
// Live-множество ассетов = те, на которые ссылается хотя бы один сохранённый
// проект в IndexedDB + переданный extraLive (обычно — ассеты текущего, ещё не
// сохранившегося проекта в памяти editorStore). Всё, что вне этого множества,
// удаляется из хранилища assets и выбрасывается из кэша с revoke objectURL.
//
// Модуль намеренно НЕ импортирует editorStore, чтобы не создавать цикл:
// вызовы приходят из editorStore/UI с уже вычисленным extraLive.
import { listProjects, listAssets, deleteManyAssets } from './idb';
import { GC_DEBOUNCE_MS } from '../lib/config';
import { revokeCacheAsset } from './assets';
import type { ProjectRecord } from '../types';

/** id ассетов, на которые ссылается проект (объекты + фон) */
export function assetIdsOfProject(data: Pick<ProjectRecord['data'], 'objects' | 'canvas'>): string[] {
  const ids: string[] = [];
  for (const o of data.objects) {
    if (o.kind === 'image') ids.push(o.assetId);
  }
  if (data.canvas.background.type === 'image' && data.canvas.background.assetId) {
    ids.push(data.canvas.background.assetId);
  }
  return ids;
}

/** Live-множество по списку проектов */
export function liveAssetIds(projects: ProjectRecord[]): Set<string> {
  const live = new Set<string>();
  for (const p of projects) {
    for (const id of assetIdsOfProject(p.data)) live.add(id);
  }
  return live;
}

function projectDataMatches(p: ProjectRecord) {
  return p.data && p.data.canvas && Array.isArray(p.data.objects);
}

/**
 * Удалить все ассеты, не входящие в live-множество. Возвращает список удалённых id.
 * Безопасно вызывать в любой момент: идемпотентно, а открытый (несохранённый) проект
 * защищён через extraLive.
 */
export async function collectGarbage(extraLive?: Iterable<string>): Promise<string[]> {
  const [projects, allAssets] = await Promise.all([listProjects(), listAssets()]);
  const live = liveAssetIds(projects.filter(projectDataMatches));
  for (const id of extraLive ?? []) live.add(id);

  const stale = allAssets.filter((a) => !live.has(a.id)).map((a) => a.id);
  if (!stale.length) return [];

  // Освободить память в кэше + удалить из IndexedDB одной транзакцией
  for (const id of stale) revokeCacheAsset(id);
  await deleteManyAssets(stale).catch(() => undefined);
  return stale;
}

// ---- Отложенный запуск (debounce), чтобы серия одинарных удалений не сканировала БД на каждый клик ----

let gcTimer: number | undefined;
let gcPending: Set<string> | undefined;

export function scheduleCollectGarbage(
  extraLive?: Iterable<string>,
  delayMs = GC_DEBOUNCE_MS
): void {
  if (gcPending) {
    for (const id of extraLive ?? []) gcPending.add(id);
  } else {
    gcPending = new Set(extraLive ?? []);
  }
  if (gcTimer !== undefined) window.clearTimeout(gcTimer);
  gcTimer = window.setTimeout(() => {
    gcTimer = undefined;
    const extra = gcPending;
    gcPending = undefined;
    void collectGarbage(extra).catch(() => undefined);
  }, delayMs);
}
