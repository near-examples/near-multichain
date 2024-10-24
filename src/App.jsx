import { useEffect, useState } from 'react';
import { NearContext } from './context';
import { Wallet } from './services/near-wallet';
import Navbar from './components/Navbar';
import { EthereumView } from './components/Ethereum/Ethereum';
import { BitcoinView } from './components/Bitcoin';

// CONSTANTS
const MPC_CONTRACT = 'v1.signer-prod.testnet';

// NEAR WALLET CONNECTION
const wallet = new Wallet({ network: 'testnet' });

function App() {
  const [signedAccountId, setSignedAccountId] = useState('');
  const [status, setStatus] = useState('Please login to request a signature');
  const [chain, setChain] = useState('eth');

  useEffect(() => {
    wallet.startUp(setSignedAccountId);
  }, []);

  return (
    <NearContext.Provider value={{ wallet, signedAccountId }}>
      <Navbar />
      <div className='container text-light d-flex flex-column justify-content-center align-items-center vh-100'>
        <h3 className='text-center'> NEAR Multi-Chain Demo</h3>
        <h5 className='text-center'>powered by Chain Signatures</h5>
        <p className='text-center small'>
          Safely control accounts on other chains using Chain Signatures MPC
          service.
          <br />
          Learn more in the{' '}
          <a
            href='https://docs.near.org/abstraction/chain-signatures'
            className='text-info'
          >
            <b>documentation</b>
          </a>
          .
        </p>

        {signedAccountId && (
          <div style={{ width: '50%', minWidth: '400px' }}>
            <div className='input-group input-group-sm mt-3 mb-3'>
              <span className='input-group-text' id='chain'>
                Chain Signatures Contract ID
              </span>
              <input
                className='form-control text-center bg-dark text-light'
                type='text'
                value={`${MPC_CONTRACT}`}
                disabled
              />
            </div>

            <div className='input-group input-group-sm my-2 mb-4'>
              <span className='input-group-text' id='chain'>
                Chain
              </span>
              <select
                className='form-select bg-dark text-light'
                aria-describedby='chain'
                value={chain}
                onChange={(e) => setChain(e.target.value)}
              >
                <option value='eth'> Ξ Ethereum </option>
                <option value='btc'> ₿ BTC </option>
              </select>
            </div>

            {chain === 'eth' && (
              <EthereumView props={{ setStatus, MPC_CONTRACT }} />
            )}
            {chain === 'btc' && (
              <BitcoinView props={{ setStatus, MPC_CONTRACT }} />
            )}
          </div>
        )}

        <div className='mt-3 small text-center text-warning'>{status}</div>

        <div
          style={{
            padding: '10px',
            margin: '10px',
            backgroundColor: '#FFC10780',
            borderRadius: '5px',
            fontSize: '15px',
          }}
        >
          ⚠️ Warning: Minimum deposit is used. MPC congestion may cause
          transaction failure. See documentation for details.
        </div>
      </div>
    </NearContext.Provider>
  );
}

export default App;
