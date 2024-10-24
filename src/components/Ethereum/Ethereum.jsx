import { useState, useEffect, useContext, useRef } from 'react';
import PropTypes from 'prop-types';

import { NearContext } from '../../context';
import { Ethereum } from '../../services/ethereum';
import { useDebounce } from '../../hooks/debounce';
import { getTransactionHashes } from '../../services/utils';
import { TransferForm } from './Transfer';
import { FunctionCallForm } from './FunctionCall';

const SEPOLIA = 11155111;
const Eth = new Ethereum('https://rpc2.sepolia.org', SEPOLIA);
const sepoliaGasPrice = await Eth.fetchSepoliaGasPrice();

export function EthereumView({ props: { setStatus, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(
    getTransactionHashes() ? 'relay' : 'request'
  );
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderLabel, setSenderLabel] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [balance, setBalance] = useState(''); // Add balance state
  const [action, setAction] = useState('transfer');
  const [derivation, setDerivation] = useState(
    sessionStorage.getItem('derivation') || 'ethereum-1'
  );
  const [reloaded, setReloaded] = useState(!!getTransactionHashes().length);

  const derivationPath = useDebounce(derivation, 1200);
  const childRef = useRef();

  // Handle signing transaction when the page is reloaded and senderAddress is set
  useEffect(() => {
    if (reloaded && senderAddress) {
      signTransaction();
    }

    async function signTransaction() {
      const { big_r, s, recovery_id } = await wallet.getTransactionResult(
        getTransactionHashes()[0]
      );
      const signedTx = await Eth.reconstructSignatureFromLocalSession(
        big_r,
        s,
        recovery_id,
        senderAddress
      );
      setSignedTransaction(signedTx);
      setStatus(
        '✅ Signed payload ready to be relayed to the Ethereum network'
      );
      setStep('relay');
      setReloaded(false);
      removeUrlParams();
    }
  }, [senderAddress, reloaded, wallet]);

  // Handle changes to derivation path and query Ethereum address and balance
  useEffect(() => {
    resetAddressState();
    fetchEthereumAddress();
  }, [derivationPath, signedAccountId]);

  const resetAddressState = () => {
    setSenderLabel('Waiting for you to stop typing...');
    setSenderAddress(null);
    setStatus('');
    setBalance(''); // Reset balance when derivation path changes
    setStep('request');
  };

  const fetchEthereumAddress = async () => {
    const { address } = await Eth.deriveAddress(
      signedAccountId,
      derivationPath
    );
    setSenderAddress(address);
    setSenderLabel(address);

    if (!reloaded) {
      const balance = await Eth.getBalance(address);
      setBalance(balance); // Update balance state
    }
  };

  async function chainSignature() {
    setStatus('🏗️ Creating transaction');

    const { transaction, payload } = await childRef.current.createPayload();

    setStatus(
      `🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`
    );
    try {
      const { big_r, s, recovery_id } = await Eth.requestSignatureToMPC(
        wallet,
        MPC_CONTRACT,
        derivationPath,
        payload,
        transaction,
        senderAddress
      );
      const signedTransaction = await Eth.reconstructSignature(
        big_r,
        s,
        recovery_id,
        transaction,
        senderAddress
      );

      setSignedTransaction(signedTransaction);
      setStatus(
        `✅ Signed payload ready to be relayed to the Ethereum network`
      );
      setStep('relay');
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function relayTransaction() {
    setLoading(true);
    setStatus(
      '🔗 Relaying transaction to the Ethereum network... this might take a while'
    );

    try {
      const txHash = await Eth.relayTransaction(signedTransaction);
      setStatus(
        <>
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target='_blank'>
            {' '}
            ✅ Successful{' '}
          </a>
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
  };

  function removeUrlParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('transactionHashes');
    window.history.replaceState({}, document.title, url);
  }

  return (
    <>
      {/* Form Inputs */}
      <div className='row mb-0'>
        <label className='col-sm-2 col-form-label'></label>
        <div className='col-sm-10'></div>
      </div>

      <div className='input-group input-group-sm my-2 mb-2'>
        <span className='input-group-text bg-info text-white' id='chain'>
          PATH
        </span>
        <input
          type='text'
          className='form-control form-control-sm'
          value={derivation}
          onChange={(e) => setDerivation(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className='row mb-0'>
        <label className='col-sm-2 col-form-label text-end'>Address:</label>
        <div className='col-sm-10 fs-5'>
          <div className='form-text' id='eth-sender'>
            {senderLabel}
          </div>
        </div>
      </div>
      <div className='row mb-0'>
        <label className='col-sm-2 col-form-label text-end'>Balance:</label>
        <div className='col-sm-10 fs-5'>
          <div className='form-text text-muted '>
            {balance ? (
              `${balance} ETH`
            ) : (
              <span className='text-warning'>Fetching balance...</span>
            )}
          </div>
        </div>
      </div>

      <div className='input-group input-group-sm my-2 mb-4'>
        <span className='input-group-text bg-success text-white' id='chain'>
          ACTION
        </span>
        <select
          className='form-select'
          aria-describedby='chain'
          onChange={(e) => setAction(e.target.value)}
          disabled={loading}
        >
          <option value='transfer'>Ξ Transfer</option>
          <option value='function-call'>Ξ Call Counter</option>
        </select>
      </div>

      {action === 'transfer' ? (
        <TransferForm ref={childRef} props={{ Eth, senderAddress, loading }} />
      ) : (
        <FunctionCallForm
          ref={childRef}
          props={{ Eth, senderAddress, loading }}
        />
      )}

      {/* <div className='text-center mt-4 d-flex justify-content-center'>
        <div className='table-responsive' style={{ maxWidth: '400px' }}>
          <table className='table table-bordered table-dark text-center w-auto'>
            <caption className='caption-top text-center text-bg-warning'>
              Sepolia Gas Prices
            </caption>
            <thead>
              <tr>
                <th scope='col'>Price</th>
                <th scope='col'>Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{sepoliaGasPrice[1]}</td> 
                <td>GWEI</td>
              </tr>
              <tr>
                <td>{sepoliaGasPrice[0]}</td> 
                <td>ETH</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div> */}

      {/* Execute Buttons */}
      <div className='d-grid gap-2'>
        {step === 'request' && (
          <button
            className='btn btn-outline-primary text-center btn-lg'
            onClick={UIChainSignature}
            disabled={loading}
          >
            Request Signature
          </button>
        )}
        {step === 'relay' && (
          <button
            className='btn btn-success text-center'
            onClick={relayTransaction}
            disabled={loading}
          >
            Relay Transaction
          </button>
        )}
      </div>
    </>
  );
}

EthereumView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired,
};
