import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      
      // Try Firebase login
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to login. Please check your credentials and try again.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <h1 style={styles.title}>Leave Management System</h1>
        <p style={styles.subtitle}>Contract Staff Portal</p>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              style={styles.input}
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={styles.input}
            />
          </div>
          
          <button 
            type="submit" 
            style={loading ? styles.buttonDisabled : styles.button}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        
        <div style={styles.testAccounts}>
          <h3 style={styles.testTitle}>Demo Accounts</h3>
          <div style={styles.accountGrid}>
            <div style={styles.accountCard}>
              <div style={styles.accountName}>John Doe</div>
              <div style={styles.accountRole}>Contract Staff</div>
              <div style={styles.accountEmail}>staff@test.com</div>
            </div>
            <div style={styles.accountCard}>
              <div style={styles.accountName}>Sarah Tan</div>
              <div style={styles.accountRole}>Manager</div>
              <div style={styles.accountEmail}>manager@test.com</div>
            </div>
            <div style={styles.accountCard}>
              <div style={styles.accountName}>Bob Lee</div>
              <div style={styles.accountRole}>Finance Officer</div>
              <div style={styles.accountEmail}>finance@test.com</div>
            </div>
          </div>
          <p style={styles.passwordNote}><strong>Password for all accounts:</strong> password123</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px',
  },
  loginBox: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '24px',
    fontWeight: '500',
  },
  error: {
    backgroundColor: '#fff5f5',
    color: '#c53030',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #fed7d7',
    textAlign: 'left',
  },
  form: {
    marginBottom: '24px',
  },
  inputGroup: {
    marginBottom: '16px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    marginTop: '5px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4299e1',
    background: 'linear-gradient(to bottom, #4299e1, #3182ce)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s ease',
    letterSpacing: '0.3px',
    boxShadow: '0 3px 5px rgba(66, 153, 225, 0.3), 0 1px 3px rgba(0, 0, 0, 0.06)',
    '&:hover': {
      background: 'linear-gradient(to bottom, #3182ce, #2c5282)',
      boxShadow: '0 4px 6px rgba(66, 153, 225, 0.4), 0 2px 4px rgba(0, 0, 0, 0.08)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(1px)',
      boxShadow: '0 1px 2px rgba(66, 153, 225, 0.3), 0 1px 2px rgba(0, 0, 0, 0.06)',
    },
  },
  buttonDisabled: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#a0aec0',
    background: 'linear-gradient(to bottom, #a0aec0, #718096)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'not-allowed',
    marginTop: '8px',
    opacity: '0.7',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  testAccounts: {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '10px',
    fontSize: '14px',
    textAlign: 'center',
    marginTop: '20px',
    border: '1px solid #e2e8f0',
  },
  testTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '14px',
  },
  accountGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
    marginBottom: '14px',
  },
  accountCard: {
    backgroundColor: 'white',
    padding: '14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  accountName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '4px',
  },
  accountRole: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: '5px',
  },
  accountEmail: {
    fontSize: '13px',
    color: '#4299e1',
    fontWeight: '500',
  },
  passwordNote: {
    fontSize: '14px',
    color: '#718096',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #e2e8f0',
  }
};

export default Login;