import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { useDebounce } from "../hooks/debounce";
import PropTypes from "prop-types";
import { Bitcoin } from "../services/bitcoin";
import { getTransactionHashes } from "../services/utils";
import { Bitcoin as BT } from "multichain-tools";
import { MPC_CONTRACT, MPC_KEY } from "../services/kdf/mpc";
import { Bitcoin as BT2, BTCRpcAdapters } from 'signet.js'
import { KeyPair } from '@near-js/crypto'
import { utils as utilsSignet } from 'signet.js'

//version 1
const BTC = new Bitcoin("testnet");
//version 2
// "https://bitcoin-testnet.drpc.org"
const PROVIDER_URL = "https://mempool.space/testnet4/api";
const BTC2 = new BT({
  providerUrl: PROVIDER_URL,
  nearNetworkId: "testnet",
  contract: MPC_CONTRACT,
  network: "testnet"
});

//version 3

// const keypair = KeyPair.fromString(MPC_KEY)

// const contract = new utilsSignet.chains.near.ChainSignatureContract({
//   networkId: 'testnet',
//   contractId: 'v1.signer-prod.testnet',
//   accountId:"maguila.testnet",
//   keypair,
// })

// const btcRpcAdapter = new BTCRpcAdapters.Mempool('https://mempool.space/testnet4/api')
// const bitcoinChain = new BT2({
//   network: 'testnet',
//   contract,
//   btcRpcAdapter,
// })



export function BitcoinView({ props: { setStatus } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [receiver, setReceiver] = useState(
    "tb1qzm5r6xhee7upsa9avdmpp32r6g5e87tsrwjahu"
  );
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("relay");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderPK, setSenderPK] = useState("");
  const [unsignedTransaction, setUnsignedTransaction] = useState(null)

  const [derivation, setDerivation] = useState("bitcoin-1");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    if (transactions.length === 0) return;
    
    getSignedTx();
  }, []);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  useEffect(() => {
    setBtcAddress();

    async function setBtcAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { address, publicKey } = await BTC2.deriveAddressAndPublicKey(
        signedAccountId,
        derivationPath
      );
      setSenderAddress(address);
      setSenderPK(publicKey);

      const balance = await BTC2.getBalance( address );
      setStatus(
        `Your Bitcoin address is: ${address}, balance: ${balance} satoshi`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    const {transaction,mpcPayloads} = await BTC2.getMPCPayloadAndTransaction({
        publicKey: senderPK,
        from: senderAddress,
        to: receiver,
        value: amount
      });
      setUnsignedTransaction(transaction)

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );

    try {
      
        const signedTransaction = await wallet.callMethod({
          contractId: MPC_CONTRACT,
          method: "sign",
          args: {
            request: {
              payload: Array.from(mpcPayloads[0].payload),
              path: derivationPath,
              key_version: 0,
            },
          },
          gas: "250000000000000", // 250 Tgas
          deposit: 1,
        });
  
      setStatus("✅ Signed payload ready to be relayed to the Bitcoin network");
      setSignedTransaction(signedTransaction);
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
      const txHash = await BTC2.addSignatureAndBroadcast({
        transaction:unsignedTransaction,
        mpcSignatures: [signedTransaction]
      });
  
      setStatus(
        <>
          <a
            href={`https://mempool.space/es/testnet4/tx/${txHash}`}
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

  function removeUrlParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("transactionHashes");
    window.history.replaceState({}, document.title, url);
  }

  return (
    <>
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
