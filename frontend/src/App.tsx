import { useState, useEffect } from 'react';
import { fetchData } from './api';


function App() {
  const [status, setStatus] = useState("Checking...");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchData('/api/health')
      .then(data => {
        if (data.status === 'Alive') {
          setStatus("Connected to Backend");
          setIsConnected(true);
        }
      })
      .catch(() => {
        setStatus("Connection Failed");
        setIsConnected(false);
      });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Reservation System</h1>
      
      {/* The Status Badge */}
      <div style={{
        display: 'inline-block',
        padding: '10px 20px',
        borderRadius: '20px',
        backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
        color: isConnected ? '#155724' : '#721c24',
        border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
        fontWeight: 'bold'
      }}>
        System Status: {status}
      </div>

      <div style={{ marginTop: '20px' }}>
        <p>Welcome to the dashboard. Use the navigation to manage bookings.</p>
      </div>
    </div>
  );
}

export default App;