import { Wallet } from './near-wallet';
import { Ethereum } from './ethereum';
import { bytesToHex } from '@ethereumjs/util';
import { Chain } from '@ethereumjs/common'

// CONSTANTS
const TGAS = 1000000000000;
const DERIVATION_PATH = "ethereum-1";
const MPC_CONTRACT = 'multichain-testnet-2.testnet';

// ETHEREUM
const ETH_SENDER = "0x46Dd36F3235C748961427854948B32BD412AdD3c";
const Eth = new Ethereum('https://rpc2.sepolia.org', Chain.Sepolia);

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });

async function requestReconstructSignature() {
  const { transaction, big_r, big_s } = await requestSignature(ETH_SENDER);
  const signature = await reconstructSignature(transaction, big_r, big_s);
  // await Eth.relayTransaction(signature);
}

async function requestSignature(eth_sender) {
  setStatus('Creating transaction');
  const { transaction, payload } = await Eth.createPayload(eth_sender);

  setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account "${DERIVATION_PATH}"... this might take a while`);
  // Request signature from MPC
  const request = await wallet.callMethod({ contractId: MPC_CONTRACT, method: 'sign', args: { payload, path: DERIVATION_PATH }, gas: 300 * TGAS },);
  const [big_r, big_s] = await wallet.getTransactionResult(request.transaction.hash);
  return { transaction, big_r, big_s };
}

async function reconstructSignature(transaction, big_r, big_s) {
  // Reconstruct signature from MPC response
  const r = BigInt('0x' + big_r.slice(2));
  const v = big_r.slice(0, 2) === '02' ? 0n : 1n;
  const s = BigInt('0x' + big_s);
  const signedTransaction = transaction.addSignature(v, r, s);

  // Validate signature
  if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
  if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }

  setStatus(`MPC responded with the signed payload: ${bytesToHex(signedTransaction.serialize()).slice(0, 15)}...`);
  return signedTransaction;
}

async function handleWalletCallback() {
  // if the user did not create a function call key for the MPC contract
  // they will be redirected to sign the transaction on the wallet

  const txHash = new URLSearchParams(window.location.search).get('transactionHashes');
  if (!txHash) return

  const { transaction } = await Eth.createPayload(ETH_SENDER); // the transaction that was signed
  const [big_r, big_s] = await wallet.getTransactionResult(txHash);
  const signature = await reconstructSignature(transaction, big_r, big_s);
}

// Setup on page load
window.onload = async () => {
  document.querySelector('#transaction').innerHTML = JSON.stringify(txToDisplay, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  let isSignedIn = await wallet.startUp();
  isSignedIn ? signedInUI() : signedOutUI();
  handleWalletCallback();
};

// UI: Transaction to display (for demo purposes)
const txToDisplay = { nonce: 'x', gasLimit: 21000, maxFeePerGas: 32725779198, maxPriorityFeePerGas: 1, to: '0xa3286628134bad128faeef82f44e99aa64085c94', value: '1', chain: Chain.Sepolia };

// Button clicks
document.querySelector('#sign-in-button').onclick = () => { wallet.signIn(); };
document.querySelector('#sign-out-button').onclick = () => { wallet.signOut(); };
document.querySelector('#request-button').onclick = () => { requestReconstructSignature(); };

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

// UI: setStatus message
function setStatus(message) {
  document.querySelector('#status').innerText = message;
}

// UI: hide Elements
function hide(id) {
  document.querySelectorAll(id).forEach(el => el.style.display = 'none');
};