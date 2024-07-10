import { useState, useEffect, useContext } from "react";
import { NearContext } from "../context";

import { NFTClass } from "../services/NFT";
import PropTypes from 'prop-types';

export function NFTView({ props: { NFT_CONTRACT } }) {
  const { wallet, signedAccountId, tokenId, setTokenId } = useContext(NearContext);
  const CK = new NFTClass();

  const [NFTs, setNFTs] = useState([]);

  useEffect(() => {
    getNFTs();
  }, []);

  async function getNFTs() {
    try {
      const NFTList = await CK.get_NFTs(wallet, NFT_CONTRACT, signedAccountId);
      setNFTs(NFTList);
    } catch (error) {
      console.error("Failed to fetch NFTs:", error);
    }
  }

  async function mintNFT() {
    try {
      await CK.mint_NFT(wallet, NFT_CONTRACT);
    } catch (error) {
      console.error("Failed to mint NFT:", error);
    }

    getNFTs();
  }


  return (
    <>
    
      <div className="input-group input-group-sm mb-2">
          <span className="text-primary input-group-text" id="NFT">NFT</span>
          <select className="form-select" aria-describedby="NFT" value={tokenId} onChange={e => setTokenId(e.target.value)} >
            <option value="" disabled>Select NFT</option>
            {NFTs.map((NFT) => (
              <option key={NFT} value={NFT}>
                {NFT}
              </option>
            ))}
          </select>
      </div>
            
      <div className="container mb-4">
          <button className="btn btn-primary btn-sm" style={{ width: '200px' }} onClick={() => mintNFT()}>Mint new NFT</button>
      </div>

    </>

  )
}

NFTView.propTypes = {
  props: PropTypes.shape({
    NFT_CONTRACT: PropTypes.string.isRequired,
  }).isRequired
};
