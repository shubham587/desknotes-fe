// strip markdown syntax to plain text for previews
export function mdToPlain(s) {
  return (s || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/[#>*_`~]/g, "") // md tokens
    .replace(/\s+/g, " ")
    .trim();
}

// relative time like "2h ago", "Yesterday", "Mar 3"
export function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 2880) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
