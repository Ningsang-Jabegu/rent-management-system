import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import loginHandler from './api/login.js';
import getUserNameHandler from './api/get-user-name.js';
import backupHandler from './api/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Endpoints
app.all('/api/login', async (req, res, next) => {
  try {
    await loginHandler(req, res);
  } catch (error) {
    next(error);
  }
});

app.all('/api/get-user-name', async (req, res, next) => {
  try {
    await getUserNameHandler(req, res);
  } catch (error) {
    next(error);
  }
});

app.all('/api/backup', async (req, res, next) => {
  try {
    await backupHandler(req, res);
  } catch (error) {
    next(error);
  }
});

// Serve static assets
app.use(express.static(__dirname));

// Fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'आन्तरिक सर्भर त्रुटि (Internal Server Error)' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rent Portal server running at http://0.0.0.0:${PORT}`);
});
