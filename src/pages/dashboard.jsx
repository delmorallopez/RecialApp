import imageDashboardMain from "../Images/imageDashboardMain.jpg";

function Dashboard() {
  return (
    <div className="contentinprogress">
      <img 
        className="imagedashboardmain" 
        src={imageDashboardMain} 
        alt="Dashboard" 
      />
      <h2>Web-based Application React in Progress - DASHBOARD</h2>
    </div>
  );
}

export default Dashboard;          
