import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode disabled: double-running effects races with Firebase auth restoration on full page reload.
createRoot(document.getElementById("root")!).render(<App />);
