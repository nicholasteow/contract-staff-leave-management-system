import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

function ApprovalDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [processedApplications, setProcessedApplications] = useState([]);
  const [allApplications, setAllApplications] = useState([]); // ADD THIS
  const [filters, setFilters] = useState({ // ADD THIS
    searchName: '',
    leaveType: ''
  });
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    awaitingParent: 0,
    teamAvailable: '85%'
  });

  useEffect(() => {
    fetchAllLeaveApplications();
  }, []);

  // ADD THIS useEffect FOR FILTERING
  useEffect(() => {
    if (allApplications.length > 0) {
      applyFilters();
    }
  }, [filters, allApplications]);

  const fetchAllLeaveApplications = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'leaveApplications'));
      const querySnapshot = await getDocs(q);
      
      const apps = [];
      let pendingCount = 0;
      let approvedCount = 0;
      let awaitingParentCount = 0;
      
      querySnapshot.forEach((doc) => {
        const app = { id: doc.id, ...doc.data() };
        apps.push(app);
        
        if (app.status === 'pending') pendingCount++;
        if (app.status === 'approved_manager' || app.status === 'approved_parent') approvedCount++;
        if (app.status === 'approved_manager') awaitingParentCount++;
      });
      
      // Store all applications
      setAllApplications(apps);
      
      // Apply initial filters
      const { searchName, leaveType } = filters;
      const filteredPending = apps.filter(app => 
        app.status === 'pending' && 
        matchesFilters(app, searchName, leaveType)
      );
      
      const filteredProcessed = apps
        .filter(app => 
          app.status !== 'pending' && 
          matchesFilters(app, searchName, leaveType)
        )
        .sort((a, b) => {
          const dateA = a.updatedAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.updatedAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB - dateA;
        })
        .slice(0, 10);
      
      setPendingApplications(filteredPending);
      setProcessedApplications(filteredProcessed);
      
      setStats(prev => ({
        ...prev,
        pending: pendingCount,
        approved: approvedCount,
        awaitingParent: awaitingParentCount
      }));
    } catch (error) {
      console.error('Error fetching leave applications:', error);
    } finally {
      setLoading(false);
    }
  };

  // ADD THIS FILTER FUNCTION
  const matchesFilters = (app, searchName, leaveType) => {
    // Check name filter
    if (searchName && !app.staffName.toLowerCase().includes(searchName.toLowerCase())) {
      return false;
    }
    
    // Check leave type filter
    if (leaveType && app.leaveType !== leaveType) {
      return false;
    }
    
    return true;
  };

  // ADD THIS FILTER APPLICATION FUNCTION
  const applyFilters = () => {
    const { searchName, leaveType } = filters;
    
    const filteredPending = allApplications.filter(app => 
      app.status === 'pending' && 
      matchesFilters(app, searchName, leaveType)
    );
    
    const filteredProcessed = allApplications
      .filter(app => 
        app.status !== 'pending' && 
        matchesFilters(app, searchName, leaveType)
      )
      .sort((a, b) => {
        const dateA = a.updatedAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.updatedAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, 10);
    
    setPendingApplications(filteredPending);
    setProcessedApplications(filteredProcessed);
  };

  // ADD THIS FILTER CHANGE HANDLER
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApprove = async (applicationId) => {
    try {
      await updateDoc(doc(db, 'leaveApplications', applicationId), {
        status: 'approved_manager',
        managerApprovalDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      alert('Leave application approved!');
      fetchAllLeaveApplications();
      
    } catch (error) {
      console.error('Error approving leave:', error);
      alert('Failed to approve leave application.');
    }
  };

  const handleReject = async (applicationId) => {
    const reason = prompt('Please enter reason for rejection:');
    if (reason) {
      try {
        await updateDoc(doc(db, 'leaveApplications', applicationId), {
          status: 'rejected',
          rejectionReason: reason,
          updatedAt: serverTimestamp()
        });
        
        alert('Leave application rejected!');
        fetchAllLeaveApplications();
        
      } catch (error) {
        console.error('Error rejecting leave:', error);
        alert('Failed to reject leave application.');
      }
    }
  };

  const getStatusDisplay = (status) => {
    switch(status) {
      case 'approved_manager': return 'Approved by Manager';
      case 'approved_parent': return 'Approved by Parent';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved_manager':
      case 'approved_parent':
        return <span style={styles.badgeApproved}>{getStatusDisplay(status)}</span>;
      case 'rejected':
        return <span style={styles.badgeRejected}>{getStatusDisplay(status)}</span>;
      default:
        return <span style={styles.badgeUnknown}>{status}</span>;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2>Manager Approval Dashboard</h2>
          <p style={styles.subtitle}>Team: Engineering Department</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div style={styles.grid}>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{stats.pending}</div>
          <div style={styles.metricLabel}>Pending</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{stats.approved}</div>
          <div style={styles.metricLabel}>Approved</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{stats.awaitingParent}</div>
          <div style={styles.metricLabel}>Awaiting Parent</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{stats.teamAvailable}</div>
          <div style={styles.metricLabel}>Team Available</div>
        </div>
      </div>

      {/* UPDATED FILTER SECTION */}
      <div style={styles.filterCard}>
        <div style={styles.row}>
          <input
            type="text"
            name="searchName"
            placeholder="Search staff name..."
            value={filters.searchName}
            onChange={handleFilterChange}
            style={styles.filterInput}
          />
          <select 
            name="leaveType"
            value={filters.leaveType}
            onChange={handleFilterChange}
            style={styles.filterSelect}
          >
            <option value="">All Leave Types</option>
            <option value="Annual Leave">Annual Leave</option>
            <option value="Medical (MC)">Medical Leave with MC</option>
            <option value="Medical (No MC)">Medical Leave without MC</option>
            <option value="Unpaid Leave">Unpaid Leave</option>
            <option value="Compassionate Leave">Compassionate Leave</option>
          </select>
        </div>
        <div style={styles.filterActions}>
          <button 
            onClick={() => setFilters({ searchName: '', leaveType: '' })}
            style={styles.clearButton}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Pending Applications Table */}
      <div style={styles.tableCard}>
        <h3 style={styles.tableTitle}>Pending Approvals</h3>
        
        {loading ? (
          <div style={styles.loading}>Loading applications...</div>
        ) : pendingApplications.length === 0 ? (
          <div style={styles.noData}>
            {filters.searchName || filters.leaveType 
              ? 'No matching pending leave applications.' 
              : 'No pending leave applications.'
            }
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Staff</th>
                <th style={styles.tableHeader}>Leave Type</th>
                <th style={styles.tableHeader}>Dates</th>
                <th style={styles.tableHeader}>Days</th>
                <th style={styles.tableHeader}>Parent Status</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApplications.map((app) => (
                <tr key={app.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{app.staffName}</td>
                  <td style={styles.tableCell}>
                    {app.leaveType}
                    <div style={chargeableBadgeStyle(app.isChargeable)}>
                      {app.isChargeable ? 'Chargeable' : 'Non-Chargeable'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {app.startDate} to {app.endDate}
                  </td>
                  <td style={styles.tableCell}>{app.totalDays}</td>
                  <td style={styles.tableCell}>
                    <span style={statusBadgeStyle('not_sent')}>
                      Not Sent
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleApprove(app.id)}
                        style={styles.approveButton}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app.id)}
                        style={styles.rejectButton}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Recently Processed Table */}
      <div style={{...styles.tableCard, marginTop: '30px'}}>
        <h3 style={styles.tableTitle}>Recently Processed</h3>
        
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : processedApplications.length === 0 ? (
          <div style={styles.noData}>
            {filters.searchName || filters.leaveType 
              ? 'No matching processed applications.' 
              : 'No processed applications yet.'
            }
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Staff</th>
                <th style={styles.tableHeader}>Leave Type</th>
                <th style={styles.tableHeader}>Dates</th>
                <th style={styles.tableHeader}>My Decision</th>
                <th style={styles.tableHeader}>Parent Status</th>
                <th style={styles.tableHeader}>Final Status</th>
              </tr>
            </thead>
            <tbody>
              {processedApplications.map((app) => (
                <tr key={app.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{app.staffName}</td>
                  <td style={styles.tableCell}>
                    {app.leaveType}
                    <div style={chargeableBadgeStyle(app.isChargeable)}>
                      {app.isChargeable ? 'Chargeable' : 'Non-Chargeable'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {app.startDate} to {app.endDate}
                  </td>
                  <td style={styles.tableCell}>
                    {getStatusBadge(app.status === 'rejected' ? 'rejected' : 'approved_manager')}
                    {app.rejectionReason && (
                      <div style={{fontSize: '11px', color: '#666', marginTop: '5px'}}>
                        Reason: {app.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    <span style={statusBadgeStyle('pending')}>
                      Pending
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    {app.status === 'approved_manager' ? (
                      <span style={{color: '#28a745', fontWeight: 'bold'}}>WAITING</span>
                    ) : app.status === 'rejected' ? (
                      <span style={{color: '#dc3545', fontWeight: 'bold'}}>REJECTED</span>
                    ) : (
                      <span style={{color: '#6c757d'}}>Unknown</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Helper functions for dynamic styles
const chargeableBadgeStyle = (isChargeable) => ({
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: '12px',
  borderRadius: '12px',
  backgroundColor: isChargeable ? '#d4edda' : '#f8d7da',
  color: isChargeable ? '#155724' : '#721c24',
  marginTop: '5px',
});

const statusBadgeStyle = (status) => ({
  display: 'inline-block',
  padding: '3px 10px',
  fontSize: '12px',
  borderRadius: '12px',
  backgroundColor: status === 'not_sent' ? '#fff3cd' : '#d1ecf1',
  color: status === 'not_sent' ? '#856404' : '#0c5460',
});

// Styles object - COMPLETE AND OUTSIDE THE COMPONENT
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '15px',
    borderBottom: '2px solid #007bff',
  },
  subtitle: {
    color: '#666',
    marginTop: '5px',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '30px',
  },
  metricCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: '5px',
  },
  metricLabel: {
    fontSize: '14px',
    color: '#666',
    textTransform: 'uppercase',
  },
  filterCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
  },
  filterInput: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  filterSelect: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  filterActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '15px',
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  tableCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  tableTitle: {
    marginBottom: '20px',
    color: '#333',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    padding: '12px 15px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#495057',
  },
  tableRow: {
    borderBottom: '1px solid #dee2e6',
    '&:hover': {
      backgroundColor: '#f8f9fa',
    },
  },
  tableCell: {
    padding: '12px 15px',
    fontSize: '14px',
  },
  badgeApproved: {
    display: 'inline-block',
    padding: '3px 10px',
    fontSize: '12px',
    borderRadius: '12px',
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  badgeRejected: {
    display: 'inline-block',
    padding: '3px 10px',
    fontSize: '12px',
    borderRadius: '12px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  badgeUnknown: {
    display: 'inline-block',
    padding: '3px 10px',
    fontSize: '12px',
    borderRadius: '12px',
    backgroundColor: '#e2e3e5',
    color: '#383d41',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  approveButton: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  rejectButton: {
    padding: '6px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
};

export default ApprovalDashboard;