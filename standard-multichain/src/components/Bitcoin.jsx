import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { Bitcoin as Bitcoin } from "../services/bitcoin";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';

const BTC_NETWORK = 'testnet';
const BTC = new Bitcoin('https://blockstream.info/testnet/api', BTC_NETWORK);

export function BitcoinView({ props: { setStatus, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [receiver, setReceiver] = useState("tb1q86ec0aszet5r3qt02j77f3dvxruk7tuqdlj0d5");
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("")
  const [senderPK, setSenderPK] = useState("")

  const [derivation, setDerivation] = useState("bitcoin-1");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    setSenderAddress('Waiting for you to stop typing...')
  }, [derivation]);

  useEffect(() => {
    setBtcAddress()

    async function setBtcAddress() {
      setStatus('Querying your address and balance');
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { address, publicKey } = await BTC.deriveAddress(signedAccountId, derivationPath);
      setSenderAddress(address);
      setSenderPK(publicKey);

      const balance = await BTC.getBalance(address);
      setStatus(`Your Bitcoin address is: ${address}, balance: ${balance} satoshi`);
    }
  }, [signedAccountId, derivationPath, setStatus]);

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');
    const payload = await BTC.createPayload(senderAddress, receiver, amount);

    setStatus('🕒 Asking MPC to sign the transaction, this might take a while...');
    try {
      const signedTransaction = await BTC.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, senderPK);
      setStatus('✅ Signed payload ready to be relayed to the Bitcoin network');
      setSignedTransaction(signedTransaction);
      setStep('relay');
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function relayTransaction() {
    setLoading(true);
    setStatus('🔗 Relaying transaction to the Bitcoin network... this might take a while');

    try {
      const txHash = await BTC.relayTransaction(signedTransaction);
      setStatus(
        <>
          <a href={`https://blockstream.info/testnet/tx/${txHash}`} target="_blank"> ✅ Successful </a>
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
      <div className="row my-3">
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
          <input type="number" className="form-control form-control-sm" value={amount} onChange={(e) => setAmount(e.target.value)} step="1" disabled={loading} />
          <div className="form-text"> satoshi units </div>
        </div>
      </div>

      <div className="text-center mt-3">
        {step === 'request' && <button className="btn btn-primary text-center" onClick={UIChainSignature} disabled={loading}> Request Signature </button>}
        {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
      </div>
    </>
  )
}

BitcoinView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};