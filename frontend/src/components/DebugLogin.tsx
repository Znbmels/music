import React from 'react';

const DebugLogin = () => {
  const setupTestTokens = () => {
    const testTokens = {
      access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFza2FhIiwiZXhwIjoxNzgzMDY5MDExfQ.7JkTgolUwxmKFIwL-_vdU5WvD5CSfXfS2QZIR0NPeKg",
      refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFza2FhIiwiZXhwIjoxNzkxNzQ0ODAwfQ.rSgIUm9WpUOXNQRNb_T5h7ChxQj-oUQl7cf_I7v8b2Y"
    };

    localStorage.setItem('vibetunes_tokens', JSON.stringify(testTokens));
    alert('Test tokens set up! Reload the page to log in.');
  };

  const clearTokens = () => {
    localStorage.removeItem('vibetunes_tokens');
    alert('Auth tokens removed! You are now logged out.');
  };

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/health-check');
      if (response.ok) {
        alert(`Backend connection successful: ${response.status}`);
      } else {
        alert(`Backend responded with status: ${response.status}`);
      }
    } catch (error: any) {
      alert(`Connection error: ${error.message}`);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>Debug Tools</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <button 
          onClick={setupTestTokens}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Set Test Tokens
        </button>
        <button 
          onClick={clearTokens}
          style={{
            background: '#f44336',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Clear Tokens
        </button>
        <button 
          onClick={checkConnection}
          style={{
            background: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Test Connection
        </button>
      </div>
    </div>
  );
};

export default DebugLogin; 