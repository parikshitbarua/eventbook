import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import NewEventPage from './pages/NewEventPage.tsx';
import HomePage from './pages/HomePage.tsx';
import AddTicketsPage from './pages/AddTicketsPage.tsx';

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
      {
        path: '/add-tickets',
        element: <AddTicketsPage />,
      },
    ],
  },
]);

export default router;
