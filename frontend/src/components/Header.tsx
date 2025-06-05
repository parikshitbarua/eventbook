import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 shadow-sm border-b border-slate-200/50 backdrop-blur-sm">
      <div className="flex justify-between items-center px-8 py-5 max-w-7xl mx-auto">
        <div className="group">
          <p
            className="text-3xl font-extrabold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent 
            transition-all duration-300 group-hover:from-red-600 group-hover:to-red-700 
            transform group-hover:scale-105 inline-block"
          >
            eventbook
          </p>
          <div
            className="h-0.5 w-0 bg-gradient-to-r from-red-500 to-red-600 
            transition-all duration-300 group-hover:w-full mt-0.5"
          ></div>
        </div>

        <div className="flex gap-4">
          <button
            className="h-[42px] px-6 bg-[#e43635] text-white 
            font-medium rounded-full shadow-sm
            transition-all duration-300 hover:bg-[#d12f2e]
            border border-[#e43635]/10 flex items-center"
          >
            <Link to={'/new-event'}>New Event</Link>
          </button>
          <appkit-button />
        </div>
      </div>
    </div>
  );
};

export default Header;
