import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { Bitcoin as Bitcoin } from "../services/bitcoin";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';
import {drop} from "../App.jsx";
import {callContract} from "../services/near.js";
import {deriveChildPublicKey} from "../services/kdf.js";
import {Account} from "near-api-js";

const BTC_NETWORK = 'testnet';
const BTC = new Bitcoin('https://blockstream.info/testnet/api', BTC_NETWORK);

// TODO use an interface for the chains?
// const derivation = "bitcoin-1";

// 0. Make sure the user has signed in with their near wallet x
// 1. Get the address from the user of the Ethereum address they want to send the money to
// 2. Send the money from the faucet Near account to the user's address
  // derive this
  // have a statistics page for all the chains
    // do we need to store the chains that we have for each

const TREASURY_DERIVATION_PATH = "bitcoin-1";
const DERIVATION_PATH = useDebounce(TREASURY_DERIVATION_PATH, 500);

export function BitcoinView({ props: { setStatus, nearAccount, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);

  const [action, setAction] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState(10);

  useEffect(() => {
    setBtcAddress()

    async function setBtcAddress() {
      setStatus('Querying your address and balance');
      setSenderAddress(`Deriving address from path ${DERIVATION_PATH}...`);

      const { address, publicKey } = await BTC.deriveAddress(signedAccountId, DERIVATION_PATH);

      const balance = await BTC.getBalance(address);
      setStatus(`Your Bitcoin address is: ${address}, balance: ${balance} satoshi`);
      setSenderAddress(address);
    }
  }, [signedAccountId, DERIVATION_PATH]);

  async function deposit() {
    const derivedBTCNEARTreasury = BTC.deriveAddress(wallet.address, DERIVATION_PATH);
    await sendMoney(derivedBTCNEARTreasury, senderAddress, depositAmount);
  }

  async function withdraw() {
    const allowed = await callContract(nearAccount, MPC_CONTRACT, "BITCOIN");
    if (!allowed) {
      setStatus(`❌ Error: not allowed to withdraw from faucet - make sure to wait 24 hours between calls`);
    }

    const derivedBTCNEAR = BTC.deriveAddress(nearAccount, DERIVATION_PATH);
    await sendMoney(derivedBTCNEAR, senderAddress, drop);
  }

  async function sendMoney(senderAddress, receiverAddress, amount) {
    setStatus('🏗️ Creating transaction');
    const payload = await BTC.createPayload(senderAddress, receiverAddress, amount);

    setStatus('🕒 Asking MPC to sign the transaction, this might take a while...');
    try {
      const signedTransaction = await BTC.requestSignatureToMPC(wallet, MPC_CONTRACT, DERIVATION_PATH, payload, senderAddress);
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

  return (
    <>
      <div className="input-group input-group-sm my-2 mb-4">
        <span className="text-primary input-group-text" id="chain">Action:</span>
        <select className="form-select" aria-describedby="chain" value={action} onChange={e => setAction(e.target.value)} >
          <option value="deposit"> Deposit </option>
          <option value="withdraw"> Withdraw </option>
        </select>
      </div>

      {
        action === "deposit" ?
          <div className="input-group input-group-sm my-2 mb-4">
            <span>Amount: </span>
            <input type="number" className="form-control form-control-sm" value={depositAmount}
                   onChange={(e) => setDepositAmount(parseFloat(e.target.value))}/>
            <span>Sender: </span>
            <input type="text" className="form-control form-control-sm" value={senderAddress}
                   onChange={(e) => setSenderAddress(e.target.value)}/>
            <input type="button" value="Submit" onClick={() => deposit()}/>
          </div> :
            <div className="input-group input-group-sm my-2 mb-4">
              <span>Receiver: </span>
              <input type="text" className="form-control form-control-sm" value={receiverAddress}
                     onChange={(e) => setReceiverAddress(e.target.value)}/>
              <input type="button" value="Submit" onClick={() => withdraw()}/>
            </div>
      }

      <div className="text-center mt-3">
        {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
      </div>
    </>
  )
}

BitcoinView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    nearAccount: PropTypes.shape(Account).isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};