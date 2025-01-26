import { useState, useEffect, useContext } from "react";
import { NearContext } from "../../context";

import { useDebounce } from "../../hooks/debounce";
import PropTypes from 'prop-types';
import { useRef } from "react";
import { TransferForm } from "./Transfer";
import { FunctionCallForm } from "./FunctionCall";
import { EthereumVM } from "../../services/evm";
import { MPC_CONTRACT } from "../../services/kdf/mpc";

const Evm = new EthereumVM('https://sepolia.drpc.org');

const contractAddress = "0xe2a01146FFfC8432497ae49A7a6cBa5B9Abd71A3";

export function EthereumView({ props: { setStatus, transactions } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(transactions ? 'relay' : "request");
  const [signedTransaction, setSignedTransaction] = useState(null);

  const [senderLabel, setSenderLabel] = useState("")
  const [senderAddress, setSenderAddress] = useState("")
  const [action, setAction] = useState("transfer")
  const [derivation, setDerivation] = useState(sessionStorage.getItem('derivation') || "ethereum-1");
  const derivationPath = useDebounce(derivation, 1200);

  const [reloaded, setReloaded] = useState(transactions.length ? true : false);

  const childRef = useRef();

  useEffect(() => {
    // special case for web wallet that reload the whole page
    if (reloaded && senderAddress) signTransaction()

    async function signTransaction() {
      const { big_r, s, recovery_id } = await wallet.getTransactionResult(transactions[0]);
      const signedTransaction = await Evm.reconstructSignedTXFromLocalSession(big_r, s, recovery_id, senderAddress);

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

    async function setEthAddress() {
      const { address } = await Evm.deriveAddress(signedAccountId, derivationPath);
      setSenderAddress(address);
      setSenderLabel(address);

      const balance = await Evm.getBalance(address);
      if (!reloaded) setStatus(`Your Ethereum address is: ${address}, balance: ${balance} ETH`);
    }
  }, [derivationPath]);

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');

    const { transaction } = await childRef.current.createTransaction();

    setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
    try {
      // to reconstruct on reload
      sessionStorage.setItem('derivation', derivationPath);

      const { big_r, s, recovery_id } = await Evm.requestSignatureToMPC({ wallet, path: derivationPath, transaction });
      const signedTransaction = await Evm.reconstructSignedTransaction(big_r, s, recovery_id, transaction);

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
      const txHash = await Evm.broadcastTX(signedTransaction);
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
          ? <TransferForm ref={childRef} props={{ Evm, senderAddress, loading }} />
          : <FunctionCallForm ref={childRef} props={{ Evm, contractAddress, senderAddress, loading }} />
      }

      <div className="text-center">
        {step === 'request' && <button className="btn btn-primary text-center" onClick={UIChainSignature} disabled={loading}> Request Signature </button>}
        {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
      </div>
    </>
  )

  function removeUrlParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('transactionHashes');
    window.history.replaceState({}, document.title, url);
  }
}

EthereumView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    transactions: PropTypes.arrayOf(PropTypes.string).isRequired
  }).isRequired
};