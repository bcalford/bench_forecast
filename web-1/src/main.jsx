import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/public-sans/wght-italic.css";
import "@fontsource-variable/source-serif-4";
import App from "./App.jsx";
import "./base.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
