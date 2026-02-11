import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { useAuth } from '../contexts/AuthContext';

function LeaveApplication() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    leaveType: 'Annual Leave',
    startDate: '',
    endDate: '',
    parentCompanyRefId: '',
    reason: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const leaveTypes = [
    { value: 'Annual Leave', label: 'Annual Leave (Chargeable)', chargeable: true },
    { value: 'Medical (MC)', label: 'Medical Leave with MC (Non-Chargeable)', chargeable: false }, 
    { value: 'Medical (No MC)', label: 'Medical Leave without MC (Non-Chargeable)', chargeable: false },
    { value: 'Unpaid Leave', label: 'Unpaid Leave (Non-Chargeable)', chargeable: false },
    { value: 'Compassionate Leave', label: 'Compassionate Leave (Chargeable)', chargeable: true },
  ];

  const calculateTotalDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to submit a leave application.');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Please select both start and end dates.');
      return;
    }

    const totalDays = calculateTotalDays();
    if (totalDays <= 0) {
      setError('End date must be after start date.');
      return;
    }

    const selectedLeaveType = leaveTypes.find(type => type.value === formData.leaveType);
    
    try {
      setLoading(true);
      setError('');

      // 1. GET USER'S COMPLETE DATA FROM USERS COLLECTION
      let staffName = currentUser.email.split('@')[0];
      let parentCompany = ''; // NEW
      let dailyRate = 0; // NEW
      
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          
          staffName = userData.name; // Get name from users collection
          parentCompany = userData.parentCompany; // NEW: Get company
          dailyRate = userData.dailyRate || 0; // NEW: Get daily rate
          
          console.log('User data loaded:', { staffName, parentCompany, dailyRate });
        } else {
          setError('User profile not found. Please contact administrator.');
          setLoading(false);
          return;
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
        setError('Error loading user profile. Please try again.');
        setLoading(false);
        return;
      }

      // 2. CREATE COMPLETE LEAVE APPLICATION DATA
      const leaveApplication = {
        staffId: currentUser.uid,
        staffEmail: currentUser.email,
        staffName: staffName,
        
        // NEW CRITICAL FIELDS:
        parentCompany: parentCompany, // "ABC Staffing", "DEF Staffing", etc.
        dailyRateAtLeave: dailyRate, // Snapshot of rate at time of leave
        
        // Existing fields:
        leaveType: formData.leaveType,
        isChargeable: selectedLeaveType.chargeable,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays: totalDays,
        reason: formData.reason,
        parentCompanyRefId: formData.parentCompanyRefId,
        
        // NEW: Calculate cost if chargeable
        calculatedCost: selectedLeaveType.chargeable ? totalDays * dailyRate : 0,
        
        // Status should indicate it's with manager (not just "pending")
        status: 'pending', // Changed from 'pending'
        
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Submitting leave application:', leaveApplication);
      
      // 3. WRITE TO FIRESTORE
      await addDoc(collection(db, 'leaveApplications'), leaveApplication);
      
      alert('Leave application submitted successfully!');
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error submitting leave application:', error);
      setError('Failed to submit leave application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Leave Application Form</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          ← Back to Dashboard
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.formCard}>
        <form onSubmit={handleSubmit}>
          {/* Leave Type */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Leave Type *</label>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              style={styles.select}
              required
            >
              {leaveTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]} // Prevent past dates
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>End Date *</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate || new Date().toISOString().split('T')[0]} // KEY: Can't be before start date
                style={styles.input}
                required
              />
            </div>
          </div>

          {/* Total Days (auto-calculated) */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Total Days</label>
            <div style={styles.displayField}>
              {calculateTotalDays()} days
              {calculateTotalDays() > 0 && (
                <span style={styles.daysNote}>
                  ({formData.startDate} to {formData.endDate})
                </span>
              )}
            </div>
          </div>

          {/* Parent Company Reference */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Parent Company Reference ID *</label>
            <input
              type="text"
              name="parentCompanyRefId"
              value={formData.parentCompanyRefId}
              onChange={handleChange}
              placeholder="e.g., ABC-2026-001"
              style={styles.input}
              required
            />
          </div>

          {/* Reason */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Reason *</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Enter reason for leave..."
              style={{...styles.input, ...styles.textarea}}
              rows="4"
              required
            />
          </div>

          {/* Buttons */}
          <div style={styles.buttonGroup}>
            <button 
              type="submit" 
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Leave Application'}
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/dashboard')}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
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
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
  },
  formCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#333',
  },
  select: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    backgroundColor: 'white',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    backgroundColor: '#f9f9f9',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
  },
  displayField: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f8f9fa',
    fontSize: '16px',
    color: '#333',
  },
  daysNote: {
    fontSize: '14px',
    color: '#666',
    marginLeft: '10px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    marginTop: '30px',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    flex: 1,
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    flex: 1,
  },
};

export default LeaveApplication;