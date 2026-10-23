# Changelog

## 1.1.0

- Add a visible ribbon button, settings button, and context menus to repair existing notes.
- Make current-note repairs work in Reading view, with an explicit guarded revert command.
- Add selection repair that respects the surrounding Markdown context.
- Support display math in ordinary prose and basic list/quote containers.
- Protect YAML with a byte-order mark, HTML code/pre blocks, wiki links, and link destinations.
- Avoid repeatedly searching for the end of every malformed math opener.
- Bundle the runtime reproducibly and add automated converter/plugin tests.

## 1.0.0

- Initial local version with paste conversion and an editor repair command.
