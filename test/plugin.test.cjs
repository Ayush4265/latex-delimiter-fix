'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function editorFor(initial, start = 0, end = start) {
  let value = initial, transactions = 0;
  const pos = offset => { const lines = value.slice(0, offset).split('\n'); return { line: lines.length - 1, ch: lines.at(-1).length }; };
  const offset = p => value.split('\n').slice(0, p.line).reduce((n, line) => n + line.length + 1, 0) + p.ch;
  return {
    getValue: () => value, offsetToPos: pos, posToOffset: offset,
    listSelections: () => [{ anchor: pos(start), head: pos(end) }],
    getCursor: side => pos(side === 'from' ? start : end), somethingSelected: () => start !== end,
    replaceSelection: text => { value = value.slice(0, start) + text + value.slice(end); },
    transaction: tx => {
      transactions++;
      const changes = tx.changes.map(e => ({ from: offset(e.from), to: offset(e.to), text: e.text }));
      for (const e of changes.reverse()) value = value.slice(0, e.from) + e.text + value.slice(e.to);
    }, get transactions() { return transactions; }
  };
}
async function setup({ reading = false, source = '\\[x\\]', saved = {} } = {}) {
  const events = {}, commands = {}, notices = [];
  let disk = source;
  class MarkdownView {}
  const view = new MarkdownView();
  view.file = { path: 'note.md', extension: 'md' };
  view.editor = editorFor(source);
  view.getMode = () => reading ? 'preview' : 'source';
  class Plugin {
    constructor() { this.app = {
      workspace: { getActiveViewOfType: () => view, on: (event, cb) => { events[event] = cb; return {}; } },
      vault: { process: async (file, cb) => { disk = cb(disk); }, getAbstractFileByPath: () => view.file }
    }; }
    async loadData() { return saved; }
    addCommand(c) { commands[c.id] = c; }
    registerEvent() {}
    addSettingTab() {}
    addRibbonIcon(icon, title, cb) { this.ribbon = cb; }
  }
  const context = { console, module: { exports: {} }, require: name => {
    assert.equal(name, 'obsidian', 'bundle must have no other runtime dependencies');
    return { Plugin, MarkdownView, PluginSettingTab: class {}, Setting: class {}, Notice: class { constructor(s) { notices.push(s); } } };
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), context);
  const plugin = new context.module.exports(); await plugin.onload();
  return { plugin, commands, events, view, notices, get disk() { return disk; }, set disk(s) { disk = s; } };
}
function paste(f, editor, text, extra = {}) {
  let handled = false;
  f.events['editor-paste']({ defaultPrevented: false, clipboardData: { files: [], getData: () => text }, preventDefault: () => { handled = true; }, ...extra }, editor);
  return handled;
}
test('command repairs existing editor content in one transaction', async () => {
  const f = await setup({source: '\\(a\\)\n\n\\[b\\]'});
  await f.commands['repair-current-note'].callback();
  assert.equal(f.view.editor.getValue(), '$a$\n\n$$\nb\n$$');
  assert.equal(f.view.editor.transactions, 1);
});
test('ribbon repairs existing note without a paste', async () => {
  const f = await setup(); await f.plugin.ribbon();
  assert.equal(f.view.editor.getValue(), '$$\nx\n$$');
});
test('reading view repair persists and can be reverted', async () => {
  const f = await setup({reading: true});
  await f.commands['repair-current-note'].callback(); assert.equal(f.disk, '$$\nx\n$$');
  await f.commands['revert-last-repair'].callback(); assert.equal(f.disk, '\\[x\\]');
});
test('revert refuses to overwrite subsequent edits', async () => {
  const f = await setup({reading: true}); await f.plugin.repairActiveNote();
  f.disk += '\nnew edit'; const expected = f.disk;
  await f.plugin.revertLastRepair(); assert.equal(f.disk, expected);
  assert.match(f.notices.at(-1), /changed since/);
});
test('selection command repairs only selection', async () => {
  const f = await setup(), e = editorFor('\\(a\\) and \\(b\\)', 0, 5);
  f.commands['repair-selection'].editorCallback(e); assert.equal(e.getValue(), '$a$ and \\(b\\)');
});
test('selection in a code fence is left alone', async () => {
  const f = await setup(), e = editorFor('```\n\\(x\\)\n```', 4, 9);
  f.commands['repair-selection'].editorCallback(e); assert.equal(e.transactions, 0);
});
test('paste repairs complete new math', async () => {
  const f = await setup(), e = editorFor('');
  assert.equal(paste(f, e, '\\[x\\]'), true); assert.equal(e.getValue(), '$$\nx\n$$');
});
for (const [name, source, at] of [['fence', '```\n\n```', 4], ['code span', '`here`', 3], ['math', '$$\n\n$$', 3], ['YAML', '---\na: \n---', 7]]) {
  test('paste in ' + name + ' is untouched', async () => {
    const f = await setup(); assert.equal(paste(f, editorFor(source, at), '\\(x\\)'), false);
  });
}
test('paste never repairs pre-existing expressions', async () => {
  const f = await setup(), e = editorFor('\\(old\\)\n\n', 11);
  paste(f, e, '\\(new\\)'); assert.equal(e.getValue(), '\\(old\\)\n\n$new$');
});
test('paste setting persists as disabled', async () => {
  const f = await setup({ saved: {autoPaste: false} });
  assert.equal(paste(f, editorFor(''), '\\(x\\)'), false);
});
test('file and already handled pastes are left to Obsidian', async () => {
  const f = await setup();
  assert.equal(paste(f, editorFor(''), '\\(x\\)', {defaultPrevented: true}), false);
  assert.equal(paste(f, editorFor(''), '\\(x\\)', {clipboardData: {files: [{}]}}), false);
});
test('multiple cursor paste is left to Obsidian', async () => {
  const f = await setup(), e = editorFor(''); e.listSelections = () => [{}, {}];
  assert.equal(paste(f, e, '\\(x\\)'), false);
});
test('reading view repair handles filesystem failure and unlocks', async () => {
  const f = await setup({reading: true});
  f.plugin.app.vault.process = async () => { throw new Error('read only'); };
  const original = console.error; console.error = () => {};
  try { await f.plugin.repairActiveNote(); } finally { console.error = original; }
  assert.equal(f.plugin.busy, false); assert.match(f.notices.at(-1), /Could not repair/);
});
test('missing active note gives a useful message', async () => {
  const f = await setup(); f.plugin.app.workspace.getActiveViewOfType = () => null;
  await f.plugin.repairActiveNote(); assert.match(f.notices.at(-1), /Open a Markdown note/);
});
test('pasted numeric percentages use safe TeX escaping', async () => {
  const f = await setup(), e = editorFor('');
  assert.equal(paste(f, e, '\\(>75%\\)'), true);
  assert.equal(e.getValue(), '$>75\\%$');
});
test('pasted dollar math from older versions is repaired too', async () => {
  const f = await setup(), e = editorFor('');
  assert.equal(paste(f, e, '$>75%$'), true);
  assert.equal(e.getValue(), '$>75\\%$');
});
test('ordinary pasted percentage does not hijack clipboard handling', async () => {
  const f = await setup();
  assert.equal(paste(f, editorFor(''), 'Plain 75%.'), false);
});
