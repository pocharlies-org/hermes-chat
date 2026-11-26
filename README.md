# hermes-chat

Un chat Hermes **embebible** con el look del sidepanel de agent-jake (Cyberpunk Noir, burbujas,
"N pasos" colapsados, razonamiento, RequestCard, plan, composer con modos y modelo).

**Web component de cero dependencias** — custom element `<hermes-chat>` + shadow DOM, un solo fichero
ESM autocontenido (`hermes-chat.js`). Funciona igual en **React** (admin.skirmshop.es) y en **vanilla
sin build** (Studio del dashboard). Los tokens de color van inlinados en el shadow CSS, así el look es
idéntico en hosts que no comparten esos tokens.

Lo propio de cada sistema (auth, id de sesión, guardas, tarjetas, voz) **lo inyecta el host** por
propiedades/eventos — nunca por un fork del chat (ley DGX-1301: `hermes-api-client` no traduce
eventos; cada host conserva su traducción, ahora hacia el contrato de este componente).

## Uso

### Vanilla (Studio)
```html
<script type="module" src="/static/hermes-chat.v1.0.0.js"></script>
<hermes-chat id="chat"></hermes-chat>
<script type="module">
  const chat = document.getElementById('chat');
  chat.turnUrl = '/api/studio/agent/turn';
  chat.modes = [{ id: 'auto', label: 'Auto', hint: 'Actúa sin preguntar' }];
  chat.renderers = { job: (d) => miTarjetaDeJob(d) };   // tarjetas propias del host
</script>
```

### React (admin)
```jsx
import 'hermes-chat';
const ref = useRef();
<hermes-chat
  ref={(el) => { if (el) { el.turnUrl = '/api/panel/hermes/turn'; el.renderers = { propuesta: (d) => <StockCard {...d} /> }; } }}
>
  <button slot="composer-actions" onClick={hablar}>🎙</button>
</hermes-chat>
```

## Contrato

El componente hace `POST` a `turnUrl` con `{text, conversation?, mode?, model?, answer?}` y lee el
stream SSE. Tipos: `meta · delta · reasoning · tool · tool_result · request · plan · custom · error · done`.
Está versionado en [`CONTRACTS.yaml`](CONTRACTS.yaml) (ley de contratos de la casa).

El host traduce sus eventos Hermes a ese vocabulario (donde ya vive hoy: `_traduce` en el BFF de admin,
`translate` en `routes_studio_agent.py` del dashboard). Las guardas (HMAC de sesión, un-turno-por-usuario,
keepalive) siguen **en el host**, intactas.

## Demo y self-check

`demo.html` usa un `transport` mock (sin servidor) que dispara todos los `kind` y ejecuta 11 asserts
(bloque "N pasos", ok/ko, plan, `custom` renderer, RequestCard contestada, escapado del markdown…).

```bash
python3 -m http.server 8099
# headless:
chrome-headless-shell --headless --no-sandbox --virtual-time-budget=8000 \
  --dump-dom http://127.0.0.1:8099/demo.html | grep 'id="result"'
# → PASS 11/11
```

## Pin (patrón de la casa, espejo del wheel de `hermes-api-client`)

- **admin**: dependencia por URL al tarball/fichero de la release en `web/package.json` (se bundlea en Vite).
- **Studio**: copia **vendored** commiteada en `services/dashboard/static/hermes-chat.vX.Y.js` (sin build).

Actualizar = un PR de pin por host.
