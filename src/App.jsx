import { useEffect, useState } from 'react';
import { NearContext } from './context';
import { Wallet } from './services/near-wallet';
import Navbar from './components/Navbar';
import { EVMView } from './components/EVM/EVM';
import { BitcoinView } from './components/Bitcoin';
import { explorerForChain, MPC_CONTRACT, NetworkId, RPCforChain } from './config';

// NEAR WALLET CONNECTION
const wallet = new Wallet({ network: NetworkId });

function App() {
  const [signedAccountId, setSignedAccountId] = useState('');
  const [status, setStatus] = useState('Please login to request a signature');
  const [chain, setChain] = useState('base');

  useEffect(() => {
    wallet.startUp(setSignedAccountId);
  }, []);

  return (
    <NearContext.Provider value={{ wallet, signedAccountId }}>
      <Navbar />
      <div className='container text-light d-flex flex-column justify-content-center align-items-center vh-75'>
        <div className='alert alert-light w-auto text-center'>
          One account controlling endless number of accounts across chains. 🚀
          <br />
          <small className='text-muted'>
            Powered by 👉 {' '}
            <a
              href='https://docs.near.org/concepts/abstraction/chain-signatures'
              className='text-primary'
            >
              <b className='text-info'>Chain Signatures</b>
            </a>
          </small>
        </div>

        {signedAccountId && (
          <div className='card mb-1 w-auto' style={{ minWidth: '35rem' }}>
            <div className='card-body'>
              <div className='input-group input-group-sm mt-3 mb-3'>
                <span
                  className='input-group-text bg-primary text-white'
                  id='chain'
                >
                  MPC Contract ID
                </span>
                <input
                  className='form-control text-center'
                  type='text'
                  value={`${MPC_CONTRACT}`}
                  disabled
                />
              </div>

              <div className='input-group input-group-sm my-2 mb-4'>
                <span
                  className='input-group-text bg-primary text-white'
                  id='chain'
                >
                  Destination Chain
                </span>
                <select
                  className='form-select text-center'
                  aria-describedby='chain'
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                >
                  <option value='eth'> Ξ Ethereum </option>
                  <option value='base'> Ξ Base </option>
                  <option value='btc'> ₿ BTC </option>
                </select>
              </div>

              {(chain === 'eth' || chain === 'base') && (
                <EVMView props={{
                  setStatus,
                  MPC_CONTRACT,
                  rpcUrl: RPCforChain[chain],
                  explorerUrl: explorerForChain[chain],
                  contractAddress: chain === 'base' ? "0xCd3b988b216790C598d9AB85Eee189e446CE526D" : "0xe2a01146FFfC8432497ae49A7a6cBa5B9Abd71A3"
                }} />
              )}
              {chain === 'btc' && (
                <BitcoinView props={{ setStatus, MPC_CONTRACT }} />
              )}
            </div>
          </div>
        )}

        <div className='mt-3 small text-center text-warning'>{status}</div>

        {/* <div className='alert alert-dismissible alert-info'>
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
        </div> */}
      </div>
    </NearContext.Provider>
  );
}

export default App;
