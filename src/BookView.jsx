import { useMemo, useState } from "react";
import { ActionIcon, Group, Modal, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

const LINES_PER_PAGE = 12;

// Flatten stored blocks into renderable "lines" (text lines + images), then
// paginate. Read-only book view; editing stays in the normal editor.
function toLines(blocks) {
  const lines = [];
  for (const b of blocks || []) {
    if (b.type === "image" && b.image_path) lines.push({ type: "image", src: b.image_path });
    else for (const l of (b.content || "").split("\n")) lines.push({ type: "text", text: l });
  }
  return lines;
}

function paginate(lines) {
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  return pages.length ? pages : [[]];
}

export default function BookView({ note, onClose }) {
  const pages = useMemo(() => paginate(toLines(note.blocks)), [note]);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState("next");

  const go = (delta) => {
    const next = page + delta;
    if (next < 0 || next >= pages.length) return;
    setDir(delta > 0 ? "next" : "prev");
    setPage(next);
  };

  return (
    <Modal opened onClose={onClose} size="lg" title={note.title} centered>
      <div className="book-stage">
        {/* key={page} remounts the page so the flip animation retriggers */}
        <div key={page} className={`book-page ${dir}`}>
          {pages[page].map((ln, i) =>
            ln.type === "image" ? (
              <img key={i} src={ln.src} alt="" style={{ maxWidth: "100%", margin: "0.5rem 0" }} />
            ) : (
              <div key={i}>{ln.text || " "}</div>
            ),
          )}
        </div>
      </div>
      <Group justify="space-between" mt="md">
        <ActionIcon variant="default" size="lg" onClick={() => go(-1)} disabled={page === 0} aria-label="Previous page">
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Text size="sm" c="dimmed">
          Page {page + 1} of {pages.length}
        </Text>
        <ActionIcon
          variant="default"
          size="lg"
          onClick={() => go(1)}
          disabled={page === pages.length - 1}
          aria-label="Next page"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
