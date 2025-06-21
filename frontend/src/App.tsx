import { RouterProvider } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter } from './config/wallet.config.tsx';
import { ThemeProvider } from './contexts/ThemeContext';
import router from './routes';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default App;
