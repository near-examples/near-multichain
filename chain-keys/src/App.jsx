import { NearContext } from './context';

import { useEffect, useState } from "react";
import Navbar from "./components/Navbar"
import { Wallet } from "./services/near-wallet";
import { NFTView } from "./components/NFT";
import { EthereumView } from "./components/Ethereum";

// CONSTANTS
const NFT_CONTRACT = 'v2.nft.kagi.testnet';

// NEAR WALLET
const wallet = new Wallet({ network: 'testnet', createAccessKeyFor: NFT_CONTRACT });

function App() {
  const [signedAccountId, setSignedAccountId] = useState('');
  const [status, setStatus] = useState("Please login to request a signature");
  const [tokenId, setTokenId] = useState('');
  const [transactionHash, setTransactionHash] = useState('');

  useEffect(() => { 
    wallet.startUp(setSignedAccountId) 
  }, []);

  useEffect(() => {
    if (signedAccountId && tokenId == '') {
      setStatus("Please select a NFT");
    } else if (! signedAccountId) {
      setStatus("Please login to request a signature");
    }
  }, [signedAccountId]);
  

  useEffect(() => {
    // Get transaction hash from URL when using web wallet
    const getTransactionHashFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = urlParams.get('transactionHashes');
      setTransactionHash(hash);
    };

    getTransactionHashFromUrl();
  }, []);

  return (
    <NearContext.Provider value={{ wallet, signedAccountId, tokenId, setTokenId }}>
      <Navbar />
      <div className="container">
        <h4> 🔗 Ethereum NFT accounts </h4>
        <p className="small">
          Send Ethereum transactions through NFT Chain Keys. Learn more in the <a href="https://docs.near.org/build/chain-abstraction/nft-chain-keys"> <b>documentation</b></a>.
        </p>

        {signedAccountId &&
          <div style={{ width: '50%', minWidth: '400px' }}>
            
            <div className="input-group input-group-sm mt-3 mb-4">
              <input className="form-control text-center" type="text" value={`NFT Chain Keys Contract: ${NFT_CONTRACT}`} disabled />
            </div>

            <NFTView props={{ NFT_CONTRACT }} />

            <EthereumView props={{ setStatus, NFT_CONTRACT, transactionHash }} />
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
