import { Wallet } from './near-wallet';
import { Ethereum } from './ethereum';
import * as ethers from 'ethers';
import { sign } from 'crypto';

// CONSTANTS
const TGAS = 1000000000000;
const DERIVATION_PATH = 'ethereum,1';
const MPC_CONTRACT = 'signer.canhazgas.testnet'; // NOT SAFE FOR PRODUCTION

// ETHEREUM
const Sepolia = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', Sepolia);
let eth_sender;
let eth_receiver = '0xe0f3B7e68151E9306727104973752A415c2bcbEb'
let signed_transaction;

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });

async function chainSignature() {
  setStatus('Creating transaction');
  const { transaction, payload } = await Eth.createPayload(eth_sender, eth_receiver);

  setStatus(`Asking ${MPC_CONTRACT} to sign the transaction using account ${eth_sender.slice(0, 8)}..., this might take a while`);
  const { big_r, big_s } = await requestSignature(payload, DERIVATION_PATH);

  setStatus(`Reconstructing & validating signature`);
  const signedTransaction = Eth.reconstructSignature(transaction, big_r, big_s);

  // Validate signature
  if (signedTransaction.getValidationErrors().length > 0) { throw new Error("Transaction validation errors"); }
  if (!signedTransaction.verifySignature()) { throw new Error("Signature is not valid"); }
  if (ethers.utils.hexlify(signedTransaction.getSenderAddress().bytes) !== eth_sender.toLowerCase()) { throw new Error("Sender address does not match"); }

  setStatus(`MPC responded with the signed payload: ${ethers.utils.hexlify(signedTransaction.serialize()).slice(0, 15)}...`);

  // Setup button to relay the transaction
  document.querySelector('#request-button').innerHTML = 'Relay Transaction';
  document.querySelector('#request-button').onclick = () => { relayTransaction(signedTransaction); };
}

async function relayTransaction(signedTransaction) {
  setStatus('Relaying transaction to the Ethereum network');
  const txHash = await Eth.relayTransaction(signedTransaction);
  setStatus(`Transaction relayed to the Ethereum network with hash: ${txHash}`);
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
const txToDisplay = { nonce: 'x', gasLimit: 21000, maxFeePerGas: 'baseFee', maxPriorityFeePerGas: 1, to: eth_receiver, value: '1', chain: Sepolia };

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

  setStatus('Querying your ETH address and balance');

  // Manually derived ETH address, in the future we will implement a contract method:
  //   MPC_CONTRACT.get_foreign_address_for({ path })
  const signingKey = new ethers.utils.SigningKey(
    ethers.utils.sha256(ethers.utils.toUtf8Bytes(wallet.accountId + "," + DERIVATION_PATH))
  );
  eth_sender = ethers.utils.computeAddress(signingKey.privateKey);
  const balance = await Eth.getBalance(eth_sender);
  setStatus(`Your ETH Address is: ${eth_sender}\n Its balance is ${balance} wei`);

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