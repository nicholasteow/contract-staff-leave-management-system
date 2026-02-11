import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [userRole, setUserRole] = useState('contract_staff');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', currentUser.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              const userData = doc.data();
              setUserRole(userData.role);
              setUserName(userData.name || currentUser.displayName || currentUser.email.split('@')[0]);
            });
          } else {
            // Fallback if user document doesn't exist
            setUserName(currentUser.displayName || currentUser.email.split('@')[0]);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserName(currentUser.displayName || currentUser.email.split('@')[0]);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const renderContent = () => {
    switch(userRole) {
      case 'contract_staff':
        return (
            <div style={styles.roleContent}>
            <h3>Contract Staff Dashboard</h3>
            <p>Welcome to the Leave Management System</p>
            <div style={styles.buttonGroup}>
                <button 
                onClick={() => navigate('/leave-application')}
                style={styles.primaryButton}
                >
                Submit Leave Application
                </button>
                <button 
                onClick={() => navigate('/my-leaves')}
                style={styles.secondaryButton}
                >
                View My Leave Status
                </button>
            </div>
            </div>
        );
      case 'manager':
        return (
          <div style={styles.roleContent}>
            <h3>Manager Approval Dashboard</h3>
            <p>Manage team leave requests and approvals</p>
            <button 
              onClick={() => navigate('/approval-dashboard')}
              style={styles.primaryButton}
            >
              View Pending Approvals
            </button>
          </div>
        );
      case 'finance':
        return (
          <div style={styles.roleContent}>
            <h3>Finance Officer Dashboard</h3>
            <p>Billing, reconciliation, and variance tracking</p>
            <div style={styles.buttonGroup}>
              <button 
                onClick={() => navigate('/monthly-reconciliation')}
                style={styles.primaryButton}
              >
                Monthly Reconciliation
              </button>
              <button 
                onClick={() => navigate('/variance-dashboard')}
                style={styles.secondaryButton}
              >
                Variance Dashboard
              </button>
            </div>
          </div>
        );
      default:
        return <p>Unknown role</p>;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2>Leave Management System</h2>
          <p style={styles.userInfo}>
            Welcome <span style={styles.userName}>{userName}</span>! | Role: <span style={styles.roleBadge}>{userRole}</span>
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>
      
      <div style={styles.content}>
        {renderContent()}
      </div>
      
      <div style={styles.quickLinks}>
        <h4>Quick Links:</h4>
        <div style={styles.linkButtons}>
            {/* Leave Form */}
            <button 
            onClick={() => navigate('/leave-application')}
            style={{...styles.linkButton, backgroundColor: '#1a69bd'}}
            >
            Leave Form
            </button>

            {/* My Leave Status */}
            <button 
            onClick={() => navigate('/my-leaves')}
            style={{...styles.linkButton, backgroundColor: '#049326'}}
            >
            My Leave Status
            </button>
            
            {/* Approval Dashboard */}
            {userRole === 'manager' && (
            <button 
                onClick={() => navigate('/approval-dashboard')}
                style={{...styles.linkButton, backgroundColor: '#ffc107', color: '#212529'}}
            >
                Approval Dashboard
            </button>
            )}
            
            {/* Finance links - Info colors */}
            {userRole === 'finance' && (
            <>
                <button 
                onClick={() => navigate('/monthly-reconciliation')} 
                style={{...styles.linkButton, backgroundColor: '#17a2b8'}} 
                >
                Reconciliation
                </button>
                <button 
                onClick={() => navigate('/variance-dashboard')}
                style={{...styles.linkButton, backgroundColor: '#6610f2'}} 
                >
                Variance Dashboard
                </button>
                <button 
                onClick={() => alert('Coming soon!')}
                style={{...styles.linkButton, backgroundColor: '#d00423'}} 
                >
                Audit Trail
                </button>
            </>
            )}
        </div>
        </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '15px',
    borderBottom: '2px solid #007bff',
  },
  userInfo: {
    color: '#666',
    fontSize: '16px',
    marginTop: '5px',
    fontWeight: '500',
  },
  userName: {
    color: '#007bff',
    fontWeight: '600',
    fontSize: '17px',
  },
  roleBadge: {
    backgroundColor: '#e9ecef',
    color: '#007bff',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '600',
    marginLeft: '5px',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  content: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '20px',
    textAlign: 'center',
  },
  roleContent: {
    maxWidth: '600px',
    margin: '0 auto',
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
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '20px',
    marginLeft: '10px',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '20px',
  },
  quickLinks: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '10px',
  },
  linkButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '10px',
    justifyContent: 'center',
  },
  linkButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default Dashboard;