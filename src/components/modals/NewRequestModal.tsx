import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@store/useAppStore";

export function NewRequestModal() {
  const show = useAppStore((s) => s.showNewRequest);
  const close = useAppStore((s) => s.closeNewRequest);
  const createNewRequest = useAppStore((s) => s.createNewRequest);
  const folders = useAppStore((s) => s.folders);
  const openNewFolder = useAppStore((s) => s.openNewFolder);
  const defaults = useAppStore((s) => s.newRequestDefaults);

  const [collection, setCollection] = useState("Personal");
  const [filename, setFilename] = useState("new-request");
  const [id, setId] = useState("nuevo-request");
  const [name, setName] = useState("Nuevo Request");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("http://localhost:3000");

  useEffect(() => {
    if (!show) return;
    setCollection(defaults?.collection ?? "Personal");
    setFilename("new-request");
    setId("nuevo-request");
    setName("Nuevo Request");
    setMethod("GET");
    setUrl("http://localhost:3000");
  }, [show, defaults?.collection]);

  const collectionOptions = useMemo(() => {
    const names = new Set<string>(["Personal"]);
    folders.forEach((folder) => {
      const normalized = normalizeCollectionName(folder.path);
      if (normalized) {
        names.add(normalized);
      }
    });
    if (collection && !names.has(collection)) {
      names.add(collection);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [folders, collection]);

  if (!show) return null;

  const handleCollectionChange = (value: string) => {
    if (value === "__new_collection__") {
      openNewFolder();
      return;
    }
    setCollection(value);
  };

  const handleCreate = async () => {
    const normalizedCollection = (collection || "Personal").trim().replace(/^\/+/, "") || "Personal";
    const normalizedFilename = (filename || "new-request").trim() || "new-request";
    const normalizedId = id.trim() || normalizedFilename;
    const normalizedName = name.trim() || "Nuevo Request";
    const normalizedMethod = method || "GET";
    const normalizedUrl = url || "";
    const path = `collections/${normalizedCollection}/${normalizedFilename}.pfs`;
    const template = [
      "petalfly 1.0",
      "meta:",
      `  id: ${normalizedId}`,
      `  name: ${normalizedName}`,
      `  collection: ${normalizedCollection}`,
      "  tags: []",
      "request:",
      `  method: ${normalizedMethod}`,
      `  url: ${normalizedUrl}`,
      'docs: """',
      "Describe este request",
      '"""',
    ].join("\n");
    try {
      await createNewRequest(path, template);
      close();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="modal">
      <div className="modal__content">
        <div className="modal__header">
          <h3>Nuevo Request</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        <div className="modal__body">
          <label>
            Carpeta / Colección
            <select value={collection} onChange={(event) => void handleCollectionChange(event.target.value)}>
              {collectionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="__new_collection__">+ Nueva colección…</option>
            </select>
            <span className="form-hint">Selecciona una colección o crea una nueva carpeta.</span>
          </label>
          <label>
            Nombre archivo
            <input value={filename} onChange={(e) => setFilename(e.target.value)} />
          </label>
          <label>
            ID
            <input value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Metodo
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </label>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
        </div>
        <div className="modal__footer">
          <button className="button--primary" onClick={handleCreate}>
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeCollectionName(value: string) {
  return value
    .replace(/^collections[\\/]/i, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}
