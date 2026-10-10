import { describe, expect, it } from 'vitest';
import {
  putProject,
  getProject,
  deleteProject,
  listProjects,
  putAsset,
  getAsset,
  listAssets,
  deleteAsset,
  deleteManyAssets,
  putProjectMeta,
  listProjectMeta,
  deleteProjectMeta,
} from './idb';
import type { AssetRecord, ProjectRecord, ProjectMeta } from '../types';

const mkProject = (id: string, name = 'Проект'): ProjectRecord => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 2,
  thumbnail: null,
  data: {
    version: 1,
    canvas: {
      width: 100,
      height: 200,
      background: { type: 'color', color: '#ffffff', transparent: false },
    },
    objects: [],
  },
});

const mkAsset = (id: string, name = 'Картинка'): AssetRecord => ({
  id,
  name,
  mime: 'image/png',
  blob: new Blob(['fake-bytes'], { type: 'image/png' }),
  createdAt: 1,
});

describe('projects store', () => {
  it('roundtrips a project record', async () => {
    await putProject(mkProject('p1', 'Мем'));
    const got = await getProject('p1');
    expect(got?.name).toBe('Мем');
    expect(got?.data.objects).toEqual([]);
    expect(got?.data.canvas.width).toBe(100);
  });

  it('lists all projects', async () => {
    await putProject(mkProject('p1'));
    await putProject(mkProject('p2'));
    const all = await listProjects();
    expect(all.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('deletes a project', async () => {
    await putProject(mkProject('p1'));
    await deleteProject('p1');
    expect(await getProject('p1')).toBeUndefined();
  });
});

describe('assets store', () => {
  it('roundtrips an asset record', async () => {
    await putAsset(mkAsset('a1'));
    const got = await getAsset('a1');
    expect(got?.name).toBe('Картинка');
    expect(got?.mime).toBe('image/png');
    // fake-indexeddb в этой среде не сохраняет identity Blob — проверяем сам факт наличия
    expect(got?.blob).toBeDefined();
  });

  it('lists assets', async () => {
    await putAsset(mkAsset('a1'));
    await putAsset(mkAsset('a2'));
    const all = await listAssets();
    expect(all.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('deletes a single asset', async () => {
    await putAsset(mkAsset('a1'));
    await deleteAsset('a1');
    expect(await getAsset('a1')).toBeUndefined();
  });

  it('deleteManyAssets removes several in one transaction and is a no-op for empty list', async () => {
    await putAsset(mkAsset('a1'));
    await putAsset(mkAsset('a2'));
    await putAsset(mkAsset('a3'));
    await deleteManyAssets(['a1', 'a2']);
    const rest = (await listAssets()).map((a) => a.id).sort();
    expect(rest).toEqual(['a3']);
    await expect(deleteManyAssets([])).resolves.toBeUndefined();
  });
});

describe('project meta store', () => {
  it('roundtrips lightweight meta', async () => {
    const meta: ProjectMeta = {
      id: 'p1',
      name: 'Мем',
      updatedAt: 2,
      width: 100,
      height: 200,
      objectCount: 3,
      thumbnail: null,
    };
    await putProjectMeta(meta);
    const all = await listProjectMeta();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(meta);
  });

  it('deletes meta by id', async () => {
    await putProjectMeta({
      id: 'p1',
      name: 'x',
      updatedAt: 2,
      width: 1,
      height: 1,
      objectCount: 0,
      thumbnail: null,
    });
    await deleteProjectMeta('p1');
    expect(await listProjectMeta()).toHaveLength(0);
  });
});
