import LogoRecial from './Images/LogoRecial.jpg'
import imageDashboard from './Images/imageDashboard.jpg'
import imageCustomers from './Images/imageCustomers.jpg'
import imageSuppliers from './Images/imageSuppliers.jpg'
import imageReceipts from './Images/imageReciepts.jpg'
import imageDispatches from './Images/imageDispatches.jpg'
import imageEntrances from './Images/imageEntrances.jpg'
import imageLogistics from './Images/imageLogistics.jpg'
import imageReports from './Images/imageReports.jpg'
import imageSettings from './Images/imageSettings.jpg'

function SideBar() {
    return <aside class="sidebar">
        <p> <a href={'/home'}><img class="logoRecial" src={LogoRecial} alt="LOGO"/></a></p>

        <nav class="menu">
            <a href={'/dashboard'} class="menu-item" ><img class="iconsidebar" src={imageDashboard} />Dashboard</a>
            <a href={'/customers'} class="menu-item"><img class="iconsidebar" src={imageCustomers} />Customers</a>
            <a href={'/suppliers'} class="menu-item"><img class="iconsidebar" src={imageSuppliers}/>Suppliers</a>
            <a href={'/receipts'}class="menu-item"><img class="iconsidebar" src={imageReceipts} />Receipts</a>
            <a href={'/dispatches'} class="menu-item"><img class="iconsidebar" src={imageDispatches} />Dispatches</a>
            <a href={'/entrances'} class="menu-item"><img class="iconsidebar" src={imageEntrances} />Entrances</a>
            <a href={`/map`} class="menu-item"><img class="iconsidebar" src={imageLogistics} />Logistics</a>
            <a href={`/reports`} class="menu-item"><img class="iconsidebar" src={imageReports}/>Reports</a>
            <a href={`/settings`} class="menu-item"><img class="iconsidebar" src={imageSettings} />Settings</a>
        </nav>
    </aside>;
  }
  
  export default SideBar;