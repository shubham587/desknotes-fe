// Tiny fetch wrapper. Backend base comes from VITE_API_URL (set in production);
// empty in dev so the Vite proxy handles /api and /media. Bearer token in localStorage.

const TOKEN_KEY = "desknotes_token";

// e.g. "https://xxxx.ngrok-free.app" in prod, "" in dev (proxy). Trailing slash stripped.
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Turn a stored media path ("/media/x.png") into a full URL against the backend.
// Leaves absolute URLs (e.g. future object-storage links) untouched.
export const mediaUrl = (p) => (!p ? p : /^https?:\/\//.test(p) ? p : `${API_BASE}${p}`);

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req(path, opts = {}) {
  const headers = { "ngrok-skip-browser-warning": "true", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).detail || detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  login: (username, password) =>
    req("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  me: () => req("/me"),
  folders: () => req("/folders"),
  createFolder: (name, parent_id = null) =>
    req("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id }),
    }),
  deleteFolder: (id) => req(`/folders/${id}`, { method: "DELETE" }),
  deleteNote: (id) => req(`/notes/${id}`, { method: "DELETE" }),
  tags: () => req("/tags"),
  notes: ({ q, folder_id, tag } = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (folder_id != null) p.set("folder_id", folder_id);
    if (tag) p.set("tag", tag);
    const qs = p.toString();
    return req(`/notes${qs ? `?${qs}` : ""}`);
  },
  createNote: (title = "Untitled", folder_id = null) =>
    req("/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, folder_id }),
    }),
  note: (id) => req(`/notes/${id}`),
  updateNote: (id, body) =>
    req(`/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  mermaid: (image_path) =>
    req("/mermaid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path }),
    }),
  moveNote: (id, folder_id) =>
    req(`/notes/${id}/folder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id }),
    }),
  todos: () => req("/todos"),
  toggleTodo: (id, done) =>
    req(`/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }),
  addTodo: (text, doc_id = null) =>
    req("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, doc_id }),
    }),
  updateTodoText: (id, text) =>
    req(`/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  updateTodoDetails: (id, details) =>
    req(`/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details }),
    }),
  deleteTodo: (id) => req(`/todos/${id}`, { method: "DELETE" }),
  clearTodos: (done) => req(`/todos${done === undefined ? "" : `?done=${done}`}`, { method: "DELETE" }),
  // checklists (a named todo_list with checkable items)
  todoLists: () => req("/todolists"),
  createTodoList: (name, items, doc_id = null) =>
    req("/todolists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, items, doc_id }),
    }),
  renameTodoList: (id, name) =>
    req(`/todolists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteTodoList: (id) => req(`/todolists/${id}`, { method: "DELETE" }),
  addListItem: (id, text) =>
    req(`/todolists/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  reorderTodos: (ids) =>
    req("/todos/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  capture: (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return req("/capture", { method: "POST", body: fd });
  },
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("/upload", { method: "POST", body: fd });
  },
  appendPhotos: (id, files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return req(`/notes/${id}/append`, { method: "POST", body: fd });
  },
};
