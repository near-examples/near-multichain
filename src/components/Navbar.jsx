import { useContext } from 'react';
import { NearContext } from '../context';

const Navbar = () => {
  const { wallet, signedAccountId } = useContext(NearContext);

  const signIn = () => {
    wallet.signIn();
  };

  const signOut = () => {
    wallet.signOut();
  };

  return (
    <nav className='navbar navbar-expand-lg bg-primary" data-bs-theme="dark'>
      <div className='container-fluid navbar-expand-lg text-center'>
        <image src='https://near.org/wp-content/themes/near-19/assets/img/logo.svg' alt='NEAR Logo' />
        <h3 className='text-white'>NEAR Multi-Chain Demo</h3>
        <div className='navbar-nav pt-1'>
          {signedAccountId ? (
            <div className='d-flex flex-column align-items-center'>
              <button className='btn btn-outline-danger' onClick={signOut}>
                Logout
              </button>
              <small className='text-white-50'>{signedAccountId}</small>
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
