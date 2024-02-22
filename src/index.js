import { Web3, } from "web3"
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Chain, Common } from '@ethereumjs/common'
import { Wallet } from './near-wallet';

// MPC
const DERIVATION_PATH = "ethereum-1";
const MPC_CONTRACT = 'multichain-testnet-2.testnet';

// NEAR
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });
const TGAS = 1000000000000;

// Ethereum
const ETH_RPC_URL = "https://rpc2.sepolia.org";
const ETH_ID = 11155111n;
const ETH_SENDER = "0x46Dd36F3235C748961427854948B32BD412AdD3c";

const web3 = new Web3(ETH_RPC_URL);
const common = new Common({ chain: Chain.Sepolia });

// Create transaction (hardcoded right now)
async function getTransaction() {
  const nonce = await web3.eth.getTransactionCount(ETH_SENDER);

  return {
    nonce: nonce,
    gasLimit: 21000,
    maxFeePerGas: 32725779198,
    maxPriorityFeePerGas: 1,
    to: '0xa3286628134bad128faeef82f44e99aa64085c94',
    value: 1 + Math.floor(Math.random() * 1000000000000000),
    chain: ETH_ID,
  };
}

async function requestSignature() {

  setStatus('Creating transaction');
  const transactionData = await getTransaction();
  const transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
  const messageHash = Array.from(transaction.getHashedMessageToSign());

  console.log(`Calling sign on ${MPC_CONTRACT} passing: - payload: ${messageHash} - path: ${DERIVATION_PATH}`)
  setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account "${DERIVATION_PATH}"... this might take a while`);
  const request = await wallet.callMethod({contractId: MPC_CONTRACT, method: 'sign', args: { payload: messageHash, path: DERIVATION_PATH }, gas: 300*TGAS},);
  const [big_r, big_s] = await wallet.getTransactionResult(request.transaction.hash);
  const r = BigInt('0x' + big_r.slice(2));
  const v = big_r.slice(0, 2) === '02' ? 0n : 1n;
  const s = BigInt('0x' + big_s);

  console.log("Signature response from MPC: ", r, v, s);
  const signedTransaction = transaction.addSignature(v, r, s);
  if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
  if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }

  setStatus(`MPC responded with the signed payload: ${bytesToHex(signedTransaction.serialize()).slice(0, 15)}...`);
}

// This code can be used to actually relay the transaction to the Ethereum network
async function relayTransaction(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const transactionResult = await web3.eth.sendSignedTransaction(serializedTx);
    setStatus(`Ethereum TX hash: "${transactionResult.transactionHash}"`);
}

// Setup on page load
window.onload = async () => {
  getTransaction().then(
    transactionData => {
      document.querySelector('#transaction').innerHTML = JSON.stringify(transactionData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
    }
  )
  let isSignedIn = await wallet.startUp();
  isSignedIn ? signedInUI() : signedOutUI();
};

// Button clicks
document.querySelector('#sign-in-button').onclick = () => { wallet.signIn(); };
document.querySelector('#sign-out-button').onclick = () => { wallet.signOut(); };
document.querySelector('#request-button').onclick = () => { requestSignature(); };

// UI: Hide signed-in elements
function signedOutUI() { hide('#signed-in'); hide('#sign-out-button'); }

// UI: Hide signed-out elements
function signedInUI() {
  hide('#signed-out');
  hide('#sign-in-button');

  setStatus('You can request a signature now');

  document.querySelectorAll('[data-behavior=account-id]').forEach(el => {
    el.innerText = wallet.accountId;
  });
}

function setStatus(message) {
  document.querySelector('#status').innerText = message;
}

function hide(id) {
  document.querySelectorAll(id).forEach(el => el.style.display = 'none');
};