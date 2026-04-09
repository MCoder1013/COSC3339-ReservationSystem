import express from 'express';
import cors from 'cors'; // Required for Frontend-to-Backend communication
import inventoryRoutes from "./routes/inventory.js";
import authRoutes from "./routes/auth.js";
import reservationRoutes from "./routes/reservations.js";
import packageRoutes from "./routes/packages.js";
import cookieParser from 'cookie-parser';
import './notifications.js';
import { authRequiredMiddleware, userMiddleware } from './routes/index.js';


const app = express();

// MIDDLEWARE
app.use(cors({
  // Allow requests from frontend
  origin: true,
  // Allow cookies to be sent
  credentials: true
}));
// Allows the backend to read JSON sent by frontend
app.use(express.json());
app.use(cookieParser())
app.use('/uploads', express.static('uploads'));
// Ensures that the `req.userId` field is set
app.use(userMiddleware);

// ROUTES
app.get('/', (_req, res) => {
  res.send('Welcome to the reservation system API!');
});

// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'Alive',
//     message: 'Backend is talking to Frontend!',
//     timestamp: new Date().toISOString()
//   });
// });


// AUTHENTICATION 
app.use("/api/auth", authRoutes);

// INVENTORY ROUTES
app.use("/api", inventoryRoutes);

// RESERVATIONS
app.use("/api", reservationRoutes);

// PACKAGES / EVENTS
app.use('/api', packageRoutes);

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend is actually listening on http://localhost:${PORT}`);
});