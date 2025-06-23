import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useState, useRef, useEffect } from 'react';
import { UserCircleIcon, SunIcon, MoonIcon, WalletIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/theme.hook.ts';
import { appKit } from '../config/wallet.config.tsx';

const Header = () => {
  const { isConnected } = useAccount();
  const { isDark, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);





  const handleConnectWallet = () => {
    setIsDropdownOpen(false);
    
    // Use the proper AppKit API to open the modal
    try {
      appKit.open();
    } catch (error) {
      console.error('Failed to open AppKit modal:', error);
      // Fallback to clicking the button if API doesn't work
      setTimeout(() => {
        const appkitButton = document.querySelector('appkit-button') as any;
        if (appkitButton) {
          appkitButton.click();
        }
      }, 100);
    }
  };

  return (
    <div
      className={`${
        isDark
          ? 'bg-black/80 border-white/10'
          : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200/50'
      } shadow-sm border-b backdrop-blur-sm z-[100] sticky top-0 transition-colors duration-300`}
    >
      <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 max-w-7xl mx-auto">
        <div className="group">
          <Link to="/home">
            <p
              className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent
            transition-all duration-300 group-hover:from-red-600 group-hover:to-red-700
            transform group-hover:scale-105 inline-block"
            >
              eventChain
            </p>
          </Link>
          <div
            className="h-0.5 w-0 bg-gradient-to-r from-red-500 to-red-600 
            transition-all duration-300 group-hover:w-full mt-0.5"
          ></div>
        </div>

        <div className={`flex items-center ${isConnected ? 'gap-1.5 sm:gap-2 lg:gap-3' : 'gap-2 sm:gap-3 lg:gap-4'}`}>
          
          
          {/* Wallet address - always visible, but will be styled for different states */}
          <div className={`${isConnected ? 'scale-75 sm:scale-85 lg:scale-95' : 'scale-90 sm:scale-95 lg:scale-100'}`}>
            <appkit-button />
          </div>



          <div className="relative ml-1 sm:ml-2" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`p-1 sm:p-1.5 lg:p-2 ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              } rounded-full transition-colors duration-200`}
            >
              <UserCircleIcon
                className={`h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 ${
                  isDark ? 'text-white/70' : 'text-slate-600'
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div
                className={`absolute right-0 mt-2 w-40 sm:w-44 lg:w-48 ${
                  isDark
                    ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/50'
                    : 'bg-white border-slate-200 shadow-lg'
                } rounded-lg py-1 z-[101] border transition-colors duration-300`}
              >
                {/* Wallet Option - Always Visible */}
                <button
                  onClick={handleConnectWallet}
                  className={`w-full flex items-center px-3 sm:px-4 py-2 text-sm ${
                    isDark
                      ? 'text-white hover:bg-gray-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  } transition-colors duration-200`}
                >
                  <WalletIcon className="h-4 w-4 mr-2" />
                  Wallet
                </button>
                <hr
                  className={`my-1 ${
                    isDark ? 'border-gray-700' : 'border-slate-200'
                  }`}
                />

                <Link
                  to="profile/my-events"
                  className={`block px-3 sm:px-4 py-2 text-sm ${
                    isDark
                      ? 'text-white hover:bg-gray-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  } transition-colors duration-200`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  My Events
                </Link>
                <Link
                  to="profile/my-tickets"
                  className={`block px-3 sm:px-4 py-2 text-sm ${
                    isDark
                      ? 'text-white hover:bg-gray-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  } transition-colors duration-200`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  My Tickets
                </Link>
                <hr
                  className={`my-1 ${
                    isDark ? 'border-gray-700' : 'border-slate-200'
                  }`}
                />
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center px-3 sm:px-4 py-2 text-sm ${
                    isDark
                      ? 'text-white hover:bg-gray-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  } transition-colors duration-200`}
                >
                  {isDark ? (
                    <>
                      <SunIcon className="h-4 w-4 mr-2" />
                      Light Theme
                    </>
                  ) : (
                    <>
                      <MoonIcon className="h-4 w-4 mr-2" />
                      Dark Theme
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
