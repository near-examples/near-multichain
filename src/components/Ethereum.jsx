import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { Ethereum } from "../services/ethereum";
import { useDebounce } from "../hooks/debounce";
import PropTypes from 'prop-types';
import {Account} from "near-api-js";
import {callContract} from "../services/near.js";
import {drop} from "../App.jsx";

const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

const TREASURY_DERIVATION_PATH = "ethereum-1";
const DERIVATION_PATH = useDebounce(TREASURY_DERIVATION_PATH, 500);

export function EthereumView({ props: { setStatus, nearAccount, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);

  const [derivation, setDerivation] = useState("-1");
  const derivationPath = useDebounce(derivation, 500);

  const [action, setAction] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState(10);

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

  async function deposit() {
    const derivedEthNEARTreasury = Eth.deriveAddress(wallet.address, DERIVATION_PATH);
    await sendMoney(derivedEthNEARTreasury, senderAddress, depositAmount);
  }

  async function withdraw() {
    const allowed = await callContract(nearAccount, MPC_CONTRACT, "BITCOIN");
    if (!allowed) {
      setStatus(`❌ Error: not allowed to withdraw from faucet - make sure to wait 24 hours between calls`);
    }

    const derivedEthNEAR = Eth.deriveAddress(nearAccount, DERIVATION_PATH);
    await sendMoney(derivedEthNEAR, senderAddress, drop);
  }

  async function sendMoney() {
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

EthereumView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    nearAccount: PropTypes.shape(Account).isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};