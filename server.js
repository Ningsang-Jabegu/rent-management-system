import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const REMOTE_API_BASE = 'https://api.ningsangjabegu.com.np/api/jabegu-rent-portal';

// Increase payload limit for base64 payment proof images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Forward all /api/jabegu-rent-portal requests to remote gateway
app.use('/api/jabegu-rent-portal', async (req, res) => {
  const targetUrl = `${REMOTE_API_BASE}${req.url}`;

  try {
    const config = {
      method: req.method,
      url: targetUrl,
      params: req.query,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers['accept'] || 'application/json, image/*, */*'
      },
      validateStatus: () => true // Allow any status code to be forwarded directly
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      config.data = req.body;
    }

    if (req.url.startsWith('/rentee/payment-proof/')) {
      config.responseType = 'arraybuffer';
    }

    const remoteRes = await axios(config);

    if (remoteRes.headers['content-type']) {
      res.setHeader('Content-Type', remoteRes.headers['content-type']);
    }
    return res.status(remoteRes.status).send(remoteRes.data);
  } catch (error) {
    console.error(`Proxy error for ${targetUrl}:`, error.message);
    const status = error.response ? error.response.status : 502;
    const data = error.response ? error.response.data : { error: 'Remote gateway error', message: error.message };
    return res.status(status).json(data);
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

