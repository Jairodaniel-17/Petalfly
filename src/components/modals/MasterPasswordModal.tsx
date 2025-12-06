import { useState } from "react";
import { useAppStore, selectEncryptionEnabled } from "@store/useAppStore";

export function MasterPasswordModal() {
  const setMasterPassword = useAppStore((state) => state.setMasterPassword);
  const shouldShowModal = useAppStore(
    (state) =>
      !state.masterPassword &&
      Object.keys(state.secretCache).length > 0 &&
      selectEncryptionEnabled(state),
  );

  const [value, setValue] = useState("");

  if (!shouldShowModal) return null;

  const handleSubmit = () => {
    if (!value) return;
    setMasterPassword(value);
    setValue("");
  };

  return (
    <div className="modal modal--blocking">
      <div className="modal__content">
        <h3>Master Password</h3>
        <p>Introduce tu contraseña maestra para descifrar secrets.</p>
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="button--primary" onClick={handleSubmit}>
          Guardar
        </button>
      </div>
    </div>
  );
}
