import { useContext } from 'react';
import { NearContext } from '../context';

import logo from '/logo-black.svg';

const Navbar = () => {
  const { wallet, signedAccountId } = useContext(NearContext);

  const signIn = () => {
    wallet.signIn();
  };

  const signOut = () => {
    wallet.signOut();
  };

  return (
    <nav className='navbar'>
      <div className='container-fluid navbar-expand-lg'>
        <a href='/'>
          <img
            src={logo}
            alt='Near'
            height='40'
            className='d-inline-block align-text-top'
          />
        </a>
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
