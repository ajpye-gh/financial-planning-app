import { ownsHome } from '@src/lib/questions';

describe('ownsHome', () => {
  it('is true only when housing is answered "own"', () => {
    expect(ownsHome({ housing: 'own' })).toBe(true);
    expect(ownsHome({ housing: 'rent' })).toBe(false);
    expect(ownsHome({})).toBe(false);
  });
});
