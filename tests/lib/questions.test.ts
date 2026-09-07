import { filingStatus, ownsHome, socialSecurityEnabled } from '@src/lib/questions';

describe('ownsHome', () => {
  it('is true only when housing is answered "own"', () => {
    expect(ownsHome({ housing: 'own' })).toBe(true);
    expect(ownsHome({ housing: 'rent' })).toBe(false);
    expect(ownsHome({})).toBe(false);
  });
});

describe('filingStatus', () => {
  it('is marriedJoint only when explicitly answered that way', () => {
    expect(filingStatus({ filingStatus: 'marriedJoint' })).toBe('marriedJoint');
  });

  it('defaults to single when unset or answered anything else', () => {
    expect(filingStatus({})).toBe('single');
    expect(filingStatus({ filingStatus: 'single' })).toBe('single');
    expect(filingStatus({ filingStatus: 'nonsense' })).toBe('single');
  });
});

describe('socialSecurityEnabled', () => {
  it('defaults to true (included) when unset', () => {
    expect(socialSecurityEnabled({})).toBe(true);
  });

  it('is false only when explicitly turned off', () => {
    expect(socialSecurityEnabled({ socialSecurityEnabled: false })).toBe(false);
  });

  it('is true when explicitly turned on', () => {
    expect(socialSecurityEnabled({ socialSecurityEnabled: true })).toBe(true);
  });
});
