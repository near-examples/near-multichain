import PropTypes from "prop-types";

import aptImg from "../assets/crypto/apt.png";
import arbImg from "../assets/crypto/arb.png";
import avaxImg from "../assets/crypto/avax.png";
import baseImg from "../assets/crypto/base.png";
import bnbImg from "../assets/crypto/bnb.png";
import btcImg from "../assets/crypto/btc.png";
import ethImg from "../assets/crypto/eth.png";
import polImg from "../assets/crypto/pol.png";
import solImg from "../assets/crypto/sol.png";
import suiImg from "../assets/crypto/sui.png";
import xrpImg from "../assets/crypto/xrp.png";

const iconMapping = {
  aptos: aptImg,
  arbitrum: arbImg,
  avalanche: avaxImg,
  base: baseImg,
  binance: bnbImg,
  bitcoin: btcImg,
  ethereum: ethImg,
  polygon: polImg,
  solana: solImg,
  sui: suiImg,
  xrp: xrpImg,
};

const ChainIcon = ({ iconSlug, alt }) => {
  const imageSrc = iconMapping[iconSlug];

  return (
    <img
      height="32"
      width="32"
      src={imageSrc}
      alt={alt}
      style={{ marginRight: "8px" }}
    />
  );
};

ChainIcon.propTypes = {
  iconSlug: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

export default ChainIcon;
