import express from 'express';


const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.get('/', (_req, res) => {
  res.send('Welcome to the reservation system!');
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});