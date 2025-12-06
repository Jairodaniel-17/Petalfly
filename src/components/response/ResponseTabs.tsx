import { useEffect, useState } from "react";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import { buildCurlCommand } from "@services/curl";
import { runTests } from "@services/testRunner";
import { formatStructuredBody } from "@services/codeFormatter";

const EMPTY_HISTORY: any[] = [];

const RESPONSE_TABS = ["body", "headers", "tests", "curl", "history"] as const;

export function ResponseTabs() {
  const response = useAppStore((s) => s.response);
  const error = useAppStore((s) => s.error);
  const lastPayload = useAppStore((s) => s.lastPayload);
  const updateDocument = useAppStore((s) => s.updateDocument);
  const activeRequest = useAppStore(selectActiveRequest);
  const history = useAppStore((s) => {
    const active = selectActiveRequest(s);
    const historyKey = active ? active.doc.meta.id || active.path.replace(/\\/g, "/") : "";
    return s.history[historyKey] ?? EMPTY_HISTORY;
  });

  const [activeTab, setActiveTab] = useState<(typeof RESPONSE_TABS)[number]>("body");
  const [testsResult, setTestsResult] = useState(response?.tests ?? []);

  useEffect(() => {
    setTestsResult(response?.tests ?? []);
  }, [response]);

  if (error) {
    return (
      <section className="panel">
        <h2>Respuesta</h2>
        <div className="warnings">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!response) {
    return (
      <section className="panel">
        <h2>Respuesta</h2>
        <p>Envía un request para ver los resultados.</p>
      </section>
    );
  }

  const bodySample = formatStructuredBody(response.body);
  const curl = buildCurlCommand(lastPayload);

  const handleRunTests = () => {
    if (!activeRequest?.doc.tests) return;
    const fresh = runTests(activeRequest.doc.tests, response);
    setTestsResult(fresh);
  };

  const requestId = activeRequest
    ? activeRequest.doc.meta.id || activeRequest.path.replace(/\\/g, "/")
    : "";

  const handleRestore = (entry: any) => {
    if (!activeRequest || !entry?.resolvedRequest) return;
    const resolved = entry.resolvedRequest;
    updateDocument({
      ...activeRequest.doc,
      request: {
        ...activeRequest.doc.request,
        method: resolved.method ?? activeRequest.doc.request.method,
        url: resolved.url ?? activeRequest.doc.request.url,
        headers: resolved.headers ?? activeRequest.doc.request.headers,
        body: resolved.body ?? activeRequest.doc.request.body,
      },
    });
  };

  return (
    <section className="panel panel--response">
      <h2>Respuesta</h2>
      <div className="response-meta">
        <span>Status: {response.status} {response.statusText}</span>
        <span>Tiempo: {response.durationMs ?? 0} ms</span>
        <span>Tamaño: {response.sizeBytes ?? 0} B</span>
      </div>
      <div className="editor-tabs">
        {RESPONSE_TABS.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="editor-tab__body">
        {activeTab === "body" && (
          <div className="response-body">
            <pre>{bodySample.code}</pre>
          </div>
        )}
        {activeTab === "headers" && (
          <div className="grid-table">
            {Object.entries(response.headers).map(([key, value]) => (
              <div className="grid-table__row" key={key}>
                <strong>{key}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === "tests" && (
          <div>
            <button onClick={handleRunTests}>Run Tests Again</button>
            <div className="tests-list">
              {testsResult.length === 0 && <p>No hay tests configurados.</p>}
              {testsResult.map((test) => (
                <div key={test.name} className="tests-list__item">
                  <span>{test.name}</span>
                  <span style={{ color: test.passed ? "#34d399" : "#f87171" }}>
                    {test.passed ? "OK" : test.message ?? "Error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "curl" && (
          <div className="curl-panel">
            <pre>{curl}</pre>
            <button onClick={() => navigator.clipboard.writeText(curl)}>Copy</button>
          </div>
        )}
        {activeTab === "history" && (
          <div className="history-panel">
            <h3>Historial ({requestId})</h3>
            {history.length === 0 && <p>Sin ejecuciones previas.</p>}
            {history.map((entry) => (
              <div className="history-entry" key={entry.timestamp}>
                <div>
                  <strong>{entry.status ?? "..."} </strong>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span>{entry.method} {entry.url}</span>
                  <span>{entry.durationMs ?? 0} ms</span>
                </div>
                <div className="history-entry__actions">
                  <button onClick={() => handleRestore(entry)}>Restore</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
