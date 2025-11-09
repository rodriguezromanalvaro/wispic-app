import { computeNextAvatar, PhotoLike } from '../features/profile/utils/photos';

/**
 * Integration-style lifecycle test (pure local) simulating the sequence of photo operations
 * and verifying both the avatar invariant and ordered photos payload we expect RPCs to return.
 *
 * Operations covered:
 * 1. Add first photo
 * 2. Add second photo (non-top)
 * 3. Reorder (second photo becomes sort_order=0)
 * 4. Replace top photo
 * 5. Delete top photo (with remaining photo having non-zero order)
 * 6. Normalize remaining photo sort_order back to 0 (optional cleanup step server may perform)
 */

describe('photo lifecycle integration (avatar invariant + ordered payload)', () => {
  function orderedPayload(photos: PhotoLike[]): { id: number|string; url: string|null; sort_order: number|null }[] {
    return [...photos]
      .sort((a,b) => {
        const ao = a.sort_order ?? 0;
        const bo = b.sort_order ?? 0;
        if (ao !== bo) return ao - bo;
        const aid = String(a.id ?? '');
        const bid = String(b.id ?? '');
        if (aid < bid) return -1;
        if (aid > bid) return 1;
        return 0;
      })
      .map(p => ({ id: p.id!, url: p.url ?? null, sort_order: p.sort_order ?? null }));
  }

  let photos: PhotoLike[] = [];

  it('starts empty (avatar null)', () => {
    expect(computeNextAvatar(photos)).toBeNull();
    expect(orderedPayload(photos)).toEqual([]);
  });

  it('add first photo ⇒ avatar becomes first url', () => {
    photos.push({ id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 0 });
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p1.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 0 }
    ]);
  });

  it('add second photo (sort_order 1) ⇒ avatar unchanged', () => {
    photos.push({ id: 2, url: 'https://cdn/app/p2.jpg', sort_order: 1 });
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p1.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 0 },
      { id: 2, url: 'https://cdn/app/p2.jpg', sort_order: 1 }
    ]);
  });

  it('reorder: second photo becomes top (swap sort_order) ⇒ avatar updates', () => {
    // swap sort_order values
    const p1 = photos.find(p => p.id === 1)!;
    const p2 = photos.find(p => p.id === 2)!;
    [p1.sort_order, p2.sort_order] = [1, 0];
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p2.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 2, url: 'https://cdn/app/p2.jpg', sort_order: 0 },
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 1 }
    ]);
  });

  it('replace top photo (id2 removed, id3 added at sort_order 0) ⇒ avatar new url', () => {
    photos = photos.filter(p => p.id !== 2);
    photos.push({ id: 3, url: 'https://cdn/app/p3.jpg', sort_order: 0 });
    // Existing photo (id1) still has sort_order 1
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p3.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 3, url: 'https://cdn/app/p3.jpg', sort_order: 0 },
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 1 }
    ]);
  });

  it('delete top photo (remove id3) ⇒ avatar falls to remaining lowest sort_order (id1)', () => {
    photos = photos.filter(p => p.id !== 3);
    // Now only id1 remains with sort_order 1
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p1.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 1 }
    ]);
  });

  it('normalize remaining photo sort_order back to 0 ⇒ avatar stable', () => {
    const p1 = photos.find(p => p.id === 1)!;
    p1.sort_order = 0; // server cleanup scenario
    expect(computeNextAvatar(photos)).toBe('https://cdn/app/p1.jpg');
    expect(orderedPayload(photos)).toEqual([
      { id: 1, url: 'https://cdn/app/p1.jpg', sort_order: 0 }
    ]);
  });
});
