import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import NewEventPage from './pages/NewEventPage.tsx';
import HomePage from './pages/HomePage.tsx';
import AddTicketsPage from './pages/AddTicketsPage.tsx';
import EventDetailsPage from './pages/EventDetailsPage.tsx';
import MyEvents from './pages/MyEvents.tsx';
import MyTickets from './pages/MyTickets.tsx';
import LandingPage from './pages/LandingPage.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/home',
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
      {
        path: '/event/:eventId',
        element: <EventDetailsPage />,
      },
      {
        path: '/profile/my-events',
        element: <MyEvents />,
      },
      {
        path: '/profile/my-tickets',
        element: <MyTickets />,
      },
    ],
  },
]);

export default router;
