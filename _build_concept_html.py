# one-off builder — can delete after run
from pathlib import Path

md = Path("concept.md").read_text(encoding="utf-8")
md = md.replace("</script>", r"<\/script>")

HTML = r'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Into Schem — редактор концепта</title>
<style>
  :root {
    --bg: #f7f6f3; --panel: #ffffff; --ink: #17181c; --ink-dim: #5c6069;
    --ink-faint: #8b909a; --rule: #e2e0da; --accent: #b8481f; --accent-soft: #fbeee8;
    --ok: #2f7d4f; --warn: #a8761a; --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131417; --panel: #1b1d21; --ink: #e8e6e1; --ink-dim: #a3a7b0;
      --ink-faint: #71757e; --rule: #2c2f35; --accent: #e87a4d; --accent-soft: #2a1f19;
      --ok: #62b487; --warn: #d9a441;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: var(--bg); color: var(--ink);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    display: flex; flex-direction: column;
  }
  .toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
    padding: 10px 16px; border-bottom: 1px solid var(--rule);
    background: var(--panel); flex-shrink: 0;
  }
  .toolbar h1 {
    font-size: 15px; margin: 0 12px 0 0; font-weight: 650; white-space: nowrap;
  }
  .toolbar .hint { font-size: 12px; color: var(--ink-faint); margin-left: auto; }
  .toolbar button, .toolbar label.btn {
    font: 600 12px/1 var(--mono); letter-spacing: .04em;
    padding: 7px 12px; border-radius: 6px; border: 1px solid var(--rule);
    background: var(--bg); color: var(--ink); cursor: pointer;
  }
  .toolbar button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .toolbar button.active { outline: 2px solid var(--accent); outline-offset: 1px; }
  .toolbar label.btn input { display: none; }
  .status { font: 12px/1 var(--mono); color: var(--ink-faint); min-width: 120px; }
  .status.dirty { color: var(--warn); }
  .panes { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
  .panes.preview-only { grid-template-columns: 1fr; }
  .panes.edit-only { grid-template-columns: 1fr; }
  .pane { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--rule); }
  .pane:last-child { border-right: none; }
  .pane.hidden { display: none; }
  .pane-head {
    font: 600 11px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase;
    color: var(--ink-faint); padding: 8px 14px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--ink) 3%, var(--panel));
  }
  #editor {
    flex: 1; width: 100%; resize: none; border: none; outline: none;
    padding: 16px 18px; font: 14px/1.55 var(--mono);
    background: var(--panel); color: var(--ink); tab-size: 2;
  }
  #preview {
    flex: 1; overflow: auto; padding: 24px 28px 80px;
    background: var(--bg);
  }
  #preview h1 { font-size: 36px; line-height: 1.05; margin: 0 0 14px; }
  #preview h2 {
    font-size: 12px; font-family: var(--mono); letter-spacing: .14em;
    text-transform: uppercase; color: var(--ink-faint);
    margin: 40px 0 14px; padding-bottom: 6px; border-bottom: 1px solid var(--rule);
  }
  #preview h3 { font-size: 17px; margin: 24px 0 8px; }
  #preview h4 { font-size: 15px; margin: 18px 0 6px; }
  #preview p, #preview li { margin-bottom: 8px; }
  #preview blockquote {
    background: var(--accent-soft); border-left: 3px solid var(--accent);
    margin: 0 0 14px; padding: 14px 18px;
  }
  #preview table {
    border-collapse: collapse; width: 100%; font-size: 14px;
    background: var(--panel); border: 1px solid var(--rule); margin: 0 0 14px;
    display: block; overflow-x: auto;
  }
  #preview th, #preview td {
    padding: 9px 12px; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top;
  }
  #preview th {
    font: 600 10px/1.3 var(--mono); text-transform: uppercase; color: var(--ink-faint);
    background: color-mix(in srgb, var(--ink) 4%, var(--panel));
  }
  #preview code {
    font-family: var(--mono); font-size: 13px;
    background: color-mix(in srgb, var(--ink) 7%, transparent);
    padding: 1px 4px; border-radius: 3px;
  }
  #preview pre { background: var(--panel); border: 1px solid var(--rule); padding: 12px; overflow-x: auto; border-radius: 6px; }
  #preview pre code { background: none; padding: 0; }
  #preview hr { border: none; border-top: 1px solid var(--rule); margin: 24px 0; }
  #preview .mermaid { margin: 16px 0; text-align: center; }
</style>
</head>
<body>

<div class="toolbar">
  <h1>Into Schem · концепт</h1>
  <button type="button" id="btn-split" class="active">Оба</button>
  <button type="button" id="btn-edit">Редактор</button>
  <button type="button" id="btn-preview">Превью</button>
  <button type="button" id="btn-save-html" class="primary">Сохранить HTML</button>
  <button type="button" id="btn-save-md">Сохранить .md</button>
  <label class="btn">Открыть .md<input type="file" id="file-open" accept=".md,text/markdown,text/plain"></label>
  <span class="status" id="status">готово</span>
  <span class="hint">Ctrl+S — сохранить HTML · правь текст слева</span>
</div>

<div class="panes" id="panes">
  <div class="pane" id="pane-edit">
    <div class="pane-head">Текст (Markdown)</div>
    <textarea id="editor" spellcheck="false"></textarea>
  </div>
  <div class="pane" id="pane-preview">
    <div class="pane-head">Превью</div>
    <article id="preview"></article>
  </div>
</div>

<script type="text/markdown" id="initial-doc">''' + md + r'''</script>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
const STORAGE_KEY = "into-schem-concept-draft";
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const panes = document.getElementById("panes");
const paneEdit = document.getElementById("pane-edit");
const panePreview = document.getElementById("pane-preview");
const initial = document.getElementById("initial-doc").textContent;

marked.setOptions({ gfm: true, breaks: false });
mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default"
});

let dirty = false;
let renderTimer = null;
let mermaidIdx = 0;

function setDirty(v) {
  dirty = v;
  statusEl.textContent = v ? "есть изменения" : "сохранено";
  statusEl.classList.toggle("dirty", v);
}

function stripFrontMatter(md) {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("---", 3);
  return end === -1 ? md : md.slice(end + 3).trimStart();
}

async function renderPreview() {
  let md = editor.value;
  const blocks = [];
  mermaidIdx = 0;
  md = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    const id = "mm-" + (mermaidIdx++);
    blocks.push({ id, code: code.trim() });
    return `<div class="mermaid" id="${id}"></div>`;
  });
  preview.innerHTML = marked.parse(stripFrontMatter(md));
  for (const { id, code } of blocks) {
    const el = document.getElementById(id);
    if (!el) continue;
    try {
      const { svg } = await mermaid.render(id + "-svg", code);
      el.innerHTML = svg;
    } catch {
      el.innerHTML = "<pre><code>" + code + "</code></pre>";
    }
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderPreview, 250);
}

function setLayout(mode) {
  ["btn-split", "btn-edit", "btn-preview"].forEach(id =>
    document.getElementById(id).classList.toggle("active", id === "btn-" + mode));
  panes.className = "panes" + (mode === "split" ? "" : " " + mode + "-only");
  paneEdit.classList.toggle("hidden", mode === "preview");
  panePreview.classList.toggle("hidden", mode === "edit");
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildHtmlDocument(bodyMd) {
  const safe = bodyMd.replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>\n` + document.documentElement.outerHTML
    .replace(/<textarea id="editor"[^>]*>[\s\S]*?<\/textarea>/,
      `<textarea id="editor" spellcheck="false">${safe.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</textarea>`)
    .replace(/<script type="text\/markdown" id="initial-doc">[\s\S]*?<\/script>/,
      `<script type="text/markdown" id="initial-doc">${safe}<\\/script>`);
}

function saveHtml() {
  const md = editor.value;
  // Rebuild from template: fetch current page source is unreliable; rebuild known shell
  const safe = md.replace(/<\/script>/gi, "<\\/script>");
  const tpl = document.documentElement.outerHTML;
  let out = tpl
    .replace(/<textarea id="editor" spellcheck="false">[\s\S]*?<\/textarea>/,
      `<textarea id="editor" spellcheck="false">${md.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</textarea>`)
    .replace(/<script type="text\/markdown" id="initial-doc">[\s\S]*?<\/script>/,
      `<script type="text/markdown" id="initial-doc">${safe}<\\/script>`);
  if (!out.startsWith("<!doctype")) out = "<!doctype html>\n" + out;
  download("concept.html", out, "text/html;charset=utf-8");
  localStorage.setItem(STORAGE_KEY, md);
  setDirty(false);
  statusEl.textContent = "HTML скачан";
}

function saveMd() {
  download("concept.md", editor.value, "text/markdown;charset=utf-8");
  statusEl.textContent = ".md скачан";
}

// Init: localStorage draft if newer than embedded
const draft = localStorage.getItem(STORAGE_KEY);
if (draft && draft !== initial) {
  if (confirm("Восстановить несохранённый черновик из браузера?")) {
    editor.value = draft;
    setDirty(true);
  } else {
    editor.value = initial;
  }
} else {
  editor.value = initial;
}

renderPreview();

editor.addEventListener("input", () => {
  setDirty(true);
  localStorage.setItem(STORAGE_KEY, editor.value);
  scheduleRender();
});

document.getElementById("btn-split").onclick = () => setLayout("split");
document.getElementById("btn-edit").onclick = () => setLayout("edit");
document.getElementById("btn-preview").onclick = () => setLayout("preview");
document.getElementById("btn-save-html").onclick = saveHtml;
document.getElementById("btn-save-md").onclick = saveMd;

document.getElementById("file-open").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    editor.value = r.result;
    setDirty(true);
    scheduleRender();
  };
  r.readAsText(file, "UTF-8");
  e.target.value = "";
});

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveHtml();
  }
});
</script>
</body>
</html>
'''

Path("concept.html").write_text(HTML, encoding="utf-8")
print("OK", len(HTML))
