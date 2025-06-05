import { useState, useMemo } from 'react';
import Select from 'react-select';

import Navbar from './components/Navbar';
import { EVMView } from './components/EVM/EVM';
import { BitcoinView } from './components/Bitcoin';
import { MPC_CONTRACT, NetworksEVM } from './config';
import { useWalletSelector } from '@near-wallet-selector/react-hook';
import { SolanaView } from './components/Solana';

function App() {
  const { signedAccountId } = useWalletSelector();
  const [status, setStatus] = useState('Please login to request a signature');
  const [chain, setChain] = useState('ETH');

  const selectedNetwork = useMemo(
    () => NetworksEVM.find(n => n.token === chain),
    [chain]
  );

  const chainOptions = [
    {
      label: 'EVM',
      options: NetworksEVM.map((network) => ({
        value: network.token,
        label: `Ξ ${network.network}`,
      })),
    },
    {
      label: 'Otros',
      options: [
        { value: 'btc', label: '₿ BTC' },
        { value: 'sol', label: '🪙 Solana' },
      ],
    },
  ];

  return (
    <>
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
                <div className="flex-grow-1">
                  <Select
                    options={chainOptions}
                    value={
                      chainOptions
                        .flatMap(group => group.options)
                        .find(opt => opt.value === chain)
                    }
                    onChange={opt => setChain(opt.value)}
                    isOptionDisabled={opt => opt.isDisabled}
                  />
                </div>
              </div>

              {(selectedNetwork) && (
                <EVMView key={chain} props={{
                  setStatus,
                  network: selectedNetwork
                }} />
              )}
              {chain === 'btc' && (
                <BitcoinView props={{setStatus}} />
              )}
              {chain === 'sol' && (
                <SolanaView props={{setStatus}}></SolanaView>
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
    </>
  );
}

export default App;
