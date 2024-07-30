import { useState, useEffect, useContext } from "react";
import { NearContext } from "../../context";

import { Ethereum } from "../../services/ethereum";
import { useDebounce } from "../../hooks/debounce";
import PropTypes from 'prop-types';
import { useRef } from "react";
import { TransferForm } from "./Transfer";
import { FunctionCallForm } from "./FunctionCall";

const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

export function EthereumView({ props: { setStatus, MPC_CONTRACT, transactions } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(transactions ? 'relay' : "request");
  const [signedTransaction, setSignedTransaction] = useState(null);

  const [senderLabel, setSenderLabel] = useState("")
  const [senderAddress, setSenderAddress] = useState("")
  const [action, setAction] = useState("transfer")
  const [derivation, setDerivation] = useState(sessionStorage.getItem('derivation') || "ethereum-1");
  const derivationPath = useDebounce(derivation, 1200);

  const [reloaded, setReloaded] = useState(transactions.length? true : false);

  const childRef = useRef();

  useEffect(() => {
    // special case for web wallet that reload the whole page
    if (reloaded && senderAddress) signTransaction()

    async function signTransaction() {
      const { big_r, s, recovery_id } = await wallet.getTransactionResult(transactions[0]);
      console.log({ big_r, s, recovery_id });
      const signedTransaction = await Eth.reconstructSignatureFromLocalSession(big_r, s, recovery_id, senderAddress);
      setSignedTransaction(signedTransaction);
      setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
      setStep('relay');

      setReloaded(false);
      removeUrlParams();
    }

  }, [senderAddress]);

  useEffect(() => {
    setSenderLabel('Waiting for you to stop typing...')
    setStatus('Querying Ethereum address and Balance...');
    setSenderAddress(null)
    setStep('request');
  }, [derivation]);

  useEffect(() => {
    setEthAddress()
    console.log(derivationPath)
    async function setEthAddress() {
      const { address } = await Eth.deriveAddress(signedAccountId, derivationPath);
      setSenderAddress(address);
      setSenderLabel(address);

      const balance = await Eth.getBalance(address);
      if (!reloaded) setStatus(`Your Ethereum address is: ${address}, balance: ${balance} ETH`);
    }
  }, [derivationPath]);

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');

    const { transaction, payload } = await childRef.current.createPayload();
    // const { transaction, payload } = await Eth.createPayload(senderAddress, receiver, amount, undefined);

    setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
    try {
      const { big_r, s, recovery_id } = await Eth.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, transaction, senderAddress);
      const signedTransaction = await Eth.reconstructSignature(big_r, s, recovery_id, transaction, senderAddress);

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
      setStatus(
        <>
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank"> ✅ Successful </a>
        </>
      );
      childRef.current.afterRelay();
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
          <div className="form-text" id="eth-sender"> {senderLabel} </div>
        </div>
      </div>
      <div className="input-group input-group-sm my-2 mb-4">
        <span className="text-primary input-group-text" id="chain">Action</span>
        <select className="form-select" aria-describedby="chain" onChange={e => setAction(e.target.value)} >
          <option value="transfer"> Ξ Transfer </option>
          <option value="function-call"> Ξ Call Counter </option>
        </select>
      </div>

      {
        action === 'transfer'
          ? <TransferForm ref={childRef} props={{ Eth, senderAddress, loading }} />
          : <FunctionCallForm ref={childRef} props={{ Eth, senderAddress, loading }} />
      }

      <div className="text-center">
        {step === 'request' && <button className="btn btn-primary text-center" onClick={UIChainSignature} disabled={loading}> Request Signature </button>}
        {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
      </div>
    </>
  )

  function removeUrlParams () {
    const url = new URL(window.location.href);
    url.searchParams.delete('transactionHashes');
    window.history.replaceState({}, document.title, url);
  }
}

EthereumView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
    transactions: PropTypes.arrayOf(PropTypes.string).isRequired
  }).isRequired
};