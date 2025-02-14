import { useWalletSelector } from '@near-wallet-selector/react-hook';
import Logo from '../assets/logo-black.svg';

const Navbar = () => {
  const { signIn,signOut, signedAccountId } =useWalletSelector();

  return (
    <nav className='navbar navbar-expand-lg bg-primary" data-bs-theme="light'>
      <div className='container-fluid navbar-expand-lg text-center'>
        <img src={Logo} alt='NEAR Logo' height="50" />
        <h1 className='text-center'>NEAR Multi-Chain Demo</h1>
        <div className='navbar-nav pt-1'>
          {signedAccountId ? (
            <div className='d-flex flex-column align-items-center'>
              <button className='btn btn-outline-danger' onClick={signOut}>
                Logout
              </button>
              <small className='text-black-50'>{signedAccountId}</small>
            </div>
          ) : (
            <button className='btn btn-outline-primary' onClick={signIn}>
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
