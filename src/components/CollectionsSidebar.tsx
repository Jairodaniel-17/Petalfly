import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { CurrentRequest, WorkspaceFolder } from "@/types/domain";
import { useAppStore } from "@store/useAppStore";

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: "folder" | "request";
  children?: TreeNode[];
  method?: string;
}

const methodColors: Record<string, string> = {
  GET: "#34d399",
  POST: "#60a5fa",
  PUT: "#f97316",
  PATCH: "#facc15",
  DELETE: "#f87171",
};

export function CollectionsSidebar() {
  const requests = useAppStore((state) => state.requests);
  const folders = useAppStore((state) => state.folders);
  const activePath = useAppStore((state) => state.activeRequestPath);
  const setActiveRequest = useAppStore((state) => state.setActiveRequest);
  const createFolder = useAppStore((state) => state.createCollectionFolder);
  const duplicateRequest = useAppStore((state) => state.duplicateRequest);
  const deleteEntry = useAppStore((state) => state.deleteEntry);
  const renameEntry = useAppStore((state) => state.renameEntry);
  const openSecretManager = useAppStore((state) => state.openSecretManager);
  const openSettings = useAppStore((state) => state.openSettings);
  const openCurlImport = useAppStore((state) => state.openCurlImport);
  const openNewRequest = useAppStore((state) => state.openNewRequest);
  const openNewFolder = useAppStore((state) => state.openNewFolder);

  const [filter, setFilter] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    window.addEventListener("click", hideMenu);
    return () => window.removeEventListener("click", hideMenu);
  }, []);

  const tree = useMemo(
    () => buildTree(requests, folders, filter),
    [requests, folders, filter],
  );

  const handleDuplicate = async (path: string) => {
    const target = window.prompt("Nueva ruta para el duplicado", path.replace(".pfs", "-copy.pfs"));
    if (!target) return;
    await duplicateRequest(path, target);
  };

  const handleDelete = async (path: string) => {
    if (!window.confirm(`¿Eliminar ${path}?`)) return;
    await deleteEntry(path);
  };

  const handleRename = async (path: string) => {
    const target = window.prompt("Nuevo nombre", path);
    if (!target || target === path) return;
    await renameEntry(path, target);
  };

  const handleContextMenu = (event: MouseEvent, node: TreeNode) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };

  const handleNewRequestInFolder = (folderPath: string) => {
    const relative = normalizePath(folderPath) || "Personal";
    openNewRequest({ collection: relative });
    setContextMenu(null);
  };

  const handleCreateFolderInFolder = async (folderPath: string) => {
    const name = window.prompt("Nombre de la nueva carpeta");
    if (!name) return;
    const trimmed = name.trim().replace(/^\/+/, "");
    if (!trimmed) return;
    await createFolder(`${folderPath}/${trimmed}`);
    setContextMenu(null);
  };

  const handleRenameFolder = async (folderPath: string) => {
    const normalized = folderPath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    const currentName = segments.pop() ?? "";
    const parent = segments.join("/");
    const next = window.prompt("Nuevo nombre de carpeta", currentName);
    if (!next || next === currentName) return;
    const target = parent ? `${parent}/${next}` : `collections/${next}`;
    await renameEntry(folderPath, target);
    setContextMenu(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="logo">
          <span className="logo__icon">🌸</span>
          <strong>Petalfly</strong>
        </div>
        <input
          type="search"
          className="sidebar__search"
          placeholder="Filtrar requests"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="sidebar__actions">
          <button onClick={() => openNewRequest()}>Nuevo Request</button>
          <button onClick={openNewFolder}>Nueva Carpeta</button>
          <button onClick={openCurlImport}>Importar cURL</button>
          <button onClick={openSecretManager}>Administrador de variables</button>
          <button onClick={openSettings}>Ajustes</button>
        </div>
      </div>
      <div className="sidebar__list">
        {tree.map((node) => (
          <TreeNodeView
            key={node.id}
            node={node}
            activePath={activePath}
            onSelect={setActiveRequest}
            onContextMenu={handleContextMenu}
            collapsed={collapsedFolders}
            onToggleFolder={(path) =>
              setCollapsedFolders((prev) => ({ ...prev, [path]: !prev[path] }))
            }
          />
        ))}
      </div>
      {contextMenu ? (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.node.type === "folder" ? (
            <>
              <button onClick={() => handleNewRequestInFolder(contextMenu.node.path)}>
                Nueva request
              </button>
              <button onClick={() => handleCreateFolderInFolder(contextMenu.node.path)}>
                Nueva carpeta
              </button>
              <button onClick={() => handleRenameFolder(contextMenu.node.path)}>
                Renombrar carpeta
              </button>
              <button
                onClick={async () => {
                  await handleDelete(contextMenu.node.path);
                  setContextMenu(null);
                }}
              >
                Eliminar carpeta
              </button>
            </>
          ) : (
            <>
              <button
                onClick={async () => {
                  await handleDuplicate(contextMenu.node.path);
                  setContextMenu(null);
                }}
              >
                Duplicar
              </button>
              <button
                onClick={async () => {
                  await handleRename(contextMenu.node.path);
                  setContextMenu(null);
                }}
              >
                Renombrar
              </button>
              <button
                onClick={async () => {
                  await handleDelete(contextMenu.node.path);
                  setContextMenu(null);
                }}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function TreeNodeView({
  node,
  activePath,
  onSelect,
  onContextMenu,
  collapsed,
  onToggleFolder,
}: {
  node: TreeNode;
  activePath?: string;
  onSelect: (path: string) => Promise<void>;
  onContextMenu: (event: MouseEvent, node: TreeNode) => void;
  collapsed: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
}) {
  if (node.type === "folder") {
    const isCollapsed = collapsed[node.path];
    return (
      <div className="tree-node">
        <div
          className="tree-node__label"
          onContextMenu={(event) => onContextMenu(event, node)}
          onClick={() => onToggleFolder(node.path)}
        >
          <span>
            {isCollapsed ? "▸" : "▾"} {node.name}
          </span>
        </div>
        {!isCollapsed && (
          <div className="tree-node__children">
            {node.children?.map((child) => (
              <TreeNodeView
                key={child.id}
                node={child}
                activePath={activePath}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                collapsed={collapsed}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  const isActive = node.path === activePath;
  return (
    <div
      className={`tree-node tree-node--request ${isActive ? "is-active" : ""}`}
      onClick={() => onSelect(node.path)}
      onContextMenu={(event) => onContextMenu(event, node)}
    >
      <span className="tree-node__method" style={{ color: methodColors[node.method ?? ""] }}>
        {node.method}
      </span>
      <span>{node.name}</span>
    </div>
  );
}

function buildTree(
  requests: CurrentRequest[],
  folders: WorkspaceFolder[],
  filter: string,
): TreeNode[] {
  const normalizedFilter = filter.trim().toLowerCase();
  const root: TreeNode = {
    id: "collections",
    name: "collections",
    path: "collections",
    type: "folder",
    children: [],
  };

  const ensureFolder = (segments: string[]) => {
    let cursor = root;
    segments.forEach((segment) => {
      if (!segment) return;
      if (!cursor.children) cursor.children = [];
      let child = cursor.children.find(
        (entry) => entry.type === "folder" && entry.name === segment,
      );
      if (!child) {
        const path = `${cursor.path}/${segment}`;
        child = {
          id: path,
          name: segment,
          path,
          type: "folder",
          children: [],
        };
        cursor.children.push(child);
      }
      cursor = child;
    });
    return cursor;
  };

  folders.forEach((folder) => {
    const relative = normalizePath(folder.path);
    if (!relative) return;
    ensureFolder(relative.split("/"));
  });

  requests.forEach((request) => {
    const relative = normalizePath(request.path);
    if (!relative) return;
    const segments = relative.split("/");
    const fileName = segments.pop();
    if (!fileName) return;
    const parent = ensureFolder(segments);
    if (!parent.children) parent.children = [];
    const name = fileName.replace(/\.pfs$/i, "");
    parent.children.push({
      id: request.path,
      name,
      path: request.path,
      type: "request",
      method: request.doc.request.method,
    });
  });

  const sorted = sortNodes(root.children ?? []);
  if (!normalizedFilter) {
    return sorted;
  }
  return filterNodes(sorted, normalizedFilter);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((node) =>
      node.type === "folder"
        ? { ...node, children: node.children ? sortNodes(node.children) : [] }
        : node,
    )
    .sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "folder" ? -1 : 1;
    });
}

function filterNodes(nodes: TreeNode[], filter: string): TreeNode[] {
  return nodes
    .map((node) => {
      if (node.type === "folder") {
        const children = node.children ? filterNodes(node.children, filter) : [];
        if (children.length || node.name.toLowerCase().includes(filter)) {
          return { ...node, children };
        }
        return null;
      }
      return node.name.toLowerCase().includes(filter) ? node : null;
    })
    .filter(Boolean) as TreeNode[];
}

function normalizePath(path: string) {
  return path.replace(/^collections[\\/]/i, "").replace(/\\/g, "/").replace(/^\/+/, "");
}
