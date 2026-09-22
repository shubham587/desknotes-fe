import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Popover,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  TagsInput,
  Text,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBook,
  IconCopy,
  IconDeviceFloppy,
  IconDots,
  IconFileTypePdf,
  IconFolderPlus,
  IconMarkdown,
  IconPhotoPlus,
  IconResize,
  IconSitemap,
  IconTrash,
} from "@tabler/icons-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { marked } from "marked";
import { api, mediaUrl } from "./api";
import { parseTasks } from "./tasks.js";
import { confirmDelete, promptText } from "./dialogs.jsx";
import MermaidModal from "./MermaidModal.jsx";
import CaptureFlow from "./CaptureFlow.jsx";
import BookView from "./BookView.jsx";
import AddTasksModal from "./AddTasksModal.jsx";

// Render stored markdown into BlockNote blocks. BlockNote's own markdown parser
// throws on common content (code fences, some lists), so go markdown -> HTML
// (via marked) -> BlockNote HTML import, which is far more robust. Fallbacks keep
// content from ever being lost.
async function mdToBlocks(editor, md) {
  try {
    let html = marked.parse(md, { async: false, breaks: true, gfm: true });
    // BlockNote's code-block importer calls .toLowerCase() on the language and
    // crashes on fences with no language — give those a default language.
    html = html.replace(/<pre><code>/g, '<pre><code class="language-text">');
    const blocks = await editor.tryParseHTMLToBlocks(html);
    if (blocks?.length) return blocks;
  } catch {
    /* fall through */
  }
  try {
    const blocks = await editor.tryParseMarkdownToBlocks(md);
    if (blocks?.length) return blocks;
  } catch {
    /* fall through */
  }
  return md.split("\n").map((line) => ({
    type: "paragraph",
    content: line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*]\s+/, "• ")
      .replace(/[*_`]/g, ""),
  }));
}

export default function NoteView({ note, folders, allTags, onSaved, onDeleted, dirtyRef, saveFnRef }) {
  const { colorScheme } = useMantineColorScheme();
  // uploadFile lets BlockNote accept pasted/dropped images (stores them in /media)
  const editor = useCreateBlockNote({
    uploadFile: async (file) => {
      const { url } = await api.upload(file);
      return mediaUrl(url);
    },
  });
  const [title, setTitle] = useState(note.title);
  const [folderId, setFolderId] = useState(note.folder_id ? String(note.folder_id) : null);
  const [tags, setTags] = useState(note.tags || []);
  const [font, setFont] = useState(note.font_style === "standard" ? "standard" : "handwriting");
  const [saving, setSaving] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [appendFiles, setAppendFiles] = useState(null);
  const [appending, setAppending] = useState(false);
  const [folderList, setFolderList] = useState(folders || []);
  const [bookOpen, setBookOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [pendingTasks, setPendingTasks] = useState(null); // detected tasks awaiting add choice
  // image size persisted in the image block's content as "width,height".
  // width is a PERCENT of the text column (25–100); height is px (0 → auto).
  // legacy notes stored width in px (>100) — clamp those to full width.
  const imgSize = ((note.blocks || []).find((b) => b.type === "image" && b.image_path)?.content || "").split(",");
  const [diagramW, setDiagramW] = useState(() => {
    const v = Number(imgSize[0]);
    return v > 0 && v <= 100 ? v : 100;
  });
  const [diagramH, setDiagramH] = useState(() => Number(imgSize[1]) || 0);
  const bodyRef = useRef(null); // the editor body, for applying the height CSS var

  const readyRef = useRef(false); // editor finished loading initial content
  const markDirty = () => {
    if (dirtyRef) dirtyRef.current = true;
  };

  // both dimensions applied via CSS vars (BlockNote ignores previewWidth for
  // inserted images), set on the note body so re-renders don't reset them
  const applyDiagramW = (w) => bodyRef.current?.style.setProperty("--diagram-w", w ? `${w}%` : "100%");
  const applyDiagramH = (h) => bodyRef.current?.style.setProperty("--diagram-h", h ? `${h}px` : "auto");
  const resizeDiagramW = (w) => {
    setDiagramW(w);
    markDirty();
    applyDiagramW(w);
  };
  const resizeDiagramH = (h) => {
    setDiagramH(h);
    markDirty();
    applyDiagramH(h);
  };
  const fileInput = useRef(null);
  const promptedTodo = useRef(new Set());
  const diagram = (note.blocks || []).find((b) => b.type === "image" && b.image_path);

  // Extract task texts from the note's blocks using the shared TODO-SECTION
  // rules (see tasks.js): a "Todo:" marker opens a section, every following line
  // is a task, and a blank line / heading / end-of-note closes it.
  const findTasks = () =>
    parseTasks(
      editor.document.map((block) => ({
        type: block.type,
        text: (block.content || []).map((n) => n.text || "").join(""),
      })),
    );

  // Sync the note's tasks with its Todos on save:
  // - a task edited in place (its old todo disappeared, a new text appeared) →
  //   UPDATE that linked todo instead of duplicating
  // - a genuinely new task → offer to add (linked to this note)
  // - unchanged tasks → nothing
  const syncTaskTodos = async (currentTasks) => {
    let all = [];
    try {
      all = await api.todos();
    } catch {
      /* ignore */
    }
    const norm = (s) => (s || "").trim().toLowerCase();
    const allTexts = new Set(all.map((t) => norm(t.text)));
    const noteTodos = all.filter((t) => t.doc_id === note.id);

    // tasks not matching ANY existing todo text = new-or-edited
    const appeared = currentTasks.filter((task) => !allTexts.has(norm(task)));
    // this note's todos whose text is no longer a current task = removed-or-edited
    const disappeared = noteTodos.filter((t) => !currentTasks.some((task) => norm(task) === norm(t.text)));

    // pair disappeared todos ↔ appeared tasks (in order) = edits → update in place
    const stillNew = [...appeared];
    let updated = 0;
    for (const todo of disappeared) {
      if (!stillNew.length) break;
      await api.updateTodoText(todo.id, stillNew.shift());
      updated += 1;
    }
    if (updated) notifications.show({ message: `Updated ${updated} todo${updated > 1 ? "s" : ""}`, color: "green" });

    // remaining appeared tasks (not already offered) → ask to add
    const toOffer = stillNew.filter((t) => !promptedTodo.current.has(norm(t)));
    toOffer.forEach((t) => promptedTodo.current.add(norm(t)));
    askAddTodos(toOffer);
  };

  // Ask whether to add the detected task-like lines to Todos (as separate todos
  // or one checklist). Driven by state so the modal survives the post-save
  // re-render. Deferred a tick so it opens after that render settles.
  const askAddTodos = (tasks) => {
    if (!tasks.length) return;
    setTimeout(() => setPendingTasks(tasks), 150);
  };

  const addSeparate = async (tasks) => {
    for (const t of tasks) await api.addTodo(t, note.id); // link so edits sync
    notifications.show({ message: `Added ${tasks.length} to Todos`, color: "green" });
  };

  const addChecklist = async (name, tasks) => {
    await api.createTodoList(name, tasks, note.id);
    notifications.show({ message: `Added checklist “${name}”`, color: "green" });
  };

  const onEditorChange = () => {
    if (readyRef.current) markDirty();
  };
  // subscribe to editor changes (fires on typing → marks the note dirty)
  useEffect(() => editor.onChange?.(onEditorChange), [editor]);
  // convert Mermaid from the full original photo (crop may be clipped); fall back to the crop
  const mermaidSource = note.originals?.[0]
    ? mediaUrl(note.originals[0])
    : diagram && mediaUrl(diagram.image_path);

  // Load stored blocks into the editor: text content is parsed as MARKDOWN (so
  // headings/lists/bold render nicely — incl. imported .md), images stay images.
  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const b of note.blocks || []) {
        if (b.type === "image" && b.image_path) {
          // image blocks store "width,height" in content (persisted resize)
          out.push({ type: "image", props: { url: mediaUrl(b.image_path), previewWidth: Number((b.content || "").split(",")[0]) || 520 } });
        } else if ((b.content || "").trim()) {
          out.push(...(await mdToBlocks(editor, b.content)));
        }
      }
      if (alive) editor.replaceBlocks(editor.document, out.length ? out : [{ type: "paragraph" }]);
      // grace period so the load's own change event doesn't mark the note dirty
      setTimeout(() => {
        if (!alive) return;
        readyRef.current = true;
        applyDiagramW(diagramW); // restore persisted width + height
        applyDiagramH(diagramH);
      }, 50);
    })();
    return () => {
      alive = false;
      readyRef.current = false;
    };
  }, [note, editor]);

  // Editor blocks -> stored blocks: consecutive text blocks become one markdown
  // text block; images stay image blocks (keeps diagram/mermaid working).
  const serialize = async () => {
    const stored = [];
    let buf = [];
    const flush = async () => {
      if (buf.length) {
        const md = (await editor.blocksToMarkdownLossy(buf)).trim();
        if (md) stored.push({ type: "text", content: md });
        buf = [];
      }
    };
    for (const b of editor.document) {
      if (b.type === "image") {
        await flush();
        // persist "width,height" so both survive reloads (height 0 = auto)
        // store the path relative to the backend ("/media/x.png"), not the full
        // URL, so it keeps working if the backend URL changes
        const u = b.props?.url || "";
        stored.push({
          type: "image",
          content: `${diagramW},${diagramH}`,
          image_path: u.startsWith("http") ? new URL(u).pathname : u,
        });
      } else {
        buf.push(b);
      }
    }
    await flush();
    return stored;
  };

  // swap the diagram image block for the rendered Mermaid SVG in the live editor,
  // then persist. (Updating the editor directly is required — BlockNote is created
  // once and ignores later initialContent changes.)
  const replaceDiagram = async (svgUrl) => {
    const imgBlock = editor.document.find((b) => b.type === "image");
    if (imgBlock) editor.updateBlock(imgBlock, { props: { url: svgUrl, previewWidth: 512 } });
    const updated = await api.updateNote(note.id, {
      title,
      folder_id: folderId ? Number(folderId) : null,
      font_style: font,
      blocks: await serialize(),
      tags,
    });
    onSaved?.(updated);
  };
  // enough content to be worth paging? (~a page of lines)
  const lineCount = (note.blocks || []).reduce(
    (n, b) => n + (b.type === "image" ? 1 : (b.content || "").split("\n").length),
    0,
  );

  const createFolder = () =>
    promptText({
      title: "New folder",
      label: "Folder name",
      placeholder: "e.g. Standup",
      onSubmit: async (name) => {
        const existing = folderList.find((f) => f.name.toLowerCase() === name.toLowerCase());
        if (existing) return setFolderId(String(existing.id));
        const { id } = await api.createFolder(name);
        setFolderList((prev) => [...prev, { id, name }]);
        setFolderId(String(id));
      },
    });

  const doAppend = async (files) => {
    setAppendFiles(null);
    setAppending(true);
    try {
      const updated = await api.appendPhotos(note.id, files);
      notifications.show({ message: "Photo added to note", color: "green" });
      onSaved?.(updated);
    } catch (e) {
      notifications.show({ message: e.message, color: "red" });
    } finally {
      setAppending(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateNote(note.id, {
        title,
        folder_id: folderId ? Number(folderId) : null,
        font_style: font,
        blocks: await serialize(),
        tags,
      });
      if (dirtyRef) dirtyRef.current = false;
      notifications.show({ message: "Saved", color: "green" });
      const tasks = findTasks(); // capture while the editor is still stable
      onSaved?.(updated);
      syncTaskTodos(tasks); // update edited tasks in place; ask only about genuinely new ones
    } catch (e) {
      notifications.show({ message: `Save failed: ${e.message}`, color: "red" });
    } finally {
      setSaving(false);
    }
  };
  // let Shell trigger a save when navigating away with unsaved changes
  if (saveFnRef) saveFnRef.current = save;

  const copy = async () => {
    const md = await editor.blocksToMarkdownLossy(editor.document);
    await navigator.clipboard.writeText(`# ${title}\n\n${md}`);
    notifications.show({ message: "Copied to clipboard", color: "green" });
  };

  const remove = () =>
    confirmDelete({
      title: "Delete note",
      message: `Delete “${note.title}”? This can't be undone.`,
      onConfirm: async () => {
        await api.deleteNote(note.id);
        notifications.show({ message: "Note deleted", color: "green" });
        onDeleted?.(note.id);
      },
    });

  const downloadMd = async () => {
    const md = await editor.blocksToMarkdownLossy(editor.document);
    const blob = new Blob([`# ${title}\n\n${md}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "note"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPdf = async () => {
    const html = await editor.blocksToHTMLLossy(editor.document);
    const w = window.open("", "_blank");
    if (!w) {
      notifications.show({
        color: "orange",
        message: "Allow pop-ups for this site to export as PDF, then try again.",
      });
      return;
    }
    w.document.write(
      `<title>${title}</title><style>body{font-family:sans-serif;padding:40px;max-width:720px;margin:auto;line-height:1.6}h1{font-size:26px}img{max-width:100%}</style><h1>${title}</h1>${html}`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  const folderOptions = folderList.map((f) => ({ value: String(f.id), label: f.name }));

  return (
    <Stack>
      <TextInput
        value={title}
        onChange={(e) => {
          setTitle(e.currentTarget.value);
          markDirty();
        }}
        size="lg"
        variant="unstyled"
        placeholder="Untitled"
        styles={{ input: { fontSize: 26, fontWeight: 600 } }}
      />
      <Group gap="sm" wrap="wrap">
        <Group gap={4} wrap="nowrap" style={{ flex: "1 1 200px", minWidth: 0 }}>
          <Select
            placeholder="No folder"
            data={folderOptions}
            value={folderId}
            onChange={(v) => {
              setFolderId(v);
              markDirty();
            }}
            clearable
            searchable
            style={{ flex: 1, minWidth: 0 }}
            size="xs"
          />
          <ActionIcon variant="light" size="lg" onClick={createFolder} aria-label="New folder" title="New folder">
            <IconFolderPlus size={16} />
          </ActionIcon>
        </Group>
        <TagsInput
          placeholder="tags"
          data={allTags}
          value={tags}
          onChange={(v) => {
            setTags(v);
            markDirty();
          }}
          style={{ flex: "1 1 240px", minWidth: 0 }}
          size="xs"
        />
        <SegmentedControl
          size="xs"
          value={font}
          onChange={(v) => {
            setFont(v);
            markDirty();
          }}
          data={[
            { label: "Handwriting", value: "handwriting" },
            { label: "Standard", value: "standard" },
          ]}
        />
        <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} onClick={save} loading={saving}>
          Save
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconPhotoPlus size={14} />}
          loading={appending}
          onClick={() => fileInput.current?.click()}
        >
          Add photo
        </Button>
        {diagram && (
          <Popover
            width={280}
            position="bottom-start"
            shadow="md"
            withArrow
            opened={resizeOpen}
            onChange={setResizeOpen}
          >
            <Popover.Target>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconResize size={14} />}
                onClick={() => setResizeOpen((o) => !o)}
              >
                Resize
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <div>
                  <Text size="xs" fw={500} mb={4}>
                    Width — {diagramW}%
                  </Text>
                  <Slider
                    min={25}
                    max={100}
                    step={5}
                    value={diagramW}
                    onChange={resizeDiagramW}
                    label={(v) => `${v}%`}
                  />
                </div>
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" fw={500}>
                      Height — {diagramH ? `${diagramH}px` : "auto"}
                    </Text>
                    {diagramH > 0 && (
                      <Button size="compact-xs" variant="subtle" onClick={() => resizeDiagramH(0)}>
                        Auto
                      </Button>
                    )}
                  </Group>
                  <Slider
                    min={0}
                    max={900}
                    step={10}
                    value={diagramH}
                    onChange={resizeDiagramH}
                    label={(v) => (v ? `${v}px` : "auto")}
                  />
                </div>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        )}
        <Menu position="bottom-end" width={210} withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<IconDots size={14} />}>
              More
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={copy}>
              Copy to clipboard
            </Menu.Item>
            <Menu.Item leftSection={<IconMarkdown size={14} />} onClick={downloadMd}>
              Download .md
            </Menu.Item>
            <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={downloadPdf}>
              Download PDF
            </Menu.Item>
            {diagram && (
              <Menu.Item leftSection={<IconSitemap size={14} />} onClick={() => setMermaidOpen(true)}>
                Diagram → Mermaid
              </Menu.Item>
            )}
            {lineCount > 12 && (
              <Menu.Item leftSection={<IconBook size={14} />} onClick={() => setBookOpen(true)}>
                Book view
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={remove}>
              Delete note
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) setAppendFiles(files);
            e.target.value = "";
          }}
        />
      </Group>
      <div ref={bodyRef} className={font === "handwriting" ? "handwriting" : undefined}>
        <BlockNoteView editor={editor} theme={colorScheme === "dark" ? "dark" : "light"} />
      </div>
      {mermaidOpen && (
        <MermaidModal
          sourcePath={mermaidSource}
          onReplace={replaceDiagram}
          onClose={() => setMermaidOpen(false)}
        />
      )}
      {appendFiles && (
        <CaptureFlow files={appendFiles} onCancel={() => setAppendFiles(null)} onDone={doAppend} />
      )}
      {bookOpen && <BookView note={note} onClose={() => setBookOpen(false)} />}
      {pendingTasks && (
        <AddTasksModal
          tasks={pendingTasks}
          defaultName={title || "Checklist"}
          onSeparate={addSeparate}
          onChecklist={addChecklist}
          onClose={() => setPendingTasks(null)}
        />
      )}
    </Stack>
  );
}
