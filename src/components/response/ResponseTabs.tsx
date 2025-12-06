import { useEffect, useState } from "react";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import { buildCurlCommand } from "@services/curl";
import { runTests } from "@services/testRunner";
import { formatStructuredBody } from "@services/codeFormatter";
import Prism from "@services/prismConfig";

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
  const [copiedBody, setCopiedBody] = useState(false); 

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

  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleCopyCurl = () => {
    navigator.clipboard
      .writeText(curl)
      .then(() => {
        setCopiedCurl(true);
        setTimeout(() => setCopiedCurl(false), 1500);
      })
      .catch((err) => console.error("Error copiando cURL:", err));
  };

  const handleCopyBody = () => {
    const text =
      typeof response.body === "string"
        ? response.body
        : JSON.stringify(response.body, null, 2);

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedBody(true);
        setTimeout(() => setCopiedBody(false), 1500);
      })
      .catch((err) => {
        console.error("Error copiando respuesta:", err);
      });
  };

  return (
    <section className="panel panel--response response-panel">
      <div className="response-header">
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
      </div>
      <div className="response-content">
        {activeTab === "body" && (
          <div className="body-tab">
            <div className="body-panel-wrapper">
              <button
                type="button"
                className={`code-copy-btn ${copiedBody ? "is-copied" : ""}`}
                onClick={handleCopyBody}
                aria-label="Copiar cuerpo de la respuesta"
              >
                <span aria-hidden="true">
                  {copiedBody ? "✓" : "⧉"}
                </span>
              </button>

              <div className="body-scroll">
                <pre
                  dangerouslySetInnerHTML={{
                    __html: Prism.highlight(
                      bodySample.code,
                      Prism.languages.json,
                      "json"
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        )}


        {activeTab === "headers" && (
          <div className="headers-list">
            {Object.entries(response.headers).map(([key, value]) => (
              <div className="headers-row" key={key}>
                <span className="header-name">{key}</span>
                <span className="header-value">{value}</span>
              </div>
            ))}
          </div>
        )}
        
        {activeTab === "tests" && (
          <div className="tests-tab">
            <button onClick={handleRunTests}>Run Tests Again</button>

            <div className="tests-list">
              {testsResult.length === 0 && <p>No hay tests configurados.</p>}
              {testsResult.map((test) => (
                <div key={test.name} className="tests-list__item">
                  <span>{test.name}</span>
                  <span className={`test-result ${test.passed ? "ok" : "fail"}`}>
                    {test.passed ? "OK" : test.message ?? "Error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "curl" && (
          <div className="curl-panel-wrapper">
            <button
              type="button"
              className={`code-copy-btn ${copiedCurl ? "is-copied" : ""}`}
              onClick={handleCopyCurl}
              aria-label="Copiar cURL"
            >
              <span aria-hidden="true">
                {copiedCurl ? "✓" : "⧉"}
              </span>
            </button>

            <div className="curl-panel">
              <pre>{curl}</pre>
            </div>
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
