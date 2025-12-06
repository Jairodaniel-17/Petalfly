# Arquitectura de Petalfly

## Flujo de datos

```
.pfs en disco
    │  (read_workspace_index)
    ▼
Parser TypeScript (pfsParser.ts)
    │  AST (PetalflyDocument)
    ▼
Zustand store (useAppStore)
    │  + Secret cache + settings + history
    │
    ├── Resolver de variables (variableResolver.ts)
    │       recibe entorno + globals (al enviar el request)
    │
    ├── Executor HTTP (httpClient.ts)
    │       construye payload → invoke("execute_request")
    │
    ├── Test runner (testRunner.ts)
    │       corre assertions del `.pfs` sobre la respuesta
    │
    └── Persistencia:
            save_pfs_file / save_environment / append_history_entry
```

### Secrets workflow

1. El usuario ingresa su **master password** en la pantalla inicial (solo se almacena en memoria).
2. El Secret Manager permite crear/editar variables con `secret: true` en el entorno activo.
3. Al guardar, el frontend usa `encrypt_value` para cifrar el secret y luego invoca `save_environment`.
4. Las variables se guardan cifradas en YAML. Cuando se necesitan (SEND o Reveal) se descifran en memoria con `decrypt_value`.
5. Cada secret mantiene un caché interno (`secretCache`) para evitar múltiples decrypts mientras la app está abierta.

### Historial

```
payload ejecutado
    │
    ├─ append_history_entry(requestId, entry, limit) → workspace/history/<requestId>.json
    └─ read_history_entries(requestId) → ResponsePanel (tab History)
```

Cada entrada almacena: status, statusText, duración, tamaño, timestamp, request resuelto y body preview. El número máximo de elementos depende de `settings.historyLimit`.

## Frontend (`src/`)

- `components/CollectionsSidebar.tsx`: árbol de colecciones, operaciones de FS, accesos a Secret Manager / Settings / Import cURL.
- `components/editor/RequestWorkspace.tsx`: toolbar + tabs (Params, Headers, Body, Auth, Tests, Docs, Raw).
- `components/response/ResponseTabs.tsx`: panel derecho con Body/Headers/Tests/Curl/History.
- `components/modals/*`: Secret Manager, Settings, Master Password y cURL Import.
- `store/useAppStore.ts`: Zustand para requests, entornos, master password, history, modales y operaciones de workspace.
- `services/pfsParser.ts`: parser bidireccional + detección de variables.
- `services/variableResolver.ts`: reemplazo in-memory de `{{var}}`.
- `services/httpClient.ts`: construye payload final y añade resultados del test runner.
- `services/testRunner.ts`: evalúa assertions en TypeScript (status, headers, body, JSONPath).
- `services/curl.ts`: conversores import/export.
- `services/tauriBridge.ts`: wrapper sobre `window.__TAURI__` para invocar comandos Rust.

## Backend (`src-tauri/`)

- `commands/fs.rs`: lectura/escritura de `.pfs`, entornos, settings, gestión de colecciones (create/duplicate/delete/rename) y helper `ensure_workspace_path`.
- `http_client.rs`: wrapper sobre `reqwest` con timeouts, redirects y métrica de duración.
- `history.rs`: persistencia de historiales (`workspace/history`).
- `crypto.rs`: ChaCha20-Poly1305 + PBKDF2 (salt + nonce per secret).
- `pfs_parser.rs`: validación de encabezado y normalización de `docs: """`.
- `domain.rs`: modelos compartidos (settings, history entries, payloads).
- `lib.rs`: comandos Tauri expuestos a la UI (workspace, secret crypto, history, FS helpers).

### Comandos clave

| Comando | Descripción |
| ------- | ----------- |
| `read_workspace_index` | Lee collections/environments/globals/settings |
| `save_pfs_file` | Valida y guarda un `.pfs` (parser Rust) |
| `save_environment` | Persiste entornos con variables cifradas |
| `save_settings` | Actualiza `workspace/settings.json` |
| `execute_request` | Usa `reqwest` para ejecutar HTTP |
| `encrypt_value` / `decrypt_value` | Cifrado simétrico de secrets |
| `append_history_entry` / `read_history_entries` | Manejo del historial por request |
| `create_folder`, `create_request`, `duplicate_request`, `delete_entry`, `rename_entry` | Operaciones del árbol |

## Workspace

```
workspace/
  collections/*.pfs
  environments/*.yaml
  globals.yaml
  history/*.json
  settings.json
```

El workspace puede ser redefinido durante tests mediante `PETALFLY_WORKSPACE`. Todos los comandos validan que las rutas permanezcan dentro de este directorio para evitar accesos indebidos.

## Extensibilidad

- **Plugins / scripting:** La capa de servicios (parser/resolver/http) está desacoplada de la UI, por lo que es posible añadir nuevas pestañas (GraphQL, gRPC) sin tocar el parser.
- **Automatización CI:** El runner de tests existe tanto en TS como en Rust (`test_runner.rs`). El historial en JSON facilita disparar pipelines offline.
- **Keyring OS:** el módulo de crypto ya está aislado para reemplazar la master password in-memory por un proveedor del sistema operativo en futuras iteraciones.
- **Importadores:** el convertidor cURL → `.pfs` y la capa de comandos permiten añadir importaciones Postman/Bruno en el mismo flujo.

## Diagramas mentales

- **Editor ↔ Parser ↔ Disco:** El usuario edita desde tabs visuales. Cada acción invoca `updateDocument` (sincroniza AST + raw `.pfs`). `save_pfs_file` recibe siempre un texto validado por el parser.
- **Secrets pipeline:** UI (Secret Manager) → encrypt/decrypt commands → YAML. La master password jamás se serializa.
- **Request pipeline:** Doc → resolver variables → payload final → `execute_request` → respuesta → runner → history → UI.
