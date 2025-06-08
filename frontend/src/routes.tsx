import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import NewEventPage from './pages/NewEventPage.tsx';
import HomePage from './pages/HomePage.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/new-event',
        element: <NewEventPage />,
      },
    ],
  },
]);

export default router;
