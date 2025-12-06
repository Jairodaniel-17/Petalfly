import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { PetalflyDocument } from "@/types/pfs";
import type { EditorTab } from "@/types/domain";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import Prism from "@services/prismConfig";
import Editor from "react-simple-code-editor";
import { MessagesEditor } from "./MessagesEditor";


const getEditorTabs = (protocol?: string): { id: EditorTab; label: string }[] => {
  const baseTabs: { id: EditorTab; label: string }[] = [
    { id: "params", label: "Params" },
    { id: "headers", label: "Headers" },
    { id: "auth", label: "Auth" },
    { id: "tests", label: "Tests" },
    { id: "docs", label: "Docs" },
  ];
  if (protocol === "graphql") {
    return [
      { id: "params", label: "Params" },
      { id: "headers", label: "Headers" },
      { id: "body", label: "Query" },
      { id: "auth", label: "Auth" },
      { id: "tests", label: "Tests" },
      { id: "docs", label: "Docs" },
    ];
  }
  return [
    ...baseTabs,
    { id: "body", label: "Body" },
  ];
};

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
          value={activeRequest.doc.protocol ?? "http"}
          onChange={(event) => {
            const newProtocol = event.target.value as PetalflyDocument["protocol"];
            updateDocument({
              ...activeRequest.doc,
              protocol: newProtocol,
              request: {
                ...activeRequest.doc.request,
                method: newProtocol === "graphql" ? "POST" : activeRequest.doc.request.method,
              },
            });
          }}
        >
          <option value="http">HTTP</option>
          <option value="grpc">gRPC (Próximamente)</option>
          <option value="graphql">GraphQL</option>
          <option value="websocket">WebSocket</option>
        </select>
        {(activeRequest.doc.protocol === "http" || activeRequest.doc.protocol === "graphql") && (
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
            {activeRequest.doc.protocol === "graphql"
              ? ["GET", "POST"].map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))
              : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
                  (method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ),
                )}
          </select>
        )}
        {activeRequest.doc.protocol === "grpc" && (
          <>
            <input
              placeholder="Servicio"
              value={activeRequest.doc.request.service ?? ""}
              onChange={(event) =>
                updateDocument({
                  ...activeRequest.doc,
                  request: {
                    ...activeRequest.doc.request,
                    service: event.target.value || undefined,
                  },
                })
              }
            />
            <input
              placeholder="Método"
              value={activeRequest.doc.request.grpc_method ?? ""}
              onChange={(event) =>
                updateDocument({
                  ...activeRequest.doc,
                  request: {
                    ...activeRequest.doc.request,
                    grpc_method: event.target.value || undefined,
                  },
                })
              }
            />
          </>
        )}
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

          <button
            className="button--primary"
            disabled={loading || !activeRequest}
            onClick={sendActiveRequest}
          >
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
        {getEditorTabs(activeRequest.doc.protocol).map((tab) => (
          <button
            key={tab.id}
            className={`editor-tab ${editorTab === tab.id ? "active" : ""}`}
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
        {editorTab === "body" && activeRequest.doc.protocol !== "websocket" && (
          <BodyEditor doc={activeRequest.doc} updateDocument={updateDocument} protocol={activeRequest.doc.protocol} />
        )}
        {editorTab === "body" && activeRequest.doc.protocol === "websocket" && (
          <MessagesEditor doc={activeRequest.doc} updateDocument={updateDocument} />
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
  protocol,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
  protocol?: string;
}) {
  const body = doc.request.body ?? { type: "none" };
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [formData, setFormData] = useState<Array<{key: string, value: string}>>([]);

  useEffect(() => {
    if (body.type === "form-data" || body.type === "urlencoded") {
      try {
        const parsed = JSON.parse(body.value ?? "{}");
        setFormData(Object.entries(parsed).map(([key, value]) => ({key, value: value as string})));
      } catch {
        setFormData([]);
      }
    }
  }, [body.type, body.value]);

  const handleBodyChange = (value: string) => {
    updateDocument({
      ...doc,
      request: { ...doc.request, body: { ...body, value } },
    });
  };

  const updateFormData = (newFormData: Array<{key: string, value: string}>) => {
    setFormData(newFormData);
    const obj = newFormData.reduce((acc, {key, value}) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);
    handleBodyChange(JSON.stringify(obj));
  };

  const addFormField = () => {
    updateFormData([...formData, {key: "", value: ""}]);
  };

  const updateFormField = (index: number, key: string, value: string) => {
    const newFormData = [...formData];
    newFormData[index] = {key, value};
    updateFormData(newFormData);
  };

  const removeFormField = (index: number) => {
    const newFormData = formData.filter((_, i) => i !== index);
    updateFormData(newFormData);
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
    <div className="body-editor">
      <label>
        Tipo de body
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
        <option value="yaml">YAML</option>
        <option value="text">Texto</option>
        <option value="form-data">Form Data</option>
        <option value="urlencoded">x-www-form-urlencoded</option>
      </select>
      </label>
      {body.type === "json" && (
        <div>
          <label>
            {protocol === "graphql" ? "Query GraphQL" : "Contenido JSON"}
            <Editor
              value={body.value ?? ""}
              onValueChange={handleBodyChange}
              highlight={(code) => Prism.highlight(code, Prism.languages.json, 'json')}
              padding={15}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 14,
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                minHeight: '200px',
              }}
            />
          </label>
          {protocol !== "graphql" && (
            <button onClick={formatJson} className="button--secondary">
              {isJsonValid ? "Formatear JSON" : "JSON inválido"}
            </button>
          )}
        </div>
      )}
      {body.type === "yaml" && (
        <div>
          <label>
            Contenido YAML
            <Editor
              value={body.value ?? ""}
              onValueChange={handleBodyChange}
              highlight={(code) => Prism.highlight(code, Prism.languages.yaml, 'yaml')}
              padding={15}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 14,
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                minHeight: '200px',
              }}
            />
          </label>
        </div>
      )}
      {body.type === "text" && (
        <label>
          Contenido de texto
          <textarea
            rows={8}
            value={body.value ?? ""}
            onChange={(event) => handleBodyChange(event.target.value)}
            placeholder="Texto plano"
          />
        </label>
      )}
      {(body.type === "form-data" || body.type === "urlencoded") && (
        <div>
          <div className="form-fields">
            {formData.map((field, index) => (
              <div key={index} className="form-field">
                <input
                  placeholder="Clave"
                  value={field.key}
                  onChange={(e) => updateFormField(index, e.target.value, field.value)}
                />
                <input
                  placeholder="Valor"
                  value={field.value}
                  onChange={(e) => updateFormField(index, field.key, e.target.value)}
                />
                <button onClick={() => removeFormField(index)} className="button--danger">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addFormField} className="button--primary">Añadir campo</button>
        </div>
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
          Token
          <input
            value={auth.bearer_token ?? ""}
            placeholder="token o {{variable}}"
            onChange={(event) => updateAuth({ bearer_token: event.target.value || undefined })}
          />
        </label>
      )}
      {auth.type === "basic" && (
        <>
          <label>
            Usuario
            <input
              value={auth.basic_user ?? ""}
              placeholder="usuario o {{variable}}"
              onChange={(event) => updateAuth({ basic_user: event.target.value || undefined })}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={auth.basic_password ?? ""}
              placeholder="contraseña o {{variable}}"
              onChange={(event) => updateAuth({ basic_password: event.target.value || undefined })}
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
            Clave
            <input
              value={auth.api_key ?? ""}
              placeholder="clave o {{variable}}"
              onChange={(event) => updateAuth({ api_key: event.target.value || undefined })}
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
