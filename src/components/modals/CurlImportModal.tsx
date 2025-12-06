import { useState } from "react";
import { useAppStore } from "@store/useAppStore";
import { importCurl } from "@services/curl";

export function CurlImportModal() {
  const show = useAppStore((state) => state.showCurlImport);
  const close = useAppStore((state) => state.closeCurlImport);
  const importDocument = useAppStore((state) => state.importCurlDocument);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string>();

  if (!show) return null;

  const handleImport = async () => {
    try {
      const doc = importCurl(raw);
      await importDocument(doc);
      close();
      setRaw("");
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="modal">
      <div className="modal__content">
        <div className="modal__header">
          <h3>Importar cURL</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        {error && <div className="modal__message">{error}</div>}
        <textarea
          rows={10}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder='curl -X GET "https://api.dev/..."'
        />
        <div className="modal__footer">
          <button className="button--primary" onClick={handleImport}>
            Importar
          </button>
        </div>
      </div>
    </div>
  );
}
