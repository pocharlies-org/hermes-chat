/**
 * <hermes-chat> — un chat Hermes embebible con el look del sidepanel de agent-jake.
 *
 * Web component de cero dependencias (custom element + shadow DOM), un solo fichero ESM.
 * Funciona en React (montar en JSX y poner propiedades por `ref`) y en vanilla
 * (document.createElement + propiedades/atributos). El chat (burbujas, "N pasos" colapsados,
 * razonamiento, RequestCard, plan, composer con modos y modelo, stop) existe aquí una vez;
 * lo propio de cada sistema (auth, id de sesión, guardas, tarjetas, voz) lo inyecta el host
 * por propiedades/eventos — nunca por un fork del chat (ley DGX-1301).
 *
 * CONTRACT: hermes-chat.wire.v1 — Contrato SSE (versionado en CONTRACTS.yaml): el componente hace POST a `turnUrl` con
 * {text, conversation?, mode?, model?, answer?} y lee el stream con fetch+getReader.
 * Tipos que entiende: meta · delta · reasoning · tool · tool_result · request · plan · custom · error · done.
 * Los comentarios `:` (keepalive) se descartan.
 *
 * Atajos con límite conocido anotados como `shortcut:` donde aplican.
 */

const TOKENS = `
:host { display:flex; flex-direction:column; height:100%; font-size:13px; font-family:var(--hc-font-sans,'DM Sans',system-ui,sans-serif);
  --bg-deepest:#0a0a12; --bg-deep:#12121e; --bg-surface:#1a1a2e; --bg-elevated:#242442;
  --accent-primary:#00d4ff; --accent-primary-dim:rgba(0,212,255,.15);
  --accent-secondary:#a855f7; --accent-secondary-dim:rgba(168,85,247,.15);
  --accent-success:#10b981; --accent-success-dim:rgba(16,185,129,.15);
  --accent-warning:#f59e0b; --accent-warning-dim:rgba(245,158,11,.15);
  --accent-danger:#ef4444; --accent-danger-dim:rgba(239,68,68,.15);
  --text-primary:#f0f0f5; --text-secondary:#8888a0; --border-default:rgba(255,255,255,.1);
  --font-mono:'JetBrains Mono','Fira Code',monospace;
  color:var(--text-primary); background:var(--bg-deepest); }
* { box-sizing:border-box; }
button { background:var(--accent-primary-dim); color:var(--text-primary); border:1px solid var(--border-default);
  border-radius:6px; padding:5px 10px; cursor:pointer; font:inherit; }
button:disabled { opacity:.4; cursor:default; }
button.icon { background:none; border:none; padding:4px 6px; opacity:.6; }
button.icon.on, button.icon:hover:not(:disabled) { opacity:1; }
button.link { background:none; border:none; padding:0; text-align:left; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
button.stop { background:var(--accent-danger-dim); border-color:var(--accent-danger); }
button.primary { border-color:var(--accent-success); background:var(--accent-success-dim); }
button.danger { border-color:var(--accent-danger); background:var(--accent-danger-dim); }
.muted { color:var(--text-secondary); }
input, textarea, select { background:var(--bg-deep); color:var(--text-primary); border:1px solid var(--border-default);
  border-radius:6px; padding:6px 8px; font:inherit; }
header { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid var(--border-default); background:var(--bg-deep); }
header .title { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
header .actions { display:flex; gap:2px; }
.drawer { padding:10px; border-bottom:1px solid var(--border-default); background:var(--bg-surface); max-height:45%; overflow-y:auto; }
.drawer.settings { display:flex; flex-direction:column; gap:8px; }
.drawer.history { display:flex; flex-direction:column; gap:4px; }
.chat-row { display:flex; align-items:center; gap:6px; padding:3px 4px; border-radius:6px; }
.chat-row.current { background:var(--bg-elevated); }
.chat-row .muted { font-size:11px; white-space:nowrap; }
.log { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
.empty { text-align:center; margin-top:30px; line-height:1.6; padding:0 10px; }
.item { word-break:break-word; line-height:1.5; }
.item.user { white-space:pre-wrap; align-self:flex-end; background:var(--accent-primary-dim); padding:6px 10px; border-radius:10px; max-width:85%; }
.item.assistant.interim { color:var(--text-secondary); }
.item.error { color:var(--accent-danger); white-space:pre-wrap; }
.item.info { color:var(--text-secondary); font-style:italic; }
.item.custom { align-self:stretch; }
.md p { margin:0 0 6px; } .md p:last-child { margin-bottom:0; }
.md ul, .md ol { margin:4px 0; padding-left:20px; }
.md code { font-family:var(--font-mono); background:var(--bg-elevated); padding:1px 4px; border-radius:4px; font-size:12px; }
.md pre { background:var(--bg-elevated); padding:8px; border-radius:6px; overflow-x:auto; }
.md pre code { background:none; padding:0; }
.md a { color:var(--accent-primary); }
.md blockquote { margin:4px 0; padding-left:8px; border-left:2px solid var(--border-default); color:var(--text-secondary); }
.md img, .md video { max-width:100%; border-radius:8px; margin:4px 0; }
.caret { color:var(--accent-primary); animation:hc-blink 1s steps(2) infinite; }
@keyframes hc-blink { 50% { opacity:0; } }
.reasoning { color:var(--text-secondary); font-size:11px; margin-bottom:4px; }
.reasoning pre { white-space:pre-wrap; max-height:160px; overflow-y:auto; margin:4px 0 0; }
.steps { font-size:12px; color:var(--text-secondary); border-left:2px solid var(--border-default); padding-left:8px; }
.steps > summary { cursor:pointer; }
.steps > .item { margin:3px 0 0 6px; }
.item.tool { font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); }
.item.tool summary { cursor:pointer; }
.item.tool pre { margin:4px 0 0 14px; white-space:pre-wrap; word-break:break-all; max-height:160px; overflow-y:auto; }
.ok { color:var(--accent-success); } .ko { color:var(--accent-danger); } .pending { color:var(--accent-warning); }
.plan { border-top:1px solid var(--border-default); background:var(--bg-deep); padding:4px 10px 6px; max-height:30%; overflow-y:auto; }
.plan-head { background:none; border:none; padding:2px 0; font-weight:600; width:100%; text-align:left; }
.plan ul { list-style:none; margin:2px 0 0; padding:0; display:flex; flex-direction:column; gap:2px; }
.plan li.done { color:var(--text-secondary); text-decoration:line-through; }
.plan li.in_progress { color:var(--accent-primary); font-weight:600; }
footer { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-top:1px solid var(--border-default); }
footer textarea { resize:none; }
.toolbar { display:flex; align-items:center; gap:6px; }
.modes { display:flex; border:1px solid var(--border-default); border-radius:6px; overflow:hidden; }
.mode { border:none; border-radius:0; background:none; padding:4px 8px; color:var(--text-secondary); }
.mode.on.ask { background:var(--accent-warning-dim); color:var(--text-primary); }
.mode.on.auto { background:var(--accent-success-dim); color:var(--text-primary); }
.mode.on.plan { background:var(--accent-secondary-dim); color:var(--text-primary); }
.model { flex:1; min-width:0; padding:4px 6px; }
.send { font-weight:700; }
.card { border:1px solid var(--accent-warning); background:var(--accent-warning-dim); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:6px; }
.card.plan { border-color:var(--accent-secondary); background:var(--accent-secondary-dim); }
.card.question { border-color:var(--accent-primary); background:var(--accent-primary-dim); }
.card.done { opacity:.7; }
.card .head { font-weight:600; } .card .head p { margin:0; }
.card ol { margin:0; padding-left:20px; }
.card pre { margin:0; font-size:11px; max-height:120px; overflow:auto; white-space:pre-wrap; word-break:break-all; }
.card .buttons { display:flex; gap:6px; flex-wrap:wrap; }
.card .free { display:flex; gap:6px; } .card .free input { flex:1; min-width:0; }
.card .answered { color:var(--text-secondary); font-style:italic; }
`;

const LABELS = {
  title: 'Hermes', newChat: 'Nueva conversación', history: 'Conversaciones', settings: 'Ajustes',
  placeholder: 'Escribe un mensaje · Enter envía · Shift+Enter salto',
  empty: 'Escribe algo para empezar.', send: '↑', stop: 'Stop', historyEmpty: 'No hay conversaciones.',
  thinking: 'Pensando…', working: (n) => `Trabajando… paso ${n}`,
};

// ── Markdown (portado de agent-jake sidepanel/markdown.ts: todo se escapa primero;
//    solo estas construcciones vuelven a ser etiquetas; enlaces limitados a http(s)). ──
function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mdInline(text) {
  const codes = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  out = out
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}
function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const html = []; let para = []; let list = null;
  const flushPara = () => { if (para.length) html.push(`<p>${para.map(mdInline).join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) html.push(`<${list.type}>${list.items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</${list.type}>`); list = null; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) { flushPara(); flushList(); const body = []; for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]); html.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`); continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { flushPara(); flushList(); const level = Math.min(heading[1].length + 2, 6); html.push(`<h${level}>${mdInline(heading[2])}</h${level}>`); continue; }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/); const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) { flushPara(); const type = bullet ? 'ul' : 'ol'; if (list && list.type !== type) flushList(); list ??= { type, items: [] }; list.items.push((bullet || numbered)[1]); continue; }
    if (/^\s*>\s?/.test(line)) { flushPara(); flushList(); html.push(`<blockquote>${mdInline(line.replace(/^\s*>\s?/, ''))}</blockquote>`); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList(); return html.join('');
}
// Media hidratación: URLs sueltas de imagen/vídeo → <img>/<video>. Opt-in por `hydrateMedia`.
function hydrateMedia(html) {
  return html.replace(/(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg))(?![^<]*<\/a>)/gi,
    '<img src="$1" alt="" loading="lazy">')
    .replace(/(https?:\/\/[^\s<>"']+\.(?:mp4|webm|mov))(?![^<]*<\/a>)/gi,
      '<video src="$1" controls preload="metadata"></video>');
}

const STATUS_ICON = { pending: '○', in_progress: '◐', done: '●' };

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export class HermesChat extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = TOKENS;
    this._root = this.shadowRoot;
    this._root.appendChild(style);

    // Estado de la conversación actual (el host persiste; aquí solo en memoria).
    this._items = [];
    this._plan = [];
    this._running = false;
    this._aborted = false;
    this._step = 0;
    this._drawer = 'none';
    this._planOpen = true;
    this._conversation = null;

    // Propiedades del host (todas opcionales). Se asignan como campos de respaldo para no
    // disparar los setters antes de que _buildChrome() cree el DOM que éstos renderizan.
    this.turnUrl = null;
    this.transport = null;      // (body, onEvent, signal) => Promise; sustituye a fetch (demo/tests)
    this._models = []; this._model = null;
    this._modes = []; this._conversations = [];
    this.currentConversation = null;
    this.contextLine = '';
    this.busy = false;
    this.renderers = {};        // { kind: (data) => Node }
    this.transformAssistant = null; // (text) => text; hidratación propia del host
    this.hydrateMedia = false;
    this.placeholder = LABELS.placeholder;
    this._labels = { ...LABELS };
    this._mode = undefined;

    this._buildChrome();
    this._renderModes(); this._renderModel();
  }

  // ── Chrome estático: header, drawers, log, plan, footer. ──
  _buildChrome() {
    const frag = this._root;
    const header = el('header');
    this._title = el('div', 'title', this.labels.title);
    const actions = el('div', 'actions');
    this._btnNew = el('button', 'icon', '✚'); this._btnNew.title = this.labels.newChat;
    this._btnHistory = el('button', 'icon', '🕘'); this._btnHistory.title = this.labels.history;
    this._btnSettings = el('button', 'icon', '⚙'); this._btnSettings.title = this.labels.settings;
    this._btnNew.addEventListener('click', () => this._newConversation());
    this._btnHistory.addEventListener('click', () => this._toggleDrawer('history'));
    this._btnSettings.addEventListener('click', () => this._toggleDrawer('settings'));
    actions.append(this._btnNew, this._btnHistory, this._btnSettings);
    header.append(this._title, actions);

    this._settingsDrawer = el('div', 'drawer settings');
    this._settingsDrawer.style.display = 'none';
    // Contenido de ajustes lo pone el host (el componente no conoce la config de cada sistema).
    const settingsSlot = document.createElement('slot'); settingsSlot.name = 'settings';
    this._settingsDrawer.appendChild(settingsSlot);

    this._historyDrawer = el('div', 'drawer history'); this._historyDrawer.style.display = 'none';

    this._log = el('main', 'log');
    this._planEl = el('section', 'plan'); this._planEl.style.display = 'none';

    const footer = el('footer');
    this._textarea = el('textarea'); this._textarea.rows = 3; this._textarea.placeholder = this.placeholder;
    this._textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
    });
    const toolbar = el('div', 'toolbar');
    this._modesEl = el('div', 'modes'); this._modesEl.setAttribute('role', 'radiogroup');
    this._modelEl = el('select', 'model'); this._modelEl.style.display = 'none';
    this._modelEl.addEventListener('change', () => this._emit('model-change', { model: this._modelEl.value }));
    this._sendBtn = el('button', 'send', this.labels.send);
    this._sendBtn.addEventListener('click', () => this._send());
    // Slot para acciones extra del host en el composer (p. ej. el micro de voz de admin).
    const composerSlot = document.createElement('slot'); composerSlot.name = 'composer-actions';
    toolbar.append(this._modesEl, this._modelEl, composerSlot, this._sendBtn);
    footer.append(this._textarea, toolbar);

    frag.append(header, this._settingsDrawer, this._historyDrawer, this._log, this._planEl, footer);
  }

  connectedCallback() { this._renderAll(); }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ── Props que re-renderizan al cambiar. ──
  set modes(v) { this._modes = v || []; this._renderModes(); } get modes() { return this._modes; }
  set models(v) { this._models = v || []; this._renderModel(); } get models() { return this._models; }
  set model(v) { this._model = v; this._renderModel(); } get model() { return this._model; }
  set conversations(v) { this._conversations = v || []; if (this._drawer === 'history') this._renderHistory(); } get conversations() { return this._conversations; }
  set labels(v) { this._labels = { ...LABELS, ...(v || {}) }; } get labels() { return this._labels || LABELS; }

  // Historial del host (p. ej. GET /mensajes): [{role:'user'|'assistant', text}] → burbujas.
  // Aditivo al contrato (hermes-chat.api.v1): el host lo siembra al abrir una conversación.
  set messages(v) {
    this._items = (v || []).map((m) => (m.role === 'user'
      ? { kind: 'user', text: m.text }
      : { kind: 'assistant', text: m.text, streaming: false, reasoning: null }));
    this._renderAll();
  }

  _toggleDrawer(which) {
    this._drawer = this._drawer === which ? 'none' : which;
    this._settingsDrawer.style.display = this._drawer === 'settings' ? '' : 'none';
    this._historyDrawer.style.display = this._drawer === 'history' ? '' : 'none';
    this._btnHistory.classList.toggle('on', this._drawer === 'history');
    this._btnSettings.classList.toggle('on', this._drawer === 'settings');
    if (this._drawer === 'history') this._renderHistory();
  }

  _newConversation() {
    this._emit('new-conversation', {});
    this._items = []; this._plan = []; this._step = 0; this._conversation = null;
    this._renderAll();
  }

  _renderHistory() {
    this._historyDrawer.replaceChildren();
    if (!this._conversations.length) { this._historyDrawer.appendChild(el('p', 'muted', this.labels.historyEmpty)); return; }
    for (const c of this._conversations) {
      const row = el('div', 'chat-row' + (c.id === this.currentConversation ? ' current' : ''));
      const link = el('button', 'link', c.title || c.id);
      link.addEventListener('click', () => this._emit('open-conversation', { id: c.id }));
      const del = el('button', 'icon', '🗑'); del.title = 'Borrar';
      del.addEventListener('click', () => this._emit('delete-conversation', { id: c.id }));
      row.append(link, del);
      this._historyDrawer.appendChild(row);
    }
  }

  _renderModes() {
    this._modesEl.replaceChildren();
    if (!this._modes.length) { this._modesEl.style.display = 'none'; return; }
    this._modesEl.style.display = '';
    for (const m of this._modes) {
      const b = el('button', 'mode ' + m.id + (m.id === this._mode ? ' on' : ''), m.label);
      b.type = 'button'; if (m.hint) b.title = m.hint;
      b.addEventListener('click', () => { this._mode = m.id; this._renderModes(); this._emit('mode-change', { mode: m.id }); });
      this._modesEl.appendChild(b);
    }
  }

  _renderModel() {
    if (!this._models.length) { this._modelEl.style.display = 'none'; return; }
    this._modelEl.style.display = '';
    const opts = this._models.includes(this._model) ? this._models : [this._model, ...this._models].filter(Boolean);
    this._modelEl.replaceChildren(...opts.map((m) => { const o = document.createElement('option'); o.value = m; o.textContent = m; return o; }));
    if (this._model) this._modelEl.value = this._model;
  }

  // ── Reductor de eventos del contrato. ──
  _handleEvent(type, data) {
    switch (type) {
      case 'meta':
        if (data.conversation != null) { this._conversation = data.conversation; this._emit('conversation-change', { conversation: data.conversation }); }
        break;
      case 'delta': {
        const last = this._items[this._items.length - 1];
        if (last && last.kind === 'assistant' && last.streaming) last.text += data.text || '';
        else this._items.push({ kind: 'assistant', text: data.text || '', streaming: true, reasoning: null });
        break;
      }
      case 'reasoning': {
        const last = this._items[this._items.length - 1];
        if (last && last.kind === 'assistant' && last.streaming) last.reasoning = (last.reasoning || '') + (data.text || '');
        else this._items.push({ kind: 'assistant', text: '', streaming: true, reasoning: data.text || '' });
        break;
      }
      case 'tool':
        this._items.push({ kind: 'tool', id: data.id, name: data.name, args: data.args, ok: undefined, detail: '' });
        this._step++;
        break;
      case 'tool_result': {
        let t = null;
        for (let i = this._items.length - 1; i >= 0; i--) if (this._items[i].kind === 'tool' && (data.id == null || this._items[i].id === data.id)) { t = this._items[i]; break; }
        if (t) { t.ok = data.ok !== false; t.detail = data.summary || t.detail; }
        break;
      }
      case 'request':
        this._items.push({ kind: 'request', request: data, answered: null });
        break;
      case 'plan':
        this._plan = (data.steps || []).map((s) => (typeof s === 'string' ? { text: s, status: 'pending' } : s));
        break;
      case 'custom':
        this._items.push({ kind: 'custom', ctype: data.kind, data: data.data });
        break;
      case 'error':
        this._items.push({ kind: 'error', text: data.message || 'Error' });
        break;
      case 'done': {
        const last = this._items[this._items.length - 1];
        if (last && last.kind === 'assistant') last.streaming = false;
        this._running = false; this._renderAll();
        this._emit('turn-end', { stopped: !!data.stopped });
        return;
      }
      default: break;
    }
    this._renderAll();
  }

  // ── Envío de turno: POST al contrato, o transport inyectado (demo/tests). ──
  async _send(extra) {
    if (this._running) return;
    const text = extra ? '' : this._textarea.value.trim();
    if (!text && !extra) return;
    if (!extra) this._textarea.value = '';
    if (!extra) this._items.push({ kind: 'user', text });

    const body = { text, conversation: this._conversation, mode: this._mode, model: this._model, ...(extra ? { answer: extra } : {}) };
    Object.keys(body).forEach((k) => (body[k] === undefined || body[k] === null || body[k] === '') && delete body[k]);

    this._running = true; this._aborted = false; this._step = 0; this._renderAll();
    const onEvent = (type, data) => this._handleEvent(type, data);
    try {
      if (typeof this.transport === 'function') {
        await this.transport(body, onEvent, { aborted: () => this._aborted });
      } else if (this.turnUrl) {
        const ctrl = new AbortController();
        this._ctrl = ctrl;
        const res = await fetch(this.turnUrl, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify(body), signal: ctrl.signal,
        });
        if (!res.ok || !res.body) { onEvent('error', { message: `HTTP ${res.status}` }); }
        else await this._readStream(res.body, onEvent);
      } else {
        onEvent('error', { message: 'Falta turnUrl o transport' });
      }
    } catch (e) {
      if (!this._aborted) onEvent('error', { message: String(e && e.message || e) });
    } finally {
      if (this._running) { this._running = false; this._handleEvent('done', {}); }
      this._renderAll();
    }
  }

  async _readStream(bodyStream, onEvent) {
    const reader = bodyStream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) { const frame = buf.slice(0, idx); buf = buf.slice(idx + 2); this._parseFrame(frame, onEvent); }
    }
    if (buf.trim()) this._parseFrame(buf, onEvent);
  }

  _parseFrame(frame, onEvent) {
    let type = null; const dataLines = [];
    for (const line of frame.split('\n')) {
      if (!line || line.startsWith(':')) continue; // keepalive / comentario
      if (line.startsWith('event:')) type = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    let data = {};
    try { data = JSON.parse(dataLines.join('\n')); } catch { data = { text: dataLines.join('\n') }; }
    if (!type && data.type) type = data.type;
    if (type) onEvent(type, data);
  }

  // API pública para el host: enviar un turno programáticamente (o desde el self-check).
  send(text) { if (text != null) this._textarea.value = text; return this._send(); }

  _stop() { this._aborted = true; if (this._ctrl) this._ctrl.abort(); this._emit('stop', {}); }

  _answerRequest(item, response, label) { item.answered = label; this._renderAll(); this._send(response); }

  // ── Render del log con bloques "N pasos" colapsados (como jake). ──
  _blocks() {
    const out = [];
    for (const item of this._items) {
      const quiet = item.kind === 'tool' || (item.kind === 'assistant' && item.streaming && !item.text.trim());
      const last = out[out.length - 1];
      if (quiet && last && last.steps) last.steps.push(item);
      else if (quiet) out.push({ steps: [item] });
      else out.push({ item });
    }
    return out;
  }

  _stepsLabel(steps) {
    const tools = steps.filter((s) => s.kind === 'tool');
    const failed = tools.filter((s) => s.ok === false).length;
    const names = [...new Set(tools.map((s) => String(s.name || '').replace(/^browser_/, '')))].slice(0, 4).join(', ');
    const n = tools.length || 1;
    return `${n} ${n === 1 ? 'paso' : 'pasos'}${names ? ` · ${names}` : ''}${failed ? ` · ${failed} con error` : ''}`;
  }

  _renderAll() { this._renderLog(); this._renderPlan(); this._renderSendBtn(); }

  _renderSendBtn() {
    if (this._running) { this._sendBtn.textContent = this.labels.stop; this._sendBtn.className = 'stop'; this._sendBtn.onclick = () => this._stop(); }
    else { this._sendBtn.textContent = this.labels.send; this._sendBtn.className = 'send'; this._sendBtn.onclick = () => this._send(); }
    this._sendBtn.disabled = this.busy || (!this._textarea.value.trim() && !this._running);
  }

  _renderLog() {
    const log = this._log; log.replaceChildren();
    if (!this._items.length) {
      const empty = el('div', 'empty'); empty.appendChild(el('p', null, this.labels.empty));
      if (this.contextLine) { const c = el('p', 'muted'); c.innerHTML = renderMarkdown(this.contextLine); empty.appendChild(c); }
      log.appendChild(empty); return;
    }
    for (const block of this._blocks()) {
      if (block.steps) {
        const d = el('details', 'steps');
        if (this._running) d.open = true;
        const s = el('summary', null, this._stepsLabel(block.steps)); d.appendChild(s);
        for (const item of block.steps) { if (item.kind === 'tool') d.appendChild(this._toolNode(item)); else if (item.reasoning) d.appendChild(this._reasoningNode(item.reasoning)); }
        log.appendChild(d);
      } else {
        log.appendChild(this._itemNode(block.item));
      }
    }
    if (this._running) log.appendChild(el('div', 'item info', this.labels.working(this._step || 1)));
    log.scrollTop = log.scrollHeight;
  }

  _reasoningNode(text) {
    const d = el('details', 'reasoning'); d.appendChild(el('summary', null, 'razonamiento'));
    const pre = el('pre', null, text); d.appendChild(pre); return d;
  }

  _toolNode(item) {
    const d = el('details', 'item tool');
    const s = el('summary');
    const mark = el('span', item.ok === undefined ? 'pending' : item.ok ? 'ok' : 'ko', '●');
    s.append(mark, document.createTextNode(' ' + (item.name || 'tool')));
    d.appendChild(s);
    if (item.detail) d.appendChild(el('pre', null, item.detail));
    return d;
  }

  _itemNode(item) {
    if (item.kind === 'user') return el('div', 'item user', item.text);
    if (item.kind === 'assistant') {
      const wrap = el('div', 'item assistant' + (item.streaming && !item.text.trim() ? ' interim' : ''));
      if (item.reasoning) wrap.appendChild(this._reasoningNode(item.reasoning));
      const md = el('div', 'md');
      let text = item.text;
      if (typeof this.transformAssistant === 'function') text = this.transformAssistant(text);
      let html = renderMarkdown(text);
      if (this.hydrateMedia) html = hydrateMedia(html);
      md.innerHTML = html;
      wrap.appendChild(md);
      if (item.streaming) wrap.appendChild(el('span', 'caret', '▍'));
      return wrap;
    }
    if (item.kind === 'tool') return this._toolNode(item);
    if (item.kind === 'error') return el('div', 'item error', item.text);
    if (item.kind === 'info') return el('div', 'item info', item.text);
    if (item.kind === 'request') return this._requestNode(item);
    if (item.kind === 'custom') {
      const wrap = el('div', 'item custom');
      const fn = this.renderers && this.renderers[item.ctype];
      if (typeof fn === 'function') { const node = fn(item.data); if (node) wrap.appendChild(node); }
      else wrap.appendChild(el('div', 'muted', `[${item.ctype}]`));
      return wrap;
    }
    return el('div', 'item', item.text || '');
  }

  _requestNode(item) {
    const r = item.request || {}; const kind = r.kind || 'question';
    const card = el('div', 'card ' + kind + (item.answered ? ' done' : ''));
    if (kind === 'approve') {
      card.appendChild(el('div', 'head', `¿Permitir ${r.tool || 'acción'}${r.origin ? ` en ${r.origin}` : ''}?`));
      if (r.args && Object.keys(r.args).length) card.appendChild(el('pre', null, JSON.stringify(r.args, null, 2)));
      if (!item.answered) {
        const b = el('div', 'buttons');
        const allow = el('button', 'primary', 'Permitir'); allow.addEventListener('click', () => this._answerRequest(item, { kind: 'approve', decision: 'allow' }, 'Permitido'));
        const deny = el('button', 'danger', 'Denegar'); deny.addEventListener('click', () => this._answerRequest(item, { kind: 'approve', decision: 'deny' }, 'Denegado'));
        b.append(allow, deny); card.appendChild(b);
      }
    } else if (kind === 'plan') {
      card.appendChild(el('div', 'head', 'Plan propuesto'));
      const sum = el('div', 'md'); sum.innerHTML = renderMarkdown(r.summary || ''); card.appendChild(sum);
      const ol = el('ol'); (r.steps || []).forEach((s) => ol.appendChild(el('li', null, typeof s === 'string' ? s : s.text))); card.appendChild(ol);
      if (!item.answered) {
        const b = el('div', 'buttons');
        const ok = el('button', 'primary', 'Aprobar y ejecutar'); ok.addEventListener('click', () => this._answerRequest(item, { kind: 'plan', decision: 'approve' }, 'Aprobado'));
        b.appendChild(ok); card.appendChild(b);
      }
    } else { // question (choices / aclaración) — el caso típico de Hermes
      const head = el('div', 'head'); head.innerHTML = renderMarkdown(r.question || ''); card.appendChild(head);
      if (!item.answered) {
        if (r.options && r.options.length) {
          const b = el('div', 'buttons');
          for (const o of r.options) { const btn = el('button', null, o.label != null ? o.label : String(o)); btn.addEventListener('click', () => this._answerRequest(item, { kind: 'question', answer: o.value != null ? o.value : o }, o.label != null ? o.label : String(o))); b.appendChild(btn); }
          card.appendChild(b);
        }
        const form = el('form', 'free');
        const inp = el('input'); inp.placeholder = 'Otra respuesta…';
        const sub = el('button', null, 'Responder'); sub.type = 'submit'; sub.disabled = true;
        inp.addEventListener('input', () => { sub.disabled = !inp.value.trim(); });
        form.addEventListener('submit', (e) => { e.preventDefault(); if (inp.value.trim()) this._answerRequest(item, { kind: 'question', answer: inp.value.trim() }, inp.value.trim()); });
        form.append(inp, sub); card.appendChild(form);
      }
    }
    if (item.answered) card.appendChild(el('div', 'answered', item.answered === 'cancelled' ? 'Cancelado' : `→ ${item.answered}`));
    return card;
  }

  _renderPlan() {
    const p = this._planEl;
    if (!this._plan.length) { p.style.display = 'none'; return; }
    p.style.display = '';
    p.replaceChildren();
    const done = this._plan.filter((s) => s.status === 'done').length;
    const head = el('button', 'plan-head'); head.textContent = `Plan · ${done}/${this._plan.length} ${this._planOpen ? '▾' : '▸'}`;
    head.addEventListener('click', () => { this._planOpen = !this._planOpen; this._renderPlan(); });
    p.appendChild(head);
    if (this._planOpen) {
      const ul = el('ul');
      for (const s of this._plan) { const li = el('li', s.status, `${STATUS_ICON[s.status] || '○'} ${s.text}`); ul.appendChild(li); }
      p.appendChild(ul);
    }
  }
}

// CONTRACT: hermes-chat.api.v1 — el tag y su API son la superficie que consumen los hosts.
customElements.define('hermes-chat', HermesChat);
export { renderMarkdown };
export default HermesChat;
