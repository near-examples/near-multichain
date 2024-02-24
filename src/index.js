import { Wallet } from './near-wallet';
import { Ethereum } from './ethereum';
import { bytesToHex } from '@ethereumjs/util';
import { Chain } from '@ethereumjs/common'

// CONSTANTS
const TGAS = 1000000000000;
const DERIVATION_PATH = '';
const MPC_CONTRACT = 'canhazgas.testnet';

// ETHEREUM
const Eth = new Ethereum('https://rpc2.sepolia.org', Chain.Sepolia);

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });

async function chainSignature() {
  // get the foreign address for the current account
  const eth_sender = await wallet.viewMethod(
    { contractId: MPC_CONTRACT, method: 'get_foreign_address_for', args: { account_id: wallet.accountId } }
  );

  setStatus('Creating transaction');
  const { transaction, payload } = await Eth.createPayload(eth_sender);

  setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account ${eth_sender.slice(0, 8)}..., this might take a while`);
  const { big_r, big_s } = await requestSignature(payload, DERIVATION_PATH);

  setStatus(`Reconstructing & validating signature`);
  const signedTransaction = Eth.reconstructSignature(transaction, big_r, big_s);

  // Validate signature
  if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
  if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }
  if (bytesToHex(signedTransaction.getSenderAddress().bytes) !== eth_sender.toLowerCase()) { throw new Error("Sender address does not match"); }

  setStatus(`MPC responded with the signed payload: ${bytesToHex(signedTransaction.serialize()).slice(0, 15)}...`);

  // await Eth.relayTransaction(signature);
}

async function requestSignature(payload, path) {
  // Request signature from MPC
  const request = await wallet.callMethod({ contractId: MPC_CONTRACT, method: 'sign', args: { payload, path }, gas: 300 * TGAS },);
  const [big_r, big_s] = await wallet.getTransactionResult(request.transaction.hash);
  return { big_r, big_s };
}

async function handleWalletCallback() {
  // if the user did not create a function call key for the MPC contract
  // they will be redirected to sign the transaction on the wallet
  const txHash = new URLSearchParams(window.location.search).get('transactionHashes');
  if (!txHash) return
  alert(`Logout and login again, remember to add a function call for ${MPC_CONTRACT}`)
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
document.querySelector('#request-button').onclick = () => { chainSignature(); };

// UI: Hide signed-in elements
function signedOutUI() { hide('#signed-in'); hide('#sign-out-button'); }

// UI: Hide signed-out elements
async function signedInUI() {
  hide('#signed-out');
  hide('#sign-in-button');

  setStatus('You can request a signature now');

  const eth_sender = await wallet.viewMethod({ contractId: MPC_CONTRACT, method: 'get_foreign_address_for', args: { account_id: wallet.accountId } });

  setStatus(`Your ETH Address is: ${eth_sender}`);

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