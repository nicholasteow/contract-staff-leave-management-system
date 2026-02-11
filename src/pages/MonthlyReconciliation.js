import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function MonthlyReconciliation() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reconciliationData, setReconciliationData] = useState([]);
  
  // State for filters
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const [selectedCompany, setSelectedCompany] = useState('ABC Staffing');
  
  // Available options
  const months = [
    { id: '2026-02', name: 'February 2026', status: 'Current' },
    { id: '2026-01', name: 'January 2026', status: 'Completed' },
    { id: '2025-12', name: 'December 2025', status: 'Completed' },
    { id: '2025-11', name: 'November 2025', status: 'Completed' },
  ];
  
  const companies = ['ABC Staffing', 'DEF Staffing', 'GHI Staffing'];

  // Fetch approved leaves for the selected month & company
  const fetchLeaveData = async () => {
    if (!selectedMonth || !selectedCompany) return;
    
    try {
      setLoading(true);
      
      // Calculate month start and end dates
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${year}-${month}-01`;
      const monthEnd = `${year}-${month}-31`;
      
      // Query approved chargeable leaves for the month
      const leavesRef = collection(db, 'leaveApplications');
      const q = query(
        leavesRef,
        where('parentCompany', '==', selectedCompany),
        where('status', 'in', ['approved_manager', 'approved_parent']),
        where('isChargeable', '==', true),
        where('startDate', '>=', monthStart),
        where('startDate', '<=', monthEnd),
        orderBy('startDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const leaves = [];
      let totalBilled = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaves.push({
          id: doc.id,
          ...data,
          // Calculate if not already set
          calculatedCost: data.calculatedCost || (data.totalDays * data.dailyRateAtLeave)
        });
        totalBilled += data.calculatedCost || (data.totalDays * data.dailyRateAtLeave);
      });
      
      // For demo: create synthetic parent company data
      const syntheticParentData = leaves.map(leave => {
        // Simulate 5% variance (±) for demo
        const variancePercent = (Math.random() * 10) - 5; // -5% to +5%
        const actualAmount = leave.calculatedCost * (1 + (variancePercent / 100));
        
        return {
          ...leave,
          actualAmount: Math.round(actualAmount),
          variance: Math.round(actualAmount - leave.calculatedCost),
          variancePercent: parseFloat(variancePercent.toFixed(1))
        };
      });
      
      setReconciliationData(syntheticParentData);
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching leave data:', error);
      setLoading(false);
    }
  };

  // Generate the reconciliation report
  const generateReport = async () => {
    if (reconciliationData.length === 0) {
      alert('No data to generate report');
      return;
    }
    
    try {
      setLoading(true);
      
      // Calculate totals
      const totals = reconciliationData.reduce((acc, item) => ({
        billed: acc.billed + item.calculatedCost,
        actual: acc.actual + item.actualAmount,
        variance: acc.variance + item.variance
      }), { billed: 0, actual: 0, variance: 0 });
      
      // Create report document in Firestore
      const report = {
        month: selectedMonth,
        parentCompany: selectedCompany,
        generatedBy: currentUser.uid,
        generatedByEmail: currentUser.email,
        generatedAt: serverTimestamp(),
        
        // Summary
        totalStaff: new Set(reconciliationData.map(d => d.staffId)).size,
        totalLeaves: reconciliationData.length,
        totalChargeableDays: reconciliationData.reduce((sum, d) => sum + d.totalDays, 0),
        
        // Financials
        totalBilledAmount: totals.billed,
        totalActualAmount: totals.actual,
        totalVariance: totals.variance,
        variancePercentage: parseFloat(((totals.variance / totals.billed) * 100).toFixed(2)),
        
        // Details stored as subcollection reference
        status: 'generated',
        
        // Flags
        hasDiscrepancies: Math.abs(totals.variance) > 100, // > $100 variance
        needsReview: Math.abs(totals.variance) > 500, // > $500 variance
      };
      
      // Save to Firestore
      const reportRef = await addDoc(collection(db, 'reconciliation_reports'), report);
      
      // Also save line items
      for (const item of reconciliationData) {
        await addDoc(collection(db, `reconciliation_reports/${reportRef.id}/line_items`), {
          ...item,
          reportId: reportRef.id
        });
      }
      
      setReportGenerated(true);
      alert(`Reconciliation report generated! Total variance: $${totals.variance.toFixed(2)}`);
      setLoading(false);
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
      setLoading(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (reconciliationData.length === 0) return;
    
    const headers = ['Staff Name', 'Leave Type', 'Start Date', 'End Date', 'Days', 
                     'Daily Rate', 'Billed Amount', 'Actual Amount', 'Variance'];
    
    const csvRows = [
      headers.join(','),
      ...reconciliationData.map(item => [
        item.staffName,
        item.leaveType,
        item.startDate,
        item.endDate,
        item.totalDays,
        item.dailyRateAtLeave,
        item.calculatedCost,
        item.actualAmount,
        item.variance
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_${selectedCompany}_${selectedMonth}.csv`;
    a.click();
  };

  // Initialize data when filters change
  useEffect(() => {
    fetchLeaveData();
  }, [selectedMonth, selectedCompany]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1>Monthly Reconciliation Report</h1>
          <p style={styles.subtitle}>Finance Officer • Generate monthly billing reconciliation</p>
        </div>
        <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Filters Section */}
      <div style={styles.filtersCard}>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>Select Month</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.select}
            >
              {months.map(month => (
                <option key={month.id} value={month.id}>
                  {month.name} ({month.status})
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.label}>Parent Company</label>
            <select 
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={styles.select}
            >
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.label}>Status</label>
            <div style={styles.statusIndicator}>
              {reconciliationData.length} approved leaves found
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {reconciliationData.length > 0 && (
        <div style={styles.reportCard}>
          <div style={styles.reportHeader}>
            <h3>Reconciliation Preview: {months.find(m => m.id === selectedMonth)?.name}</h3>
            <span style={styles.companyBadge}>{selectedCompany}</span>
          </div>
          
          {/* Summary Stats */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}>
              <div style={styles.summaryValue}>
                ${reconciliationData.reduce((sum, d) => sum + d.calculatedCost, 0).toLocaleString()}
              </div>
              <div style={styles.summaryLabel}>Total Billed</div>
            </div>
            
            <div style={styles.summaryItem}>
              <div style={styles.summaryValue}>
                ${reconciliationData.reduce((sum, d) => sum + d.actualAmount, 0).toLocaleString()}
              </div>
              <div style={styles.summaryLabel}>Parent Company Total</div>
            </div>
            
            <div style={styles.summaryItem}>
              <div style={{
                ...styles.summaryValue,
                color: reconciliationData.reduce((sum, d) => sum + d.variance, 0) >= 0 ? '#28a745' : '#dc3545'
              }}>
                ${reconciliationData.reduce((sum, d) => sum + d.variance, 0).toLocaleString()}
              </div>
              <div style={styles.summaryLabel}>Total Variance</div>
            </div>
            
            <div style={styles.summaryItem}>
              <div style={styles.summaryValue}>
                {reconciliationData.length}
              </div>
              <div style={styles.summaryLabel}>Leave Records</div>
            </div>
          </div>
          
          {/* Data Table */}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Staff</th>
                  <th style={styles.th}>Leave Type</th>
                  <th style={styles.th}>Dates</th>
                  <th style={styles.th}>Days</th>
                  <th style={styles.th}>Daily Rate</th>
                  <th style={styles.th}>Billed</th>
                  <th style={styles.th}>Actual</th>
                  <th style={styles.th}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationData.map((item, index) => (
                  <tr key={index}>
                    <td style={styles.td}>{item.staffName}</td>
                    <td style={styles.td}>{item.leaveType}</td>
                    <td style={styles.td}>{item.startDate} to {item.endDate}</td>
                    <td style={styles.td}>{item.totalDays}</td>
                    <td style={styles.td}>${item.dailyRateAtLeave}</td>
                    <td style={styles.td}>${item.calculatedCost}</td>
                    <td style={styles.td}>${item.actualAmount}</td>
                    <td style={{
                      ...styles.td,
                      color: item.variance >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: '600'
                    }}>
                      ${item.variance} ({item.variancePercent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actionsCard}>
        <div style={styles.buttonGroup}>
          <button 
            onClick={generateReport}
            disabled={loading || reconciliationData.length === 0}
            style={loading ? styles.buttonDisabled : styles.primaryButton}
          >
            {loading ? 'Generating Report...' : 'Generate Reconciliation Report'}
          </button>
          
          <button 
            onClick={exportToCSV}
            disabled={reconciliationData.length === 0}
            style={styles.secondaryButton}
          >
            Export to CSV
          </button>
        </div>
        
        {reportGenerated && (
          <div style={styles.successMessage}>
            ✅ Report generated successfully! Check Firestore "reconciliation_reports" collection.
          </div>
        )}
      </div>
    </div>
  );
}

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
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginBottom: '20px',
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
  },
  select: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    backgroundColor: 'white',
  },
  statusIndicator: {
    padding: '10px',
    backgroundColor: '#e7f3ff',
    borderRadius: '6px',
    textAlign: 'center',
    fontWeight: '600',
    color: '#007bff',
  },
  reportCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee',
  },
  companyBadge: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '5px 15px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
    marginBottom: '25px',
  },
  summaryItem: {
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
    borderTop: '3px solid #007bff',
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
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #eee',
  },
  actionsCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  },
  primaryButton: {
    padding: '15px 30px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    flex: 1,
  },
  secondaryButton: {
    padding: '15px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    padding: '15px 30px',
    backgroundColor: '#ccc',
    color: '#666',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'not-allowed',
    flex: 1,
  },
  successMessage: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '15px',
    borderRadius: '6px',
    textAlign: 'center',
    fontWeight: '600',
  },
};

export default MonthlyReconciliation;