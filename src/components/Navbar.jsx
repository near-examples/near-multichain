/**
 * NAVIGATION BAR COMPONENT
 * 
 * This component demonstrates how to integrate NEAR wallet functionality
 * into a React application. It provides:
 * - Wallet connection/disconnection controls
 * - Display of connected account information
 * - Consistent navigation across the application
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - NEAR Wallet Selector integration
 * - Conditional rendering based on authentication state
 * - User experience patterns for Web3 applications
 */

import { useWalletSelector } from '@near-wallet-selector/react-hook';
import Logo from '../assets/logo-black.svg';

const Navbar = () => {
  /**
   * NEAR WALLET INTEGRATION
   * 
   * The useWalletSelector hook provides access to:
   * - signIn: Function to initiate wallet connection flow
   * - signOut: Function to disconnect the current wallet
   * - signedAccountId: The currently connected NEAR account ID (null if not connected)
   * 
   * This hook manages the entire wallet connection state and provides
   * a consistent interface regardless of which wallet the user chooses
   * (NEAR Wallet, MyNearWallet, Sender, etc.)
   */
  const { signIn, signOut, signedAccountId } = useWalletSelector();

  return (
    /**
     * BOOTSTRAP NAVBAR STRUCTURE
     * 
     * Using Bootstrap classes for responsive design:
     * - navbar: Base navbar styling
     * - navbar-expand-lg: Responsive behavior (collapses on small screens)
     * - bg-primary: Primary theme color background
     * - container-fluid: Full-width container
     */
    <nav className='navbar navbar-expand-lg bg-primary" data-bs-theme="light'>
      <div className='container-fluid navbar-expand-lg text-center'>
        
        {/* APPLICATION BRANDING */}
        <img src={Logo} alt='NEAR Logo' height="50" />
        <h1 className='text-center'>NEAR Multi-Chain Demo</h1>
        
        {/* WALLET CONNECTION CONTROLS */}
        <div className='navbar-nav pt-1'>
          {signedAccountId ? (
            /**
             * AUTHENTICATED STATE
             * 
             * When a user is connected, we show:
             * - A logout button for disconnecting
             * - The connected account ID for reference
             * 
             * This provides clear feedback about the current connection state
             * and allows users to easily disconnect if needed.
             */
            <div className='d-flex flex-column align-items-center'>
              <button className='btn btn-outline-danger' onClick={signOut}>
                Logout
              </button>
              <small className='text-black-50'>{signedAccountId}</small>
            </div>
          ) : (
            /**
             * UNAUTHENTICATED STATE
             * 
             * When no wallet is connected, we show a login button.
             * Clicking this will trigger the wallet selector modal,
             * allowing users to choose from available wallet options.
             * 
             * The signIn function handles:
             * - Displaying available wallet options
             * - Managing the connection flow
             * - Redirecting back to the application after connection
             */
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
