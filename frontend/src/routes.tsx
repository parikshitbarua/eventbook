import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout.tsx";

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
    }
]);

export default router;