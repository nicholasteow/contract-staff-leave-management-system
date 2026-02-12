import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  limit
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function BillingVarianceDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [varianceData, setVarianceData] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  
  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [senderEmail, setSenderEmail] = useState(currentUser?.email || '');

  // Fetch variance data from reconciliation reports
  const fetchVarianceData = async () => {
    try {
      setLoading(true);
      
      // Get all reconciliation reports
      const reportsRef = collection(db, 'reconciliation_reports');
      const q = query(reportsRef, orderBy('generatedAt', 'desc'), limit(12));
      const querySnapshot = await getDocs(q);
      
      const reports = [];
      querySnapshot.forEach((doc) => {
        reports.push({ id: doc.id, ...doc.data() });
      });
      
      // Group by month AND company (not lumped together)
      const groupedData = groupByMonthAndCompany(reports);
      setVarianceData(groupedData);
      
      // Calculate summary statistics
      calculateSummaryStats(groupedData);
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching variance data:', error);
      setLoading(false);
    }
  };

  // Group data by month AND company (separate rows for each combination)
  const groupByMonthAndCompany = (reports) => {
    const groups = {};
    
    reports.forEach(report => {
      // Create unique key: month + company
      const uniqueKey = `${report.month}_${report.parentCompany}`;
      
      if (!groups[uniqueKey]) {
        groups[uniqueKey] = {
          uniqueKey: uniqueKey,
          period: report.month,
          parentCompany: report.parentCompany,
          totalBilled: report.totalBilledAmount || 0,
          totalActual: report.totalActualAmount || 0,
          totalVariance: report.totalVariance || 0,
          variancePercentage: report.variancePercentage || 0,
          needsReview: report.needsReview || false,
          generatedAt: report.generatedAt
        };
      } else {
        // If same company/month combination already exists (shouldn't happen with proper data)
        groups[uniqueKey].totalBilled += report.totalBilledAmount || 0;
        groups[uniqueKey].totalActual += report.totalActualAmount || 0;
        groups[uniqueKey].totalVariance += report.totalVariance || 0;
        groups[uniqueKey].needsReview = groups[uniqueKey].needsReview || report.needsReview;
      }
    });
    
    // Convert to array and sort by date (newest first), then by company
    return Object.values(groups).sort((a, b) => {
      // First sort by period (month) - newest first
      if (b.period !== a.period) {
        return b.period.localeCompare(a.period);
      }
      // Then sort by company name
      return a.parentCompany.localeCompare(b.parentCompany);
    });
  };

  // Calculate summary statistics
  const calculateSummaryStats = (data) => {
    if (data.length === 0) return;
    
    const stats = {
      totalVariance: 0,
      periodsNeedingReview: 0,
      totalBilled: 0,
      totalActual: 0,
      uniqueCompanies: new Set(),
      uniqueMonths: new Set()
    };
    
    data.forEach(item => {
      stats.totalVariance += item.totalVariance;
      stats.totalBilled += item.totalBilled;
      stats.totalActual += item.totalActual;
      stats.uniqueCompanies.add(item.parentCompany);
      stats.uniqueMonths.add(item.period);
      
      if (item.needsReview) {
        stats.periodsNeedingReview++;
      }
    });
    
    stats.uniqueCompaniesCount = stats.uniqueCompanies.size;
    stats.uniqueMonthsCount = stats.uniqueMonths.size;
    
    setSummaryStats(stats);
  };

  // Export variance report
  const exportVarianceReport = () => {
    if (varianceData.length === 0) return;
    
    const headers = ['Month', 'Parent Company', 'Billed Amount', 'Actual Amount', 'Variance', 'Variance %', 'Status'];
    
    const csvRows = [
      headers.join(','),
      ...varianceData.map(item => {
        const variancePercent = ((item.totalVariance / item.totalBilled) * 100).toFixed(2);
        const needsReview = Math.abs(item.totalVariance) > 500 || Math.abs(variancePercent) > 5;
        
        return [
          formatMonth(item.period),
          item.parentCompany,
          item.totalBilled,
          item.totalActual,
          item.totalVariance,
          variancePercent + '%',
          needsReview ? 'Needs Review' : 'OK'
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variance_by_company_month_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Prepare email preview for notification
  const prepareEmailPreview = () => {
    // Get companies needing review
    const companiesToNotify = varianceData
      .filter(item => Math.abs(item.totalVariance) > 500 || Math.abs((item.totalVariance / item.totalBilled) * 100) > 5)
      .map(item => ({
        company: item.parentCompany,
        email: `${item.parentCompany.replace(/\s+/g, '-')}@example.com`,
        contactPerson: item.parentCompany.includes('ABC') ? 'John Smith' : 
                       item.parentCompany.includes('DEF') ? 'Sarah Johnson' : 'Mike Chen',
        period: formatMonth(item.period),
        variance: item.totalVariance,
        percent: ((item.totalVariance / item.totalBilled) * 100).toFixed(1),
        amount: Math.abs(item.totalVariance).toLocaleString(),
        direction: item.totalVariance >= 0 ? 'overbilled' : 'underbilled'
      }));

    setEmailPreview({
      to: companiesToNotify.map(c => c.email).join(', '),
      cc: 'finance@contract-staff.gov.sg',
      subject: `[ACTION REQUIRED] Billing Variance Alert - ${new Date().toLocaleDateString()}`,
      companies: companiesToNotify,
      timestamp: new Date().toLocaleString(),
      sender: senderEmail || currentUser?.email || 'finance.officer@contract-staff.gov.sg'
    });
    
    setShowEmailModal(true);
  };

  // Initialize
  useEffect(() => {
    fetchVarianceData();
  }, []);

  // ============ UPDATED VARIANCE LOGIC ============
  // Get variance color - NEW LOGIC
  const getVarianceColor = (variance) => {
    const varianceAbs = Math.abs(variance);
    
    // Exactly zero = Green
    if (variance === 0) return '#28a745';
    
    // Exceeds $500 threshold = Red
    if (varianceAbs > 500) return '#dc3545';
    
    // Everything else = Yellow
    return '#ffc107';
  };

  // Get variance icon - NEW LOGIC
  const getVarianceIcon = (variance) => {
    const varianceAbs = Math.abs(variance);
    
    if (variance === 0) return '✅'; // Exact match
    if (varianceAbs > 500) return '⚠️'; // Critical
    return '⚡'; // Within threshold
  };
  // ================================================

  // Format month for display
  const formatMonth = (monthId) => {
    const [year, month] = monthId.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Email Modal Component
  const EmailModal = () => {
    if (!showEmailModal || !emailPreview) return null;
    
    const handleSend = () => {
      console.log('📨 MOCK EMAIL SENT', {
        ...emailPreview,
        sender: senderEmail
      });
      
      alert(`✅ Test email ready!
      
From: ${senderEmail || 'no-reply@demo.com'}
To: ${emailPreview.companies.length} manager(s)
Subject: ${emailPreview.subject}

Check console for full email preview.`);
      setShowEmailModal(false);
    };
    
    return (
      <div style={modalStyles.overlay}>
        <div style={modalStyles.modal}>
          <div style={modalStyles.header}>
            <h3 style={{margin: 0}}>📧 Send Test Email</h3>
            <button 
              onClick={() => setShowEmailModal(false)}
              style={modalStyles.closeButton}
            >
              ✕
            </button>
          </div>
          
          <div style={modalStyles.content}>
            {/* Sender Email Input - Editable for testing */}
            <div style={modalStyles.field}>
              <span style={modalStyles.label}>From:</span>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={modalStyles.emailInput}
              />
            </div>
            
            {/* To field (read-only, fake recipients) */}
            <div style={modalStyles.field}>
              <span style={modalStyles.label}>To:</span>
              <span style={modalStyles.emails}>{emailPreview.to}</span>
            </div>
            
            {/* CC field */}
            <div style={modalStyles.field}>
              <span style={modalStyles.label}>Cc:</span>
              <span>{emailPreview.cc}</span>
            </div>
            
            {/* Subject field - editable */}
            <div style={modalStyles.field}>
              <span style={modalStyles.label}>Subject:</span>
              <input
                type="text"
                value={emailPreview.subject}
                onChange={(e) => setEmailPreview({...emailPreview, subject: e.target.value})}
                style={modalStyles.subjectInput}
              />
            </div>
            
            {/* Email Body */}
            <div style={modalStyles.body}>
              <p>Dear Finance Team,</p>
              
              {emailPreview.companies.length > 0 ? (
                <>
                  <p>The following companies have billing variances exceeding our threshold of $500 or 5%:</p>
                  
                  <table style={modalStyles.emailTable}>
                    <thead>
                      <tr>
                        <th style={modalStyles.th}>Company</th>
                        <th style={modalStyles.th}>Contact</th>
                        <th style={modalStyles.th}>Period</th>
                        <th style={modalStyles.th}>Variance</th>
                        <th style={modalStyles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailPreview.companies.map((c, i) => (
                        <tr key={i}>
                          <td style={modalStyles.td}>{c.company}</td>
                          <td style={modalStyles.td}>{c.contactPerson}</td>
                          <td style={modalStyles.td}>{c.period}</td>
                          <td style={{
                            ...modalStyles.td,
                            // ===== UPDATED EMAIL VARIANCE COLOR =====
                            color: Math.abs(c.variance) > 500 ? '#dc3545' : 
                                   c.variance === 0 ? '#28a745' : '#ffc107',
                            fontWeight: 'bold'
                          }}>
                            {c.variance >= 0 ? '+' : '-'}${c.amount} ({c.percent}%)
                          </td>
                          <td style={modalStyles.td}>
                            <span style={{
                              ...modalStyles.statusBadge,
                              backgroundColor: Math.abs(c.variance) > 500 ? '#f8d7da' : 
                                             c.variance === 0 ? '#d4edda' : '#fff3cd',
                              color: Math.abs(c.variance) > 500 ? '#721c24' : 
                                    c.variance === 0 ? '#155724' : '#856404'
                            }}>
                              {Math.abs(c.variance) > 500 ? 'Critical' : 
                               c.variance === 0 ? 'Exact' : c.direction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <p style={modalStyles.note}>
                    ⚠️ <strong>Internal Note:</strong> Managers do not have access to view these discrepancies. 
                    Please coordinate with the Finance Officer to address these variances.
                  </p>
                </>
              ) : (
                <>
                  <p style={{fontSize: '16px', fontWeight: '500', color: '#28a745'}}>
                    ✅ No billing variances exceed the current threshold of $500 or 5%.
                  </p>
                  <p>All companies are within acceptable variance limits for this period.</p>
                  <p style={modalStyles.note}>
                    📊 This is a routine notification. No action required.
                  </p>
                </>
              )}
              
              <p style={modalStyles.signature}>
                Regards,<br />
                Finance Department<br />
                Contract Staff Leave Management System<br />
                {emailPreview.timestamp}
              </p>
            </div>
          </div>
          
          <div style={modalStyles.footer}>
            <button 
              onClick={handleSend}
              style={modalStyles.sendButton}
            >
              📨 Send Email
            </button>
            <button 
              onClick={() => setShowEmailModal(false)}
              style={modalStyles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1>Billing Variance Dashboard</h1>
          <p style={styles.subtitle}>Finance Officer • Track billing discrepancies by company</p>
        </div>
        <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Controls */}
      <div style={styles.controlsCard}>
        <div style={styles.controlsRow}>
          <div>
            <h3 style={{margin: 0}}>Monthly Variance by Company</h3>
            <p style={styles.controlsSubtext}>
            </p>
          </div>
          
          <button 
            onClick={exportVarianceReport}
            disabled={varianceData.length === 0}
            style={styles.exportButton}
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>💰</div>
            <div style={styles.summaryContent}>
              <div style={{
                ...styles.summaryValue,
                color: getVarianceColor(summaryStats.totalVariance)
              }}>
                ${Math.abs(summaryStats.totalVariance).toLocaleString()}
              </div>
              <div style={styles.summaryLabel}>Total Variance</div>
              {/* ===== UPDATED SUMMARY STATS TEXT ===== */}
              <div style={styles.summarySubtext}>
                {Math.abs(summaryStats.totalVariance) > 500 ? 'Critical Variance' : 
                 summaryStats.totalVariance === 0 ? 'Exact Match' : 'Minor Variance'}
              </div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>🏢</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {summaryStats.uniqueCompaniesCount}
              </div>
              <div style={styles.summaryLabel}>Companies</div>
              <div style={styles.summarySubtext}>
                With variance data
              </div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>⚠️</div>
            <div style={styles.summaryContent}>
              <div style={{
                ...styles.summaryValue,
                color: summaryStats.periodsNeedingReview > 0 ? '#dc3545' : '#28a745'
              }}>
                {summaryStats.periodsNeedingReview}
              </div>
              <div style={styles.summaryLabel}>Need Review</div>
              <div style={styles.summarySubtext}>
                {summaryStats.periodsNeedingReview > 0 ? 'Action required' : 'All clear'}
              </div>
            </div>
          </div>
          
          <div style={styles.summaryCard}>
            <div style={styles.summaryIcon}>📅</div>
            <div style={styles.summaryContent}>
              <div style={styles.summaryValue}>
                {summaryStats.uniqueMonthsCount}
              </div>
              <div style={styles.summaryLabel}>Month(s)</div>
              <div style={styles.summarySubtext}>
                Of data shown
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variance Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3>Variance Details</h3>
          <div style={styles.tableStats}>
            Showing {varianceData.length} records • {summaryStats?.uniqueCompaniesCount || 0} companies • {summaryStats?.uniqueMonthsCount || 0} months
          </div>
        </div>
        
        {loading ? (
          <div style={styles.loadingState}>Loading variance data...</div>
        ) : varianceData.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📊</div>
            <h4>No variance data found</h4>
            <p>Generate reconciliation reports first to see variance tracking.</p>
            <button 
              onClick={() => navigate('/monthly-reconciliation')}
              style={styles.primaryButton}
            >
              Go to Reconciliation
            </button>
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Month</th>
                  <th style={styles.th}>Company</th>
                  <th style={styles.th}>Billed Amount</th>
                  <th style={styles.th}>Actual Amount</th>
                  <th style={styles.th}>Variance</th>
                  <th style={styles.th}>Variance %</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {varianceData.map((item, index) => {
                  const variancePercent = ((item.totalVariance / item.totalBilled) * 100).toFixed(2);
                  const needsReview = Math.abs(item.totalVariance) > 500 || Math.abs(variancePercent) > 5;
                  
                  return (
                    <tr key={index} style={{
                      backgroundColor: needsReview ? '#fff3cd' : 'transparent',
                      borderLeft: needsReview ? '4px solid #ffc107' : 'none'
                    }}>
                      <td style={styles.td}>
                        <strong>{formatMonth(item.period)}</strong>
                        <div style={styles.periodDetails}>
                          {item.period}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.companyCell}>
                          <div style={styles.companyBadge}>{item.parentCompany}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.amountCell}>
                          ${item.totalBilled.toLocaleString()}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.amountCell}>
                          ${item.totalActual.toLocaleString()}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{
                          ...styles.varianceCell,
                          color: getVarianceColor(item.totalVariance)
                        }}>
                          <span style={styles.varianceIcon}>
                            {getVarianceIcon(item.totalVariance)}
                          </span>
                          <strong>
                            ${Math.abs(item.totalVariance).toLocaleString()}
                          </strong>
                          {/* ===== UPDATED VARIANCE DIRECTION TEXT ===== */}
                          <div style={styles.varianceDirection}>
                            {item.totalVariance === 0 ? 'Exact match' : 
                             item.totalVariance > 0 ? 'Underbilled' : 'Overbilled'} 
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{
                          ...styles.percentCell,
                          backgroundColor: Math.abs(variancePercent) > 5 ? '#f8d7da' : '#d4edda',
                          color: Math.abs(variancePercent) > 5 ? '#721c24' : '#155724'
                        }}>
                          {variancePercent}%
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{
                          ...styles.statusBadge,
                          backgroundColor: needsReview ? '#fff3cd' : '#d4edda',
                          color: needsReview ? '#856404' : '#155724'
                        }}>
                          {needsReview ? 'Needs Review' : 'Within Limits'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Panel */}
      <div style={styles.actionPanel}>
        <h3>Quick Actions</h3>
        <div style={styles.actionButtons}>
          <button 
            onClick={() => navigate('/monthly-reconciliation')}
            style={styles.actionButton}
          >
            🔄 Generate New Reconciliation
          </button>
          <button 
            onClick={prepareEmailPreview}
            disabled={varianceData.length === 0}
            style={styles.actionButton}
          >
            📧 Notify Managers
          </button>
        </div>
      </div>

      {/* Email Modal */}
      <EmailModal />
    </div>
  );
}

// Main Styles
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
  controlsCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlsSubtext: {
    color: '#666',
    fontSize: '14px',
    marginTop: '5px',
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
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
    marginBottom: '3px',
  },
  summarySubtext: {
    fontSize: '12px',
    color: '#999',
  },
  tableCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    marginBottom: '30px',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  tableStats: {
    color: '#666',
    fontSize: '14px',
  },
  loadingState: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    backgroundColor: '#f8f9fa',
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #dee2e6',
    fontWeight: '600',
    color: '#333',
    fontSize: '14px',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'middle',
  },
  periodDetails: {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px',
  },
  companyCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  companyBadge: {
    backgroundColor: '#e9ecef',
    color: '#495057',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  amountCell: {
    fontWeight: '600',
    fontSize: '14px',
  },
  varianceCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  varianceIcon: {
    fontSize: '16px',
  },
  varianceDirection: {
    fontSize: '12px',
    color: '#666',
  },
  percentCell: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    display: 'inline-block',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    display: 'inline-block',
  },
  actionPanel: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  actionButtons: {
    display: 'flex',
    gap: '15px',
    marginTop: '15px',
  },
  actionButton: {
    padding: '12px 20px',
    backgroundColor: '#f8f9fa',
    color: '#333',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'left',
    fontSize: '14px',
    ':hover': {
      backgroundColor: '#e9ecef'
    }
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '15px',
  },
};

// Modal Styles
const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '800px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px 12px 0 0'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '5px 10px',
    color: '#666'
  },
  content: {
    padding: '25px'
  },
  field: {
    marginBottom: '15px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center'
  },
  label: {
    fontWeight: '600',
    width: '70px',
    color: '#555'
  },
  emails: {
    color: '#0066cc',
    wordBreak: 'break-all',
    fontSize: '13px'
  },
  emailInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit'
  },
  subjectInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit'
  },
  body: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #eee',
    fontSize: '14px',
    lineHeight: '1.6'
  },
  emailTable: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '15px 0',
    fontSize: '13px',
    backgroundColor: 'white'
  },
  th: {
    backgroundColor: '#f1f1f1',
    padding: '10px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd'
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid #eee'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize',
    display: 'inline-block'
  },
  note: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#fff3cd',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#856404',
    borderLeft: '4px solid #ffc107',
    fontStyle: 'italic'
  },
  signature: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #ddd',
    color: '#666'
  },
  footer: {
    padding: '20px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '0 0 12px 12px'
  },
  sendButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};

export default BillingVarianceDashboard;