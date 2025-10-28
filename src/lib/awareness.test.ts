import { describe, expect, it } from 'vitest';

import { calculateAwarenessScores } from './awareness';

describe('calculateAwarenessScores', () => {
  it('computes high, typical, and low awareness indexes with smoothing', () => {
    const result = calculateAwarenessScores([
      { slug: 'balanced', searchVolume: 250, productCount: 50 },
      { slug: 'popular', searchVolume: 800, productCount: 40 },
      { slug: 'overlooked', searchVolume: 80, productCount: 120 },
    ]);

    const balanced = result.scores.get('balanced');
    const popular = result.scores.get('popular');
    const overlooked = result.scores.get('overlooked');

    expect(result.baseline).toBeGreaterThan(0);
    expect(balanced).toBeDefined();
    expect(popular).toBeDefined();
    expect(overlooked).toBeDefined();

    expect(popular!.index).toBeGreaterThan(1.5);
    expect(overlooked!.index).toBeLessThan(0.5);
    expect(Math.abs(balanced!.index - 1)).toBeLessThan(0.1);

    expect(result.scores.size).toBe(3);
    [balanced!, popular!, overlooked!].forEach((score) => {
      expect(score.colorScore).toBeGreaterThanOrEqual(0);
      expect(score.colorScore).toBeLessThanOrEqual(100);
    });
  });

  it('ignores entries without positive search volume and product count', () => {
    const result = calculateAwarenessScores([
      { slug: 'valid', searchVolume: 200, productCount: 25 },
      { slug: 'no-search', searchVolume: 0, productCount: 15 },
      { slug: 'no-products', searchVolume: 100, productCount: 0 },
      { slug: 'nulls', searchVolume: null, productCount: null },
    ]);

    expect(result.scores.has('valid')).toBe(true);
    expect(result.scores.has('no-search')).toBe(false);
    expect(result.scores.has('no-products')).toBe(false);
    expect(result.scores.has('nulls')).toBe(false);
  });
});
