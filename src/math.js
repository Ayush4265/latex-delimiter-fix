'use strict';

function escaped(s, i) {
  let n = 0;
  while (i > 0 && s[--i] === '\\') n++;
  return n % 2 === 1;
}

// Build a source mask before finding delimiters. Masked text is never rewritten.
function protectedMask(s) {
  const mask = new Uint8Array(s.length);
  const mark = (a, b) => mask.fill(1, a, b);
  let offset = 0, fence = null, yaml = false;
  const lines = s.match(/[^\n]*\n|[^\n]+$/g) || [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], bare = line.replace(/\r?\n$/, '');
    if (index === 0 && bare.replace(/^\uFEFF/, '') === '---') yaml = true;
    if (yaml) {
      mark(offset, offset + line.length);
      if (index > 0 && /^(---|\.\.\.)\s*$/.test(bare)) yaml = false;
    } else {
      const m = bare.match(/^(?: {0,3}> ?)* {0,3}(?:[-+*] |\d+[.)] )?(`{3,}|~{3,})(.*)$/);
      if (fence) {
        mark(offset, offset + line.length);
        if (m && m[1][0] === fence.char && m[1].length >= fence.size && !m[2].trim()) fence = null;
      } else if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        fence = { char: m[1][0], size: m[1].length };
        mark(offset, offset + line.length);
      } else if (/^(?: {4}|\t)/.test(bare)) mark(offset, offset + line.length);
    }
    offset += line.length;
  }
  // Match runs once, so long notes full of unmatched backticks don't trigger repeated searches.
  const ticks = new Map();
  for (const m of s.matchAll(/`+/g)) {
    if (!mask[m.index] && !escaped(s, m.index)) {
      const group = ticks.get(m[0].length) || [];
      group.push(m.index); ticks.set(m[0].length, group);
    }
  }
  const nextTick = new Map();
  for (const [size, positions] of ticks) {
    for (let i = 0; i + 1 < positions.length; i++) nextTick.set(positions[i], positions[i + 1] + size);
  }
  const dollarEnds = new Map();
  for (const token of ['$$', '$']) {
    let next = -1;
    for (let i = s.length - 1; i >= 0; i--) {
      if (token === '$' && s[i] === '\n') next = -1;
      if (s.startsWith(token, i) && !mask[i] && !escaped(s, i) &&
          (token === '$$' ? s[i - 1] !== '$' && s[i + 2] !== '$' : s[i - 1] !== '$' && s[i + 1] !== '$')) {
        if (next >= 0) dollarEnds.set(i, next + token.length);
        next = i;
      }
    }
  }
  for (let i = 0; i < s.length;) {
    if (mask[i]) { i++; continue; }
    let end = -1;
    for (const [open, close] of [['<!--', '-->'], ['%%', '%%']]) {
      if (s.startsWith(open, i) && !escaped(s, i)) {
        const j = s.indexOf(close, i + open.length);
        end = j < 0 ? s.length : j + close.length;
        break;
      }
    }
    if (end < 0 && nextTick.has(i)) end = nextTick.get(i);
    if (end < 0 && dollarEnds.has(i)) end = dollarEnds.get(i);
    // Protect HTML code/pre blocks and link destinations, including their delimiters.
    if (end < 0 && s[i] === '<') {
      const m = s.slice(i, i + 100).match(/^<(code|pre)\b[^>]*>/i);
      if (m) {
        const re = new RegExp('</' + m[1] + '\\s*>', 'ig'); re.lastIndex = i + m[0].length;
        const close = re.exec(s); end = close ? close.index + close[0].length : s.length;
      }
    }
    if (end < 0 && s.startsWith('[[', i)) {
      const close = s.indexOf(']]', i + 2);
      end = close < 0 ? s.length : close + 2;
    }
    if (end < 0 && s.startsWith('](', i) && !escaped(s, i)) {
      let depth = 1, j = i + 2;
      for (; j < s.length && depth; j++) {
        if (escaped(s, j)) continue;
        if (s[j] === '(') depth++;
        if (s[j] === ')') depth--;
      }
      end = j;
    }
    if (end > i) { mark(i, end); i = end; } else i++;
  }
  return mask;
}

function displayText(s, from, to, raw, nl) {
  const lineStart = s.lastIndexOf('\n', from - 1) + 1;
  const before = s.slice(lineStart, from);
  const lineEnd = s.indexOf('\n', to);
  const after = s.slice(to, lineEnd < 0 ? s.length : lineEnd).replace(/\r$/, '');
  const container = before.match(/^( {0,3}(?:> ?)*)(?:([-+*]|\d+[.)]) +)?$/);
  if (container) {
    const continuation = container[1] + (container[2] ? ' '.repeat(before.length - container[1].length) : '');
    const rawLines = raw.split(/\r?\n/);
    // Keep quote prefixes on the outside of the math expression.
    if (continuation.trim()) {
      for (let i = 1; i < rawLines.length; i++) {
        if (rawLines[i].startsWith(continuation)) rawLines[i] = rawLines[i].slice(continuation.length);
        else if (rawLines[i].trim()) return null;
      }
    }
    const body = rawLines.join(nl).trim();
    if (!body) return null;
    if (after.trim()) return null;
    return '$$' + nl + body.split(nl).map(line => continuation + line).join(nl) + nl + continuation + '$$';
  }
  // Split a prose paragraph around display math. Leave table/list/quote structures alone.
  if (/^\s*(?:>|[-+*] |\d+[.)] |\|)/.test(before) || before.includes('|') || after.includes('|')) return null;
  if (raw.includes('\n')) return null;
  return nl + nl + '$$' + nl + raw.trim() + nl + '$$' + nl + nl;
}

function findEdits(s) {
  const mask = protectedMask(s), edits = [];
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  let pending = null;
  for (let i = 0; i < s.length; i++) {
    if (mask[i]) { pending = null; continue; }
    if (s[i] === '\n' && pending && (!pending.display || /^\r?\n/.test(s.slice(i + 1, i + 3)))) pending = null;
    if (s[i] !== '\\') continue;
    if (s[i + 1] === '\\') { i++; continue; }
    const next = s[i + 1];
    if (next === '[' || next === '(') {
      pending = { from: i, display: next === '[' };
      i++; continue;
    }
    if (!pending || next !== (pending.display ? ']' : ')')) continue;
    const raw = s.slice(pending.from + 2, i);
    const body = raw.trim();
    const text = !body ? null : pending.display ? displayText(s, pending.from, i + 2, raw, nl) : '$' + body + '$';
    if (text !== null) edits.push({ from: pending.from, to: i + 2, text });
    pending = null; i++;
  }
  return edits;
}

function applyEdits(s, edits) {
  const parts = []; let cursor = 0;
  for (const e of edits) {
    parts.push(s.slice(cursor, e.from), e.text); cursor = e.to;
  }
  parts.push(s.slice(cursor)); return parts.join('');
}

function editsInRange(s, from, to) {
  return findEdits(s).filter(e => e.from >= from && e.to <= to);
}
module.exports = { findEdits, applyEdits, editsInRange };

