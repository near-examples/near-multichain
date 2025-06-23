/**
 * BITCOIN TRANSACTION COMPONENT
 * 
 * This component demonstrates how to use NEAR Protocol's Multi-Party Computation (MPC)
 * service to create and sign Bitcoin transactions. The MPC service allows a NEAR account
 * to control Bitcoin addresses without directly holding Bitcoin private keys.
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - Threshold cryptography via NEAR's MPC
 * - Cross-chain address derivation
 * - Bitcoin transaction creation and signing
 * - UTXO (Unspent Transaction Output) management
 * - Integration with Bitcoin testnet
 */

import { useState, useEffect } from "react";

import { useDebounce } from "../hooks/debounce";
import PropTypes from "prop-types";
import { SIGNET_CONTRACT, NetworkId } from "../config";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { chainAdapters } from "chainsig.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";

/**
 * BITCOIN RPC ADAPTER SETUP
 * 
 * We use the Mempool.space API as our Bitcoin RPC provider.
 * This gives us access to:
 * - UTXO information for transaction inputs
 * - Network fee estimates
 * - Transaction broadcasting capabilities
 */
const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(
  "https://mempool.space/testnet4/api"
)

/**
 * BITCOIN CHAIN ADAPTER INITIALIZATION
 * 
 * The Bitcoin chain adapter handles all Bitcoin-specific operations:
 * - Address derivation from NEAR accounts
 * - Transaction construction
 * - UTXO management
 * - Fee calculation
 */
const Bitcoin = new chainAdapters.btc.Bitcoin({
  network: NetworkId,           // Network configuration (testnet4 in this case)
  btcRpcAdapter,               // RPC provider for blockchain interactions
  contract: SIGNET_CONTRACT    // NEAR MPC contract for signing operations
})

export function BitcoinView({ props: { setStatus } }) {
  // NEAR Wallet Integration - provides account access and transaction signing
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  // COMPONENT STATE MANAGEMENT
  // Default receiver address is a valid Bitcoin testnet address
  const [receiver, setReceiver] = useState("tb1qzm5r6xhee7upsa9avdmpp32r6g5e87tsrwjahu");
  const [amount, setAmount] = useState(1000);              // Amount in satoshis (Bitcoin's smallest unit)
  const [loading, setLoading] = useState(false);           // Loading state for UI feedback
  const [step, setStep] = useState("request");             // Current step: "request" or "relay"
  const [signedTransaction, setSignedTransaction] = useState(null); // Holds the signed transaction
  const [senderAddress, setSenderAddress] = useState("");  // Derived Bitcoin address
  const [senderPK, setSenderPK] = useState("");           // Derived public key

  /**
   * DERIVATION PATH STATE
   * 
   * The derivation path determines which Bitcoin address to derive from the NEAR account.
   * Different paths create different addresses, allowing one NEAR account to control
   * multiple Bitcoin addresses. This uses the debounce hook to prevent excessive
   * API calls while the user is typing.
   */
  const [derivation, setDerivation] = useState("bitcoin-1");
  const derivationPath = useDebounce(derivation, 500);

  // Update UI immediately when user starts typing a new derivation path
  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  /**
   * ADDRESS DERIVATION AND BALANCE CHECKING
   * 
   * This effect runs whenever the signed account or derivation path changes.
   * It demonstrates the core MPC functionality:
   * 1. Derive a Bitcoin address from the NEAR account + derivation path
   * 2. Query the Bitcoin network for the address balance
   * 3. Display the results to the user
   */
  useEffect(() => {
    setBtcAddress();

    async function setBtcAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      /**
       * ADDRESS AND PUBLIC KEY DERIVATION
       * 
       * This is where the magic happens! The MPC service uses the combination of:
       * - Your NEAR account ID
       * - The derivation path you specify
       * 
       * To deterministically generate a Bitcoin address and public key.
       * The private key never exists in one place - it's distributed across
       * multiple nodes in the MPC network.
       */
      const { address, publicKey } = await Bitcoin.deriveAddressAndPublicKey(
        signedAccountId,
        derivationPath
      );
      setSenderAddress(address);
      setSenderPK(publicKey);

      /**
       * BALANCE CHECKING
       * 
       * Once we have the address, we can query the Bitcoin network
       * to see how much Bitcoin (in satoshis) is available to spend.
       */
      const balance = await Bitcoin.getBalance(address);

      // Convert balance from raw format to decimal for display
      const bitcoinBalance = bigIntToDecimal(balance.balance, balance.decimals);

      // Convert to satoshis (1 BTC = 100,000,000 satoshis)
      const satoshi = chainAdapters.btc.Bitcoin.toSatoshi(bitcoinBalance);

      setStatus(
        `Your Bitcoin address is: ${address}, balance: ${satoshi} satoshi`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  /**
   * TRANSACTION CREATION AND SIGNING PROCESS
   * 
   * This function demonstrates the complete flow of creating and signing
   * a Bitcoin transaction using NEAR's MPC service.
   */
  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    /**
     * STEP 1: PREPARE TRANSACTION FOR SIGNING
     * 
     * This step:
     * - Selects appropriate UTXOs (unspent transaction outputs) to fund the transaction
     * - Calculates fees based on current network conditions
     * - Creates the raw transaction structure
     * - Generates the hashes that need to be signed
     */
    const { transaction, hashesToSign } = await Bitcoin.prepareTransactionForSigning({
      publicKey: senderPK,        // Public key of the sender
      from: senderAddress,        // Bitcoin address sending the funds
      to: receiver,               // Bitcoin address receiving the funds
      value: amount.toString(),   // Amount in satoshis
    });

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );
    try {

      /**
       * STEP 2: MPC SIGNING PROCESS
       * 
       * This is the core of the multi-party computation process:
       * - The transaction hashes are sent to the MPC network
       * - Multiple nodes participate in generating the signature
       * - No single node ever has access to the complete private key
       * - The signature is returned in RSV format (r, s, v components)
       * 
       * The signing process can take 30-60 seconds as it involves
       * coordination between multiple nodes.
       */
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,     // The transaction hashes to sign
        path: derivationPath,       // Derivation path for the key
        keyType: "Ecdsa",          // Elliptic Curve Digital Signature Algorithm
        signerAccount: { 
          accountId: signedAccountId,
          signAndSendTransactions 
        }
      });

      // Verify we received valid signatures
      if (!rsvSignatures) {
        throw new Error("No signature received");
      }

      /**
       * STEP 3: FINALIZE TRANSACTION
       * 
       * Now that we have the signatures, we can:
       * - Attach the signatures to the transaction
       * - Create the final serialized transaction ready for broadcast
       */
      const tx = Bitcoin.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      });

      setStatus("✅ Signed payload ready to be relayed to the Bitcoin network");
      setSignedTransaction(tx);
      setStep("relay");
    } catch (e) {
      console.log(e);
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  /**
   * TRANSACTION BROADCASTING
   * 
   * Once we have a signed transaction, we can broadcast it to the Bitcoin network.
   * This function sends the transaction to Bitcoin nodes, which will:
   * - Validate the transaction
   * - Include it in the mempool
   * - Eventually include it in a block
   */
  async function relayTransaction() {
    setLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Bitcoin network... this might take a while"
    );

    try {

      /**
       * BROADCAST TO BITCOIN NETWORK
       * 
       * The broadcastTx function sends our signed transaction to Bitcoin nodes.
       * If successful, we get a transaction hash that can be used to track
       * the transaction on block explorers.
       */
      const txHash = await Bitcoin.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://mempool.space/es/testnet4/tx/${txHash.hash}`}
            target="_blank"
          >
            {" "}
            ✅ Successfully Broadcasted{" "}
          </a>
        </>
      );
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
    }

    // Reset to initial state for next transaction
    setStep("request");
    setLoading(false);
  }

  /**
   * UI HANDLER FOR STARTING THE SIGNING PROCESS
   * 
   * This wrapper handles the loading state while the signing process occurs.
   */
  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  };

  /**
   * COMPONENT RENDER
   * 
   * The UI provides:
   * - Information about the testnet environment
   * - Input fields for derivation path, receiver, and amount
   * - Buttons to initiate signing and broadcasting
   * - Real-time status updates throughout the process
   */
  return (
    <>
      {/* TESTNET INFORMATION AND FAUCET LINK */}
      <div className="alert alert-info text-center" role="alert">
        You are working with <strong>Testnet 4</strong>.
        <br />
        You can get funds from the faucet:
        <a
          href="https://mempool.space/testnet4/faucet"
          target="_blank"
          rel="noopener noreferrer"
          className="alert-link"
        >
          mempool.space/testnet4/mining
        </a>
      </div>

      {/* DERIVATION PATH INPUT */}
      <div className="row my-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">
          Path:
        </label>
        <div className="col-sm-10">
          <input
            type="text"
            className="form-control form-control-sm"
            value={derivation}
            onChange={(e) => setDerivation(e.target.value)}
            disabled={loading}
          />
          <div className="form-text" id="eth-sender">
            {" "}
            {senderAddress}{" "}
          </div>
        </div>
      </div>

      {/* RECEIVER ADDRESS INPUT */}
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
        <div className="col-sm-10">
          <input
            type="text"
            className="form-control form-control-sm"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* AMOUNT INPUT (IN SATOSHIS) */}
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">
          Amount:
        </label>
        <div className="col-sm-10">
          <input
            type="number"
            className="form-control form-control-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="1"
            disabled={loading}
          />
          <div className="form-text"> satoshi units </div>
        </div>
      </div>

      {/* ACTION BUTTONS - CONDITIONAL RENDERING BASED ON CURRENT STEP */}
      <div className="text-center mt-3">
        {step === "request" && (
          <button
            className="btn btn-primary text-center"
            onClick={UIChainSignature}
            disabled={loading}
          >
            {" "}
            Request Signature{" "}
          </button>
        )}
        {step === "relay" && (
          <button
            className="btn btn-success text-center"
            onClick={relayTransaction}
            disabled={loading}
          >
            {" "}
            Relay Transaction{" "}
          </button>
        )}
      </div>
    </>
  );
}

// PropTypes for development-time type checking
BitcoinView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
