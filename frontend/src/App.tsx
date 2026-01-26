import { useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState("Not connected yet");

  const checkConnection = async () => {
    try {
      // Logic: Try to hit the backend IP on port 3000
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Error: Could not reach backend. Check CORS or Firewall.");
      console.error(error);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>System Integration Test</h1>
      <button onClick={checkConnection} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Test Backend Connection
      </button>
      <p style={{ marginTop: '20px', fontWeight: 'bold', color: 'blue' }}>
        {message}
      </p>
    </div>
  )
}



export default App
