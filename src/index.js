import { Wallet } from './near-wallet';
import { Ethereum } from './ethereum';
import * as ethers from 'ethers';
import { deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint, uncompressedHexPointToEvmAddress } from './kdf';

// params: To be filled
let derivation;
let eth_sender;
let eth_receiver;
let amount;

// CONSTANTS
const TGAS = 1000000000000;
const MPC_CONTRACT = 'multichain-testnet-2.testnet';

// ETHEREUM
const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });

// Used to derive the Ethereum address from the MPC public key
async function deriveEthAddress(derivation_path) {
  const rootPublicKey = await wallet.viewMethod({ contractId: MPC_CONTRACT, method: 'public_key' });
  const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(rootPublicKey), wallet.accountId, derivation_path);
  return uncompressedHexPointToEvmAddress(publicKey);
}

// Chain Signature Flow
async function chainSignature() {
  console.log(eth_sender, eth_receiver, amount, derivation);

  setStatus('Creating transaction');
  const { transaction, payload } = await Eth.createPayload(eth_sender, eth_receiver, amount);

  setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account ${eth_sender.slice(0, 8)}..., this might take a while`);
  const { big_r, big_s } = await requestSignature(payload, derivation);

  setStatus(`Reconstructing & validating signature`);
  const signedTransaction = Eth.reconstructSignature(transaction, big_r, big_s, eth_sender);

  // Validate signature
  if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
  if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }

  setStatus(`MPC responded with the signed payload: ${ethers.utils.hexlify(signedTransaction.serialize()).slice(0, 15)}...`);

  // Setup button to relay the transaction
  document.querySelector('#request-button').innerHTML = 'Relay Transaction';
  document.querySelector('#request-button').onclick = () => { relayTransaction(signedTransaction); };
}

async function relayTransaction(signedTransaction) {
  setStatus('Relaying transaction to the Ethereum network... please be patient, ETH might take a while to respond.');
  const txHash = await Eth.relayTransaction(signedTransaction);
  setStatus(`Transaction relayed to the Ethereum network with hash: ${txHash}`);
}

async function requestSignature(payload, path) {
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
  let isSignedIn = await wallet.startUp();
  isSignedIn ? signedInUI() : signedOutUI();
  handleWalletCallback();
};

// Derivation path
document.querySelector('#receiver').oninput = (e) => { eth_receiver = e.target.value };
document.querySelector('#amount').oninput = (e) => { amount = e.target.value };

// Button clicks
document.querySelector('#sign-in-button').onclick = () => { wallet.signIn(); };
document.querySelector('#sign-out-button').onclick = () => { wallet.signOut(); };
document.querySelector('#request-button').onclick = async () => { disableInput(); await chainSignature(); enableInput(); };

// UI: Hide signed-in elements
function signedOutUI() { hide('#signed-in'); hide('#sign-out-button'); }

async function setEthAddress(derivation_path) {
  setStatus('Querying your address and balance');
  document.querySelector('#eth-sender').innerHTML = "Deriving...";

  const sender = await deriveEthAddress(derivation_path);

  const balance = await Eth.getBalance(sender);
  setStatus(`Your ETH Address is: ${sender}\n Its balance is ${balance} wei`);
  document.querySelector('#eth-sender').innerHTML = sender;

  derivation = derivation_path;
  eth_sender = sender;
}

// UI: Hide signed-out elements
async function signedInUI() {
  hide('#signed-out');
  hide('#sign-in-button');

  derivation = document.querySelector('#derivation').value;
  eth_receiver = document.querySelector('#receiver').value;
  amount = document.querySelector('#amount').value;

  setEthAddress(derivation)

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

// UI: disable input
function disableInput() {
  document.querySelectorAll('input').forEach(e => e.disabled = true);

}

// UI: enable input
function enableInput() {
  document.querySelectorAll('input').forEach(e => e.disabled = false);
}

let timer = null;
document.querySelector('#derivation').oninput = () => {
  document.querySelector('#eth-sender').innerHTML = "Waiting for you to stop typing...";

  clearTimeout(timer);
  timer = setTimeout(() => {
    setEthAddress(document.querySelector('#derivation').value);
  }, 500);
}
