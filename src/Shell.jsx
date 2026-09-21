import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Loader,
  NavLink,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconChecklist,
  IconChevronDown,
  IconChevronUp,
  IconFolder,
  IconFolderPlus,
  IconGripVertical,
  IconLogout,
  IconMoon,
  IconNotes,
  IconPencilPlus,
  IconPhotoUp,
  IconPlus,
  IconSearch,
  IconSun,
  IconTag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { api, clearToken } from "./api";
import { confirmDelete, promptText } from "./dialogs.jsx";
import { mdToPlain, relTime } from "./util.js";
import Home from "./Home.jsx";
import NoteView from "./NoteView.jsx";
import CaptureFlow from "./CaptureFlow.jsx";
import CameraCapture from "./CameraCapture.jsx";

export default function Shell({ onLogout }) {
  const [opened, { toggle, close }] = useDisclosure();
  const [folders, setFolders] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [todos, setTodos] = useState([]);
  const [todoLists, setTodoLists] = useState([]);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [view, setView] = useState("note"); // note (home when no active) | capture | todos
  const [active, setActive] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(null); // folder id (or "none") being hovered
  const [newTodo, setNewTodo] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dirtyRef = useRef(false); // active note has unsaved edits
  const saveFnRef = useRef(null); // NoteView registers its save() here

  const isEmptyDraft = (n) =>
    n && n.title === "Untitled" && !(n.blocks || []).some((b) => b.type === "image" || (b.content || "").trim());

  // delete an untouched empty draft so blank notes don't pile up
  const cleanupEmpty = async () => {
    if (active && !dirtyRef.current && isEmptyDraft(active)) {
      await api.deleteNote(active.id).catch(() => {});
      return true;
    }
    return false;
  };

  // run `proceed` after handling unsaved edits / empty drafts on the current note
  const guardLeave = (rawProceed) => {
    // any navigation also closes the mobile nav drawer so content is visible
    const proceed = () => {
      close();
      rawProceed();
    };
    if (!active) return proceed();
    if (dirtyRef.current) {
      modals.openConfirmModal({
        title: "Unsaved changes",
        centered: true,
        children: <Text size="sm">You have unsaved changes to “{active.title}”. Save them?</Text>,
        labels: { confirm: "Save", cancel: "Discard" },
        onConfirm: async () => {
          await saveFnRef.current?.();
          dirtyRef.current = false;
          loadNotes();
          proceed();
        },
        onCancel: async () => {
          dirtyRef.current = false;
          if (await cleanupEmpty()) loadNotes();
          proceed();
        },
      });
    } else {
      cleanupEmpty().then((deleted) => {
        if (deleted) loadNotes();
        proceed();
      });
    }
  };

  const loadNotes = useCallback(() => {
    api.notes({ q: search, folder_id: folderFilter, tag: tagFilter }).then(setNotes).catch(() => {});
  }, [search, folderFilter, tagFilter]);

  const loadMeta = useCallback(() => {
    api.folders().then(setFolders).catch(() => {});
    api.tags().then(setAllTags).catch(() => {});
    api.todos().then(setTodos).catch(() => {}); // for the home open-todo count
    api.todoLists().then(setTodoLists).catch(() => {});
  }, []);

  // debounce so typing in search fires one request, not one per keystroke
  useEffect(() => {
    const t = setTimeout(loadNotes, 250);
    return () => clearTimeout(t);
  }, [loadNotes]);
  useEffect(loadMeta, [loadMeta]);
  // if the active tag filter points at a tag that no longer exists (its last
  // note was deleted → tag pruned), drop the filter so we don't get stuck empty
  useEffect(() => {
    if (tagFilter && allTags.length && !allTags.includes(tagFilter)) setTagFilter(null);
  }, [allTags, tagFilter]);

  const logout = () =>
    guardLeave(() => {
      dirtyRef.current = false;
      clearToken();
      onLogout();
    });

  const openNote = (id) =>
    guardLeave(async () => {
      dirtyRef.current = false;
      setActive(await api.note(id));
      setView("note");
    });

  const goHome = () =>
    guardLeave(() => {
      dirtyRef.current = false;
      setActive(null);
      setFolderFilter(null);
      setTagFilter(null);
      setView("note");
    });

  const newNote = () =>
    guardLeave(async () => {
      const doc = await api.createNote("Untitled", folderFilter);
      dirtyRef.current = false;
      setActive(doc);
      setView("note");
      loadNotes();
    });

  const startCapture = () =>
    guardLeave(() => {
      dirtyRef.current = false;
      setActive(null);
      setView("capture");
    });

  // import a .md file -> a formatted note (rendered, not raw markdown)
  const importMd = async (filename, text) => {
    const title = filename.replace(/\.m+d$/i, "").replace(/\.md$/i, "") || "Imported note";
    const doc = await api.createNote(title, folderFilter);
    const updated = await api.updateNote(doc.id, {
      title,
      folder_id: folderFilter,
      font_style: "standard",
      blocks: [{ type: "text", content: text }],
      tags: [],
    });
    dirtyRef.current = false;
    setActive(updated);
    setView("note");
    loadNotes();
    loadMeta();
    notifications.show({ message: `Imported “${title}”`, color: "green" });
  };

  const openTodos = () =>
    guardLeave(async () => {
      dirtyRef.current = false;
      setTodos(await api.todos());
      setTodoLists(await api.todoLists().catch(() => []));
      setView("todos");
    });

  // apply a folder/tag filter and return to the notes list (empty detail)
  const applyFilter = ({ folder = null, tag = null }) =>
    guardLeave(() => {
      dirtyRef.current = false;
      setFolderFilter(folder);
      setTagFilter(tag);
      setActive(null);
      setView("note");
    });

  const newFolder = () =>
    promptText({
      title: "New folder",
      label: "Folder name",
      placeholder: "e.g. Standup",
      onSubmit: async (name) => {
        await api.createFolder(name);
        loadMeta();
      },
    });

  const removeFolder = (f) =>
    confirmDelete({
      title: "Delete folder",
      message: `Delete folder “${f.name}”? Its notes are kept (just unfiled).`,
      onConfirm: async () => {
        await api.deleteFolder(f.id);
        if (folderFilter === f.id) applyFilter({});
        loadMeta();
      },
    });

  const onNoteDeleted = () => {
    setActive(null);
    setView("note");
    loadNotes();
    loadMeta();
  };

  const removeNote = (n) =>
    confirmDelete({
      title: "Delete note",
      message: `Delete “${n.title}”? This can't be undone.`,
      onConfirm: async () => {
        await api.deleteNote(n.id);
        if (active?.id === n.id) setActive(null);
        loadNotes();
        loadMeta();
      },
    });

  const onDrop = (files) => setPending(files);

  const transcribe = async (croppedFiles) => {
    setPending(null);
    setBusy(true);
    try {
      const res = await api.capture(croppedFiles);
      notifications.show({ message: `Saved “${res.title}”`, color: "green" });
      dirtyRef.current = false;
      setActive(res.doc);
      setView("note");
      loadNotes();
      loadMeta();
    } catch (e) {
      notifications.show({ message: e.message, color: "red" });
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (t) => {
    await api.toggleTodo(t.id, !t.done);
    setTodos(await api.todos());
  };

  const deleteTodo = async (t) => {
    await api.deleteTodo(t.id);
    setTodos((prev) => prev.filter((x) => x.id !== t.id));
  };
  const saveTodoDetails = async (id, details) => {
    await api.updateTodoDetails(id, details);
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, details } : x)));
  };

  // --- checklists ---
  const refreshLists = async () => setTodoLists(await api.todoLists().catch(() => []));
  const toggleListItem = async (item) => {
    await api.toggleTodo(item.id, !item.done);
    await refreshLists();
  };
  const deleteListItem = async (item) => {
    await api.deleteTodo(item.id);
    await refreshLists();
  };
  const addListItem = async (listId, text) => {
    await api.addListItem(listId, text);
    await refreshLists();
  };
  const renameList = async (listId, name) => {
    await api.renameTodoList(listId, name);
    setTodoLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
  };
  const deleteList = (list) =>
    confirmDelete({
      title: "Delete checklist",
      message: `Delete “${list.name}” and its ${list.items.length} item${list.items.length === 1 ? "" : "s"}?`,
      onConfirm: async () => {
        await api.deleteTodoList(list.id);
        setTodoLists((prev) => prev.filter((l) => l.id !== list.id));
      },
    });
  const newChecklist = () =>
    promptText({
      title: "New checklist",
      label: "Checklist name",
      placeholder: "e.g. Groceries",
      onSubmit: async (name) => {
        await api.createTodoList(name.trim() || "Checklist", []);
        await refreshLists();
      },
    });

  const addTodo = async () => {
    const text = newTodo.trim();
    if (!text) return;
    setNewTodo("");
    await api.addTodo(text);
    setTodos(await api.todos());
  };

  const clearDone = async () => {
    await api.clearTodos(true);
    setTodos(await api.todos());
  };

  const clearAllTodos = () =>
    confirmDelete({
      title: "Clear all todos",
      message: "Delete every todo? This can't be undone.",
      confirmLabel: "Clear all",
      onConfirm: async () => {
        await api.clearTodos();
        setTodos([]);
      },
    });

  // drag a todo onto another to reorder; persist the new order
  const reorderTodo = (fromId, toId) => {
    if (fromId === toId) return;
    setTodos((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((t) => t.id === fromId);
      const to = arr.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      api.reorderTodos(arr.map((t) => t.id));
      return arr;
    });
  };
  // touch-friendly reorder (drag doesn't fire on phones): move one slot up/down
  const moveTodo = (id, dir) => {
    setTodos((prev) => {
      const i = prev.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      api.reorderTodos(arr.map((t) => t.id));
      return arr;
    });
  };

  // --- drag a note onto a folder to file it (folderId null = un-file) ---
  const onDropNote = async (folderId, e) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/note-id"));
    if (!id) return;
    await api.moveNote(id, folderId);
    const dest = folderId ? folders.find((f) => f.id === folderId)?.name : "All notes";
    notifications.show({ message: `Moved to ${dest}`, color: "green" });
    loadNotes();
  };
  const allowDrop = (key) => (e) => {
    e.preventDefault();
    setDragOver(key);
  };

  const openCount =
    todos.filter((t) => !t.done).length +
    todoLists.reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 270, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="sm" wrap="nowrap" onClick={goHome} style={{ cursor: "pointer" }} title="Home">
              <Box
                w={30}
                h={30}
                style={{
                  borderRadius: 9,
                  background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Stack gap={2.5} w={13}>
                  <Box h={2.5} w={7} bg="white" style={{ borderRadius: 2 }} />
                  <Box h={2.5} w={13} bg="white" style={{ borderRadius: 2, opacity: 0.9 }} />
                  <Box h={2.5} w={13} bg="white" style={{ borderRadius: 2, opacity: 0.6 }} />
                </Stack>
              </Box>
              <Text className="wordmark" visibleFrom="xs">DeskNotes</Text>
            </Group>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              variant="default"
              leftSection={<IconPencilPlus size={16} />}
              onClick={newNote}
              visibleFrom="xs"
            >
              New note
            </Button>
            <ActionIcon variant="default" size="lg" onClick={newNote} aria-label="New note" hiddenFrom="xs">
              <IconPencilPlus size={18} />
            </ActionIcon>
            <Button
              leftSection={<IconCamera size={16} />}
              onClick={startCapture}
              visibleFrom="xs"
            >
              New capture
            </Button>
            <ActionIcon
              variant="filled"
              size="lg"
              onClick={startCapture}
              aria-label="New capture"
              hiddenFrom="xs"
            >
              <IconCamera size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={toggleColorScheme}
              aria-label="Toggle theme"
            >
              {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <ActionIcon variant="subtle" size="lg" onClick={logout} aria-label="Log out">
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={5} h="100%">
          <TextInput
            placeholder="Search notes…"
            radius="xl"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />

          <NavLink
            className="side-nav"
            label="Todos"
            leftSection={<IconChecklist size={18} />}
            rightSection={
              openCount > 0 ? (
                <Badge size="sm" circle variant="filled" color="ink">{openCount}</Badge>
              ) : null
            }
            active={view === "todos"}
            onClick={openTodos}
          />

          <Group justify="space-between" align="center" mt={8} px={6}>
            <Text className="side-label">Folders</Text>
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={newFolder} aria-label="New folder">
              <IconFolderPlus size={16} />
            </ActionIcon>
          </Group>
          <NavLink
            className="side-nav"
            label="All notes"
            leftSection={<IconNotes size={18} />}
            active={view !== "todos" && folderFilter === null && tagFilter === null}
            onClick={() => applyFilter({})}
            onDragOver={allowDrop("none")}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDropNote(null, e)}
            styles={dragOver === "none" ? { root: { outline: "2px dashed var(--accent)" } } : undefined}
          />
          {folders.map((f) => (
            <NavLink
              key={f.id}
              className="side-nav"
              label={f.name}
              leftSection={<IconFolder size={18} />}
              active={folderFilter === f.id}
              onClick={() => applyFilter({ folder: f.id })}
              onDragOver={allowDrop(f.id)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDropNote(f.id, e)}
              styles={dragOver === f.id ? { root: { outline: "2px dashed var(--accent)" } } : undefined}
              rightSection={
                <ActionIcon
                  component="div"
                  size="sm"
                  variant="subtle"
                  color="red"
                  aria-label="Delete folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFolder(f);
                  }}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              }
            />
          ))}

          {allTags.length > 0 && (
            <>
              <Text className="side-label" mt={8} px={6}>Tags</Text>
              <Group gap={5} px={4} style={{ maxHeight: 100, overflowY: "auto", flexWrap: "wrap" }}>
                {allTags.map((t) => (
                  <Badge
                    key={t}
                    variant={tagFilter === t ? "filled" : "light"}
                    color="ink"
                    radius="sm"
                    style={{ cursor: "pointer", textTransform: "none" }}
                    onClick={() => applyFilter({ tag: tagFilter === t ? null : t })}
                  >
                    {t}
                  </Badge>
                ))}
              </Group>
            </>
          )}

          <Text className="side-label" mt={8} px={6}>Notes</Text>
          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={4}>
              {notes.map((n) => (
                <NavLink
                  key={n.id}
                  active={active?.id === n.id && view === "note"}
                  onClick={() => openNote(n.id)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/note-id", String(n.id))}
                  style={{ cursor: "grab", borderRadius: 8 }}
                  label={
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text fw={500} size="sm" lineClamp={1}>{n.title}</Text>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{relTime(n.updated_at)}</Text>
                    </Group>
                  }
                  description={
                    n.preview ? (
                      <Text size="xs" c="dimmed" lineClamp={1}>{mdToPlain(n.preview)}</Text>
                    ) : (
                      <Text size="xs" c="dimmed" fs="italic">No content yet</Text>
                    )
                  }
                  rightSection={
                    <ActionIcon
                      component="div"
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label="Delete note"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNote(n);
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  }
                />
              ))}
              {notes.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py="md">No notes yet</Text>
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {busy ? (
          <Stack align="center" justify="center" gap="md" py={80}>
            <Loader />
            <Text c="dimmed">Reading your handwriting…</Text>
          </Stack>
        ) : view === "capture" ? (
          <Stack maw={720} mx="auto" mt="lg" gap="lg">
            <div>
              <Title order={2}>New capture</Title>
              <Text c="dimmed" size="sm">Snap or upload a photo — we transcribe it and keep diagrams as-is.</Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {/* Take photo — opens the in-app camera (webcam / rear camera) */}
              <Card
                withBorder
                radius="md"
                padding="xl"
                onClick={() => setCameraOpen(true)}
                style={{ cursor: "pointer", textAlign: "center" }}
              >
                <Stack align="center" gap={6}>
                  <IconCamera size={40} />
                  <Text fw={500}>Take photo</Text>
                  <Text size="xs" c="dimmed">Snap several, then transcribe all</Text>
                </Stack>
              </Card>
              {/* Upload / drag-and-drop from disk */}
              <Dropzone
                onDrop={onDrop}
                accept={IMAGE_MIME_TYPE}
                maxSize={20 * 1024 ** 2}
                radius="md"
                p="xl"
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Stack align="center" gap={6} style={{ pointerEvents: "none" }}>
                  <IconPhotoUp size={40} />
                  <Text fw={500}>Upload or drop</Text>
                  <Text size="xs" c="dimmed">Choose files · multiple → one note</Text>
                </Stack>
              </Dropzone>
            </SimpleGrid>
          </Stack>
        ) : view === "todos" ? (
          <Stack gap="sm" style={{ maxWidth: 620 }}>
            <Group justify="space-between" align="flex-end">
              <Title order={2}>To-do</Title>
              {todos.length > 0 && (
                <Group gap="xs">
                  {todos.some((t) => t.done) && (
                    <Button size="xs" variant="subtle" onClick={clearDone}>
                      Clear done
                    </Button>
                  )}
                  <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={clearAllTodos}>
                    Clear all
                  </Button>
                </Group>
              )}
            </Group>
            <Group gap="xs" wrap="nowrap">
              <TextInput
                flex={1}
                placeholder="Add a todo…"
                value={newTodo}
                onChange={(e) => setNewTodo(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
              />
              <Button onClick={addTodo}>Add</Button>
            </Group>
            <Button
              variant="light"
              leftSection={<IconChecklist size={16} />}
              onClick={newChecklist}
              style={{ alignSelf: "flex-start" }}
            >
              New checklist
            </Button>
            {todoLists.map((list) => (
              <Checklist
                key={list.id}
                list={list}
                onToggleItem={toggleListItem}
                onDeleteItem={deleteListItem}
                onAddItem={addListItem}
                onRename={renameList}
                onDelete={deleteList}
              />
            ))}
            {todos.length === 0 && todoLists.length === 0 && <Text c="dimmed">No todos yet.</Text>}
            {todos.map((t, i) => (
              <TodoRow
                key={t.id}
                t={t}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onSaveDetails={saveTodoDetails}
                onReorder={reorderTodo}
                onMove={moveTodo}
                isFirst={i === 0}
                isLast={i === todos.length - 1}
              />
            ))}
          </Stack>
        ) : active ? (
          <NoteView
            key={active.id}
            note={active}
            folders={folders}
            allTags={allTags}
            dirtyRef={dirtyRef}
            saveFnRef={saveFnRef}
            onSaved={(u) => {
              dirtyRef.current = false;
              setActive(u);
              loadNotes();
              loadMeta();
            }}
            onDeleted={onNoteDeleted}
          />
        ) : (
          <Home
            notes={notes}
            openTodos={openCount}
            onCapture={startCapture}
            onNewNote={newNote}
            onImportMd={importMd}
            onOpenTodos={openTodos}
            onOpenNote={openNote}
          />
        )}
      </AppShell.Main>

      {pending && <CaptureFlow files={pending} onCancel={() => setPending(null)} onDone={transcribe} />}
      {cameraOpen && (
        <CameraCapture
          onCancel={() => setCameraOpen(false)}
          onDone={(files) => {
            setCameraOpen(false);
            if (files.length) onDrop(files);
          }}
        />
      )}
    </AppShell>
  );
}

// A single todo row that expands to a notes area for extra info per task.
function TodoRow({ t, onToggle, onDelete, onSaveDetails, onReorder, onMove, isFirst, isLast }) {
  const hasDetails = !!(t.details && t.details.trim());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(t.details || "");
  useEffect(() => setDraft(t.details || ""), [t.id, t.details]);

  const saveDetails = () => {
    if ((draft || "") !== (t.details || "")) onSaveDetails(t.id, draft);
  };

  return (
    <Box
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/todo-id", String(t.id))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onReorder(Number(e.dataTransfer.getData("text/todo-id")), t.id)}
      style={{ borderBottom: "1px dashed var(--mantine-color-gray-4)", paddingBottom: 6 }}
    >
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Box visibleFrom="sm" style={{ display: "inline-flex", flexShrink: 0 }}>
            <IconGripVertical size={16} style={{ cursor: "grab", opacity: 0.4 }} />
          </Box>
          {/* touch-friendly reorder (phones can't drag) */}
          <Stack gap={0} hiddenFrom="sm" style={{ flexShrink: 0 }}>
            <ActionIcon size="xs" variant="subtle" color="gray" disabled={isFirst} onClick={() => onMove(t.id, -1)} aria-label="Move up">
              <IconChevronUp size={14} />
            </ActionIcon>
            <ActionIcon size="xs" variant="subtle" color="gray" disabled={isLast} onClick={() => onMove(t.id, 1)} aria-label="Move down">
              <IconChevronDown size={14} />
            </ActionIcon>
          </Stack>
          <Checkbox
            checked={!!t.done}
            onChange={() => onToggle(t)}
            radius="xl"
            size="md"
            styles={{
              root: { flex: 1, minWidth: 0 },
              body: { alignItems: "center" },
              labelWrapper: { flex: 1, minWidth: 0 },
              label: {
                fontSize: 16,
                textDecoration: t.done ? "line-through" : "none",
                opacity: t.done ? 0.5 : 1,
              },
            }}
            label={
              <span>
                {t.text}
                <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 8, whiteSpace: "nowrap" }}>{t.date}</span>
              </span>
            }
          />
        </Group>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Hide notes" : "Add notes"}
            title="Notes"
            style={
              hasDetails
                ? {
                    background: "var(--highlight-wash)",
                    color: "var(--highlight)",
                    border: "1px solid color-mix(in srgb, var(--highlight) 40%, transparent)",
                  }
                : undefined
            }
          >
            {hasDetails ? (
              <IconNotes size={18} />
            ) : (
              <IconChevronDown
                size={18}
                style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
              />
            )}
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="lg" onClick={() => onDelete(t)} aria-label="Delete todo">
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Group>
      <Collapse in={open}>
        <Textarea
          mt={6}
          ml={{ base: 0, sm: 28 }}
          placeholder="Extra info — context, links, sub-steps…"
          autosize
          minRows={2}
          maxRows={10}
          styles={{ input: { borderLeft: "3px solid var(--highlight)" } }}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={saveDetails}
        />
      </Collapse>
    </Box>
  );
}

// A checklist card: a named group of items with a circular progress ring,
// inline rename, per-item toggle/delete, and an add-item box.
function Checklist({ list, onToggleItem, onDeleteItem, onAddItem, onRename, onDelete }) {
  // populated lists start collapsed; a brand-new empty one opens ready to fill
  const [open, setOpen] = useState(list.items.length === 0);
  const [adding, setAdding] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(list.name);
  useEffect(() => setNameDraft(list.name), [list.name]);

  const total = list.items.length;
  const done = list.items.filter((i) => i.done).length;
  const pct = total ? (done / total) * 100 : 0;

  const submitAdd = () => {
    const t = adding.trim();
    if (!t) return;
    onAddItem(list.id, t);
    setAdding("");
  };
  const submitName = () => {
    setEditingName(false);
    const n = nameDraft.trim();
    if (n && n !== list.name) onRename(list.id, n);
    else setNameDraft(list.name);
  };

  const complete = total > 0 && done === total;

  return (
    <Box
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "var(--surface)",
        boxShadow: "var(--mantine-shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* header — click anywhere (except name/actions) to expand */}
      <Group
        justify="space-between"
        wrap="nowrap"
        gap="xs"
        p="sm"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <RingProgress
            size={48}
            thickness={4}
            roundCaps
            rootColor="var(--mantine-color-default-border)"
            sections={pct > 0 ? [{ value: pct, color: complete ? "teal" : "ink" }] : []}
            label={
              <Text ta="center" fw={700} style={{ fontSize: 11 }}>
                {done}/{total}
              </Text>
            }
          />
          <div style={{ minWidth: 0, flex: 1 }} onClick={(e) => e.stopPropagation()}>
            {editingName ? (
              <TextInput
                size="xs"
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.currentTarget.value)}
                onBlur={submitName}
                onKeyDown={(e) => e.key === "Enter" && submitName()}
              />
            ) : (
              <Text
                fw={600}
                lineClamp={1}
                style={{ cursor: "text" }}
                onClick={() => setEditingName(true)}
                title="Rename"
              >
                {list.name}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {total === 0 ? "Empty — add items below" : complete ? "All done 🎉" : `${done} of ${total} done`}
            </Text>
          </div>
        </Group>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse" : "Expand"}>
            <IconChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="lg" onClick={() => onDelete(list)} aria-label="Delete checklist">
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={open}>
        <Box px="sm" pb="sm" style={{ borderTop: "1px solid var(--line)" }}>
          <Stack gap={0} pt={4}>
            {list.items.map((it) => (
              <Group
                key={it.id}
                justify="space-between"
                wrap="nowrap"
                gap="xs"
                py={5}
                style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 55%, transparent)" }}
              >
                <Checkbox
                  size="sm"
                  radius="xl"
                  checked={!!it.done}
                  onChange={() => onToggleItem(it)}
                  styles={{
                    root: { flex: 1, minWidth: 0 },
                    labelWrapper: { flex: 1, minWidth: 0 },
                    label: { fontSize: 15, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.5 : 1 },
                  }}
                  label={it.text}
                />
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onDeleteItem(it)} aria-label="Delete item">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ))}
            {total === 0 && (
              <Text size="xs" c="dimmed" fs="italic" py={6}>
                No items yet — add one below.
              </Text>
            )}
          </Stack>

          <Group gap="xs" mt="sm" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Add item…"
              style={{ flex: 1 }}
              value={adding}
              onChange={(e) => setAdding(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
            />
            <ActionIcon variant="light" size="lg" onClick={submitAdd} aria-label="Add item">
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
        </Box>
      </Collapse>
    </Box>
  );
}
