import { useEffect, useState } from "react";
import Navbar from "./components/Navbar"
import { Wallet } from "./services/near-wallet";
import { Ethereum } from "./services/ethereum";
import { deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint, uncompressedHexPointToEvmAddress } from './services/kdf';
import * as ethers from 'ethers';

// // CONSTANTS
const TGAS = 1000000000000;
const MPC_CONTRACT = 'multichain-testnet-2.testnet';

// // ETHEREUM
const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });
function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [derivation, setDerivation] = useState("ethereum-1");
  const [ethSender, setEthSender] = useState("^ This will be used to derive your ETH Address")
  const [ethReceiver, setEthReceiver] = useState("0xe0f3B7e68151E9306727104973752A415c2bcbEb");
  const [status, setStatus] = useState("Please login to request a signature");
  const [amount, setAmount] = useState(0.01);
  const [loading, setLoading] = useState(false); 
  const [signedTransaction,setSignedTransaction] = useState(null)
  const [requestButton, setRequestButton] = useState("Request a signature");

  useEffect(() => {
    const initFunction = async () => {
      const isSignedIn = await wallet.startUp();
      setIsSignedIn(isSignedIn);
    }
    
    initFunction();
  }, []);

  useEffect(()=>{
    if(isSignedIn){
      setEthAddress(derivation)
    }else{
      setStatus("Please login to request a signature")
    }
  },[isSignedIn])

  useEffect(() => {
    if(signedTransaction === null){
      setRequestButton("Request a signature");
      return;
    }
    if ( signedTransaction.getValidationErrors().length > 0) {
      throw new Error("Transaction validation errors");
    }
    if (!signedTransaction.verifySignature()) {
      throw new Error("Signature is not valid");
    }

    setStatus(`MPC responded with the signed payload: ${ethers.utils.hexlify(signedTransaction.serialize()).slice(0, 15)}...`);
    setRequestButton("Relay Transaction");
  }, [signedTransaction]);

  async function setEthAddress(derivation_path) {
    setStatus('Querying your address and balance');
  
    const sender = await deriveEthAddress(derivation_path);
    const balance = await Eth.getBalance(sender);

    setStatus(`Your ETH Address is: ${sender}\n Its balance is ${balance} wei`);
   
    setDerivation(derivation_path);
    setEthSender(sender);
  }

  async function deriveEthAddress(derivation_path) {
    const rootPublicKey = await wallet.viewMethod({ contractId: MPC_CONTRACT, method: 'public_key' });
    const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(rootPublicKey), wallet.accountId, derivation_path);
    return uncompressedHexPointToEvmAddress(publicKey);
  }

  async function requestSignature(payload, path) {
    const request = await wallet.callMethod({ contractId: MPC_CONTRACT, method: 'sign', args: { payload, path }, gas: 300 * TGAS },);
    const [big_r, big_s] = await wallet.getTransactionResult(request.transaction.hash);
    return { big_r, big_s };
  }

  async function relayTransaction(signedTransaction) {
    setStatus('Relaying transaction to the Ethereum network... please be patient, ETH might take a while to respond.');
    const txHash = await Eth.relayTransaction(signedTransaction);
    setStatus(`Transaction relayed to the Ethereum network with hash: ${txHash}`);
  }

  async function chainSignature() {
    setStatus('Creating transaction');
    const { transaction, payload } = await Eth.createPayload(ethSender, ethReceiver, amount);
  
    setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account ${ethSender.slice(0, 8)}..., this might take a while`);
    const { big_r, big_s } = await requestSignature(payload, derivation);
  
    setStatus(`Reconstructing & validating signature`);
    const signedTransaction = Eth.reconstructSignature(transaction, big_r, big_s, ethSender);
    
    setSignedTransaction(signedTransaction)
  }

  let timer;

  const handleInputChange = (event) => {
    const value = event.target.value;
    setDerivation(value)
    clearTimeout(timer);
    // document.querySelector('#eth-sender').innerHTML = "Waiting for you to stop typing...";
    setEthSender("Waiting for you to stop typing...");
    timer = setTimeout(() => {
      setEthAddress(value);
    }, 500);
  };

  const handleSubmit = async() => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
    if(signedTransaction !== null){
      relayTransaction(signedTransaction);
    }
  }
  return (
    <>
      <Navbar wallet={wallet} isSignedIn={isSignedIn}></Navbar>
      <div className="container">
      <div className="alert alert-info mb-4 text-center" role="alert">
        MPC Contract: multichain-testnet-2.testnet
      </div>

      <h2> NEAR 🔗 ETH </h2>
      <p className="small">
        Safely control Ethereum accounts through our NEAR MPC service. Learn more in our <a href="https://docs.near.org/abstraction/chain-signatures"> <b>documentation</b> </a>
      </p>

      <div id="signed-in" className="mt-3" style={{ width: '60%' }}>
        <div className="row my-3">
          <label className="col-sm-2 col-form-label col-form-label-sm">From:</label>
          <div className="col-sm-10">
            <input type="text" className="form-control form-control-sm" value={derivation} onChange={handleInputChange} disabled={loading}/>
            <div className="form-text" id="eth-sender"> {ethSender} </div>
          </div>
        </div>
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
          <div className="col-sm-10">
            <input type="text" className="form-control form-control-sm" value={ethReceiver} onChange={(e)=>setEthReceiver(e.target.value)} disabled={loading}/>
          </div>
        </div>
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
          <div className="col-sm-10">
            <input type="number" className="form-control form-control-sm" value={amount} onChange={(e)=>setAmount(e.target.value)} step="0.01" disabled={loading}/>
          </div>
        </div>

        <div className="text-center">
          <button className="btn btn-primary text-center" onClick={handleSubmit}> {requestButton} </button>
        </div>
        <hr />
      </div>

      <div className="mt-3 small text-center">
        <span > {status} </span>
      </div>
    </div>
    </>
  )
}

export default App
