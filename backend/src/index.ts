import express from 'express';
import cors from 'cors'; // Required for Frontend-to-Backend communication
import inventoryRoutes from "./routes/inventory.js";
import authRoutes from "./routes/auth.js";
import reservationRoutes from "./routes/reservations.js";
import packageRoutes from "./routes/packages.js";
import cookieParser from 'cookie-parser';
import './notifications.js';


const app = express();

// MIDDLEWARE
app.use(cors({
  origin: true, // Allow requests from frontend
  credentials: true // Allow cookies to be sent
})); 
app.use(express.json()); // allows the backend to read JSON sent byfrontend
app.use(cookieParser())
app.use('/uploads', express.static('uploads'));

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

// INVENTORY ROUTES
app.use("/api", inventoryRoutes);

//AUTHENTICATION 
app.use("/api/auth", authRoutes);

// RESERVATIONS
app.use("/api", reservationRoutes);

// PACKAGES / EVENTS
app.use('/api', packageRoutes);

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend is actually listening on http://localhost:${PORT}`);
});