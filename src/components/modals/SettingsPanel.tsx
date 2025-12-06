import { useState } from "react";
import { useAppStore } from "@store/useAppStore";
import { applyTheme, availableThemes, DEFAULT_THEME } from "@services/theme";

export function SettingsPanel() {
  const show = useAppStore((s) => s.showSettings);
  const close = useAppStore((s) => s.closeSettings);
  const settings = useAppStore((s) => s.settings);
  const persistSettings = useAppStore((s) => s.persistSettings);
  const workspacePath = useAppStore((s) => s.workspacePath);
  const setMasterPassword = useAppStore((s) => s.setMasterPassword);

  const [localSettings, setLocalSettings] = useState(settings);

  if (!show) return null;

  const handleSave = async () => {
    await persistSettings(localSettings);
    applyTheme(localSettings.theme ?? "");
    close();
  };

  return (
    <div className="modal">
      <div className="modal__content">
        <div className="modal__header">
          <h3>Ajustes</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        <div className="settings-grid">
          <label>
            Workspace
            <input value={workspacePath ?? ""} disabled />
          </label>
          <label>
            Timeout (ms)
            <input
              type="number"
              value={localSettings.timeoutMs ?? 30000}
              onChange={(event) =>
                setLocalSettings({
                  ...localSettings,
                  timeoutMs: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Ignorar SSL
            <input
              type="checkbox"
              checked={localSettings.ignoreSsl ?? false}
              onChange={(event) =>
                setLocalSettings({ ...localSettings, ignoreSsl: event.target.checked })
              }
            />
          </label>
          <label>
            Tema
            <select
              value={localSettings.theme ?? DEFAULT_THEME}
              onChange={(event) =>
                setLocalSettings({ ...localSettings, theme: event.target.value as any })
              }
            >
              {availableThemes().map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mostrar prompt contraseña maestra
            <input
              type="checkbox"
              checked={!localSettings.disableMasterPasswordPrompt}
              onChange={(event) =>
                setLocalSettings({ ...localSettings, disableMasterPasswordPrompt: !event.target.checked })
              }
            />
          </label>
          <label>
            Historial máx.
            <input
              type="number"
              value={localSettings.historyLimit ?? 15}
              onChange={(event) =>
                setLocalSettings({
                  ...localSettings,
                  historyLimit: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Debug logs
            <input
              type="checkbox"
              checked={localSettings.debugLogs ?? false}
              onChange={(event) =>
                setLocalSettings({ ...localSettings, debugLogs: event.target.checked })
              }
            />
          </label>
        </div>
        <div className="settings-actions">
          <button onClick={() => setMasterPassword("")}>Reset master password</button>
          <button className="button--primary" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
