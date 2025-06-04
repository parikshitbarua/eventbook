import { RouterProvider } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from './config/wallet.config.tsx';
import router from './routes';

function App() {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <RouterProvider router={router} />
    </WagmiProvider>
  );
}

export default App;
