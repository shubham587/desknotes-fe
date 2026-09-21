// Pure task-detection for notes. Given the note's blocks as {type, text}, apply
// clear TODO-SECTION rules and return the individual task texts.
//
//   START — a marker line: "Todo:" / "Todos:" / "To-do:" / "Action:" /
//           "Action items:" (a colon inline, OR a heading that is just that
//           word). Text after the colon on the same line is the first task(s).
//   BODY  — every following line is one task (bullets/numbers optional); an
//           inline "1. a 2. b" is split into separate tasks.
//   END   — the section ends at the first BLANK line, the next heading, or the
//           end of the note. Anything after that is normal notes, never a todo.
//   Outside any section, only an explicit checkbox line ("[ ] …") is a task.

const clean = (t) =>
  (t || "")
    .replace(/^[-*•\s]*(?:\[[ xX]?\]\s*)?(?:\d{1,2}\s*[.)]\s*)?/, "")
    .replace(/[.,;:\s]+$/, "")
    .trim();

const splitItems = (s) =>
  s.split(/(?=\s\d{1,2}\s*[.)]\s)|\n/).map((x) => x.trim()).filter(Boolean);

// text after a start marker (may be ""), or null if the block isn't a marker.
// A marker is: "Todo:" / "Action items:" etc. with a colon (anywhere on the
// line — text after the colon are same-line tasks), OR a SHORT line that simply
// begins with a marker word ("Action", "Todo", "Todo on monday", a "Todo"
// heading). Trailing words on a no-colon marker (e.g. "on monday") are a label,
// not a task. The short-line guard keeps prose like "Action plan for Q3" out.
const startAfter = (type, text) => {
  const inline = text.match(/\b(?:to-?dos?|action items?|actions?)\s*:/i);
  if (inline) return text.slice(inline.index + inline[0].length).trim();
  const lead = text.match(/^(?:to-?dos?|action items?|actions?)\b/i);
  if (lead) {
    const rest = text.slice(lead[0].length).trim();
    if (rest === "" || type === "heading" || text.split(/\s+/).length <= 4) return "";
  }
  return null;
};

export function parseTasks(blocks) {
  const out = [];
  const pushItems = (s) =>
    splitItems(s).forEach((it) => {
      const c = clean(it);
      if (c.length > 1) out.push(c);
    });

  let inSection = false;
  for (const { type, text } of blocks) {
    const t = (text || "").trim();
    const after = startAfter(type, t);

    if (after !== null) {
      inSection = true; // a marker opens (or reopens) a todo section
      if (after) pushItems(after);
      continue;
    }
    if (inSection) {
      if (!t || type === "heading") {
        inSection = false; // blank line or heading closes the section
      } else {
        pushItems(t); // every line inside the section is a task
        continue;
      }
    }
    // outside a section: only an explicit checkbox is a standalone task
    if (type === "checkListItem" || /^\s*\[[ xX]?\]\s*\S/.test(t)) {
      const c = clean(t);
      if (c.length > 1) out.push(c);
    }
  }
  return [...new Set(out)];
}
