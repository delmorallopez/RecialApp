import logo from './logo.svg';
import './App.css';
import './index.css';
import imageDasboardMain from './Images/imageDashboardMain.jpg'
import imageCustomersMain from './Images/imageCustomersMain.jpg'
import imageSuppliersMain from './Images/imageSuppliersMain.jpg'

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import SideBar from './SideBar'
import Map from './Map'


const router = createBrowserRouter([
  {
    path: "/home",
    element: <Home />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/customers",
    element: <Customers />,
  },
  {
    path: "/suppliers",
    element: <Suppliers />,
  },
  {
    path: "/receipts",
    element: <Receipts />,
  },
  {
    path: "/dispatches",
    element: <Dispatches />,
  },
  {
    path: "/entrances",
    element: <Entrances />,
  },
  {
    path: "/map",
    element: <Map />,
  },
  {
    path: "/reports",
    element: <Reports />,
  },
  {
    path: "/settings",
    element: <Settings />,
  },
  {
    path: "/",
    element: <Home />,
  }
]);

function App() {
  return (
    <div className="App">
      <body>
        <div class="app">
          <div class="menu-toggle">
            <div class="hamburger">
              <span></span>
            </div>
          </div>

          <SideBar />

          <main class="content">
            <RouterProvider router={router} />
          </main>
        </div>

        {/* <script>
          const menu_toggle = document.querySelector('.menu-toggle');
          const sidebar = document.querySelector('.sidebar');

          menu_toggle.addEventListener('click', () => {
                  menu_toggle.classList.toggle('is-active');
                sidebar.classList.toggle('is-active');
          });
        </script> */}
      </body>
    </div>
  );
}

function Home() {
  return <>
    <h1>Reciclajes Recial</h1>
    <p>Web-based Application React in Progress</p>
  </>;
}

function Dashboard() {
  return <h2 class="contentinprogress"><img class="imagedashboardmain" src={imageDasboardMain} /> Web-based Application React in Progress    DASHBOARD</h2>;  
}

function Customers() {
  return <h2 class="contentinprogress"><img class="imagecustomersmain" src={imageCustomersMain} />Web-based Application React in Progress    CUSTOMERS</h2>;
}
function Suppliers() {
  return <h2 class="contentinprogress"><img class="imagesuppliersmain" src={imageSuppliersMain} />Web-based Application React in Progress    SUPPLIERS</h2>;
}
function Receipts() {
  return <h2 class="contentinprogress">Web-based Application React in Progress    RECEIPTS</h2>;
}
function Dispatches() {
  return <h2 class="contentinprogress">Web-based Application React in Progress    DISPATCHES</h2>;
}

function Entrances() {
  return <h2 class="contentinprogress">Web-based Application React in Progress    ENTRANCES</h2>;
}
function Reports() {

  return <h2 class="contentinprogress">Web-based Application React in Progress    REPORTS</h2>;
}
function Settings() {
  return <h2 class="contentinprogress">Web-based Application React in Progress    SETTINGS</h2>;
}


export default App;
