import { useEffect, useState, useMemo } from "react";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import { buildCurlCommand } from "@services/curl";
import { runTests } from "@services/testRunner";
import { formatStructuredBody } from "@services/codeFormatter";
import Prism from "@services/prismConfig";
import * as curlconverter from "curlconverter";

const EMPTY_HISTORY: any[] = [];

const RESPONSE_TABS = ["body", "headers", "tests", "curl", "code", "history"] as const;

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
  const [selectedLang, setSelectedLang] = useState("python");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const curl = buildCurlCommand(lastPayload);

    const convertedData = useMemo(() => {
      if (!curl || (!curl.includes("http://") && !curl.includes("https://"))) {
        const msg = "No URL in request";
        return { code: msg, highlighted: msg, language: selectedLang };
      }

      try {
        const converters: Record<string, (curl: string) => string> = {
          python: curlconverter.toPython,
          javascript: curlconverter.toJavaScript,
          php: curlconverter.toPhp,
          ruby: curlconverter.toRuby,
          go: curlconverter.toGo,
          java: curlconverter.toJava,
          csharp: curlconverter.toCSharp,
          swift: curlconverter.toSwift,
          kotlin: curlconverter.toKotlin,
          rust: curlconverter.toRust,
        };

        const converter = converters[selectedLang];
        const code = converter ? converter(curl) : curl;

        // 👇 mapear lenguaje seleccionado a lenguaje de Prism
        const prismLangMap: Record<string, string> = {
          python: "python",
          javascript: "javascript",
          php: "php",
          ruby: "ruby",
          go: "go",
          java: "java",
          csharp: "csharp",
          swift: "swift",
          kotlin: "kotlin",
          rust: "rust",
        };

        const prismKey = prismLangMap[selectedLang] ?? "clike";
        const prismLanguage = Prism.languages[prismKey] ?? Prism.languages.clike;

        const highlighted = Prism.highlight(code, prismLanguage, prismKey);

        return {
          code,
          highlighted,
          language: selectedLang,
        };
      } catch (error) {
        const errorMsg = `Error converting to ${selectedLang}: ${error}`;
        return {
          code: errorMsg,
          highlighted: errorMsg,
          language: selectedLang,
        };
      }
    }, [selectedLang, curl]);

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

   const handleCopyCurl = () => {
     navigator.clipboard
       .writeText(curl)
       .then(() => {
         setCopiedCurl(true);
         setTimeout(() => setCopiedCurl(false), 1500);
       })
       .catch((err) => console.error("Error copiando cURL:", err));
   };

    const handleCopyCode = () => {
      navigator.clipboard
        .writeText(convertedData.code)
        .then(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 1500);
        })
        .catch((err) => console.error("Error copiando código:", err));
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

        {activeTab === "code" && (
          <div className="code-panel-wrapper">
            <div className="code-controls">
              <label
                htmlFor="code-lang-select"
                className="code-lang-label"
              >
                Lenguaje:
              </label>

              <select
                id="code-lang-select"
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="code-lang-select"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="php">PHP</option>
                <option value="ruby">Ruby</option>
                <option value="go">Go</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="swift">Swift</option>
                <option value="kotlin">Kotlin</option>
                <option value="rust">Rust</option>
              </select>

              <button
                type="button"
                className={`code-copy-btn code-copy-btn--inline ${
                  copiedCode ? "is-copied" : ""
                }`}
                onClick={handleCopyCode}
                aria-label="Copiar código"
              >
                <span aria-hidden="true">
                  {copiedCode ? "✓" : "⧉"}
                </span>
              </button>
            </div>

            <div className="code-panel">
              <pre
                dangerouslySetInnerHTML={{
                  __html: convertedData.highlighted,
                }}
              />
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
