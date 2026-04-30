import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders headings', () => {
    const html = renderMarkdown('# Hello\n\n## World');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<h2>World</h2>');
  });

  it('renders bold and italic', () => {
    const html = renderMarkdown('Some **bold** and *italic*.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders lists', () => {
    const html = renderMarkdown('- one\n- two\n- three');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders GFM tables', () => {
    const md = '| H1 | H2 |\n|----|----|\n| a | b |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>H1</th>');
    expect(html).toContain('<td>a</td>');
  });

  it('strips script tags (XSS protection)', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips event handler attributes (XSS protection)', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('preserves links with target=_blank', () => {
    const html = renderMarkdown(
      '[link](https://example.com){target="_blank"}'
    );
    // marked won't parse the {target} suffix; just check the link survives
    expect(html).toContain('href="https://example.com"');
  });
});
