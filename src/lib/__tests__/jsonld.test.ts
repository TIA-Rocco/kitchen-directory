import { describe, it, expect } from 'vitest';
import { safeJsonLd } from '../jsonld';

describe('safeJsonLd', () => {
  it('escapes </script> so it cannot break out of a JSON-LD <script> block', () => {
    const out = safeJsonLd({ reviewBody: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('\\u003c'); // <
    expect(out).toContain('\\u003e'); // >
  });

  it('escapes angle brackets and ampersands', () => {
    const out = safeJsonLd({ s: '<img src=x onerror=alert(1)> & more' });
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
    expect(out).toContain('\\u0026');
  });

  it('escapes U+2028 / U+2029 line/paragraph separators', () => {
    const ls = String.fromCharCode(0x2028);
    const ps = String.fromCharCode(0x2029);
    const out = safeJsonLd({ s: `a${ls}b${ps}c` });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain(ls);
    expect(out).not.toContain(ps);
  });

  it('remains valid JSON that round-trips to the original data', () => {
    const data = {
      '@type': 'Review',
      reviewBody: '5/5 - great service & support </script>',
      author: { name: "O'Brien <test>" },
    };
    const out = safeJsonLd(data);
    expect(JSON.parse(out)).toEqual(data);
  });

  it('does not corrupt ordinary spaces', () => {
    const out = safeJsonLd({ s: 'hello world foo bar' });
    expect(JSON.parse(out).s).toBe('hello world foo bar');
  });

  it('returns empty string for undefined (guards set:html)', () => {
    expect(safeJsonLd(undefined)).toBe('');
  });
});
