import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useState, useRef, useEffect } from 'react';
import { UserCircleIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/theme.hook.ts';

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

  return (
    <div
      className={`${
        isDark
          ? 'bg-black/80 border-white/10'
          : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200/50'
      } shadow-sm border-b backdrop-blur-sm z-[100] sticky top-0 transition-colors duration-300`}
    >
      <div className="flex justify-between items-center px-8 py-5 max-w-7xl mx-auto">
        <div className="group">
          <Link to="/home">
            <p
              className="text-3xl font-extrabold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent
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

        <div className="flex gap-4 items-center">
          <button
            className="h-[42px] px-6 bg-[#e43635] text-white 
            font-medium rounded-full shadow-sm
            transition-all duration-300 hover:bg-[#d12f2e]
            border border-[#e43635]/10 flex items-center"
          >
            <Link to={'/new-event'}>New Event</Link>
          </button>
          <appkit-button />

          {isConnected && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`p-2 ${
                  isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                } rounded-full transition-colors duration-200`}
              >
                <UserCircleIcon
                  className={`h-6 w-6 ${
                    isDark ? 'text-white/70' : 'text-slate-600'
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div
                  className={`absolute right-0 mt-2 w-48 ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 shadow-lg shadow-black/50'
                      : 'bg-white border-slate-200 shadow-lg'
                  } rounded-lg py-1 z-[101] border transition-colors duration-300`}
                >
                  <Link
                    to="profile/my-events"
                    className={`block px-4 py-2 text-sm ${
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
                    className={`block px-4 py-2 text-sm ${
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
                    className={`w-full flex items-center px-4 py-2 text-sm ${
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
