import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useState, useRef, useEffect } from 'react';
import { UserCircleIcon, SunIcon, MoonIcon, WalletIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/theme.hook.ts';
import { appKit } from '../config/wallet.config.tsx';
import { v4 as uuidv4 } from 'uuid';
import API_ENDPOINTS from '../config/api.config.ts';
import { colors } from '../config/global.themes';

const Header = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
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

  useEffect(() => {
    if (isConnected && address) {
      // Get or generate user_id from localStorage
      let userId = localStorage.getItem('eventchain_user_id');
      if (!userId) {
        userId = uuidv4();
        localStorage.setItem('eventchain_user_id', userId);
      }

      // Update user with wallet address (upsert only, no event tracking)
      const updateUserWalletAddress = async () => {
        try {
          const response = await fetch(API_ENDPOINTS.ADD_USER, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              wallet_address: address,
              // No event tracking data here - just user upsert
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('User wallet address updated successfully:', result);
          } else {
            console.error('Failed to update user wallet address:', response.statusText);
          }
        } catch (error) {
          console.error('Error updating user wallet address:', error);
        }
      };

      updateUserWalletAddress();
    }
  }, [isConnected, address]);

    const trackWalletButtonClick = async () => {
    // Get or generate user_id from localStorage
    let userId = localStorage.getItem('eventchain_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('eventchain_user_id', userId);
    }

    const payload = JSON.stringify({
      user_id: userId,
      event_type: 'button_click',
      event_name: 'wallet_connect_button_click',
      event_data: {
        button_location: 'header_dropdown',
        timestamp: new Date().toISOString(),
        connection_method: 'header_wallet_button',
      },
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });

    fetch(API_ENDPOINTS.ADD_EVENT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .then(data => {
        console.log('🎉 Success response:', data);
      })
      .catch(error => {
        console.error('💥 Error tracking wallet connect button click:', error);
      });
  };

  const trackCreateButtonClick = () => {
    // Get or generate user_id from localStorage
    let userId = localStorage.getItem('eventchain_user_id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('eventchain_user_id', userId);
    }

    const payload = JSON.stringify({
      user_id: userId,
      event_type: 'button_click',
      event_name: 'new_event_button_click',
      event_data: {
        button_location: 'header_navigation',
        timestamp: new Date().toISOString(),
      },
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });

    // Use sendBeacon for reliable tracking during navigation
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(API_ENDPOINTS.ADD_EVENT, blob);
      if (success) {
        console.log('Create button click tracked successfully');
      } else {
        console.error('Failed to track create button click');
      }
    } else {
      // Fallback for browsers that don't support sendBeacon
      fetch(API_ENDPOINTS.ADD_EVENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      }).catch(error => {
        console.error('Error tracking create button click:', error);
      });
    }
  };

  const handleConnectWallet = async () => {
    setIsDropdownOpen(false);

    // Track the button click
    await trackWalletButtonClick();
    
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

  const handleCreateClick = () => {
    // Track the button click
    trackCreateButtonClick();
    
    // Navigate to new event page
    navigate('/new-event');
  };

  return (
    <div
      className={`${
        isDark
          ? 'bg-zinc-900/95 border-zinc-700/50'
          : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200/50'
      } shadow-sm border-b backdrop-blur-sm z-[100] sticky top-0 transition-colors duration-300`}
    >
      <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 max-w-7xl mx-auto">
        <div className="group">
          <Link to="/home">
            <p
              className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-clip-text text-transparent
            transition-all duration-300 transform group-hover:scale-105 inline-block"
              style={{
                backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${colors.primaryHover}, #3A1F6B)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`;
              }}
            >
              eventChain
            </p>
          </Link>
          <div
            className="h-0.5 w-0 transition-all duration-300 group-hover:w-full mt-0.5"
            style={{
              backgroundImage: `linear-gradient(to right, ${colors.primary}, ${colors.primaryHover})`,
            }}
          ></div>
        </div>

        <div className={`flex items-center ${isConnected ? 'gap-1.5 sm:gap-2 lg:gap-3' : 'gap-2 sm:gap-3 lg:gap-4'}`}>
          
          {/* Wallet address - always visible, but will be styled for different states */}
          <div
              className={`${isConnected ? 'scale-75 sm:scale-85 lg:scale-95' : 'scale-90 sm:scale-95 lg:scale-100'}`}
              onClick={handleConnectWallet}
          >
            <appkit-button />
          </div>

          {/* Create Event Button - positioned between wallet and profile */}
          <button
            onClick={handleCreateClick}
            className={`flex items-center gap-1 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2 text-xs sm:text-sm lg:text-base font-medium transition-all duration-200 rounded-xl text-white transform hover:scale-105 shadow-sm hover:shadow-md`}
            style={{
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              border: '1px solid',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.primaryHover;
              e.currentTarget.style.borderColor = colors.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary;
              e.currentTarget.style.borderColor = colors.primary;
            }}
          >
            <PlusIcon className="h-2 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
            <span className="hidden sm:inline">Create</span>
          </button>

          <div className="relative ml-1 sm:ml-2" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="p-1 sm:p-1.5 lg:p-2 rounded-full transition-all duration-200 transform hover:scale-105"
              style={{
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#374151',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.primary}15`;
                e.currentTarget.style.color = colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : '#374151';
              }}
            >
              <UserCircleIcon
                className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 transition-colors duration-200"
                style={{ color: 'inherit' }}
              />
            </button>

            {isDropdownOpen && (
              <div
                className={`absolute right-0 mt-2 w-40 sm:w-44 lg:w-48 ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 shadow-lg shadow-black/50'
                    : 'bg-white border-slate-200 shadow-lg'
                } rounded-lg py-1 z-[101] border transition-colors duration-300`}
              >
                {/* Wallet Option - Always Visible */}
                <button
                  onClick={handleConnectWallet}
                  className={`w-full flex items-center px-3 sm:px-4 py-2 text-sm transition-all duration-200 rounded-lg mx-1`}
                  style={{
                    color: isDark ? 'white' : '#374151',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.primary}15`;
                    e.currentTarget.style.color = colors.primary;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isDark ? 'white' : '#374151';
                    e.currentTarget.style.transform = 'translateX(0px)';
                  }}
                >
                  <WalletIcon 
                    className="h-4 w-4 mr-2 transition-colors duration-200" 
                    style={{ color: 'inherit' }}
                  />
                  Wallet
                </button>
                <hr
                  className={`my-1 ${
                    isDark ? 'border-zinc-700' : 'border-slate-200'
                  }`}
                />

                <Link
                  to="profile/my-events"
                  className="block px-3 sm:px-4 py-2 text-sm transition-all duration-200 rounded-lg mx-1"
                  style={{
                    color: isDark ? 'white' : '#374151',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.primary}15`;
                    e.currentTarget.style.color = colors.primary;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isDark ? 'white' : '#374151';
                    e.currentTarget.style.transform = 'translateX(0px)';
                  }}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  My Events
                </Link>
                <Link
                  to="profile/my-tickets"
                  className="block px-3 sm:px-4 py-2 text-sm transition-all duration-200 rounded-lg mx-1"
                  style={{
                    color: isDark ? 'white' : '#374151',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.primary}15`;
                    e.currentTarget.style.color = colors.primary;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isDark ? 'white' : '#374151';
                    e.currentTarget.style.transform = 'translateX(0px)';
                  }}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  My Tickets
                </Link>
                <hr
                  className={`my-1 ${
                    isDark ? 'border-zinc-700' : 'border-slate-200'
                  }`}
                />
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center px-3 sm:px-4 py-2 text-sm transition-all duration-200 rounded-lg mx-1"
                  style={{
                    color: isDark ? 'white' : '#374151',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.primary}15`;
                    e.currentTarget.style.color = colors.primary;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isDark ? 'white' : '#374151';
                    e.currentTarget.style.transform = 'translateX(0px)';
                  }}
                >
                  {isDark ? (
                    <>
                      <SunIcon className="h-4 w-4 mr-2 transition-colors duration-200" style={{ color: 'inherit' }} />
                      Light Theme
                    </>
                  ) : (
                    <>
                      <MoonIcon className="h-4 w-4 mr-2 transition-colors duration-200" style={{ color: 'inherit' }} />
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
