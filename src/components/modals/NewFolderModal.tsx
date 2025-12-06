import { useState } from "react";
import { useAppStore } from "@store/useAppStore";

export function NewFolderModal() {
  const show = useAppStore((s) => s.showNewFolder);
  const close = useAppStore((s) => s.closeNewFolder);
  const createFolder = useAppStore((s) => s.createCollectionFolder);
  const [name, setName] = useState("");

  if (!show) return null;

  const handleCreate = async () => {
    const trimmed = name.trim().replace(/^\/+/, "");
    if (!trimmed) return alert("Ingresa un nombre");
    const target = trimmed.startsWith("collections/") ? trimmed : `collections/${trimmed}`;
    try {
      await createFolder(target);
      close();
      setName("");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="modal">
      <div className="modal__content">
        <div className="modal__header">
          <h3>Nueva Carpeta</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        <div className="modal__body">
          <label>
            Nombre o ruta
            <span className="form-hint">Puedes usar subcarpetas como api/internas</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-carpeta" />
          </label>
        </div>
        <div className="modal__footer">
          <button className="button--primary" onClick={handleCreate}>Crear</button>
        </div>
      </div>
    </div>
  );
}
