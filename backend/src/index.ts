import express from 'express';
import cors from 'cors'; // Required for Frontend-to-Backend communication
import * as argon2 from 'argon2';
import inventoryRoutes from "./routes/inventory.js";

import * as database from './database.js'

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

// from https://emailregex.com lol
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

app.post('/register', async (req, res) => {
  let email = req.body.email;
  const password = req.body.password;

  email = email.toLowerCase();

  const emailValid = emailRegex.test(email);
  if (!emailValid) {
    return res.json({
      'error': 'invalid email'
    });
  }

  const passwordValid = /^.{1,100}/.test(password);
  if (!passwordValid) {
    return res.json({
      'error': 'invalid password'
    });
  }

  const passwordHash = await argon2.hash(password);

  database.tryRegister(email, passwordHash);

  res.json({
    'message': 'Successfully registered!'
  });
})
// INVENTORY ROUTES
app.use("/api/inventory", inventoryRoutes);

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend is actually listening on http://localhost:${PORT}`);
});