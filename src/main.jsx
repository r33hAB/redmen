import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ProtectedApp from "./ProtectedApp.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <ProtectedApp>
    <App />
  </ProtectedApp>
);
