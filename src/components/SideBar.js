import { Link } from "react-router-dom";

import LogoRecial from '../Images/LogoRecial.jpg';
import imageDashboard from '../Images/imageDashboard.jpg';
import imageCustomers from '../Images/imageCustomers.jpg';
import imageSuppliers from '../Images/imageSuppliers.jpg';
import imageReceipts from '../Images/imageReciepts.jpg';
import imageDispatches from '../Images/imageDispatches.jpg';
import imageEntrances from '../Images/imageEntrances.jpg';
import imageLogistics from '../Images/imageLogistics.jpg';
import imageReports from '../Images/imageReports.jpg';
import imageSettings from '../Images/imageSettings.jpg';

function SideBar({ isActive }) {
  return (
    <aside className={`sidebar ${isActive ? "is-active" : ""}`}>
      
      <div className="logo-container">
        <Link to="/home">
          <img className="logoRecial" src={LogoRecial} alt="Logo Recial" />
        </Link>
      </div>

      <nav className="menu">
        <Link to="/dashboard" className="menu-item">
          <img className="iconsidebar" src={imageDashboard} alt="" />
          Dashboard
        </Link>

        <Link to="/customers" className="menu-item">
          <img className="iconsidebar" src={imageCustomers} alt="" />
          Customers
        </Link>

        <Link to="/suppliers" className="menu-item">
          <img className="iconsidebar" src={imageSuppliers} alt="" />
          Suppliers
        </Link>

        <Link to="/receipts" className="menu-item">
          <img className="iconsidebar" src={imageReceipts} alt="" />
          Receipts
        </Link>

        <Link to="/dispatches" className="menu-item">
          <img className="iconsidebar" src={imageDispatches} alt="" />
          Dispatches
        </Link>

        <Link to="/entrances" className="menu-item">
          <img className="iconsidebar" src={imageEntrances} alt="" />
          Entrances
        </Link>

        <Link to="/tanks" className="menu-item">
         <img className="iconsidebar" src={imageLogistics} alt="" />
          Tanks
        </Link>

        <Link to="/map" className="menu-item">
          <img className="iconsidebar" src={imageLogistics} alt="" />
          Logistics
        </Link>

        <Link to="/reports" className="menu-item">
          <img className="iconsidebar" src={imageReports} alt="" />
          Reports
        </Link>

        <Link to="/settings" className="menu-item">
          <img className="iconsidebar" src={imageSettings} alt="" />
          Settings
        </Link>
      </nav>

    </aside>
  );
}

export default SideBar;