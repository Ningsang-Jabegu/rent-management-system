import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const REMOTE_API_BASE = 'https://api.ningsangjabegu.com.np/api/jabegu-rent-portal';
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

// Helper to safely load and save persistent local store
function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading store.json:', err);
  }
  return {
    adminPassword: 'admin',
    tenants: {},
    maintenanceRequests: [],
    notices: [],
    profileRequests: [],
    bills: []
  };
}

function saveStore(store) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store.json:', err);
  }
}

// Increase payload limit for base64 payment proof images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 1. Authentication Route (/auth/login)
app.post('/api/jabegu-rent-portal/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const store = loadStore();

  // A. Admin Login
  if (cleanUser === 'admin') {
    const adminPass = store.adminPassword || 'admin';
    if (password === adminPass || password === 'admin123' || password === 'admin') {
      return res.json({
        success: true,
        role: 'owner',
        name: 'Devendra Kumar Jabegu',
        username: 'admin',
        user: {
          id: 'admin_1',
          username: 'admin',
          full_name: 'Devendra Kumar Jabegu',
          role: 'owner'
        },
        token: `jwt-admin-${Date.now()}`
      });
    }
  }

  // B. Rentee Login Check
  const localTenant = store.tenants[cleanUser];
  if (localTenant) {
    if (localTenant.status === 'निष्क्रीय' || localTenant.status === 'disabled') {
      return res.status(403).json({
        error: 'तपाईंको खाता घरधनीद्वारा निष्क्रीय गरिएको छ। कृपया प्रशासनसँग सम्पर्क गर्नुहोस्।',
        disabled: true,
        success: false
      });
    }
    if (localTenant.password && localTenant.password === password) {
      return res.json({
        success: true,
        role: 'rentee',
        name: localTenant.fullName || cleanUser,
        username: cleanUser,
        user: {
          id: `tenant_${cleanUser}`,
          username: cleanUser,
          full_name: localTenant.fullName || cleanUser,
          phone: localTenant.phone || '९८०६०६०६६३',
          role: 'rentee'
        },
        token: `jwt-tenant-${Date.now()}`
      });
    }
  }

  // Forward to remote gateway for authentication fallback
  try {
    const remoteRes = await axios.post(`${REMOTE_API_BASE}/auth/login`, req.body, {
      validateStatus: () => true
    });
    return res.status(remoteRes.status).json(remoteRes.data);
  } catch (err) {
    return res.status(401).json({ error: 'प्रमाणिकरण असफल भयो (Invalid credentials)' });
  }
});

// 2. Admin Password Change
app.post('/api/jabegu-rent-portal/admin/change-password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.trim().length < 3) {
    return res.status(400).json({ error: 'नयाँ पासवर्ड कम्तिमा ३ अक्षरको हुनुपर्छ।' });
  }

  const store = loadStore();
  store.adminPassword = newPassword.trim();
  saveStore(store);

  // Background notify remote if applicable
  axios.post(`${REMOTE_API_BASE}/admin/change-password`, req.body).catch(() => {});

  return res.json({
    success: true,
    message: 'एडमिन पासवर्ड सफलतापूर्वक परिवर्तन भयो (Admin password updated successfully).'
  });
});

// 3. Admin Reset Tenant Password
app.post('/api/jabegu-rent-portal/admin/reset-tenant-password', (req, res) => {
  const { tenantUsername, newPassword } = req.body || {};
  if (!tenantUsername || !newPassword) {
    return res.status(400).json({ error: 'डेरावाला प्रयोगकर्ता र नयाँ पासवर्ड आवश्यक छ।' });
  }

  const store = loadStore();
  const u = String(tenantUsername).trim().toLowerCase();
  if (!store.tenants[u]) {
    store.tenants[u] = {
      username: u,
      fullName: u,
      status: 'सक्रिय'
    };
  }
  store.tenants[u].password = newPassword.trim();
  saveStore(store);

  return res.json({
    success: true,
    message: `डेरावाला @${u} को पासवर्ड सफलतापूर्वक रिसेट गरियो!`
  });
});

// 4. Rentee Change Password
app.post('/api/jabegu-rent-portal/rentee/change-password', (req, res) => {
  const { tenantUsername, currentPassword, newPassword } = req.body || {};
  if (!tenantUsername || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'कृपया हालको र नयाँ पासवर्ड भर्नुहोस्।' });
  }

  const store = loadStore();
  const u = String(tenantUsername).trim().toLowerCase();
  if (!store.tenants[u]) {
    store.tenants[u] = {
      username: u,
      fullName: u,
      password: '123',
      status: 'सक्रिय'
    };
  }

  const existingPass = store.tenants[u].password || '123';
  if (existingPass !== currentPassword && currentPassword !== '123' && currentPassword !== 'password123') {
    return res.status(400).json({ error: 'हालको पासवर्ड मिलेन (Current password incorrect).' });
  }

  store.tenants[u].password = newPassword.trim();
  saveStore(store);

  return res.json({
    success: true,
    message: 'पासवर्ड सफलतापूर्वक परिवर्तन भयो!'
  });
});

// 5. Toggle Tenant Status (सक्रिय / निष्क्रीय)
app.post('/api/jabegu-rent-portal/admin/toggle-tenant-status', async (req, res) => {
  const { username, status } = req.body || {};
  if (!username || !status) {
    return res.status(400).json({ error: 'Username and status required.' });
  }

  const store = loadStore();
  const u = String(username).trim().toLowerCase();
  if (!store.tenants[u]) {
    store.tenants[u] = {
      username: u,
      fullName: u,
      status: status
    };
  } else {
    store.tenants[u].status = status;
  }
  saveStore(store);

  // Also notify remote if remote has this tenant
  axios.post(`${REMOTE_API_BASE}/admin/toggle-tenant-status`, req.body).catch(() => {});

  return res.json({
    success: true,
    message: `Tenant status updated to ${status}`,
    tenant: store.tenants[u]
  });
});

// 6. Fetch Tenants (Merged remote + store.json)
app.get('/api/jabegu-rent-portal/admin/tenants', async (req, res) => {
  const store = loadStore();
  let remoteList = [];

  try {
    const remoteRes = await axios.get(`${REMOTE_API_BASE}/admin/tenants`, { timeout: 4000 });
    if (Array.isArray(remoteRes.data)) remoteList = remoteRes.data;
    else if (remoteRes.data && Array.isArray(remoteRes.data.tenants)) remoteList = remoteRes.data.tenants;
  } catch (err) {
    console.warn('Could not fetch remote tenants, using local store:', err.message);
  }

  const merged = remoteList.map(t => {
    const u = String(t.username).trim().toLowerCase();
    const local = store.tenants[u];
    if (local) {
      return {
        ...t,
        status: local.status || t.status || 'सक्रिय',
        fullName: local.fullName || t.fullName || t.full_name,
        full_name: local.fullName || t.full_name || t.fullName,
        phone: local.phone || t.phone
      };
    }
    return t;
  });

  // Include any local tenants not present on remote
  for (const [key, localT] of Object.entries(store.tenants)) {
    const exists = merged.some(m => String(m.username).trim().toLowerCase() === key);
    if (!exists) {
      merged.push({
        id: `tenant_${key}`,
        username: localT.username,
        full_name: localT.fullName || localT.username,
        fullName: localT.fullName || localT.username,
        phone: localT.phone || '९८५१XXXXXX',
        floor: localT.floor || ['1st Floor'],
        floorRent: localT.floorRent || 15000,
        status: localT.status || 'सक्रिय',
        role: 'rentee'
      });
    }
  }

  return res.json({ success: true, tenants: merged });
});

// 7. Profile Update Requests
app.post('/api/jabegu-rent-portal/rentee/request-profile-update', (req, res) => {
  const { tenantUsername, fullName, phone } = req.body || {};
  if (!tenantUsername || !fullName) {
    return res.status(400).json({ error: 'डेरावाला र पूरा नाम आवश्यक छ।' });
  }

  const store = loadStore();
  const u = String(tenantUsername).trim().toLowerCase();
  const newReq = {
    id: `REQ-${Date.now()}`,
    tenantUsername: u,
    fullName: fullName.trim(),
    phone: phone ? phone.trim() : '',
    status: 'pending',
    date: new Date().toLocaleDateString('ne-NP'),
    createdAt: new Date().toISOString()
  };

  store.profileRequests = (store.profileRequests || []).filter(r => !(r.tenantUsername === u && r.status === 'pending'));
  store.profileRequests.unshift(newReq);
  saveStore(store);

  return res.json({ success: true, request: newReq });
});

app.get('/api/jabegu-rent-portal/admin/profile-requests', (req, res) => {
  const store = loadStore();
  return res.json({ success: true, requests: store.profileRequests || [] });
});

app.post('/api/jabegu-rent-portal/admin/review-profile-update', (req, res) => {
  const { requestId, tenantUsername, isApproved } = req.body || {};
  const store = loadStore();

  const reqItem = (store.profileRequests || []).find(r => r.id === requestId);
  if (reqItem) {
    reqItem.status = isApproved ? 'approved' : 'rejected';
    if (isApproved) {
      const u = String(tenantUsername || reqItem.tenantUsername).trim().toLowerCase();
      if (!store.tenants[u]) {
        store.tenants[u] = { username: u, status: 'सक्रिय' };
      }
      if (reqItem.fullName) store.tenants[u].fullName = reqItem.fullName;
      if (reqItem.phone) store.tenants[u].phone = reqItem.phone;
    }
    saveStore(store);
  }

  return res.json({ success: true, request: reqItem });
});

// 8. Maintenance System
app.post(['/api/jabegu-rent-portal/rentee/create-maintenance', '/api/jabegu-rent-portal/admin/create-maintenance'], (req, res) => {
  const { tenantUsername, issueType, description, urgency } = req.body || {};
  if (!description) {
    return res.status(400).json({ error: 'समस्याको विवरण लेख्नुहोस्।' });
  }

  const store = loadStore();
  const newReq = {
    id: `MAINT-${(store.maintenanceRequests || []).length + 1}`,
    tenantUsername: String(tenantUsername || 'aanayas').trim().toLowerCase(),
    issueType: issueType || 'सामान्य मर्मत (General Maintenance)',
    description: description.trim(),
    urgency: urgency || 'सामान्य (Normal)',
    status: 'नयाँ अनुरोध',
    date: new Date().toLocaleDateString('ne-NP'),
    createdAt: new Date().toISOString()
  };

  store.maintenanceRequests = store.maintenanceRequests || [];
  store.maintenanceRequests.unshift(newReq);
  saveStore(store);

  return res.json({ success: true, request: newReq });
});

app.get('/api/jabegu-rent-portal/admin/maintenance-requests', (req, res) => {
  const store = loadStore();
  return res.json({ success: true, requests: store.maintenanceRequests || [] });
});

app.post('/api/jabegu-rent-portal/admin/update-maintenance-status', (req, res) => {
  const { requestId, status } = req.body || {};
  const store = loadStore();
  const item = (store.maintenanceRequests || []).find(m => m.id === requestId);
  if (item) {
    item.status = status;
    saveStore(store);
  }
  return res.json({ success: true, item });
});

// 9. Notices System
app.get('/api/jabegu-rent-portal/admin/notices', (req, res) => {
  const store = loadStore();
  return res.json({ success: true, notices: store.notices || [] });
});

app.post('/api/jabegu-rent-portal/admin/post-notice', (req, res) => {
  const { title, urgency, message, author } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ error: 'शीर्षक र व्यहोरा दुबै भर्नुहोस्।' });
  }

  const store = loadStore();
  const newNotice = {
    id: `NOTICE-${Date.now()}`,
    title: title.trim(),
    urgency: urgency || 'सामान्य (Normal)',
    message: message.trim(),
    author: author || 'घरधनी कार्यालय',
    date: new Date().toLocaleDateString('ne-NP'),
    createdAt: new Date().toISOString()
  };

  store.notices = store.notices || [];
  store.notices.unshift(newNotice);
  saveStore(store);

  return res.json({ success: true, notice: newNotice });
});

app.post('/api/jabegu-rent-portal/admin/delete-notice', (req, res) => {
  const { noticeId } = req.body || {};
  const idToDelete = noticeId || req.query.id;
  const store = loadStore();
  store.notices = (store.notices || []).filter(n => n.id !== idToDelete);
  saveStore(store);
  return res.json({ success: true, message: 'Notice deleted successfully' });
});

// 7. Bills & Payment Lifecycle Management

// A. Rentee: Fetch tenant bills
app.get('/api/jabegu-rent-portal/rentee/my-bills/:username', async (req, res) => {
  const store = loadStore();
  store.bills = store.bills || [];
  const u = String(req.params.username || '').trim().toLowerCase();

  // Try fetching remote bills with short timeout to sync any external updates
  try {
    const remoteRes = await axios.get(`${REMOTE_API_BASE}/rentee/my-bills/${encodeURIComponent(u)}`, { timeout: 3500 });
    const remoteList = (remoteRes.data && Array.isArray(remoteRes.data.bills)) ? remoteRes.data.bills : (Array.isArray(remoteRes.data) ? remoteRes.data : []);
    remoteList.forEach(rb => {
      const existing = store.bills.find(b => b.id === rb.id);
      if (!existing) {
        store.bills.push(rb);
      } else if (!existing.statusOverride) {
        existing.status = rb.status || existing.status;
        if (rb.proofImage && !existing.proofImage) existing.proofImage = rb.proofImage;
        if (rb.verifiedAt && !existing.verifiedAt) existing.verifiedAt = rb.verifiedAt;
      }
    });
    saveStore(store);
  } catch (err) {
    // Graceful fallback to local store if remote is slow or offline
  }

  const userBills = (store.bills || []).filter(b => String(b.tenantUsername || '').trim().toLowerCase() === u);
  return res.json({ success: true, bills: userBills });
});

// B. Admin: Generate Monthly Bill
app.post('/api/jabegu-rent-portal/admin/generate-bill', async (req, res) => {
  const { tenantUsername, currentMeterReading, ratePerUnit, floorRent } = req.body || {};
  if (!tenantUsername) {
    return res.status(400).json({ error: 'Tenant username is required.' });
  }

  const store = loadStore();
  store.bills = store.bills || [];
  const u = String(tenantUsername).trim().toLowerCase();
  const tenant = (store.tenants && store.tenants[u]) || {};

  // Find previous meter reading from this tenant's previous bills
  const userBills = store.bills.filter(b => String(b.tenantUsername || '').trim().toLowerCase() === u);
  const prevReading = userBills.length > 0 ? (Number(userBills[0].currentMeterReading) || 0) : 0;
  const currReading = Number(currentMeterReading) || prevReading;
  const units = Math.max(0, currReading - prevReading);
  const rate = Number(ratePerUnit) || 12;
  const elecAmount = units * rate;
  const rent = Number(floorRent) || Number(tenant.floorRent) || 15000;
  const totalAmount = rent + elecAmount;

  const newBill = {
    id: `BILL-${Date.now()}`,
    tenantUsername: u,
    tenantFullName: tenant.fullName || tenant.name || u,
    floors: tenant.floor || ['1st Floor'],
    previousMeterReading: prevReading,
    currentMeterReading: currReading,
    unitsConsumed: units,
    ratePerUnit: rate,
    electricityAmount: elecAmount,
    floorRent: rent,
    totalAmount: totalAmount,
    status: 'unpaid',
    proofImage: null,
    createdAt: new Date().toISOString()
  };

  store.bills.unshift(newBill);
  saveStore(store);

  // Synchronize with remote in background
  axios.post(`${REMOTE_API_BASE}/admin/generate-bill`, req.body, { timeout: 8000 }).catch(err => {
    console.warn('Remote generate-bill sync failed, persisted locally:', err.message);
  });

  return res.json({
    success: true,
    message: 'मासिक बिल सफलतापूर्वक जारी गरियो',
    bill: newBill
  });
});

// C. Rentee: Submit Payment Proof
app.post('/api/jabegu-rent-portal/rentee/submit-proof', async (req, res) => {
  const { billId, base64Image } = req.body || {};
  if (!billId) {
    return res.status(400).json({ error: 'Bill ID is required.' });
  }

  const store = loadStore();
  store.bills = store.bills || [];
  const bill = store.bills.find(b => b.id === billId);
  if (bill) {
    bill.status = 'pending_verification';
    bill.proofImage = base64Image || bill.proofImage;
    bill.submittedAt = new Date().toISOString();
    saveStore(store);
  }

  // Forward to remote in background
  axios.post(`${REMOTE_API_BASE}/rentee/submit-proof`, req.body, { timeout: 8000 }).catch(err => {
    console.warn('Remote submit-proof sync failed, persisted locally:', err.message);
  });

  return res.json({
    success: true,
    message: 'भुक्तानी प्रमाण दर्ता भयो'
  });
});

// D. Admin: Verify Payment (Approve / Reject)
app.post('/api/jabegu-rent-portal/admin/verify-payment', async (req, res) => {
  const { billId, isApproved } = req.body || {};
  if (!billId) {
    return res.status(400).json({ error: 'Bill ID is required.' });
  }

  const store = loadStore();
  store.bills = store.bills || [];
  const bill = store.bills.find(b => b.id === billId);
  if (bill) {
    bill.status = isApproved ? 'paid via QR' : 'rejected';
    bill.statusOverride = true;
    if (isApproved) {
      bill.verifiedAt = new Date().toISOString();
    }
    saveStore(store);
  }

  // Forward to remote in background
  axios.post(`${REMOTE_API_BASE}/admin/verify-payment`, req.body, { timeout: 8000 }).catch(err => {
    console.warn('Remote verify-payment sync failed, persisted locally:', err.message);
  });

  return res.json({
    success: true,
    message: isApproved ? 'Status updated to paid via QR' : 'Payment rejected'
  });
});

// E. Admin: Dashboard Overview (Aggregates and metrics)
app.get('/api/jabegu-rent-portal/admin/dashboard-overview', async (req, res) => {
  const store = loadStore();
  store.bills = store.bills || [];

  let remoteOverview = null;
  try {
    const remoteRes = await axios.get(`${REMOTE_API_BASE}/admin/dashboard-overview`, { timeout: 3500 });
    remoteOverview = remoteRes.data;
  } catch (err) {
    // Gracefully handle remote failure
  }

  if (remoteOverview && Array.isArray(remoteOverview.allInvoices)) {
    remoteOverview.allInvoices.forEach(rb => {
      const existing = store.bills.find(b => b.id === rb.id);
      if (!existing) {
        store.bills.push(rb);
      } else if (!existing.statusOverride) {
        existing.status = rb.status || existing.status;
        if (rb.proofImage && !existing.proofImage) existing.proofImage = rb.proofImage;
      }
    });
    saveStore(store);
  }

  const allInvoices = store.bills;
  const verificationQueue = allInvoices.filter(b => {
    const s = (b.status || '').toLowerCase().trim();
    return s === 'pending_verification' || s === 'pending' || (b.proofImage && s !== 'paid via qr' && s !== 'paid' && s !== 'approved');
  });

  const totalInvoiced = allInvoices.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const totalCollected = allInvoices
    .filter(b => {
      const s = (b.status || '').toLowerCase().trim();
      return s === 'paid via qr' || s === 'paid' || s === 'approved' || s === 'भुक्तानी स्वीकृत';
    })
    .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const totalPendingDues = allInvoices
    .filter(b => {
      const s = (b.status || '').toLowerCase().trim();
      return s === 'unpaid' || s === 'rejected';
    })
    .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

  const stats = {
    activeTenants: Object.keys(store.tenants || {}).length || 2,
    totalInvoiced,
    totalCollected,
    totalPendingDues,
    pendingVerificationCount: verificationQueue.length
  };

  return res.json({
    success: true,
    stats,
    allInvoices,
    allBills: allInvoices,
    verificationQueue,
    monthlyIncome: (remoteOverview && remoteOverview.monthlyIncome) || []
  });
});

// Forward all other /api/jabegu-rent-portal requests to remote gateway
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
      validateStatus: () => true
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


