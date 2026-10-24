# LaTeX Delimiter Fix

Repair unrendered LaTeX math in existing notes, selections, and pasted text. Converts `\[ ... \]` to display math (`$$`) and `\( ... \)` to inline math (`$`). Also escapes numeric percentages in math to prevent a bare `%` from commenting out a closing delimiter.

Author: **Atharva Savnerkar** ([Ayush4265](https://github.com/Ayush4265)). This is an independent community plugin.

## Repair existing notes

- Click the **sigma (Σ) ribbon icon**, labelled **Fix math in current note**.
- Or run **LaTeX Delimiter Fix: Repair math in current note** from the command palette.
- Or use **Fix math in current note** in the editor context menu or plugin settings.
- To repair only a passage, select it and run **Repair math in selection**.

The current-note command works in editing mode and Reading view. Only the active note is changed. Selection repair checks the surrounding note and changes complete expressions fully inside the selection.

In editing mode, use **Undo**. For Reading view repairs, run **Revert last note repair**. The revert command stores one repair in memory for the session and refuses to overwrite later edits. It is not a persistent backup.

Use Reading view or Live Preview with the cursor outside the formula to see rendered math. Source mode intentionally shows raw syntax.

## Nested lists, italics, and percentages

Version 1.1.2 repairs inline math inside italic and bold text in nested lists, including four-space/tab indentation and list continuation paragraphs. Code indentation is interpreted relative to the list content, so actual code remains protected.

Before:

```text
- Parent
    - _Size \(<2\text{ cm}\):_ Description.
    - Accuracy \(>75%\).
```

After:

```text
- Parent
    - _Size $<2\text{ cm}$:_ Description.
    - Accuracy $>75\%$.
```

The numeric-percent correction also applies to existing dollar math from older versions. Plain-text percentages and already escaped percentages stay unchanged. Explanatory comments in multiline display math are preserved.

## Automatic paste repair

Enabled by default; disable **Fix LaTeX on paste** in plugin settings if desired. When conversion is needed, the plugin inserts plain-text Markdown, so rich clipboard formatting is not retained. Images, file pastes, multiple-cursor pastes, and pastes already handled by another plugin are left alone. Existing text elsewhere in the note is not repaired by a paste.

## Install or update

Download the [latest GitHub release](https://github.com/Ayush4265/latex-delimiter-fix/releases/latest). Put `main.js` and `manifest.json` in `<your vault>/.obsidian/plugins/latex-delimiter-fix/`, replacing the old files. Alternatively, extract the plugin ZIP into `.obsidian/plugins/`.

Restart/reload Obsidian, or toggle the plugin off and on. Enable **LaTeX Delimiter Fix** under Community plugins. Requires Obsidian 1.5.0 or later.

## Protected content and limits

The scanner protects fenced/indented code, matched inline code, YAML properties, HTML/Obsidian comments, HTML code/pre blocks, wiki links, Markdown link destinations, and existing matched dollar math apart from numeric-percent repairs. Incomplete delimiter pairs are left alone.

Inline expressions must close on the same line. Complex nested Markdown, display math crossing blank paragraphs, and display math inside table cells may be skipped. Literal paired delimiters in prose can be indistinguishable from intended math. Review changes and use Undo when needed.

This is a conservative source scanner, not a complete Markdown or TeX parser. It does not repair arbitrary invalid TeX, install LaTeX packages, or wrap long equations automatically. Expression-edge whitespace and list/quote prefixes may be normalized during display conversion.

## Validation

95 automated tests cover conversion, percentage regressions, nested italic/bold lists, list/code boundaries, note/selection/paste operations, Reading view/revert, malformed input, and repeat runs. Tests use a mocked Obsidian API. The reported nested-list case was checked against a local note copy while verifying its 28 fenced blocks stayed unchanged. Live desktop/mobile rendering testing remains outstanding.

## Privacy

Runs locally with no network calls, telemetry, account, API key, downloaded code, or access outside the vault. Only explicit repairs and handled paste events change notes. Event handlers are registered with Obsidian for cleanup on unload.

## Development and releases

Requires Node.js 20 or later. There are no third-party build/test dependencies.

```sh
node build.cjs
node --check main.js
node --test test/*.test.cjs
```

Edit `src/math.js` or `src/main.js`, then rebuild the readable runtime bundle `main.js`. GitHub Actions tests manifest updates and publishes a release whose tag matches the manifest version exactly, without a `v` prefix. Obsidian installs the individual `main.js` and `manifest.json` release assets.

Licensed under [MIT](LICENSE).
