import express from 'express';
import cors from 'cors'; // Required for Frontend-to-Backend communication
import bodyParser from 'body-parser';
import argon2 from 'node-argon2';

const app = express();

// MIDDLEWARE
app.use(cors()); // This tells the browser: "It's okay to accept requests from my frontend"
app.use(express.json()); // This allows the backend to read JSON sent by your frontend

// ROUTES
app.get('/', (_req, res) => {
  res.send('Welcome to the reservation system API!');
});

// The "Health Check" route your frontend button calls
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Alive', 
    message: 'Backend is talking to Frontend!',
    timestamp: new Date().toISOString()
  });
});

app.post('/register', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  const usernameValid = /^[a-zA-Z0-9_]{1,20}/.test(username);
  if (!usernameValid) {
    return res.json({
      'error': 'invalid username'
    });
  }
  const passwordValid = /^.{1,100}/.test(password);
  if (!passwordValid) {
    return res.json({
      'error': 'invalid password'
    });
  }

  const hash = await argon2.hash(password);

  // TODO: return an error if it's already in the database, and insert it otherwise
})

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend is actually listening on http://localhost:${PORT}`);
});