import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

function MyLeaves() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyLeaveApplications();
  }, [currentUser]);

  const fetchMyLeaveApplications = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // First, get user's actual name
      let staffName = currentUser.email.split('@')[0];
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', currentUser.email));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        staffName = userDoc.data().name;
      }

      // Then fetch leave applications
      const q = query(
        collection(db, 'leaveApplications'),
        where('staffEmail', '==', currentUser.email)
      );
      
      const querySnapshot = await getDocs(q);
      const applications = [];
      querySnapshot.forEach((doc) => {
        applications.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by most recent first
      applications.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setLeaveApplications(applications);
    } catch (error) {
      console.error('Error fetching leave applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span style={styles.badgePending}>Pending</span>;
      case 'approved_manager':
        return <span style={styles.badgeApproved}>Approved by Manager</span>;
      case 'approved_parent':
        return <span style={styles.badgeApproved}>Approved by Parent Co.</span>;
      case 'rejected':
        return <span style={styles.badgeRejected}>Rejected</span>;
      default:
        return <span style={styles.badgeUnknown}>{status}</span>;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#ffc107'; // Yellow
      case 'approved_manager': return '#28a745'; // Green
      case 'approved_parent': return '#20c997'; // Teal
      case 'rejected': return '#dc3545'; // Red
      default: return '#6c757d'; // Gray
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2>My Leave Applications</h2>
          <p style={styles.subtitle}>Track all your leave requests and status</p>
        </div>
        <div>
          <button 
            onClick={() => navigate('/leave-application')}
            style={styles.newLeaveButton}
          >
            + New Leave Application
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading your leave applications...</div>
      ) : leaveApplications.length === 0 ? (
        <div style={styles.noApplications}>
          <h3>No leave applications yet</h3>
          <p>Submit your first leave application to get started.</p>
          <button 
            onClick={() => navigate('/leave-application')}
            style={styles.primaryButton}
          >
            Submit First Leave Application
          </button>
        </div>
      ) : (
        <div style={styles.applicationsList}>
          <div style={styles.summary}>
            <p>You have {leaveApplications.length} leave application(s)</p>
          </div>
          
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Leave Type</th>
                <th style={styles.tableHeader}>Dates</th>
                <th style={styles.tableHeader}>Total Days</th>
                <th style={styles.tableHeader}>Parent Ref ID</th>
                <th style={styles.tableHeader}>Status</th>
                <th style={styles.tableHeader}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {leaveApplications.map((app) => (
                <tr key={app.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>
                    <div>{app.leaveType}</div>
                    <div style={styles.chargeableBadge(app.isChargeable)}>
                      {app.isChargeable ? 'Chargeable' : 'Non-Chargeable'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    {app.startDate} to {app.endDate}
                  </td>
                  <td style={styles.tableCell}>{app.totalDays} days</td>
                  <td style={styles.tableCell}>
                    <code>{app.parentCompanyRefId || 'N/A'}</code>
                  </td>
                  <td style={styles.tableCell}>
                    {getStatusBadge(app.status)}
                    {app.rejectionReason && app.status === 'rejected' && (
                      <div style={styles.rejectionReason}>
                        <strong>Reason:</strong> {app.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {app.createdAt?.toDate?.() 
                      ? app.createdAt.toDate().toLocaleDateString()
                      : 'Recently'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
  newLeaveButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px',
    color: '#666',
  },
  noApplications: {
    backgroundColor: 'white',
    padding: '50px',
    borderRadius: '10px',
    textAlign: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '20px',
  },
  applicationsList: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  summary: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '5px',
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
    padding: '15px',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  badgePending: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  badgeApproved: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  badgeRejected: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  badgeUnknown: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#e2e3e5',
    color: '#383d41',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  chargeableBadge: (isChargeable) => ({
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '11px',
    borderRadius: '10px',
    backgroundColor: isChargeable ? '#d1ecf1' : '#f8d7da',
    color: isChargeable ? '#0c5460' : '#721c24',
    marginTop: '5px',
  }),
  rejectionReason: {
    marginTop: '5px',
    fontSize: '12px',
    color: '#666',
    padding: '5px',
    backgroundColor: '#fff3cd',
    borderRadius: '4px',
    borderLeft: '3px solid #dc3545',
  },
};

export default MyLeaves;