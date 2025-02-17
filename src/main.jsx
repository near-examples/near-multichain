import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@near-wallet-selector/modal-ui/styles.css';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet'
import { setupHereWallet } from '@near-wallet-selector/here-wallet'
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet'
import { setupBitteWallet } from '@near-wallet-selector/bitte-wallet'
import { WalletSelectorProvider } from '@near-wallet-selector/react-hook'
import { NetworkId } from './config.js';

const walletSelectorConfig = {
  network: { networkId: NetworkId, nodeUrl: 'https://rpc.testnet.pagoda.co' },
  modules: [setupMyNearWallet(), setupHereWallet(), setupMeteorWallet(), setupBitteWallet()]
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <WalletSelectorProvider config={walletSelectorConfig}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </WalletSelectorProvider>
)
