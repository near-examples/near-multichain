import { Ethereum } from "../services/ethereum";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';

const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

export function EthereumView({ props: { setStatus, wallet, MPC_CONTRACT } }) {

  const [receiver, setReceiver] = useState("0xe0f3B7e68151E9306727104973752A415c2bcbEb");
  const [amount, setAmount] = useState(0.01);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("")

  const [derivation, setDerivation] = useState("test");
  const derivationPath = useDebounce(derivation, 1000);

  useEffect(() => { setEthAddress(derivationPath) }, [derivationPath]);

  async function setEthAddress() {
    setStatus('Querying your address and balance');
    setSenderAddress('Deriving address...');

    const { address } = await Eth.deriveAddress(wallet.accountId, derivationPath);
    const balance = await Eth.getBalance(address);
  
    setSenderAddress(address);
    setStatus(`Your Ethereum address is: ${address}, balance: ${balance} ETH`);
  }

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');
    const { transaction, payload } = await Eth.createPayload(senderAddress, receiver, amount);

    setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
    try {
      const signedTransaction = await Eth.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, transaction, senderAddress);
      setSignedTransaction(signedTransaction);
      setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
      setStep('relay');
    } catch(e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function relayTransaction() {
    setLoading(true);
    setStatus('🔗 Relaying transaction to the Ethereum network... this might take a while');

    try{
      const txHash = await Eth.relayTransaction(signedTransaction);
      setStatus(`✅ Successful: https://sepolia.etherscan.io/tx/${txHash}`);
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
    }

    setStep('request');
    setLoading(false);
  }

  const handleDerivationChange = (event) => {
    setStatus('Derivation path changed');
    setSenderAddress('Waiting for you to stop typing...');
    setDerivation(event.target.value);
  }

  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  }

  return (
    <>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">From:</label>
        <div className="col-sm-10">
          <input type="text" className="form-control form-control-sm" value={derivation} onChange={handleDerivationChange} disabled={loading}/>
          <div className="form-text" id="eth-sender"> {senderAddress} </div>
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
        <div className="col-sm-10">
          <input type="text" className="form-control form-control-sm" value={receiver} onChange={(e) => setReceiver(e.target.value)} disabled={loading}/>
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
        <div className="col-sm-10">
          <input type="number" className="form-control form-control-sm" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" disabled={loading}/>
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
    wallet: PropTypes.object.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};