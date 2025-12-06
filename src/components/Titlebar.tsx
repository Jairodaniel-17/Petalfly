import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

export const Titlebar: React.FC = () => {
  const handleMinimize = async (e: React.MouseEvent) => {
    e.preventDefault();
    await win.minimize();
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    await win.toggleMaximize();
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.preventDefault();
    await win.close();
  };

  return (
    <header className="titlebar" onDoubleClick={handleMaximize}>
      <div className="titlebar__left">
        <span className="titlebar__logo">◆</span>
        <span className="titlebar__title">Petalfly</span>
      </div>

      <div className="titlebar__buttons">
        <button
          type="button"
          className="titlebar__btn"
          onClick={handleMinimize}
        >
          &#x2212; {/* – */}
        </button>
        <button
          type="button"
          className="titlebar__btn"
          onClick={handleMaximize}
        >
          &#x25A1; {/* □ */}
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          onClick={handleClose}
        >
          &#x2715; {/* ✕ */}
        </button>
      </div>
    </header>
  );
};
