import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import NewEvent from './pages/NewEvent.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/new-event',
        element: <NewEvent />,
      },
    ],
  },
]);

export default router;
