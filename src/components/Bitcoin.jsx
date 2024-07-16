import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { Bitcoin as Bitcoin } from "../services/bitcoin";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';
import {drop} from "../App.jsx";
import {callContract} from "../services/near.js";
import {deriveChildPublicKey} from "../services/kdf.js";

const BTC_NETWORK = 'testnet';
const BTC = new Bitcoin('https://blockstream.info/testnet/api', BTC_NETWORK);

// const derivation = "bitcoin-1";

// 0. Make sure the user has signed in with their near wallet x
// 1. Get the address from the user of the Ethereum address they want to send the money to
// 2. Send the money from the faucet Near account to the user's address
  // derive this
  // have a statistics page for all the chains
    // do we need to store the chains that we have for each

export function BitcoinView({ props: { setStatus, nearAccount, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);
  const [faucetAddress, setFaucetAddress] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);

  const [derivation, setDerivation] = useState("bitcoin-1");
  const derivationPath = useDebounce(derivation, 500);

  const [action, setAction] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState(0);

  useEffect(() => {
    setBtcAddress()

    async function setBtcAddress() {
      setStatus('Querying your address and balance');
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { address, publicKey } = await BTC.deriveAddress(signedAccountId, derivationPath);

      const balance = await BTC.getBalance(address);
      setStatus(`Your Bitcoin address is: ${address}, balance: ${balance} satoshi`);
    }
  }, [signedAccountId, derivationPath]);

  useEffect(() => {
    setBTCAddress();
    async function setBTCAddress() {
      const {address, _} = await BTC.deriveAddress(nearAccount.accountId, derivationPath);
      setFaucetAddress(address);
    }
  }, []);

  // this function needs to make a request to the contract to just say whether or not is it okay to make a rust call
  // for a deposit

  // we need to sign the payload using the sign method


  async function chainSignature(senderAddress, receiverAddress, amount) {
    setStatus('🏗️ Creating transaction');
    const payload = await BTC.createPayload(senderAddress, receiverAddress, amount);
    setStatus('🕒 Asking MPC to sign the transaction, this might take a while...');
    try {
      const signedTransaction = await BTC.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, senderAddress);
      setStatus('✅ Signed payload ready to be relayed to the Bitcoin network');
      setSignedTransaction(signedTransaction);
      setStep('relay');
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function deposit() {

  }

  async function withdraw(account) {
    const allowed = await contractCall(nearAccount, MPC_CONTRACT);
    if (!allowed) {
      setStatus(`❌ Error: not allowed to withdraw from faucet - make sure to wait 24 hours between calls`);
    }

    const derivedBTCNEAR = BTC.deriveAddress(nearAccount, derivationPath);
    await chainSignature(derivedBTCNEAR, account, drop);
  }

  // callContract

  async function contractCall(nearAccount, MPC_CONTRACT) {
    const res = await callContract(nearAccount, MPC_CONTRACT, "BITCOIN");
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

      <div className="input-group input-group-sm my-2 mb-4">
        <span className="text-primary input-group-text" id="chain">Action:</span>
        <select className="form-select" aria-describedby="chain" value={action} onChange={e => setAction(e.target.value)} >
          <option value="deposit"> Deposit </option>
          <option value="withdraw"> Withdraw </option>
        </select>
      </div>

      {
        action === "deposit" &&
        <div className="input-group input-group-sm my-2 mb-4">
          <input type="number" className="form-control form-control-sm" value={depositAmount} onChange={(e) => setDepositAmount(parseFloat(e.target.value))} />
        </div>
      }

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
    nearAccount: PropTypes.any.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};