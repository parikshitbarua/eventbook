import Header from "./Header";
import { Outlet } from "react-router";

const Layout = () => {
    return (
        <div>
            <Header />
            <Outlet />
            {/*<ToastContainer />*/}
        </div>
    )
}

export default Layout;