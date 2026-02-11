import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  where,
  query,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function HistoricalAuditTrail() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');

  // FETCH ALL 5 ACTION TYPES (including exports)
  const fetchAllAuditData = async () => {
    try {
      setLoading(true);
      const allLogs = [];

      // 1. 📝 LEAVE APPLICATIONS (Staff actions)
      const leavesRef = collection(db, 'leaveApplications');
      const leavesSnap = await getDocs(leavesRef);
      leavesSnap.forEach(doc => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          timestamp: data.submittedAt || data.createdAt,
          user: data.staffEmail || data.staffName,
          userRole: 'contract_staff',
          action: 'applied_leave',
          icon: '📝',
          description: `Applied ${data.totalDays} days ${data.leaveType}`,
          details: {
            company: data.parentCompany,
            startDate: data.startDate,
            endDate: data.endDate,
            days: data.totalDays,
            isChargeable: data.isChargeable
          },
          color: '#007bff'
        });
      });

      // 2. ✅ MANAGER APPROVALS & ❌ REJECTIONS
      const approvedLeavesRef = collection(db, 'leaveApplications');
      const approvedQ = query(
        approvedLeavesRef, 
        where('status', 'in', ['approved_manager', 'rejected'])
      );
      const approvedSnap = await getDocs(approvedQ);

      approvedSnap.forEach(doc => {
        const data = doc.data();
        
        allLogs.push({
          id: `${doc.id}_manager`,
          timestamp: data.managerApprovalDate || data.updatedAt,
          user: data.managerEmail || 'manager@example.com',
          userRole: 'manager',
          action: data.status === 'rejected' ? 'rejected_leave' : 'approved_leave',
          icon: data.status === 'rejected' ? '❌' : '✅',
          description: `${data.status === 'rejected' ? 'Rejected' : 'Approved'} leave for ${data.staffName}`,
          details: {
            staffName: data.staffName,
            company: data.parentCompany,
            days: data.totalDays,
            leaveType: data.leaveType,
            comments: data.rejectionReason || data.reason || 'No comments'
          },
          color: data.status === 'rejected' ? '#dc3545' : '#28a745'
        });
      });

      // 3. 🟢 RECONCILIATION REPORTS (Finance actions)
      const reportsRef = collection(db, 'reconciliation_reports');
      const reportsSnap = await getDocs(reportsRef);
      reportsSnap.forEach(doc => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          timestamp: data.generatedAt,
          user: data.generatedByEmail || 'finance@example.com',
          userRole: 'finance_officer',
          action: 'generated_report',
          icon: '🟢',
          description: `Generated reconciliation report for ${data.parentCompany} - ${data.month}`,
          details: {
            company: data.parentCompany,
            period: data.month,
            totalVariance: data.totalVariance,
            variancePercent: data.variancePercentage,
            totalLeaves: data.totalLeaves,
            needsReview: data.needsReview
          },
          color: '#17a2b8'
        });
      });

      // 4. 📊 AUDIT TRAIL EXPORTS (New action type)
      const exportsRef = collection(db, 'audit_exports');
      const exportsSnap = await getDocs(exportsRef);
      exportsSnap.forEach(doc => {
        const data = doc.data();
        allLogs.push({
          id: doc.id,
          timestamp: data.exportedAt,
          user: data.exportedBy,
          userRole: data.exportedByRole || 'finance_officer',
          action: 'exported_audit',
          icon: '📊',
          description: `Exported audit trail (${data.recordCount} records)`,
          details: {
            recordCount: data.recordCount,
            filename: data.filename,
            filters: data.filters
          },
          color: '#6c757d'
        });
      });

      // SORT ALL LOGS BY TIMESTAMP (newest first)
      allLogs.sort((a, b) => {
        const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return dateB - dateA;
      });

      setAuditLogs(allLogs);
      setLoading(false);

    } catch (error) {
      console.error('Error fetching audit trail:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAuditData();
  }, []);

  // Filter logs
  const getFilteredLogs = () => {
    let filtered = [...auditLogs];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.description?.toLowerCase().includes(term) ||
        log.user?.toLowerCase().includes(term) ||
        log.details?.company?.toLowerCase().includes(term) ||
        log.details?.staffName?.toLowerCase().includes(term)
      );
    }
    
    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action === selectedAction);
    }
    
    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => log.userRole === selectedUser);
    }
    
    return filtered;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleString('en-SG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // EXPORT TO CSV FUNCTION
  const exportToCSV = async () => {
    try {
      const filteredLogs = getFilteredLogs();
      
      // CSV Headers
      const headers = ['Timestamp', 'User', 'Role', 'Action', 'Description', 'Details'];
      
      // Convert logs to CSV rows
      const rows = filteredLogs.map(log => {
        const timestamp = formatTimestamp(log.timestamp);
        const details = Object.entries(log.details || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ');
        
        return [
          timestamp,
          log.user,
          log.userRole.replace('_', ' '),
          log.action.replace('_', ' '),
          log.description,
          details
        ];
      });
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filename = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // LOG THIS EXPORT ACTION TO FIREBASE
      await addDoc(collection(db, 'audit_exports'), {
        exportedAt: serverTimestamp(),
        exportedBy: currentUser?.email || 'unknown',
        exportedByRole: 'finance_officer', // You can get this from user profile
        recordCount: filteredLogs.length,
        filename: filename,
        filters: {
          searchTerm: searchTerm || 'none',
          actionType: selectedAction,
          userRole: selectedUser
        }
      });

      // Refresh the audit trail to show this export
      await fetchAllAuditData();

      alert(`✅ Exported ${filteredLogs.length} records to ${filename}`);

    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('❌ Failed to export. Please try again.');
    }
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1>Historical Audit Trail</h1>
          <p style={styles.subtitle}>Complete system activity log</p>
        </div>
        <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
          ← Back to Dashboard
        </button>
      </div>

      {/* FILTERS */}
      <div style={styles.filtersCard}>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>🔍 Search</label>
            <input
              type="text"
              placeholder="Search by user, company, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.label}>🎯 Action Type</label>
            <select 
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Actions</option>
              <option value="applied_leave">📝 Leave Applications</option>
              <option value="approved_leave">✅ Manager Approvals</option>
              <option value="rejected_leave">❌ Rejections</option>
              <option value="generated_report">🟢 Report Generation</option>
              <option value="exported_audit">📊 Audit Exports</option>
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.label}>👤 User Role</label>
            <select 
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Users</option>
              <option value="contract_staff">Contract Staff</option>
              <option value="manager">Managers</option>
              <option value="finance_officer">Finance Officers</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS */}
      {!loading && auditLogs.length > 0 && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>📝</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {auditLogs.filter(l => l.action === 'applied_leave').length}
              </div>
              <div style={styles.summaryLabel}>Leave Applications</div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>✅</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {auditLogs.filter(l => l.action === 'approved_leave').length}
              </div>
              <div style={styles.summaryLabel}>Manager Approvals</div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>❌</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {auditLogs.filter(l => l.action === 'rejected_leave').length}
              </div>
              <div style={styles.summaryLabel}>Rejections</div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>🟢</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {auditLogs.filter(l => l.action === 'generated_report').length}
              </div>
              <div style={styles.summaryLabel}>Reports Generated</div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT TIMELINE */}
      <div style={styles.timelineCard}>
        <div style={styles.timelineHeader}>
          <h3>📋 Activity Timeline</h3>
          <span style={styles.recordCount}>
            {getFilteredLogs().length} records
          </span>
        </div>
        
        {loading ? (
          <div style={styles.loadingState}>Loading audit trail...</div>
        ) : getFilteredLogs().length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <h4>No audit records found</h4>
            <p>Activities will appear here as users interact with the system.</p>
          </div>
        ) : (
          <div style={styles.timeline}>
            {getFilteredLogs().map((log, index) => (
              <div key={index} style={styles.timelineItem}>
                <div style={{...styles.timelineIcon, backgroundColor: log.color || '#007bff'}}>
                  {log.icon}
                </div>
                <div style={styles.timelineContent}>
                  <div style={styles.timelineTop}>
                    <div style={styles.timelineTitle}>
                      <strong>{log.description}</strong>
                      <span style={styles.timelineRole}>• {log.userRole.replace('_', ' ')}</span>
                    </div>
                    <span style={styles.timelineTime}>
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <div style={styles.timelineDetails}>
                    <span style={styles.timelineUser}>👤 {log.user}</span>
                    
                    {/* Dynamic details based on action type */}
                    {log.details?.company && (
                      <span style={styles.timelineMeta}>🏢 {log.details.company}</span>
                    )}
                    {log.details?.period && (
                      <span style={styles.timelineMeta}>📅 {log.details.period}</span>
                    )}
                    {log.details?.days && (
                      <span style={styles.timelineMeta}>📆 {log.details.days} days</span>
                    )}
                    {log.details?.totalVariance !== undefined && (
                      <span style={{
                        ...styles.timelineMeta,
                        color: log.details.totalVariance >= 0 ? '#28a745' : '#dc3545'
                      }}>
                        💰 ${Math.abs(log.details.totalVariance).toLocaleString()} variance
                      </span>
                    )}
                    {log.details?.staffName && (
                      <span style={styles.timelineMeta}>👨‍💼 {log.details.staffName}</span>
                    )}
                    {log.details?.comments && (
                      <span style={styles.timelineMeta}>💬 "{log.details.comments}"</span>
                    )}
                    {log.details?.recordCount && (
                      <span style={styles.timelineMeta}>📊 {log.details.recordCount} records</span>
                    )}
                    {log.details?.filename && (
                      <span style={styles.timelineMeta}>📄 {log.details.filename}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXPORT BUTTON */}
      <div style={styles.exportSection}>
        <button 
          onClick={exportToCSV}
          style={styles.exportButton}
          disabled={loading || getFilteredLogs().length === 0}
        >
          📥 Export Audit Trail (CSV)
        </button>
      </div>
    </div>
  );
}

// STYLES
const styles = {
  container: {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #007bff',
  },
  subtitle: {
    color: '#666',
    marginTop: '5px',
    fontSize: '16px',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  filtersCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginBottom: '25px',
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '20px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '8px',
    fontWeight: '600',
    color: '#333',
    fontSize: '14px',
  },
  searchInput: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
  },
  select: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '30px',
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  summaryIcon: {
    fontSize: '32px',
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '5px',
  },
  summaryLabel: {
    color: '#666',
    fontSize: '14px',
  },
  timelineCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    marginBottom: '25px',
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
  },
  recordCount: {
    color: '#666',
    fontSize: '14px',
    backgroundColor: '#f8f9fa',
    padding: '6px 12px',
    borderRadius: '20px',
  },
  loadingState: {
    textAlign: 'center',
    padding: '60px',
    color: '#666',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  timelineItem: {
    display: 'flex',
    gap: '15px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    borderLeft: '4px solid transparent',
  },
  timelineIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: 'white',
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  timelineTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  timelineRole: {
    color: '#666',
    fontSize: '13px',
    textTransform: 'capitalize',
  },
  timelineTime: {
    color: '#999',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },
  timelineDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '13px',
  },
  timelineUser: {
    color: '#495057',
    backgroundColor: '#e9ecef',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  timelineMeta: {
    color: '#666',
    backgroundColor: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #dee2e6',
  },
  exportSection: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  exportButton: {
    padding: '12px 24px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
};

export default HistoricalAuditTrail;