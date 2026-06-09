// MUST be first: bridges VITE_DEPLOY_ENV → globalThis.process.env.DEPLOY_ENV so
// the SDK resolves the right contract deploy (staging vs prod) in the browser,
// before any @liq/* import reads it at module load. See the module's comment.
import "./deploy-env-shim";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { AppProviders } from "./providers/AppProviders";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
