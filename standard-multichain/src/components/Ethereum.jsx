import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { Ethereum } from "../services/ethereum";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';

const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

export function EthereumView({ props: { setStatus, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [receiver, setReceiver] = useState("0xe0f3B7e68151E9306727104973752A415c2bcbEb");
  const [amount, setAmount] = useState(0.01);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("")

  const [derivation, setDerivation] = useState("ethereum-1");
  const derivationPath = useDebounce(derivation, 1000);

  useEffect(() => {
    setSenderAddress('Waiting for you to stop typing...')
  }, [derivation]);

  useEffect(() => {
    setEthAddress()

    async function setEthAddress() {
      setStatus('Querying your address and balance');
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { address } = await Eth.deriveAddress(signedAccountId, derivationPath);
      setSenderAddress(address);

      const balance = await Eth.getBalance(address);
      setStatus(`Your Ethereum address is: ${address}, balance: ${balance} ETH`);
    }
  }, [signedAccountId, derivationPath]);

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');
    const { transaction, payload } = await Eth.createPayload(senderAddress, receiver, amount);

    setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
    try {
      const signedTransaction = await Eth.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, transaction, senderAddress);
      setSignedTransaction(signedTransaction);
      setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
      setStep('relay');
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function relayTransaction() {
    setLoading(true);
    setStatus('🔗 Relaying transaction to the Ethereum network... this might take a while');

    try {
      const txHash = await Eth.relayTransaction(signedTransaction);
      setStatus(<>
        <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank"> ✅ Successful </a>
      </>
      );
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
    }

    setStep('request');
    setLoading(false);
  }

  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  }

  return (
    <>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">Path:</label>
        <div className="col-sm-10">
          <input type="text" className="form-control form-control-sm" value={derivation} onChange={(e) => setDerivation(e.target.value)} disabled={loading} />
          <div className="form-text" id="eth-sender"> {senderAddress} </div>
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
        <div className="col-sm-10">
          <input type="text" className="form-control form-control-sm" value={receiver} onChange={(e) => setReceiver(e.target.value)} disabled={loading} />
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
        <div className="col-sm-10">
          <input type="number" className="form-control form-control-sm" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" disabled={loading} />
          <div className="form-text"> Ethereum units </div>
        </div>
      </div>

      <div className="text-center">
        {step === 'request' && <button className="btn btn-primary text-center" onClick={UIChainSignature} disabled={loading}> Request Signature </button>}
        {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
      </div>
    </>
  )
}

EthereumView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};