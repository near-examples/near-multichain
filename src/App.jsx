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
        <h2 className='text-center text-white'> NEAR Multi-Chain Demo</h2>
        <figure>
          <blockquote className='blockquote'>
            <p className='mb-0'>
              Securely manage countless accounts across multiple blockchains using a single NEAR account.
            </p>
          </blockquote>
          <figcaption className='blockquote-footer text-center'>
            Powered by {''}
            <a
              href='https://docs.near.org/concepts/abstraction/chain-signatures'
              className='text-info'
            >
              <b>Chain Signatures</b>
            </a>
          </figcaption>
        </figure>

        {signedAccountId && (
          <div
            className='card mb-1'
            style={{ width: '50%', minWidth: '600px' }}
          >
            <div className='card-body'>
              <div className='input-group input-group-sm mt-3 mb-3'>
                <span className='input-group-text' id='chain'>
                  MPC Contract ID
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
                  Destination Chain
                </span>
                <select
                  className='form-select bg-dark text-light text-center'
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
          </div>
        )}

        <div className='mt-3 small text-center text-warning'>{status}</div>

        <div className='alert alert-dismissible alert-info'>
          <h4 className='alert-heading'>⚠️ Heads Up!</h4>
          <ul className='mb-0'>
            <li>Minimum deposit is used.</li>
            <li>MPC congestion may cause transaction failure.</li>
            <li>
              <a href='#' className='alert-link'>
                See documentation for details.
              </a>
            </li>
          </ul>
        </div>

        <div
          style={{
            padding: '10px',
            margin: '10px',
            backgroundColor: '#FFC10780',
            borderRadius: '5px',
            fontSize: '15px',
          }}
        ></div>
      </div>
    </NearContext.Provider>
  );
}

export default App;
