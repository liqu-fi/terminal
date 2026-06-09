// MUST be first: tells the SDK the deploy env (staging vs prod) via setDeployEnv
// before any @liq/* getChainConfig call, so the browser doesn't default to prod
// and read the wallet's prod account. See the module's comment.
import "./deploy-env-init";

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
