// Runnable check: `node src/tasks.test.mjs`. No framework — asserts + exit code.
import assert from "node:assert/strict";
import { parseTasks } from "./tasks.js";

const b = (type, text) => ({ type, text });

// The reported bug: "Todo:" on its own line, pointers on the following lines,
// then normal notes after a blank line.
assert.deepEqual(
  parseTasks([
    b("heading", "Monday"),
    b("paragraph", "Todo:"),
    b("bulletListItem", "call the vendor"),
    b("bulletListItem", "review the flow diagram"),
    b("paragraph", ""), // blank line ends the section
    b("paragraph", "these are just my notes, not a todo"),
  ]),
  ["call the vendor", "review the flow diagram"],
);

// Tasks inline on the marker line, numbered, still split.
assert.deepEqual(
  parseTasks([b("paragraph", "Todo: 1. pay rent 2) email Sam")]),
  ["pay rent", "email Sam"],
);

// A heading closes the section (no blank line needed).
assert.deepEqual(
  parseTasks([
    b("heading", "Action items"),
    b("numberedListItem", "book the room"),
    b("heading", "Notes"),
    b("paragraph", "ignore me"),
  ]),
  ["book the room"],
);

// Real note 14: "Action" (no colon) then numbered items, then an image block.
assert.deepEqual(
  parseTasks([
    b("paragraph", "Action"),
    b("numberedListItem", "Check with vengal"),
    b("numberedListItem", "Review the flow with team"),
    b("image", ""),
  ]),
  ["Check with vengal", "Review the flow with team"],
);

// Real note 41: "Todo on monday" (marker + label, no colon) then bullets.
assert.deepEqual(
  parseTasks([
    b("paragraph", "Todo on monday"),
    b("bulletListItem", "keep your shit up"),
    b("bulletListItem", "add the linear comments"),
    b("bulletListItem", "do the changes on UI"),
  ]),
  ["keep your shit up", "add the linear comments", "do the changes on UI"],
);

// Guard: prose that merely begins with a marker word is NOT a section.
assert.deepEqual(parseTasks([b("paragraph", "Action plan for the Q3 product launch")]), []);

// No marker + prose only → nothing captured.
assert.deepEqual(parseTasks([b("paragraph", "just a normal note about Monday")]), []);

// Standalone checkbox outside any section is still a task.
assert.deepEqual(parseTasks([b("checkListItem", "[ ] buy milk")]), ["buy milk"]);

// Dedupes repeats.
assert.deepEqual(
  parseTasks([b("paragraph", "Todo:"), b("bulletListItem", "call X"), b("bulletListItem", "call X")]),
  ["call X"],
);

console.log("tasks.js: all checks passed");
