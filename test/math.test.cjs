'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findEdits, applyEdits, editsInRange } = require('../src/math');
const fix = s => applyEdits(s, findEdits(s));
const formula = String.raw`\text{Murphy's Triad} = \text{1. Pain (First)} \longrightarrow \text{2. Vomiting / Nausea (Next)} \longrightarrow \text{3. Temperature / Fever (Last)}`;
const conversions = [
  ['screenshot', '\\[' + formula + '\\]', '$$\n' + formula + '\n$$'],
  ['existing whole note', '# Heading\n\n\\[' + formula + '\\]\n\nText', '# Heading\n\n$$\n' + formula + '\n$$\n\nText'],
  ['inline', String.raw`This is \(x^2\).`, 'This is $x^2$.'],
  ['multiple', String.raw`\(a\) and \(b\)`, '$a$ and $b$'],
  ['multiline', '\\[\nx+y\n\\]', '$$\nx+y\n$$'],
  ['windows newline', '\\[\r\nx\r\n\\]', '$$\r\nx\r\n$$'],
  ['prose display', 'Before \\[x\\] after', 'Before \n\n$$\nx\n$$\n\n after'],
  ['quote', '> \\[x\\]', '> $$\n> x\n> $$'],
  ['bullet', '- \\[x\\]', '- $$\n  x\n  $$'],
  ['numbered list', '1. \\[x\\]', '1. $$\n   x\n   $$'],
  ['quoted multiline', '> \\[\n> x\n> \\]', '> $$\n> x\n> $$'],
  ['escaped dollar TeX', String.raw`\(\text{Cost \$5}\)`, String.raw`$\text{Cost \$5}$`],
  ['frontmatter end', '---\na: b\n---\n\\(x\\)', '---\na: b\n---\n$x$'],
  ['after code', '```\n\\(a\\)\n```\n\\(b\\)', '```\n\\(a\\)\n```\n$b$']
];
for (const [name, input, expected] of conversions) test(name, () => {
  assert.equal(fix(input), expected);
  assert.equal(fix(expected), expected, 'repeat repair must be a no-op');
});
const protectedCases = [
  '`\\(x\\)`', '``\\(x\\) ` y``', '```latex\n\\[x\\]\n```',
  '~~~\n\\(x\\)\n~~~', '    \\[x\\]', '\t\\(x\\)',
  '---\nformula: \\(x\\)\n---', '\uFEFF---\nformula: \\(x\\)\n---',
  '<!-- \\(x\\) -->', '%% \\(x\\) %%', '<!-- \\(x\\)', '%% \\(x\\)',
  '$\\(x\\)$', '$$\n\\[x\\]\n$$', String.raw`\\[x\\]`,
  '\\[x', '\\(x', '\\[\\]', '\\( \\)', '\\(a\nb\\)',
  '> text \\[x\\] more', '| \\[x\\] |', '<code>\\(x\\)</code>', '<pre>\\[x\\]</pre>',
  '[label](path\\(x\\))', '```\n\\(x\\)', '- ```\n\\(x\\)\n  ```',
  '\\[x\n\ny\\]', '$a \\(x\\) b$', '\\[x\n```\ny\n```\n\\]'
];
protectedCases.forEach((s, i) => test('protected region ' + i, () => assert.equal(fix(s), s)));
test('selection respects surrounding code context', () => {
  const s = '```\n\\(x\\)\n```'; assert.equal(editsInRange(s, 4, 9).length, 0);
});
test('selection only includes complete contained expressions', () => {
  const s = '\\(a\\) \\(b\\)';
  assert.equal(editsInRange(s, 0, 5).length, 1);
  assert.equal(editsInRange(s, 1, 4).length, 0);
});
test('edits preserve all unedited bytes', () => {
  const s = '# 🧮\r\n\r\n\\(α+β\\) and \\(z\\)\r\n';
  const edits = findEdits(s);
  assert.equal(edits.length, 2);
  assert.equal(applyEdits(s, edits), '# 🧮\r\n\r\n$α+β$ and $z$\r\n');
});
test('large malformed note completes promptly', () => {
  const s = '\\[unclosed '.repeat(30000);
  const start = performance.now();
  assert.equal(findEdits(s).length, 0);
  assert.ok(performance.now() - start < 3000);
});
test('wiki link targets stay unchanged', () => assert.equal(fix('[[note\\(x\\)|alias]]'), '[[note\\(x\\)|alias]]'));
test('long escaped backslash runs do not freeze the editor', () => {
  const s = '\\'.repeat(150000);
  const start = performance.now();
  assert.equal(findEdits(s).length, 0);
  assert.ok(performance.now() - start < 3000);
});
test('generated varied notes retain code and become stable after repair', () => {
  for (let i = 0; i < 200; i++) {
    const s = '# Note ' + i + '\n\n\\[x_{' + i + '}\\]\n\n`\\(literal\\)`\n\nInline \\(y+' + i + '\\).';
    const result = fix(s);
    assert.ok(result.includes('`\\(literal\\)`'));
    assert.equal(fix(result), result);
    assert.equal(findEdits(s).length, 2);
  }
});
test('numeric percentage before a heading cannot swallow subsequent prose', () => {
  const source = '| Variable | Value |\n| --- | --- |\n| Neutrophils | \\(>75%\\) |\n\n#### Interpretation\n\n- **Low score:** Observe.\n- **High score $\\ge 9$ (or $\\ge 8$):** Act.\n';
  const expected = source.replace('\\(>75%\\)', '$>75\\%$');
  assert.equal(fix(source), expected);
  assert.equal(fix(expected), expected);
});
test('old plugin numeric percentages in existing dollar math are repaired', () => {
  assert.equal(fix('Neutrophils $>75%$, accuracy $>95%$; plain 90%.'), 'Neutrophils $>75\\%$, accuracy $>95\\%$; plain 90%.');
});
test('escaped percentages are not double escaped', () => {
  assert.equal(fix(String.raw`\(>75\%\) and $>95\%$`), String.raw`$>75\%$ and $>95\%$`);
});
test('single line display percentage is repaired', () => {
  assert.equal(fix(String.raw`\[p = 75%\]`), '$$\np = 75\\%\n$$');
});
test('genuine multiline TeX comments are retained', () => {
  const s = '\\[\nx = 1 % intentional comment\n+ 2\n\\]';
  assert.equal(fix(s), '$$\nx = 1 % intentional comment\n+ 2\n$$');
});
test('percentages in protected code or ordinary prose stay unchanged', () => {
  const s = 'Plain 75%. `\\(75%\\)` and `$75%$`\n\n```tex\n\\(75%\\)\n$75%$\n```';
  assert.equal(fix(s), s);
});
test('italic math inside four-space nested lists is repaired', () => {
  const s = '- **Parent:**\n    - _Location (Size \\(<2\\text{ cm}\\)):_ Action.\n    - _Other size \\(>2\\text{ cm}\\):_ Action.';
  const expected = s.replace('\\(<2\\text{ cm}\\)', '$<2\\text{ cm}$').replace('\\(>2\\text{ cm}\\)', '$>2\\text{ cm}$');
  assert.equal(fix(s), expected);
  assert.equal(fix(expected), expected);
});
test('bold nested list math is repaired', () => {
  assert.equal(fix('- Parent\n    - **Value \\(x\\)**'), '- Parent\n    - **Value $x$**');
});
test('nested ordered list math is repaired', () => {
  assert.equal(fix('1. Parent\n    1. _Value \\(x\\)_'), '1. Parent\n    1. _Value $x$_');
});
test('tab-indented nested list math is repaired', () => {
  assert.equal(fix('- Parent\n\t- _Value \\(x\\)_'), '- Parent\n\t- _Value $x$_');
});
test('nested list continuation paragraphs are repaired', () => {
  assert.equal(fix('- Parent\n    - Child\n\n      _Value \\(x\\)_'), '- Parent\n    - Child\n\n      _Value $x$_');
});
test('deeply nested list math is repaired', () => {
  assert.equal(fix('- Parent\n    - Child\n        - _Value \\(x\\)_'), '- Parent\n    - Child\n        - _Value $x$_');
});
test('quote nested list math is repaired', () => {
  assert.equal(fix('> - Parent\n>     - _Value \\(x\\)_'), '> - Parent\n>     - _Value $x$_');
});
for (const [name, s] of [
  ['root indented fake list', '    - _Value \\(x\\)_'],
  ['root tab fake list', '\t- _Value \\(x\\)_'],
  ['indented code inside list', '- Parent\n\n      _Value \\(x\\)_'],
  ['indented code inside nested list', '- Parent\n    - Child\n\n          _Value \\(x\\)_'],
  ['fenced code inside nested list', '- Parent\n    - Child\n\n      ```tex\n      _Value \\(x\\)_\n      ```'],
  ['fence on list marker', '- ```tex\n  _Value \\(x\\)_\n  ```'],
  ['quote code', '>     _Value \\(x\\)_'],
  ['parent math after code stays independent', '- Parent\n\n      \\(code\\)\n\nOutside.\n\n    \\(code again\\)']
]) test('list/code safety: ' + name, () => assert.equal(fix(s), s));
