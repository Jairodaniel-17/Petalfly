import { useEffect, useMemo, useState } from "react";
import type { VariableDefinition } from "@/types/domain";
import { useAppStore, selectEncryptionEnabled } from "@store/useAppStore";

const SECRET_PLACEHOLDER = "••••••";
const STORED_SECRET_SENTINEL = "\u0007\u0007\u0007\u0007\u0007\u0007";

export function SecretManager() {
  const show = useAppStore((s) => s.showSecretManager);
  const close = useAppStore((s) => s.closeSecretManager);
  const environments = useAppStore((s) => s.environments);
  const activeEnvironment = useAppStore(
    (s) => s.activeEnvironment ?? s.settings.activeEnvironment ?? s.environments[0]?.name,
  );
  const revealSecret = useAppStore((s) => s.revealSecret);
  const setSecretValue = useAppStore((s) => s.setSecretValue);
  const saveEnvironmentSecrets = useAppStore((s) => s.saveEnvironmentSecrets);
  const duplicateEnvironment = useAppStore((s) => s.duplicateEnvironment);
  const createEnvironment = useAppStore((s) => s.createEnvironment);
  const updateEnvironmentVariables = useAppStore((s) => s.updateEnvironmentVariables);
  const encryptionEnabled = useAppStore(selectEncryptionEnabled);

  const [newSecretName, setNewSecretName] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [messages, setMessages] = useState<string>();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [selectedEnv, setSelectedEnv] = useState(activeEnvironment ?? environments[0]?.name ?? "");

  useEffect(() => {
    if (show) {
      setSelectedEnv(activeEnvironment ?? environments[0]?.name ?? "");
      setMessages(undefined);
    }
  }, [show, activeEnvironment, environments]);

  useEffect(() => {
    setVisibility({});
    setEditingValues({});
    setNewSecretName("");
    setNewSecretValue("");
    setMessages(undefined);
  }, [selectedEnv]);

  const env = useMemo(() => {
    if (!environments.length) {
      return { name: "", path: "", variables: [] };
    }
    return environments.find((entry) => entry.name === selectedEnv) ?? environments[0];
  }, [environments, selectedEnv]);

  const secrets = useMemo(
    () => (env?.variables ?? []).filter((variable) => variable.secret),
    [env],
  );

  useEffect(() => {
    if (!show || !env) {
      return;
    }
    if (!encryptionEnabled) {
      const initialValues: Record<string, string> = {};
      secrets.forEach((secret) => {
        initialValues[secret.name] = secret.value ?? "";
      });
      setEditingValues(initialValues);
    }
    setVisibility(
      secrets.reduce<Record<string, boolean>>((acc, secret) => {
        acc[secret.name] = !encryptionEnabled;
        return acc;
      }, {}),
    );
  }, [show, encryptionEnabled, env, secrets]);

  if (!show) return null;

  const ensureValueLoaded = async (variable: VariableDefinition) => {
    if (editingValues[variable.name] !== undefined) {
      return editingValues[variable.name];
    }
    try {
      const value = await revealSecret(env.name, variable);
      setEditingValues((prev) => ({ ...prev, [variable.name]: value }));
      return value;
    } catch (error) {
      setMessages((error as Error).message);
      throw error;
    }
  };

  const handleToggleVisible = async (variable: VariableDefinition) => {
    if (!visibility[variable.name]) {
      try {
        await ensureValueLoaded(variable);
      } catch {
        return;
      }
    }
    setVisibility((prev) => ({
      ...prev,
      [variable.name]: !prev[variable.name],
    }));
  };

  const handleValueChange = (variable: VariableDefinition, value: string) => {
    setEditingValues((prev) => ({ ...prev, [variable.name]: value }));
    setSecretValue(env.name, variable.name, value);
  };

  const handleAddSecret = () => {
    if (!newSecretName.trim()) return;
    const sanitizedName = newSecretName.trim();
    const storedValue = encryptionEnabled ? STORED_SECRET_SENTINEL : newSecretValue;
    const updated = [
      ...env.variables,
      { name: sanitizedName, value: storedValue, secret: true },
    ];
    updateEnvironmentVariables(env.name, updated);
    setSecretValue(env.name, sanitizedName, newSecretValue);
    setEditingValues((prev) => ({ ...prev, [sanitizedName]: newSecretValue }));
    setNewSecretName("");
    setNewSecretValue("");
  };

  const handleEncrypt = async () => {
    try {
      await saveEnvironmentSecrets(env.name);
      setMessages(encryptionEnabled ? "Secrets guardados y cifrados" : "Secrets guardados");
    } catch (error) {
      setMessages((error as Error).message);
    }
  };

  const handleDelete = (variable: VariableDefinition) => {
    const updated = env.variables.filter((entry) => entry.name !== variable.name);
    updateEnvironmentVariables(env.name, updated);
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[variable.name];
      return next;
    });
    setVisibility((prev) => {
      const next = { ...prev };
      delete next[variable.name];
      return next;
    });
  };

  const handleClear = (variable: VariableDefinition) => {
    setEditingValues((prev) => ({ ...prev, [variable.name]: "" }));
    setSecretValue(env.name, variable.name, "");
  };

  const handleCreate = async () => {
    const name = window.prompt("Nombre del nuevo entorno");
    if (!name) return;
    try {
      await createEnvironment(name);
      setMessages(`Entorno ${name} creado`);
      setSelectedEnv(name.trim());
    } catch (error) {
      setMessages((error as Error).message);
    }
  };

  const handleDuplicate = async () => {
    const name = window.prompt("Nombre del nuevo entorno");
    if (!name) return;
    try {
      await duplicateEnvironment(env.name, name);
      setMessages(`Entorno ${name} duplicado`);
      setSelectedEnv(name.trim());
    } catch (error) {
      setMessages((error as Error).message);
    }
  };

  if (!env || env.name === "") {
    return (
      <div className="modal">
        <div className="modal__content">
          <div className="modal__header">
            <h3>Secret Manager</h3>
            <button onClick={close}>Cerrar</button>
          </div>
          <p>No hay entornos disponibles.</p>
          <button onClick={handleCreate}>Crear entorno</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal__content">
        <div className="modal__header">
          <h3>Secret Manager · {env.name}</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        <div className="secret-toolbar">
          <label>
            Entorno
            <select value={env.name} onChange={(event) => setSelectedEnv(event.target.value)}>
              {environments.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button--ghost" onClick={handleDuplicate}>
            Duplicar entorno
          </button>
        </div>
        {messages && <div className="modal__message">{messages}</div>}
        <div className="secret-list">
          {secrets.length === 0 && <p>No hay secrets en este entorno.</p>}
          {secrets.map((secret) => {
            const visible = Boolean(visibility[secret.name]);
            return (
              <div className="secret-row" key={secret.name}>
                <div className="secret-row__info">
                  <strong>{secret.name}</strong>
                  <div className="secret-row__value">
                    <input
                      type={visible ? "text" : "password"}
                      value={editingValues[secret.name] ?? ""}
                      placeholder={SECRET_PLACEHOLDER}
                      disabled={encryptionEnabled && !visible}
                      onChange={(event) => handleValueChange(secret, event.target.value)}
                    />
                  </div>
                </div>
                <div className="secret-row__actions">
                  <button
                    className="icon-button"
                    title={visible ? "Ocultar valor" : "Mostrar valor"}
                    onClick={() => handleToggleVisible(secret)}
                  >
                    {visible ? "🙈" : "👁"}
                  </button>
                  <button
                    className="icon-button"
                    title="Vaciar valor"
                    onClick={() => handleClear(secret)}
                  >
                    🧹
                  </button>
                  <button
                    className="icon-button"
                    title="Eliminar secret"
                    onClick={() => handleDelete(secret)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="secret-form">
          <input
            placeholder="Nombre del secret"
            value={newSecretName}
            onChange={(event) => setNewSecretName(event.target.value)}
          />
          <input
            placeholder="Valor"
            value={newSecretValue}
            onChange={(event) => setNewSecretValue(event.target.value)}
          />
          <button onClick={handleAddSecret}>Añadir secret</button>
        </div>
        <div className="modal__footer">
          <button onClick={handleEncrypt}>{encryptionEnabled ? "Encrypt & Save" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
