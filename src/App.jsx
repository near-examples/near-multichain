import { useEffect, useState } from "react";
import Navbar from "./components/Navbar"
import { Wallet } from "./services/near-wallet";
import { EthereumView } from "./components/Ethereum";
import { BitcoinView } from "./components/Bitcoin";

// CONSTANTS
const MPC_CONTRACT = 'multichain-testnet-2.testnet';

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: MPC_CONTRACT });

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [status, setStatus] = useState("Please login to request a signature");
  const [chain, setChain] = useState('eth');

  useEffect(() => {
    const initFunction = async () => {
      const isSignedIn = await wallet.startUp();
      setIsSignedIn(isSignedIn);
    }

    initFunction();
  }, []);

  return (
    <>
      <Navbar wallet={wallet} isSignedIn={isSignedIn}></Navbar>
      <div className="container">
        <h4> 🔗 NEAR Multi Chain </h4>
        <p className="small">
          Safely control accounts on other chains through the NEAR MPC service. Learn more in the <a href="https://docs.near.org/abstraction/chain-signatures"> <b>documentation</b></a>.
        </p>

        {isSignedIn &&
          <div style={{ width: '50%', minWidth: '400px' }}>

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

            {chain === 'eth' && <EthereumView props={{ setStatus, wallet, MPC_CONTRACT }} />}
            {chain === 'btc' && <BitcoinView props={{ setStatus, wallet, MPC_CONTRACT }} />}
          </div>
        }

        <div className="mt-3 small text-center">
          <span> {status} </span>
        </div>
      </div>
    </>
  )
}

export default App
