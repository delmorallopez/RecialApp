import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { useState } from "react";

import SideBar from "./components/SideBar";
import Dashboard from "./pages/dashboard";
import Customers from "./pages/customers";
import Suppliers from "./pages/suppliers";
import Receipts from "./pages/receipts";
import Dispatches from "./pages/dispatches";
import Entrances from "./pages/entrances";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import Home from "./pages/home";
import Map from "./Map";


function App() {
  const [isActive, setIsActive] = useState(false);

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout isActive={isActive} setIsActive={setIsActive} />,
      children: [
        { path: "/", element: <Home /> },
        { path: "home", element: <Home /> },
        { path: "dashboard", element: <Dashboard /> },
        { path: "customers", element: <Customers /> },
        { path: "suppliers", element: <Suppliers /> },
        { path: "receipts", element: <Receipts /> },
        { path: "dispatches", element: <Dispatches /> },
        { path: "entrances", element: <Entrances /> },
        { path: "map", element: <Map /> },
        { path: "reports", element: <Reports /> },
        { path: "settings", element: <Settings /> },
      ]
    }
  ]);
  
  return (
    <RouterProvider router={router} />
  );
}

function Layout({ isActive, setIsActive }) {
  return (
    <div className="app">
      
      <div 
        className={`menu-toggle ${isActive ? "is-active" : ""}`}
        onClick={() => setIsActive(!isActive)}
      >
        <div className="hamburger">
          <span></span>
        </div>
      </div>

      <SideBar isActive={isActive} />

      <main className="content">
        <Outlet />
      </main>

    </div>
  );
}
export default App;
