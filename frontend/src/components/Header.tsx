const Header = () => {
    return (
        <div className="bg-slate-100 shadow-md border-b border-slate-200">
            <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
                <p className="text-3xl font-bold text-blue-600 transition duration-200">
                    eventbook
                </p>

                <div className="flex">
                    <button className="px-5 py-2 bg-blue-500 text-white font-medium rounded-xl shadow hover:bg-blue-600 transition duration-200">
                        Create +
                    </button>
                    <div
                        className="ml-2 text-blue-600 font-medium rounded-xl hover:bg-gray-100 transition duration-200 cursor-pointer p-4 h-auto">
                        Login
                    </div>
                </div>
            </div>
        </div>
    );

}

export default Header;