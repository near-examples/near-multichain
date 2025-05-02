import { useState, useEffect } from "react";

import { useDebounce } from "../hooks/debounce";
import PropTypes from "prop-types";
import { SIGNET_CONTRACT, MPC_CONTRACT, NetworkId } from "../config";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { chainAdapters, utils } from "chainsig.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";

const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(
  "https://mempool.space/testnet4/api"
)

const Bitcoin = new chainAdapters.btc.Bitcoin({
  network: NetworkId,
  btcRpcAdapter,
  contract: SIGNET_CONTRACT,
})
export function BitcoinView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiver, setReceiver] = useState("tb1qzm5r6xhee7upsa9avdmpp32r6g5e87tsrwjahu");
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderPK, setSenderPK] = useState("");

  const [derivation, setDerivation] = useState("bitcoin-1");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  useEffect(() => {
    setBtcAddress();

    async function setBtcAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { address, publicKey } = await Bitcoin.deriveAddressAndPublicKey(
        signedAccountId,
        derivationPath
      );
      setSenderAddress(address);
      setSenderPK(publicKey);

      const balance = await Bitcoin.getBalance(address);

      const bitcoinBalance = bigIntToDecimal(balance.balance, balance.decimals);

      const satoshi = chainAdapters.btc.Bitcoin.toSatoshi(bitcoinBalance);

      setStatus(
        `Your Bitcoin address is: ${address}, balance: ${satoshi} satoshi`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction, hashesToSign } = await Bitcoin.prepareTransactionForSigning({
      publicKey: senderPK,
      from: senderAddress,
      to: receiver,
      value: amount.toString(),
    });

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );
    try {
      const mpcTransactions = hashesToSign.map(
        (hash) => ({
          receiverId: MPC_CONTRACT,
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName: "sign",
                args: {
                  request: {
                    payload: hash,
                    path: derivationPath,
                    key_version: 0,
                  },
                },
                gas: "250000000000000",
                deposit: 1,
              },
            },
          ],
        })
      )

      const sentTxs = await signAndSendTransactions({ transactions: mpcTransactions });
      const rsvSignatures = sentTxs.map(tx => utils.cryptography.toRSV(tx))
      
      if (!rsvSignatures) {
        throw new Error("No signature received");
      }

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

  async function relayTransaction() {
    setLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Bitcoin network... this might take a while"
    );

    try {


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

    setStep("request");
    setLoading(false);
  }

  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  };

  return (
    <>
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

BitcoinView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
