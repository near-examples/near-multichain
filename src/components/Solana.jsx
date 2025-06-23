/**
 * SOLANA TRANSACTION COMPONENT
 * 
 * This component demonstrates how to use NEAR Protocol's Multi-Party Computation (MPC)
 * service to create and sign Solana transactions. Unlike Bitcoin's UTXO model,
 * Solana uses an account-based system similar to Ethereum.
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - NEAR MPC integration with Solana blockchain
 * - EdDSA signature scheme (different from Bitcoin's ECDSA)
 * - Account-based transaction model
 * - Solana's devnet integration
 * - Real-time balance checking and transaction broadcasting
 * 
 * DIFFERENCES FROM BITCOIN:
 * - Uses EdDSA signatures instead of ECDSA
 * - Account-based model instead of UTXO
 * - Faster confirmation times
 * - Different address format (base58 encoded)
 */

import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { Connection as SolanaConnection } from '@solana/web3.js'
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";

/**
 * SOLANA RPC CONNECTION SETUP
 * 
 * We connect to Solana's devnet (development network) for testing.
 * The Solana Connection object provides access to:
 * - Account balance queries
 * - Transaction broadcasting
 * - Network information
 * - Block and transaction history
 */
const connection = new SolanaConnection("https://api.devnet.solana.com");

/**
 * SOLANA CHAIN ADAPTER INITIALIZATION
 * 
 * The Solana chain adapter handles Solana-specific operations:
 * - Public key derivation from NEAR accounts
 * - Transaction construction using Solana's transaction format
 * - Balance queries in SOL and lamports
 * - Integration with NEAR's MPC signing service
 */
const Solana = new chainAdapters.solana.Solana({
  solanaConnection: connection,    // RPC connection to Solana network
  contract: SIGNET_CONTRACT       // NEAR MPC contract for EdDSA signing
})

export function SolanaView({ props: { setStatus } }) {
  // NEAR Wallet Integration for account access and MPC signing
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  // COMPONENT STATE MANAGEMENT
  // Default receiver is a valid Solana devnet address
  const [receiver, setReceiver] = useState("G58AYKiiNy7wwjPAeBAQWTM6S1kJwP3MQ3wRWWhhSJxA");
  const [amount, setAmount] = useState(1);                    // Amount in SOL (Solana's native token)
  const [loading, setLoading] = useState(false);             // Loading state for UI feedback
  const [step, setStep] = useState("request");               // Current step: "request" or "relay"
  const [signedTransaction, setSignedTransaction] = useState(null); // Holds the signed transaction
  const [senderAddress, setSenderAddress] = useState("");    // Derived Solana public key

  /**
   * DERIVATION PATH STATE
   * 
   * Similar to Bitcoin, different derivation paths create different Solana addresses.
   * However, Solana addresses are public keys (base58 encoded) rather than
   * hash-based addresses like Bitcoin. This allows one NEAR account to control
   * multiple Solana addresses for different purposes.
   */
  const [derivation, setDerivation] = useState("solana-1");
  const derivationPath = useDebounce(derivation, 500);

  // Provide immediate UI feedback when user changes derivation path
  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  /**
   * ADDRESS DERIVATION AND BALANCE CHECKING
   * 
   * This effect demonstrates the MPC address derivation process for Solana:
   * 1. Derive a Solana public key from NEAR account + derivation path
   * 2. Query the Solana network for the account balance
   * 3. Display results in user-friendly format
   */
  useEffect(() => {
    setSolAddress();

    async function setSolAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      /**
       * SOLANA ADDRESS DERIVATION
       * 
       * For Solana, the "address" is actually a public key in base58 format.
       * The MPC service generates this public key deterministically from:
       * - Your NEAR account ID
       * - The specified derivation path
       * 
       * The corresponding private key is distributed across the MPC network
       * using threshold cryptography, so no single party controls it.
       */
      const { publicKey } = await Solana.deriveAddressAndPublicKey(signedAccountId, derivationPath);

      setSenderAddress(publicKey);

      /**
       * BALANCE CHECKING
       * 
       * Solana uses an account-based model where each public key
       * has an associated account with a balance. We query the network
       * to get the current SOL balance for this address.
       */
      const balance = await Solana.getBalance(publicKey);

      setStatus(
        `Your Solana address is:${publicKey}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} sol`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  /**
   * TRANSACTION CREATION AND SIGNING PROCESS
   * 
   * This function demonstrates the complete flow for Solana transactions:
   * 1. Create a transfer transaction
   * 2. Serialize the transaction for signing
   * 3. Use NEAR MPC to generate EdDSA signature
   * 4. Attach signature to create final transaction
   */
  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    /**
     * STEP 1: PREPARE SOLANA TRANSACTION
     * 
     * Unlike Bitcoin's UTXO model, Solana transactions are simpler:
     * - Specify sender, receiver, and amount
     * - The system automatically handles account creation if needed
     * - No need to select specific inputs or calculate change
     * 
     * Amount is converted from SOL to lamports (1 SOL = 1 billion lamports)
     */
    const { transaction: { transaction } } = await Solana.prepareTransactionForSigning({
      from: senderAddress,                           // Sender's public key
      to: receiver,                                  // Receiver's public key
      amount: decimalToBigInt(amount, 9),           // Convert SOL to lamports (9 decimals)
    })

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );

    try {
      /**
       * STEP 2: MPC SIGNING WITH EDDSA
       * 
       * Solana uses EdDSA (Edwards-curve Digital Signature Algorithm) instead of
       * ECDSA used by Bitcoin. This is important because:
       * - EdDSA is more efficient and secure for certain operations
       * - It's based on different mathematical principles (Edwards curves)
       * - The signature format and verification process differs from ECDSA
       * 
       * The MPC network must be configured to handle EdDSA signatures
       * for Solana transactions.
       */
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: [transaction.serializeMessage()],   // Serialize transaction for signing
        path: derivationPath,                         // Derivation path for key generation
        keyType: "Eddsa",                            // EdDSA signature scheme for Solana
        signerAccount: { 
          accountId: signedAccountId,
          signAndSendTransactions 
        }
      });

      // Verify we received a valid signature
      if (!rsvSignatures[0] || !rsvSignatures[0].signature) {
        throw new Error("Failed to sign transaction");
      }

      /**
       * STEP 3: FINALIZE SOLANA TRANSACTION
       * 
       * With the EdDSA signature, we can now:
       * - Attach the signature to the transaction
       * - Serialize the complete transaction for broadcasting
       * - Prepare it for submission to the Solana network
       */
      const txSerialized = Solana.finalizeTransactionSigning({
        transaction,                    // Original transaction object
        rsvSignatures: rsvSignatures[0], // EdDSA signature from MPC
        senderAddress                   // Sender's public key for verification
      })

      setStatus("✅ Signed payload ready to be relayed to the Solana network");
      setSignedTransaction(txSerialized);
      setStep("relay");
    } catch (e) {
      console.log(e);
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  /**
   * TRANSACTION BROADCASTING TO SOLANA NETWORK
   * 
   * Once we have a signed transaction, we broadcast it to Solana validators.
   * Solana's fast block times (400ms) mean transactions confirm much faster
   * than Bitcoin (10+ minutes) or Ethereum (15+ seconds).
   */
  async function relayTransaction() {
    setLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Solana network... this might take a while"
    );

    try {

      /**
       * BROADCAST TO SOLANA VALIDATORS
       * 
       * The signed transaction is sent to Solana validators who will:
       * - Validate the transaction format and signatures
       * - Check account balances and permissions
       * - Include the transaction in the next block
       * - Confirm the transaction (usually within 1-2 seconds)
       */
      const txHash = await Solana.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://explorer.solana.com/tx/${txHash.hash}?cluster=devnet`}
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

    // Reset UI state for next transaction
    setStep("request");
    setLoading(false);
  }

  /**
   * UI HANDLER FOR INITIATING SIGNATURE PROCESS
   * 
   * Manages loading state during the signing operation.
   */
  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  };

  /**
   * COMPONENT RENDER
   * 
   * The UI provides a similar interface to the Bitcoin component but
   * with Solana-specific elements:
   * - Devnet information and faucet link
   * - SOL amount input (rather than satoshis)
   * - Solana explorer links for transaction tracking
   */
  return (<>
    {/* DEVNET INFORMATION AND FAUCET ACCESS */}
    <div className="alert alert-info text-center" role="alert">
      You are working with <strong>DevTest</strong>.
      <br />
      You can get funds from the faucet:
      <a
        href="https://faucet.solana.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="alert-link"
      >
        faucet.solana.com/
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

    {/* AMOUNT INPUT (IN SOL) */}
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
          step="0.1"      // Allow decimal inputs for SOL
          min="0"         // Prevent negative amounts
          disabled={loading}
        />
        <div className="form-text"> solana units </div>
      </div>
    </div>

    {/* ACTION BUTTONS - TWO-STEP PROCESS */}
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
  </>)
}

// PropTypes for development-time type checking and documentation
SolanaView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
