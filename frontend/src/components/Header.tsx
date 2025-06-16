import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useState, useRef, useEffect } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';

const Header = () => {
  const { isConnected } = useAccount();
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
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 shadow-sm border-b border-slate-200/50 backdrop-blur-sm z-[100] sticky top-0">
      <div className="flex justify-between items-center px-8 py-5 max-w-7xl mx-auto">
        <div className="group">
          <Link to="/">
            <p
              className="text-3xl font-extrabold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent
            transition-all duration-300 group-hover:from-red-600 group-hover:to-red-700
            transform group-hover:scale-105 inline-block"
            >
              eventbook
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
                className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200"
              >
                <UserCircleIcon className="h-6 w-6 text-slate-600" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-[101] border border-slate-200">
                  <Link
                    to="profile/my-events"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    My Events
                  </Link>
                  <Link
                    to="/my-tickets"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    My Tickets
                  </Link>
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
