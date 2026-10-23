# LaTeX Delimiter Fix

Repair unrendered LaTeX math in **existing notes**, selected text, and future pastes. Converts `\[ ... \]` to Obsidian display math (`$$`) and `\( ... \)` to inline math (`$`). This is an independent community plugin.

## Repair existing text

No need to copy and paste the note again:

- Click the **sigma (Σ) ribbon icon**, labelled **Fix math in current note**.
- Or open the command palette and run **LaTeX Delimiter Fix: Repair math in current note**.
- Or right-click in the editor and choose **Fix math in current note**.
- For a passage, select it and run **Repair math in selection** or use the editor context menu.
- The plugin settings also have a **Fix math** button.

The current-note command works in editing mode and Reading view. Only the active note is repaired. Selection repair only changes complete expressions fully inside a selection and checks the surrounding note for code/math context.

In editing mode, use **Undo** to reverse a repair. In Reading view, use **LaTeX Delimiter Fix: Revert last note repair**. The latter stores one repair in memory for the current session and refuses to revert if the note has changed. It is not a persistent backup or vault history.

Use Reading view or Live Preview with your cursor outside the equation to see rendered math. Source mode intentionally shows raw syntax.

## Automatic paste repair

Enabled by default. Disable **Fix LaTeX on paste** in the plugin settings if desired. When conversion is needed, the plugin inserts plain-text Markdown from the clipboard, so rich clipboard formatting is not retained. Images, file pastes, multiple-cursor pastes, and pastes already handled by another plugin are left alone. Existing text elsewhere in the note is not changed by pasting.

## Install or update manually

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/Ayush4265/latex-delimiter-fix/releases/latest), or extract the plugin ZIP.
2. Put them in `<your vault>/.obsidian/plugins/latex-delimiter-fix/`. When updating, replace the existing files.
3. Restart/reload Obsidian, then enable **LaTeX Delimiter Fix** in **Settings > Community plugins**. For an update, toggling the plugin off and on also reloads it.

Requires Obsidian 1.5.0 or later. No build step is needed for installation.

## Example

Before:

```text
\[\text{Sequence} = \text{First} \longrightarrow \text{Next} \longrightarrow \text{Last}\]
```

After:

```text
$$
\text{Sequence} = \text{First} \longrightarrow \text{Next} \longrightarrow \text{Last}
$$
```

The converter also handles standalone display blocks in basic quotes and lists, and display math embedded in ordinary prose by separating it into a block.

## What stays unchanged

The converter skips fenced and indented code, matched inline code, YAML properties, HTML/Obsidian comments, HTML `code`/`pre` blocks, wiki links, Markdown link destinations, and existing matched dollar-delimited math. An expression cannot cross a protected region. Incomplete pairs are left alone. TeX content is preserved apart from whitespace at expression edges and container prefixes.

## Limits

This repairs **delimiters**, not invalid TeX or missing LaTeX packages. Long equations may still need manual line breaks. Inline expressions must close on the same line. Display expressions spanning blank paragraphs, table cells, complex nested Markdown, or mixed prose within list/quote containers may be skipped. Literal paired delimiters in ordinary prose are indistinguishable from intended math; review repairs and use Undo if necessary.

The converter is a conservative source scanner rather than a full Markdown parser. Automated tests cover the original long-form equation, existing notes, Reading view/revert, selections, clipboard context, protected regions, malformed input, and repeated repairs. Tests use a mocked Obsidian API; this release was not manually exercised in a running Obsidian instance during development. Mobile uses only public Obsidian and standard JavaScript APIs, but on-device testing remains outstanding.

## Privacy

Runs locally. No network calls, telemetry, account, API key, remote code, external dependencies, or access outside the vault. Only explicit repairs and handled paste events change note content. All event handlers are registered with Obsidian for cleanup when the plugin unloads.

## Development

Requires Node.js 20 or later, with no third-party build or test dependencies:

```sh
node build.cjs
node --check main.js
node --test test/*.test.cjs
```

Edit `src/math.js` or `src/main.js`, then rebuild. `main.js` is the readable generated runtime bundle. The GitHub release tag must match the version in `manifest.json` exactly, without a `v` prefix; attach `main.js` and `manifest.json` as individual release assets.

Licensed under [MIT](LICENSE).

Author: **Atharva Savnerkar** ([Ayush4265](https://github.com/Ayush4265)).

