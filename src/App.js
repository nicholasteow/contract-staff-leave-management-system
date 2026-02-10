// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { AuthProvider } from './contexts/AuthContext';
// import Login from './pages/Login';
// import Dashboard from './pages/Dashboard';
// import LeaveApplication from './pages/LeaveApplication';
// import ApprovalDashboard from './pages/ApprovalDashboard';
// import Reconciliation from './pages/Reconciliation';
// import VarianceDashboard from './pages/VarianceDashboard';
// import AuditTrail from './pages/AuditTrail';

// function App() {
//   return (
//     <Router>
//       <AuthProvider>
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/dashboard" element={<Dashboard />} />
//           <Route path="/leave-application" element={<LeaveApplication />} />
//           <Route path="/approval-dashboard" element={<ApprovalDashboard />} />
//           <Route path="/reconciliation" element={<Reconciliation />} />
//           <Route path="/variance-dashboard" element={<VarianceDashboard />} />
//           <Route path="/audit-trail" element={<AuditTrail />} />
//         </Routes>
//       </AuthProvider>
//     </Router>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeaveApplication from './pages/LeaveApplication';
import ApprovalDashboard from './pages/ApprovalDashboard';
import MyLeaves from './pages/MyLeaves'
// Remove these 3 imports for now:
// import Reconciliation from './pages/Reconciliation';
// import VarianceDashboard from './pages/VarianceDashboard';
// import AuditTrail from './pages/AuditTrail';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leave-application" element={<LeaveApplication />} />
          <Route path="/approval-dashboard" element={<ApprovalDashboard />} />
          <Route path="/my-leaves" element={<MyLeaves />} />
          {/* Remove these 3 routes for now: */}
          {/* <Route path="/reconciliation" element={<Reconciliation />} /> */}
          {/* <Route path="/variance-dashboard" element={<VarianceDashboard />} /> */}
          {/* <Route path="/audit-trail" element={<AuditTrail />} /> */}
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;