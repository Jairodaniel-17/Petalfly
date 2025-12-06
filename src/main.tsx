import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Titlebar } from "./components/Titlebar";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="app-frame">
      <Titlebar />
      <App />
    </div>
  </React.StrictMode>
);
