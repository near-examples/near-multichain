// index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@near-wallet-selector/modal-ui/styles.css";

import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupBitteWallet } from "@near-wallet-selector/bitte-wallet";
import { WalletSelectorProvider } from "@near-wallet-selector/react-hook";
import type { WalletModuleFactory } from "@near-wallet-selector/core";

import { NetworkId } from "./config";

// Wallet selector config with proper typing
const walletSelectorConfig = {
  network: NetworkId,
  modules: [
    setupMyNearWallet(),
    setupHereWallet(),
    setupMeteorWallet(),
    setupBitteWallet(),
  ] as WalletModuleFactory[],
};

// Render the app
const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <WalletSelectorProvider config={walletSelectorConfig}>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </WalletSelectorProvider>
  );
}
