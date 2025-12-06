import { useEffect } from "react";
import "./app.css";
import { CollectionsSidebar } from "@components/CollectionsSidebar";
import { RequestWorkspace } from "@components/editor/RequestWorkspace";
import { ResponseTabs } from "@components/response/ResponseTabs";
import { SecretManager } from "@components/modals/SecretManager";
import { SettingsPanel } from "@components/modals/SettingsPanel";
import { MasterPasswordModal } from "@components/modals/MasterPasswordModal";
import { CurlImportModal } from "@components/modals/CurlImportModal";
import { NewRequestModal } from "@components/modals/NewRequestModal";
import { NewFolderModal } from "@components/modals/NewFolderModal";
import { useAppStore, selectActiveRequest } from "@store/useAppStore";
import { applyTheme } from "@services/theme";

function App() {
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const settings = useAppStore((state) => state.settings);
  const environments = useAppStore((state) => state.environments);
  const activeEnvironment = useAppStore(
    (state) => state.activeEnvironment ?? state.settings.activeEnvironment ?? "",
  );
  const selectEnvironment = useAppStore((state) => state.selectEnvironment);
  const activeRequest = useAppStore(selectActiveRequest);
  const globalError = useAppStore((state) => state.error);

  const tauriAvailable =
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__ !== "undefined";

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    try {
      applyTheme(settings.theme ?? "");
    } catch {
      // ignore
    }
  }, [settings.theme]);

  return (
    <div className="app-shell">
      <CollectionsSidebar />
      <div className="workspace">
        {(!tauriAvailable || globalError) && (
          <div className="error-banner">
            {!tauriAvailable
              ? "Estás ejecutando sólo el servidor web (pnpm dev). Para la experiencia completa usa `pnpm tauri dev`."
              : globalError}
          </div>
        )}
        <div className="workspace__toolbar">
          <div>
            <strong>{settings.workspaceName}</strong>
            <div className="workspace__meta">
              {activeRequest?.doc.meta.collection} · {activeRequest?.doc.meta.name}
            </div>
          </div>
          <div className="workspace__controls">
            <label>
              Entorno
              <select
                value={activeEnvironment}
                onChange={(event) => void selectEnvironment(event.target.value)}
              >
                <option value="">Sin entorno</option>
                {environments.map((env) => (
                  <option key={env.name} value={env.name}>
                    {env.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button--ghost" onClick={loadWorkspace}>
              Recargar
            </button>
          </div>
        </div>
        <div className="workspace__panels">
          <RequestWorkspace />
          <ResponseTabs />
        </div>
      </div>
      <SecretManager />
      <SettingsPanel />
      <CurlImportModal />
      <MasterPasswordModal />
      <NewRequestModal />
      <NewFolderModal />
    </div>
  );
}

export default App;
