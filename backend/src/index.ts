import express from 'express';
import cors from 'cors';


const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.get('/', (_req, res) => {
  res.send('Welcome to the reservation system!');
});
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Alive', 
    message: 'Backend is talking to Frontend!',
    timestamp: new Date().toISOString()
  });
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});