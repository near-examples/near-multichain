import { useState, useMemo, useCallback } from "react";
import Select from "react-select";

import Navbar from "./components/Navbar";
import ChainIcon from "./components/ChainIcon";
import LoadingSpinner from "./components/LoadingSpinner";
import StatusMessage from "./components/StatusMessage";
import { EVMView } from "./components/EVM/EVM";
import { BitcoinView } from "./components/Bitcoin";
import { SolanaView } from "./components/Solana";
import { SuiView } from "./components/Sui";
import { AptosView } from "./components/Aptos";
import { XRPView } from "./components/XRP";
import { CHAIN_ICONS, MPC_CONTRACT, NetworksEVM } from "./config";
import { useWalletSelector } from "@near-wallet-selector/react-hook";

const otherChains = [
  { value: "BTC", label: "Bitcoin", component: BitcoinView },
  { value: "SOL", label: "Solana", component: SolanaView },
  { value: "SUI", label: "Sui", component: SuiView },
  { value: "APT", label: "Aptos", component: AptosView },
  { value: "XRP", label: "XRP", component: XRPView },
];

function App() {
  const { signedAccountId, isLoading: isWalletLoading } = useWalletSelector();
  const [status, setStatus] = useState("Please login to request a signature");
  const [selectedChain, setSelectedChain] = useState("ETH");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedNetwork = useMemo(
    () => NetworksEVM.find((network) => network.token === selectedChain),
    [selectedChain],
  );

  const handleSetStatus = useCallback((newStatus, isLoading = false) => {
    setStatus(newStatus);
    setIsProcessing(isLoading);
  }, []);

  const createChainOption = (value, label, altText = label) => ({
    value,
    label: (
      <div style={{ display: "flex", alignItems: "center" }}>
        <ChainIcon iconSlug={CHAIN_ICONS[value]} alt={altText} />
        {label}
      </div>
    ),
  });

  const chainOptions = [
    {
      label: "EVM Networks",
      options: NetworksEVM.map((network) =>
        createChainOption(network.token, network.network),
      ),
    },
    {
      label: "Other Blockchains",
      options: otherChains.map(({ value, label }) =>
        createChainOption(value, label),
      ),
    },
  ];

  const renderChainView = () => {
    const commonProps = { setStatus: handleSetStatus };

    if (selectedNetwork) {
      return (
        <EVMView
          key={selectedChain}
          props={{ ...commonProps, network: selectedNetwork }}
        />
      );
    }

    const chainConfig = otherChains.find(
      (chain) => chain.value === selectedChain,
    );
    if (chainConfig) {
      const ChainComponent = chainConfig.component;
      return <ChainComponent props={commonProps} />;
    }

    return null;
  };

  return (
    <>
      <Navbar />
      <div className="container text-light d-flex flex-column justify-content-center align-items-center vh-75">
        <div
          className="alert alert-light w-auto text-center shadow-sm border-0 mb-4"
          style={{ maxWidth: "600px" }}
        >
          <h5 className="mb-3">🚀 Multi-Chain Account Management</h5>
          <p className="mb-3">
            One account controlling endless number of accounts across chains.
          </p>
          <small className="text-muted">
            Powered by{" "}
            <a
              href="https://docs.near.org/concepts/abstraction/chain-signatures"
              className="text-decoration-none fw-bold"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-info">NEAR Chain Signatures</span>
            </a>
          </small>
        </div>

        {isWalletLoading && (
          <div className="card mb-4 w-auto">
            <div className="card-body text-center py-4">
              <LoadingSpinner />
              <div className="mt-3">Connecting wallet...</div>
            </div>
          </div>
        )}
        {signedAccountId && !isWalletLoading && (
          <div
            className="card mb-4 shadow"
            style={{ minWidth: "42rem", maxWidth: "600px" }}
          >
            <div className="card-header bg-primary text-white py-3">
              <h6 className="mb-0">
                <i className="bi bi-wallet2 me-2"></i>
                Connected as:{" "}
                <code className="text-light">{signedAccountId}</code>
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="input-group input-group-sm mb-4">
                <span className="input-group-text bg-secondary text-white">
                  <i className="bi bi-shield-check me-1"></i>
                  MPC Contract
                </span>
                <input
                  className="form-control text-center bg-light"
                  type="text"
                  value={MPC_CONTRACT}
                  disabled
                  title="Multi-Party Computation Contract ID"
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold text-muted mb-3">
                  <i className="bi bi-link-45deg me-1"></i>
                  Select Destination Chain
                </label>
                <Select
                  options={chainOptions}
                  value={chainOptions
                    .flatMap((group) => group.options)
                    .find((option) => option.value === selectedChain)}
                  onChange={(option) => setSelectedChain(option.value)}
                  isOptionDisabled={(option) => option.isDisabled}
                  placeholder="Choose a blockchain..."
                  isSearchable
                />
              </div>
              <div className="border-top pt-4">{renderChainView()}</div>
            </div>
          </div>
        )}
        <StatusMessage status={status} isLoading={isProcessing} />

        {signedAccountId && (
          <div className="mt-5 text-center">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Need help? Check the{" "}
              <a
                href="https://docs.near.org/concepts/abstraction/chain-signatures"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info text-decoration-none"
              >
                documentation
              </a>
            </small>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
