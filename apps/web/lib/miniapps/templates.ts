/**
 * Mini-App Creator starter templates (Phase 3, spec §9). Each template is a
 * tiny bundle built in memory as a stored (method 0) zip — the exact format
 * readZip/validateBundle accept — so "start from a template" goes through
 * the same upload validator as a hand-built zip. Nothing here widens the
 * bundle contract: static assets only, no service workers, no CSP overrides.
 */
import { crc32 } from "node:zlib";

export type TemplateName = "static" | "todo";

export const TEMPLATE_NAMES: readonly TemplateName[] = ["static", "todo"];

export function isTemplateName(name: string): name is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(name);
}

interface TemplateFile {
  path: string;
  text: string;
}

/** Build a stored-entry zip (no compression) from in-memory text files. */
export function buildZip(files: TemplateFile[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const data = Buffer.from(file.text, "utf8");
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method: stored
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central directory disk
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  return Buffer.concat([...locals, ...centrals, eocd]);
}

const STATIC_INDEX = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My Page</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<h1>Hello from your mini-app</h1>
<p>Edit <code>index.html</code> and <code>style.css</code>, re-zip, and upload a new bundle to update.</p>
</main>
</body>
</html>
`;

const STATIC_STYLE = `body {
  margin: 0;
  font-family: ui-monospace, monospace;
  background: #101014;
  color: #e8e8ec;
}
main {
  max-width: 560px;
  margin: 48px auto;
  padding: 0 16px;
}
h1 { font-size: 20px; }
code { background: #1c1c22; padding: 1px 4px; border-radius: 3px; }
`;

const TODO_INDEX = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>To-Do</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<h1>To-Do</h1>
<form id="add"><input id="text" placeholder="Add a task…" maxlength="200" autocomplete="off"><button>Add</button></form>
<ul id="list"></ul>
<p id="note" class="muted"></p>
</main>
<script src="app.js"></script>
</body>
</html>
`;

const TODO_APP_JS = `// Apps-API to-do: state lives in the owner's box via GET/PUT
// /api/apps/v1/state (256KB cap; guests read-only).
const list = document.getElementById("list");
const note = document.getElementById("note");
let items = [];

async function load() {
  const res = await fetch("/api/apps/v1/state");
  if (!res.ok) { note.textContent = "Couldn't load."; return; }
  const data = await res.json();
  items = Array.isArray(data.state.items) ? data.state.items : [];
  draw();
}

async function save() {
  const res = await fetch("/api/apps/v1/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: { items } }),
  });
  note.textContent = res.ok ? "" : "Couldn't save (guests are read-only).";
}

function draw() {
  list.textContent = "";
  items.forEach((item, i) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = item.text;
    if (item.done) label.className = "done";
    const toggle = document.createElement("button");
    toggle.textContent = item.done ? "Undo" : "Done";
    toggle.onclick = () => { items[i].done = !items[i].done; draw(); save(); };
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.onclick = () => { items.splice(i, 1); draw(); save(); };
    li.append(label, toggle, remove);
    list.append(li);
  });
}

document.getElementById("add").onsubmit = (event) => {
  event.preventDefault();
  const input = document.getElementById("text");
  const text = input.value.trim();
  if (!text) return;
  items.push({ text, done: false });
  input.value = "";
  draw();
  save();
};

load();
`;

const TODO_STYLE = `body {
  margin: 0;
  font-family: ui-monospace, monospace;
  background: #101014;
  color: #e8e8ec;
}
main { max-width: 560px; margin: 32px auto; padding: 0 16px; }
h1 { font-size: 20px; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; background: #1c1c22; color: inherit; border: 1px solid #33333d; }
button { padding: 6px 10px; background: #1c1c22; color: inherit; border: 1px solid #33333d; cursor: pointer; }
ul { list-style: none; padding: 0; }
li { display: flex; gap: 8px; align-items: center; padding: 6px 0; }
li span { flex: 1; }
.done { text-decoration: line-through; opacity: 0.6; }
.muted { opacity: 0.7; font-size: 12px; }
`;

const TEMPLATES: Record<TemplateName, TemplateFile[]> = {
  static: [
    { path: "index.html", text: STATIC_INDEX },
    { path: "style.css", text: STATIC_STYLE },
  ],
  todo: [
    { path: "index.html", text: TODO_INDEX },
    { path: "app.js", text: TODO_APP_JS },
    { path: "style.css", text: TODO_STYLE },
  ],
};

export function templateZip(name: TemplateName): Buffer {
  return buildZip(TEMPLATES[name]);
}
