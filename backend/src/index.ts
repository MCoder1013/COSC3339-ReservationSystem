import express from 'express';
import cors from 'cors'; // Required for Frontend-to-Backend communication
import inventoryRoutes from "./routes/inventory.js";
import authRoutes from "./routes/auth.js";
import cookieParser from 'cookie-parser';

const app = express();

// MIDDLEWARE
app.use(cors()); // This tells the browser: "It's okay to accept requests from my frontend"
app.use(express.json()); // This allows the backend to read JSON sent by your frontend
app.use(cookieParser())

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

// INVENTORY ROUTES
app.use("/api", inventoryRoutes);
app.use("/api/auth", authRoutes);

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend is actually listening on http://localhost:${PORT}`);
});