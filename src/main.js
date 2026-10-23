'use strict';
const { Plugin, PluginSettingTab, Setting, Notice, MarkdownView } = require('obsidian');
const { findEdits, applyEdits, editsInRange } = require('./math');

module.exports = class LatexDelimiterFix extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { autoPaste: saved?.autoPaste !== false };
    this.busy = false;
    this.lastRepair = null;
    this.addCommand({ id: 'repair-current-note', name: 'Repair math in current note',
      callback: () => this.repairActiveNote() });
    this.addCommand({ id: 'repair-selection', name: 'Repair math in selection',
      editorCallback: editor => this.repairEditor(editor, true) });
    this.addCommand({ id: 'revert-last-repair', name: 'Revert last note repair',
      callback: () => this.revertLastRepair() });
    this.addRibbonIcon('sigma', 'Fix math in current note', () => this.repairActiveNote());
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (file.extension !== 'md' || view?.file?.path !== file.path) return;
      menu.addItem(item => item.setTitle('Fix math in current note').setIcon('sigma')
        .onClick(() => this.repairActiveNote()));
    }));
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      menu.addItem(item => item.setTitle('Fix math in current note').setIcon('sigma')
        .onClick(() => this.repairEditor(editor, false)));
      if (editor.somethingSelected()) menu.addItem(item => item.setTitle('Fix math in selection')
        .setIcon('sigma').onClick(() => this.repairEditor(editor, true)));
    }));
    this.registerEvent(this.app.workspace.on('editor-paste', (evt, editor) => this.onPaste(evt, editor)));
    this.addSettingTab(new FixSettings(this.app, this));
  }

  repairEditor(editor, selectionOnly) {
    const source = editor.getValue();
    let edits = findEdits(source);
    if (selectionOnly) {
      const ranges = editor.listSelections().map(range => {
        const a = editor.posToOffset(range.anchor), b = editor.posToOffset(range.head);
        return { from: Math.min(a, b), to: Math.max(a, b) };
      });
      edits = edits.filter(e => ranges.some(r => e.from >= r.from && e.to <= r.to));
    }
    if (!edits.length) { new Notice('No complete, supported math delimiters found.'); return 0; }
    editor.transaction({ changes: edits.map(e => ({
      from: editor.offsetToPos(e.from), to: editor.offsetToPos(e.to), text: e.text
    })) });
    new Notice(`Repaired ${edits.length} math expression(s). Use Undo to revert.`);
    return edits.length;
  }

  async repairActiveNote() {
    if (this.busy) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) { new Notice('Open a Markdown note first.'); return; }
    if (view.getMode() !== 'preview') { this.repairEditor(view.editor, false); return; }
    // Reading view uses an atomic vault operation; never overwrite a stale read.
    this.busy = true;
    const file = view.file;
    let repair = null, count = 0;
    try {
      await this.app.vault.process(file, source => {
        const edits = findEdits(source);
        count = edits.length;
        if (!count) return source;
        const after = applyEdits(source, edits);
        repair = { path: file.path, before: source, after };
        return after;
      });
      if (repair) this.lastRepair = repair;
      new Notice(count ? `Repaired ${count} math expression(s). Run Revert last note repair to undo.` : 'No complete, supported math delimiters found.');
    } catch (error) {
      console.error('LaTeX Delimiter Fix: note repair failed', error);
      new Notice('Could not repair this note. Check that the vault is writable.');
    } finally { this.busy = false; }
  }

  async revertLastRepair() {
    if (this.busy) return;
    const repair = this.lastRepair;
    if (!repair) { new Notice('No Reading view repair to revert in this session. In the editor, use Undo.'); return; }
    const file = this.app.vault.getAbstractFileByPath(repair.path);
    if (!file || file.extension !== 'md') { new Notice('The repaired note was moved or removed.'); return; }
    this.busy = true;
    try {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view?.file?.path === repair.path && view.getMode() !== 'preview') {
        if (view.editor.getValue() !== repair.after) { new Notice('Note changed since repair. Revert skipped to preserve your edits.'); return; }
        view.editor.transaction({ changes: [{ from: { line: 0, ch: 0 },
          to: view.editor.offsetToPos(repair.after.length), text: repair.before }] });
      } else {
        let restored = false;
        await this.app.vault.process(file, source => {
          if (source !== repair.after) return source;
          restored = true; return repair.before;
        });
        if (!restored) { new Notice('Note changed since repair. Revert skipped to preserve your edits.'); return; }
      }
      this.lastRepair = null;
      new Notice('Reverted the last Reading view repair.');
    } catch (error) {
      console.error('LaTeX Delimiter Fix: revert failed', error);
      new Notice('Could not revert the note.');
    } finally { this.busy = false; }
  }

  onPaste(evt, editor) {
    if (!this.settings.autoPaste || evt.defaultPrevented || !evt.clipboardData || editor.listSelections().length !== 1) return;
    if (evt.clipboardData.files.length) return;
    const pasted = evt.clipboardData.getData('text/plain');
    if (!pasted || (!/\\[[(]/.test(pasted) && !pasted.includes('%'))) return;
    const source = editor.getValue();
    const from = editor.posToOffset(editor.getCursor('from'));
    const to = editor.posToOffset(editor.getCursor('to'));
    const combined = source.slice(0, from) + pasted + source.slice(to);
    const edits = editsInRange(combined, from, from + pasted.length)
      .map(e => ({ from: e.from - from, to: e.to - from, text: e.text }));
    if (!edits.length) return;
    evt.preventDefault();
    editor.replaceSelection(applyEdits(pasted, edits));
  }
};

class FixSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    this.containerEl.empty();
    new Setting(this.containerEl).setName('Repair existing note')
      .setDesc('Fix math in the current note, including Reading view. The editor supports Undo; Reading view repairs have a revert command.')
      .addButton(button => button.setButtonText('Fix math').onClick(() => this.plugin.repairActiveNote()));
    new Setting(this.containerEl).setName('Fix LaTeX on paste')
      .setDesc('Convert complete supported delimiters in pasted plain text. Existing notes change only when you run a repair.')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.autoPaste).onChange(async value => {
        this.plugin.settings.autoPaste = value;
        await this.plugin.saveData(this.plugin.settings);
      }));
  }
}
