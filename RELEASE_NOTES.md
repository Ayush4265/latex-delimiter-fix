Fix math skipped inside italic and bold nested list items.

- Classify indentation relative to list content rather than treating every four-space-indented line as code.
- Support inline math in nested unordered/ordered lists, tab indentation, and list continuation paragraphs.
- Preserve italics, bold text, list indentation, and surrounding prose.
- Keep actual indented/fenced code protected, including code in block quotes.
- Apply the fix to current-note, selection, and paste repair.

Validation: 95 automated tests pass. Regression checks cover both reported italic list lines and preserve all 28 fenced blocks in the local verification note. Tests use a mocked Obsidian API; live desktop/mobile rendering tests remain outstanding.

Author: Atharva Savnerkar.

To update, replace `main.js` and `manifest.json` in `.obsidian/plugins/latex-delimiter-fix/`, reload the plugin, then run **Repair math in current note**.
