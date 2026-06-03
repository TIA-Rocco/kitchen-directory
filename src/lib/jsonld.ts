/**
 * Safe serializer for inline JSON-LD (<script type="application/ld+json">).
 *
 * `JSON.stringify` escapes quotes and control chars but NOT `<`, `>`, or `&`,
 * so an attacker-controlled string containing `</script>` (e.g. a review body
 * or FAQ answer) would terminate the script element early and inject arbitrary
 * HTML — stored XSS. We additionally escape U+2028/U+2029, which are valid in
 * JSON strings but illegal as raw JS string literals in some parsers.
 *
 * Output remains valid JSON: `<` etc. decode back to the original chars,
 * so Schema.org consumers (Google Rich Results, etc.) see identical data.
 *
 * U+2028/U+2029 are handled via split/join (not a regex literal) because a raw
 * line/paragraph separator inside a `/.../` literal is itself a line terminator
 * and would not parse.
 */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export function safeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (!json) return '';
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEP)
    .join('\\u2028')
    .split(PARA_SEP)
    .join('\\u2029');
}
