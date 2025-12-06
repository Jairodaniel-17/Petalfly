import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { PetalflyDocument } from "@/types/pfs";
import type { EditorTab } from "@/types/domain";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import Prism from "@services/prismConfig";
import Editor from "react-simple-code-editor";

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "tests", label: "Tests" },
  { id: "docs", label: "Docs" },
  { id: "raw", label: ".pfs" },
];

type QueryValue = NonNullable<PetalflyDocument["request"]["query"]>[string];
type QueryRow = [string, QueryValue];

export function RequestWorkspace() {
  const activeRequest = useAppStore(selectActiveRequest);
  const warnings = useAppStore((state) => state.warnings);
  const loading = useAppStore((state) => state.loading);
  const editorTab = useAppStore((state) => state.editorTab);
  const setEditorTab = useAppStore((state) => state.setEditorTab);
  const updateDocument = useAppStore((state) => state.updateDocument);
  const updateRaw = useAppStore((state) => state.updateRaw);
  const saveActiveRequest = useAppStore((state) => state.saveActiveRequest);
  const sendActiveRequest = useAppStore((state) => state.sendActiveRequest);
  const environments = useAppStore((s) => s.environments);
  const activeEnvName = useAppStore((s) => s.activeEnvironment ?? s.settings.activeEnvironment ?? "");
  const env = environments.find((e) => e.name === activeEnvName);
  const variables = env?.variables ?? [];
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const copyPlaceholder = async (name: string) => {
    const tpl = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(tpl);
      setCopyMessage(`Copiado ${tpl}`);
      setTimeout(() => setCopyMessage(null), 1500);
    } catch {
      // fallback: alert
      alert(`Copiado: ${tpl}`);
    }
  };

  if (!activeRequest) {
    return (
      <section className="panel panel--request">
        <h2>Request</h2>
        <p>Selecciona o crea un request en la barra lateral.</p>
      </section>
    );
  }

  return (
    <section className="panel panel--request">
      <div className="request-toolbar">
        <select
          value={activeRequest.doc.request.method}
          onChange={(event) =>
            updateDocument({
              ...activeRequest.doc,
              request: {
                ...activeRequest.doc.request,
                method: event.target.value as PetalflyDocument["request"]["method"],
              },
            })
          }
        >
          {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
            (method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ),
          )}
        </select>
        <input
          className="request-toolbar__url"
          value={activeRequest.doc.request.url}
          onChange={(event) =>
            updateDocument({
              ...activeRequest.doc,
              request: { ...activeRequest.doc.request, url: event.target.value },
            })
          }
        />
        <div className="request-toolbar__actions">
          <button onClick={saveActiveRequest}>Guardar</button>
          <button className="button--primary" disabled={loading} onClick={sendActiveRequest}>
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
      <div className="vars-panel">
        <strong>Variables</strong>
        <div className="vars-list">
          {variables.length === 0 && <span className="vars-empty">Sin variables</span>}
          {variables.map((v) => (
            <button key={v.name} className="var-item" onClick={() => copyPlaceholder(v.name)}>
              {v.name} {v.secret ? <em>🔒</em> : null}
            </button>
          ))}
          {copyMessage && <span className="vars-copy-msg">{copyMessage}</span>}
        </div>
      </div>
      <div className="editor-tabs">
        {EDITOR_TABS.map((tab) => (
          <button
            key={tab.id}
            className={editorTab === tab.id ? "is-active" : ""}
            onClick={() => setEditorTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="editor-tab__body">
        {editorTab === "params" && (
          <ParamsEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "headers" && (
          <HeadersEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "body" && (
          <BodyEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "auth" && (
          <AuthEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "tests" && (
          <TestsEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "docs" && (
          <DocsEditor doc={activeRequest.doc} updateDocument={updateDocument} />
        )}
        {editorTab === "raw" && (
          <RawEditor raw={activeRequest.raw} updateRaw={updateRaw} />
        )}
      </div>
      {warnings?.length ? (
        <div className="warnings">
          <strong>Warnings</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning.variable}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ParamsEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const entries = Object.entries(doc.request.query ?? {}) as QueryRow[];
  const defaultRow: QueryRow = ["", { value: "", enabled: true }];
  const rows: QueryRow[] = entries.length > 0 ? entries : [defaultRow];

  const updateRow = (index: number, key: string, value: QueryValue) => {
    const query: Record<string, QueryValue> = {};
    rows.forEach(([entryKey, entryValue], rowIndex) => {
      const nextKey = rowIndex === index ? key : entryKey;
      const nextValue = rowIndex === index ? value : entryValue;
      if (!nextKey) return;
      query[nextKey] = nextValue;
    });
    updateDocument({
      ...doc,
      request: { ...doc.request, query },
    });
  };

  return (
    <div className="grid-table">
      {rows.map(([key, value], index) => (
        <div className="grid-table__row" key={`${key}-${index}`}>
          <input
            value={key}
            placeholder="Nombre"
            onChange={(event) => updateRow(index, event.target.value, value)}
          />
          <input
            value={typeof value === "string" ? value : value.value}
            placeholder="Valor"
            onChange={(event) =>
              updateRow(
                index,
                key,
                typeof value === "string"
                  ? event.target.value
                  : { ...value, value: event.target.value },
              )
            }
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={typeof value === "string" ? true : value.enabled !== false}
              onChange={(event) =>
                updateRow(
                  index,
                  key,
                  typeof value === "string"
                    ? { value, enabled: event.target.checked }
                    : { ...value, enabled: event.target.checked },
                )
              }
            />
            Activo
          </label>
        </div>
      ))}
      <button
        onClick={() =>
          updateDocument({
            ...doc,
            request: {
              ...doc.request,
              query: { ...(doc.request.query ?? {}), [`param${rows.length + 1}`]: "" },
            },
          })
        }
      >
        Añadir parámetro
      </button>
    </div>
  );
}

function HeadersEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const entries = Object.entries(doc.request.headers ?? {});
  const rows = entries.length > 0 ? entries : [["", ""]];
  const updateHeaders = (index: number, key: string, value: string) => {
    const headers: Record<string, string> = {};
    rows.forEach(([entryKey, entryValue], rowIndex) => {
      const nextKey = rowIndex === index ? key : entryKey;
      const nextValue = rowIndex === index ? value : entryValue;
      if (!nextKey) return;
      headers[nextKey] = nextValue;
    });
    updateDocument({ ...doc, request: { ...doc.request, headers } });
  };
  return (
    <div className="grid-table">
      {rows.map(([key, value], index) => (
        <div className="grid-table__row" key={`${key}-${index}`}>
          <input
            value={key}
            placeholder="Header"
            onChange={(event) => updateHeaders(index, event.target.value, value)}
          />
          <input
            value={value}
            placeholder="Valor"
            onChange={(event) => updateHeaders(index, key, event.target.value)}
          />
          <button
            onClick={() =>
              updateDocument({
                ...doc,
                request: {
                  ...doc.request,
                  headers: Object.fromEntries(rows.filter((_, rowIndex) => rowIndex !== index)),
                },
              })
            }
          >
            ☓
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          updateDocument({
            ...doc,
            request: {
              ...doc.request,
              headers: { ...(doc.request.headers ?? {}), [`X-Header-${rows.length + 1}`]: "" },
            },
          })
        }
      >
        Añadir header
      </button>
    </div>
  );
}

function BodyEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const body = doc.request.body ?? { type: "none" };
  const [isJsonValid, setIsJsonValid] = useState(true);

  const handleBodyChange = (value: string) => {
    updateDocument({
      ...doc,
      request: { ...doc.request, body: { ...body, value } },
    });
  };

  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(body.value ?? "{}"), null, 2);
      handleBodyChange(formatted);
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  };

  return (
    <div>
      <select
        value={body.type}
        onChange={(event) =>
          updateDocument({
            ...doc,
            request: { ...doc.request, body: { type: event.target.value as any, value: body.value } },
          })
        }
      >
        <option value="none">Sin body</option>
        <option value="json">JSON</option>
        <option value="text">Texto</option>
        <option value="form-data">Form Data</option>
        <option value="urlencoded">x-www-form-urlencoded</option>
      </select>
      {body.type !== "none" && (
        <textarea
          rows={body.type === "json" ? 12 : 8}
          value={body.value ?? ""}
          onChange={(event) => handleBodyChange(event.target.value)}
        />
      )}
      {body.type === "json" && (
        <button onClick={formatJson}>{isJsonValid ? "Formatear" : "JSON inválido"}</button>
      )}
    </div>
  );
}

function AuthEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const auth = doc.request.auth ?? { type: "none" };
  const updateAuth = (next: Partial<PetalflyDocument["request"]["auth"]>) => {
    updateDocument({
      ...doc,
      request: { ...doc.request, auth: { ...auth, ...next } },
    });
  };
  return (
    <div className="grid-form">
      <p className="form-hint">
        Puedes referenciar variables disponibles con {"{{nombre}}"}; se sustituyen
        automáticamente antes de enviar la petición.
      </p>
      <label>
        Tipo
        <select
          value={auth.type}
          onChange={(event) => updateAuth({ type: event.target.value as any })}
        >
          <option value="none">Sin auth</option>
          <option value="bearer">Bearer</option>
          <option value="basic">Basic</option>
          <option value="apiKey">API Key</option>
        </select>
      </label>
      {auth.type === "bearer" && (
        <label>
          Token o {"{{variable}}"}
          <span className="form-hint">
            Coloca el valor directo o una variable; se resolverá en el request final.
          </span>
          <input
            value={auth.bearer_token_var ?? ""}
            placeholder="token o {{secret_token}}"
            onChange={(event) => updateAuth({ bearer_token_var: event.target.value })}
          />
        </label>
      )}
      {auth.type === "basic" && (
        <>
          <label>
            Usuario
            <span className="form-hint">
              Puedes usar variables definidas en la barra lateral.
            </span>
            <input
              value={auth.basic_user_var ?? ""}
              placeholder="usuario o {{secret_user}}"
              onChange={(event) => updateAuth({ basic_user_var: event.target.value })}
            />
          </label>
          <label>
            Password
            <span className="form-hint">
              El valor se sustituye automáticamente al ejecutar la petición.
            </span>
            <input
              value={auth.basic_password_var ?? ""}
              placeholder="password o {{secret_pass}}"
              onChange={(event) => updateAuth({ basic_password_var: event.target.value })}
            />
          </label>
        </>
      )}
      {auth.type === "apiKey" && (
        <>
          <label>
            Nombre header/query
            <input
              value={auth.name ?? ""}
              onChange={(event) => updateAuth({ name: event.target.value })}
            />
          </label>
          <label>
            Valor o {"{{variable}}"}
            <span className="form-hint">
              Referencia variables y las enviaremos con el valor resuelto.
            </span>
            <input
              value={auth.api_key_var ?? ""}
              placeholder="clave o {{secret_key}}"
              onChange={(event) => updateAuth({ api_key_var: event.target.value })}
            />
          </label>
          <label>
            Ubicación
            <select
              value={auth.in ?? "header"}
              onChange={(event) => updateAuth({ in: event.target.value as any })}
            >
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}

function TestsEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const tests = doc.tests ?? [];
  const updateTest = (index: number, next: any) => {
    const updated = tests.map((test, idx) => (idx === index ? next : test));
    updateDocument({ ...doc, tests: updated });
  };
  const addTest = () => {
    updateDocument({
      ...doc,
      tests: [
        ...tests,
        {
          name: `Test ${tests.length + 1}`,
          expect: { status: 200 },
        },
      ],
    });
  };
  return (
    <div>
      {tests.map((test, index) => (
        <div className="test-card" key={test.name}>
          <input
            value={test.name}
            onChange={(event) => updateTest(index, { ...test, name: event.target.value })}
          />
          <label>
            Status
            <input
              type="number"
              value={test.expect.status ?? ""}
              onChange={(event) =>
                updateTest(index, {
                  ...test,
                  expect: { ...test.expect, status: Number(event.target.value) || undefined },
                })
              }
            />
          </label>
          <label>
            Header contiene
            <input
              value={test.expect.header?.contains ?? ""}
              onChange={(event) =>
                updateTest(index, {
                  ...test,
                  expect: {
                    ...test.expect,
                    header: {
                      ...(test.expect.header ?? { name: "Content-Type" }),
                      contains: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <label>
            JSONPath
            <input
              value={test.expect.json?.path ?? ""}
              onChange={(event) =>
                updateTest(index, {
                  ...test,
                  expect: {
                    ...test.expect,
                    json: {
                      ...(test.expect.json ?? {}),
                      path: event.target.value,
                    },
                  },
                })
              }
            />
          </label>
          <button
            onClick={() =>
              updateDocument({
                ...doc,
                tests: tests.filter((_, idx) => idx !== index),
              })
            }
          >
            Eliminar
          </button>
        </div>
      ))}
      <button onClick={addTest}>Añadir test</button>
    </div>
  );
}

function DocsEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const [view, setView] = useState<"edit" | "preview">("edit");
  return (
    <div className="docs-editor">
      <div className="docs-editor__tabs">
        <button onClick={() => setView("edit")} className={view === "edit" ? "is-active" : ""}>
          Markdown
        </button>
        <button
          onClick={() => setView("preview")}
          className={view === "preview" ? "is-active" : ""}
        >
          Preview
        </button>
      </div>
      {view === "edit" ? (
        <textarea
          rows={10}
          value={doc.docs ?? ""}
          onChange={(event) => updateDocument({ ...doc, docs: event.target.value })}
        />
      ) : (
        <div className="docs-preview">
          <ReactMarkdown>{doc.docs ?? ""}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function RawEditor({
  raw,
  updateRaw,
}: {
  raw: string;
  updateRaw: (raw: string) => void;
}) {
  const [value, setValue] = useState(raw);
  useEffect(() => {
    setValue(raw);
  }, [raw]);

  const highlight = useCallback(
    (code: string) => Prism.highlight(code, Prism.languages.pfs ?? Prism.languages.yaml, "pfs"),
    [],
  );

  return (
    <div className="raw-editor">
      <Editor
        value={value}
        onValueChange={setValue}
        highlight={highlight}
        padding={12}
        className="raw-editor__editor"
        textareaClassName="raw-editor__textarea"
      />
      <div className="raw-editor__actions">
        <button onClick={() => updateRaw(value)}>Aplicar cambios</button>
      </div>
    </div>
  );
}
