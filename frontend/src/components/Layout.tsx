import Header from "./Header";
import { Outlet } from "react-router";

const Body = () => {
    return (
        <div>
            <Header />
            <Outlet />
            {/*<ToastContainer />*/}
        </div>
    )
}

export default Body;