import { describe, expect, it } from 'vitest';
import { slugify } from './slug.ts';

describe('slugify', () => {
  it('lowercases text and replaces spaces and punctuation with dashes', () => {
    expect(slugify('Button - variants')).toBe('button-variants');
  });

  it('collapses multiple punctuation into one dash', () => {
    expect(slugify('Hello!!! World')).toBe('hello-world');
  });

  it('trims leading and trailing punctuation', () => {
    expect(slugify('---test---')).toBe('test');
  });

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('leaves an already-slugified input unchanged', () => {
    expect(slugify('button-variants')).toBe('button-variants');
  });

  it('preserves numbers', () => {
    expect(slugify('v2 API')).toBe('v2-api');
  });

  it('normalizes em dashes and slashes with other punctuation', () => {
    expect(slugify('Foo - Bar/Baz')).toBe('foo-bar-baz');
  });
});
