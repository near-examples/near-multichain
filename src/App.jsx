import { NearContext } from './context';

import { useEffect, useState } from "react";
import Navbar from "./components/Navbar"
import { Wallet } from "./services/near-wallet";
import { EthereumView } from "./components/Ethereum";
import { BitcoinView } from "./components/Bitcoin";
import {nearAccountFromEnv} from "./web3/utils.js";

// CONSTANTS
export const MPC_CONTRACT = 'v2.multichain-mpc.testnet';
export const FAUCET_CONTRACT = 'faucetofnear.testnet';

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });
// const faucet_wallet = new Wallet({ network: 'testnet', createAccessKeyFor: FAUCET_CONTRACT });

export const drop = 0.1;

function App() {
  const [signedAccountId, setSignedAccountId] = useState('');
  const [status, setStatus] = useState("Please login to request a signature");
  const [chain, setChain] = useState('eth');
  const [nearAccount, setNearAccount] = useState(null);

  useEffect(() => {
      wallet.startUp(setSignedAccountId);
      nearAccountFromEnv().then(({account}) => {
          setNearAccount(account);
      })
  }, []);

    return (
        <NearContext.Provider value={{ wallet, signedAccountId }}>
          <Navbar />
            <div> good bye </div>
          <div className="container">
            <h4> 🔗 NEAR Multi Chain </h4>
            <p className="small">
              Safely control accounts on other chains through the NEAR MPC service. Learn more in the <a href="https://docs.near.org/abstraction/chain-signatures"> <b>documentation</b></a>.
            </p>

            {
                <div style={{ width: '50%', minWidth: '400px' }}>
                    <div>Hello World!</div>
                  <div className="input-group input-group-sm mt-3 mb-3">
                    <input className="form-control text-center" type="text" value={`MPC Contract: ${MPC_CONTRACT}`} disabled />
                  </div>

                  <div className="input-group input-group-sm my-2 mb-4">
                    <span className="text-primary input-group-text" id="chain">Chain</span>
                    <select className="form-select" aria-describedby="chain" value={chain} onChange={e => setChain(e.target.value)} >
                      <option value="eth"> Ξ Ethereum </option>
                      <option value="btc"> ₿ BTC </option>
                    </select>
                  </div>

                  {chain === 'eth' && <EthereumView props={{ setStatus, nearAccount: nearAccount }} />}
                  {chain === 'btc' && <BitcoinView props={{ setStatus, nearAccount: nearAccount }} />}
                </div>
            }

            <div className="mt-3 small text-center">
              {status}
            </div>
          </div>
        </NearContext.Provider>
    )
}

export default App
