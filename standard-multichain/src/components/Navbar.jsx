import { useContext } from "react";
import { NearContext } from "../context";

import logo from "/logo-black.svg";

const Navbar = () => {
  const { wallet, signedAccountId } = useContext(NearContext);

  const signIn = () => { wallet.signIn() }

  const signOut = () => { wallet.signOut() }

  return (<nav className="navbar">
    <div className="container-fluid navbar-expand-lg">
      <a href="/"><img src={logo} alt="Near" height="40" className="d-inline-block align-text-top" /></a>
      <div className='navbar-nav pt-1'>
        {signedAccountId
          ? <button className="btn btn-secondary" onClick={signOut}>Logout {signedAccountId}</button>
          : <button className="btn btn-secondary" onClick={signIn}>Login</button>
        }
      </div>
    </div>
  </nav>)
}

export default Navbar