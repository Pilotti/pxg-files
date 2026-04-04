import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initializeAppPreferences } from "./services/app-preferences.js";
import "./styles/global.css";

initializeAppPreferences();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
