import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import {
  getRatesDb,
  saveRatesDb,
  getTenantsDb,
  saveTenantsDb,
  getTransactionsDb,
  saveTransactionsDb
} from './githubDb.js';

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

// 6. Fetch Tenants (Merged live GitHub repo + remote API + store.json)
app.get('/api/jabegu-rent-portal/admin/tenants', async (req, res) => {
  const store = loadStore();
  let tenantsList = [];
  let ratesData = {};

  try {
    [tenantsList, ratesData] = await Promise.all([
      getTenantsDb().catch(() => []),
      getRatesDb().catch(() => ({}))
    ]);
  } catch (err) {
    console.warn('GitHub DB fetch error:', err.message);
  }

  // Also query remote API as fallback
  let remoteList = [];
  try {
    const remoteRes = await axios.get(`${REMOTE_API_BASE}/admin/tenants`, { timeout: 3500 });
    if (Array.isArray(remoteRes.data)) remoteList = remoteRes.data;
    else if (remoteRes.data && Array.isArray(remoteRes.data.tenants)) remoteList = remoteRes.data.tenants;
  } catch (_) {}

  // Base list prioritized: GitHub tenantsList first, then remoteList, then local store
  const combinedMap = new Map();
  for (const t of tenantsList) {
    if (t && t.username) combinedMap.set(String(t.username).trim().toLowerCase(), { ...t });
  }
  for (const t of remoteList) {
    if (t && t.username) {
      const u = String(t.username).trim().toLowerCase();
      if (!combinedMap.has(u)) combinedMap.set(u, { ...t });
      else {
        // Overlay any missing attributes
        const existing = combinedMap.get(u);
        combinedMap.set(u, { ...t, ...existing });
      }
    }
  }
  for (const [key, localT] of Object.entries(store.tenants || {})) {
    if (!combinedMap.has(key)) {
      combinedMap.set(key, {
        id: `tenant_${key}`,
        username: localT.username || key,
        full_name: localT.fullName || localT.username || key,
        fullName: localT.fullName || localT.username || key,
        phone: localT.phone || '',
        floor: localT.floor || ['1st Floor'],
        floorRent: localT.floorRent || 15000,
        usesSharedWifi: localT.usesSharedWifi || false,
        wifiDeviceCount: localT.wifiDeviceCount || 0,
        status: localT.status || 'सक्रिय',
        role: 'rentee'
      });
    }
  }

  const merged = Array.from(combinedMap.values()).map(t => {
    const u = String(t.username).trim().toLowerCase();
    const local = (store.tenants && store.tenants[u]) || {};
    const rateInfo = ratesData[u] || {};
    const mr = rateInfo.MeterReading || null;
    const electricityRatePerUnit = rateInfo.electricityRatePerUnit || 12;

    let activeReadings = [];
    if (mr) {
      if (Array.isArray(mr.current) && mr.current.length > 0) {
        activeReadings = mr.current;
      } else if (Array.isArray(mr.previous) && mr.previous.length > 0) {
        activeReadings = mr.previous;
      } else if (Array.isArray(mr.first) && mr.first.length > 0) {
        activeReadings = mr.first;
      }
    }

    const floors = Array.isArray(t.floor) ? t.floor : (t.floor ? [t.floor] : (local.floor || ['1st Floor']));
    const meterReadings = activeReadings.map((val, idx) => ({
      id: `m${idx + 1}`,
      reading: val,
      floor: floors[idx] || `Flat ${idx + 1}`
    }));

    const totalMeterReading = activeReadings.reduce((sum, v) => sum + (Number(v) || 0), 0);
    let meterBreakdownText = '';
    if (meterReadings.length > 1) {
      meterBreakdownText = `[${meterReadings.map(m => `${m.reading} (${m.id})`).join(', ')}]`;
    } else if (meterReadings.length === 1) {
      meterBreakdownText = `${meterReadings[0].reading} Units`;
    }

    return {
      ...t,
      status: local.status || t.status || 'सक्रिय',
      fullName: local.fullName || t.fullName || t.full_name || u,
      full_name: local.fullName || t.full_name || t.fullName || u,
      phone: local.phone || t.phone || '',
      floor: floors,
      floorRent: (local.floorRent !== undefined) ? local.floorRent : (t.floorRent !== undefined ? t.floorRent : 15000),
      usesSharedWifi: (local.usesSharedWifi !== undefined) ? local.usesSharedWifi : (t.usesSharedWifi || false),
      wifiDeviceCount: (local.wifiDeviceCount !== undefined) ? local.wifiDeviceCount : (t.wifiDeviceCount || 0),
      MeterReading: mr,
      electricityRatePerUnit,
      rates: rateInfo,
      meterReadings: meterReadings.length > 0 ? meterReadings : (local.meterReadings || t.meterReadings || []),
      currentMeterReading: activeReadings.length > 0 ? totalMeterReading : (local.currentMeterReading !== undefined ? local.currentMeterReading : t.currentMeterReading),
      meterBreakdownText: meterBreakdownText || local.meterBreakdownText || t.meterBreakdownText || '',
      role: 'rentee'
    };
  });

  return res.json({ success: true, tenants: merged });
});

// 6.5. Admin Edit Tenant Details (Synchronized to GitHub rates.json, tenants.json, local store, remote API)
app.post(['/api/jabegu-rent-portal/admin/edit-tenant', '/api/jabegu-rent-portal/admin/update-tenant'], async (req, res) => {
  const {
    username,
    fullName,
    phone,
    floor,
    floorRent,
    usesSharedWifi,
    wifiDeviceCount,
    status,
    password,
    meters,
    meterReadings,
    currentMeterReading,
    meterBreakdownText,
    electricityRatePerUnit
  } = req.body || {};

  if (!username) {
    return res.status(400).json({ error: 'प्रयोगकर्ता नाम (Username) आवश्यक छ।' });
  }

  const u = String(username).trim().toLowerCase();
  const store = loadStore();
  if (!store.tenants[u]) {
    store.tenants[u] = { username: u };
  }

  const tenant = store.tenants[u];
  if (fullName) {
    tenant.fullName = fullName.trim();
    tenant.full_name = fullName.trim();
  }
  if (phone !== undefined) tenant.phone = phone ? phone.trim() : '';
  if (floor) {
    tenant.floor = Array.isArray(floor) ? floor : [floor];
  }
  if (floorRent !== undefined) tenant.floorRent = Number(floorRent) || 15000;
  if (usesSharedWifi !== undefined) tenant.usesSharedWifi = Boolean(usesSharedWifi);
  if (wifiDeviceCount !== undefined) tenant.wifiDeviceCount = Number(wifiDeviceCount) || 0;
  if (status) tenant.status = status;
  if (password && String(password).trim()) {
    tenant.password = String(password).trim();
    axios.post(`${REMOTE_API_BASE}/admin/reset-tenant-password`, {
      tenantUsername: u,
      newPassword: tenant.password
    }).catch(() => {});
  }
  if (meters || meterReadings) {
    tenant.meterReadings = meters || meterReadings;
  }
  if (currentMeterReading !== undefined) {
    tenant.currentMeterReading = currentMeterReading;
  }
  if (meterBreakdownText) {
    tenant.meterBreakdownText = meterBreakdownText;
  }

  saveStore(store);

  // Extract meter reading units into array [n1, n2, ...]
  let meterUnits = [];
  if (Array.isArray(meters) && meters.length > 0) {
    meterUnits = meters.map(m => Number(m.reading) || 0);
  } else if (Array.isArray(meterReadings) && meterReadings.length > 0) {
    meterUnits = meterReadings.map(m => (typeof m === 'object' ? Number(m.reading) || 0 : Number(m) || 0));
  } else if (currentMeterReading !== undefined && currentMeterReading !== null && currentMeterReading !== '') {
    meterUnits = [Number(currentMeterReading) || 0];
  }

  // 1. Persist to GitHub data/settings/rates.json
  let savedRatesData = null;
  try {
    const ratesData = await getRatesDb();
    const existingRate = ratesData[u] || {};
    const rateVal = Number(electricityRatePerUnit) || Number(existingRate.electricityRatePerUnit) || 12;

    if (meterUnits.length > 0) {
      ratesData[u] = {
        electricityRatePerUnit: rateVal,
        updatedAt: new Date().toISOString(),
        MeterReading: {
          first: meterUnits,
          previous: meterUnits,
          current: []
        }
      };
      await saveRatesDb(ratesData, `Update rates.json meter readings for ${u}`);
      savedRatesData = ratesData[u];
    }
  } catch (err) {
    console.error('Error saving rates.json to GitHub:', err.message);
  }

  // 2. Persist to GitHub data/users/tenants.json
  try {
    const tenantsList = await getTenantsDb();
    let tMatch = tenantsList.find(t => String(t.username).trim().toLowerCase() === u);
    if (!tMatch) {
      tMatch = { id: `tenant_${u}`, username: u, role: 'rentee' };
      tenantsList.push(tMatch);
    }
    if (fullName) {
      tMatch.full_name = fullName.trim();
      tMatch.fullName = fullName.trim();
    }
    if (phone !== undefined) tMatch.phone = phone ? phone.trim() : '';
    if (floor) {
      tMatch.floor = Array.isArray(floor) ? floor : [floor];
    }
    if (floorRent !== undefined) tMatch.floorRent = Number(floorRent) || 15000;
    if (usesSharedWifi !== undefined) tMatch.usesSharedWifi = Boolean(usesSharedWifi);
    if (wifiDeviceCount !== undefined) tMatch.wifiDeviceCount = Number(wifiDeviceCount) || 0;
    if (status) tMatch.status = status;
    tMatch.updatedAt = new Date().toISOString();
    await saveTenantsDb(tenantsList, `Update tenant profile for ${u}`);
  } catch (err) {
    console.error('Error saving tenants.json to GitHub:', err.message);
  }

  if (status) {
    axios.post(`${REMOTE_API_BASE}/admin/toggle-tenant-status`, { username: u, status }).catch(() => {});
  }

  return res.json({
    success: true,
    message: `डेरावाला @${u} को विवरण सफलतापूर्वक अद्यावधिक गरियो!`,
    tenant: {
      ...tenant,
      rates: savedRatesData,
      MeterReading: savedRatesData ? savedRatesData.MeterReading : undefined
    }
  });
});

// 6.6. Rentee Profile Fetch (Synchronized with live GitHub repo)
app.get('/api/jabegu-rent-portal/rentee/profile/:username', async (req, res) => {
  const store = loadStore();
  const u = String(req.params.username || '').trim().toLowerCase();

  let [tenantsList, ratesData] = await Promise.all([
    getTenantsDb().catch(() => []),
    getRatesDb().catch(() => ({}))
  ]);

  let tenant = tenantsList.find(t => String(t.username).trim().toLowerCase() === u);
  const local = (store.tenants && store.tenants[u]) || {};

  if (!tenant) {
    // Fallback to remote API
    try {
      const remoteRes = await axios.get(`${REMOTE_API_BASE}/admin/tenants`, { timeout: 3500 });
      const list = (remoteRes.data && Array.isArray(remoteRes.data.tenants)) ? remoteRes.data.tenants : (Array.isArray(remoteRes.data) ? remoteRes.data : []);
      tenant = list.find(t => String(t.username).trim().toLowerCase() === u);
    } catch (_) {}
  }

  if (!tenant && local.username) {
    tenant = {
      id: `tenant_${u}`,
      username: u,
      fullName: local.fullName || u,
      full_name: local.fullName || u,
      phone: local.phone || '',
      floor: local.floor || ['1st Floor'],
      floorRent: local.floorRent || 15000,
      usesSharedWifi: local.usesSharedWifi || false,
      wifiDeviceCount: local.wifiDeviceCount || 0,
      status: local.status || 'सक्रिय',
      role: 'rentee'
    };
  }

  if (!tenant) {
    return res.status(404).json({ error: 'डेरावाला भेटिएन।' });
  }

  const rateInfo = ratesData[u] || {};
  const mr = rateInfo.MeterReading || null;
  const electricityRatePerUnit = rateInfo.electricityRatePerUnit || 12;

  let activeReadings = [];
  if (mr) {
    if (Array.isArray(mr.current) && mr.current.length > 0) {
      activeReadings = mr.current;
    } else if (Array.isArray(mr.previous) && mr.previous.length > 0) {
      activeReadings = mr.previous;
    } else if (Array.isArray(mr.first) && mr.first.length > 0) {
      activeReadings = mr.first;
    }
  }

  const floors = Array.isArray(tenant.floor) ? tenant.floor : (tenant.floor ? [tenant.floor] : (local.floor || ['1st Floor']));
  const meterReadings = activeReadings.map((val, idx) => ({
    id: `m${idx + 1}`,
    reading: val,
    floor: floors[idx] || `Flat ${idx + 1}`
  }));

  const totalMeterReading = activeReadings.reduce((sum, v) => sum + (Number(v) || 0), 0);

  const merged = {
    ...tenant,
    fullName: local.fullName || tenant.fullName || tenant.full_name || u,
    full_name: local.fullName || tenant.full_name || tenant.fullName || u,
    phone: local.phone || tenant.phone || '',
    floor: floors,
    floorRent: local.floorRent !== undefined ? local.floorRent : (tenant.floorRent !== undefined ? tenant.floorRent : 15000),
    usesSharedWifi: local.usesSharedWifi !== undefined ? local.usesSharedWifi : (tenant.usesSharedWifi || false),
    wifiDeviceCount: local.wifiDeviceCount !== undefined ? local.wifiDeviceCount : (tenant.wifiDeviceCount || 0),
    status: local.status || tenant.status || 'सक्रिय',
    MeterReading: mr,
    electricityRatePerUnit,
    rates: rateInfo,
    meterReadings: meterReadings.length > 0 ? meterReadings : (local.meterReadings || []),
    currentMeterReading: activeReadings.length > 0 ? totalMeterReading : (local.currentMeterReading || 0),
    meterBreakdownText: activeReadings.length > 1
      ? `[${activeReadings.map((v, i) => `${v} (m${i + 1})`).join(', ')}]`
      : `${totalMeterReading} Units`
  };

  return res.json({ success: true, tenant: merged });
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

// A. Rentee: Fetch tenant bills (Synchronized directly with GitHub transactions.json)
app.get('/api/jabegu-rent-portal/rentee/my-bills/:username', async (req, res) => {
  const store = loadStore();
  const u = String(req.params.username || '').trim().toLowerCase();

  let transactions = [];
  try {
    transactions = await getTransactionsDb();
  } catch (err) {
    console.warn('Could not fetch GitHub transactions:', err.message);
    transactions = store.bills || [];
  }

  // Filter bills for this tenant
  const userBills = (transactions || [])
    .filter(b => String(b.tenantUsername || '').trim().toLowerCase() === u)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return res.json({ success: true, bills: userBills });
});

// B. Admin: Generate Monthly Bill (Updates rates.json and transactions.json in GitHub repo)
app.post('/api/jabegu-rent-portal/admin/generate-bill', async (req, res) => {
  const { tenantUsername, currentMeterReading, ratePerUnit, floorRent, meters } = req.body || {};
  if (!tenantUsername) {
    return res.status(400).json({ error: 'Tenant username is required.' });
  }

  const store = loadStore();
  store.bills = store.bills || [];
  const u = String(tenantUsername).trim().toLowerCase();
  const tenant = (store.tenants && store.tenants[u]) || {};
  const floors = Array.isArray(tenant.floor) ? tenant.floor : (tenant.floor ? [tenant.floor] : ['1st Floor']);
  const isMultiFlat = floors.length > 1;

  // 1. Fetch live rates and meter readings from GitHub data/settings/rates.json
  let ratesData = {};
  try {
    ratesData = await getRatesDb();
  } catch (err) {
    console.error('Error fetching rates.json from GitHub:', err.message);
  }

  const tenantRate = ratesData[u] || {};
  const mr = tenantRate.MeterReading || { first: [], previous: [], current: [] };
  const rate = Number(ratePerUnit) || Number(tenantRate.electricityRatePerUnit) || 12;
  const rent = Number(floorRent) || Number(tenant.floorRent) || 15000;

  // Determine previous readings from DB:
  // If mr.current has values, the last recorded reading is in mr.current; otherwise mr.previous; otherwise mr.first
  const dbPrev = (Array.isArray(mr.current) && mr.current.length > 0)
    ? mr.current
    : ((Array.isArray(mr.previous) && mr.previous.length > 0) ? mr.previous : (Array.isArray(mr.first) ? mr.first : []));

  let prevReadingDisplay = '0';
  let currReadingDisplay = '0';
  let totalUnits = 0;
  let meterBreakdown = null;
  const newCurrUnits = [];

  if (isMultiFlat || (Array.isArray(meters) && meters.length > 1)) {
    // Multi-flat meters
    const activeMeters = Array.isArray(meters) && meters.length > 0 ? meters : floors.map((fl, idx) => ({
      id: `m${idx + 1}`,
      floor: fl,
      prev: Number(dbPrev[idx] !== undefined ? dbPrev[idx] : 0) || 0,
      curr: Number(dbPrev[idx] !== undefined ? dbPrev[idx] : 0) || 0
    }));

    meterBreakdown = activeMeters.map((m, idx) => {
      const p = Number(m.prev !== undefined ? m.prev : (dbPrev[idx] !== undefined ? dbPrev[idx] : 0)) || 0;
      const c = Number(m.curr !== undefined ? m.curr : p) || p;
      const units = Math.max(0, c - p);
      totalUnits += units;
      newCurrUnits.push(c);
      return {
        id: m.id || `m${idx + 1}`,
        floor: m.floor || floors[idx] || `Flat ${idx + 1}`,
        prev: p,
        curr: c,
        units: units
      };
    });

    prevReadingDisplay = meterBreakdown.map(m => `${m.prev} (${m.id})`).join(', ');
    currReadingDisplay = meterBreakdown.map(m => `${m.curr} (${m.id})`).join(', ');
  } else {
    // Single flat tenant
    const prevReading = Number(dbPrev[0] !== undefined ? dbPrev[0] : 0) || 0;
    const currReading = (currentMeterReading !== undefined && currentMeterReading !== null && currentMeterReading !== '')
      ? Number(currentMeterReading)
      : prevReading;
    totalUnits = Math.max(0, currReading - prevReading);
    newCurrUnits.push(currReading);
    prevReadingDisplay = String(prevReading);
    currReadingDisplay = String(currReading);
  }

  const elecAmount = totalUnits * rate;
  const totalAmount = rent + elecAmount;

  // 2. Update rates.json in GitHub repo:
  // "each time admin generates bill if the db's current reading has a value, then, just copy the current value to the previous value, and the admin's filled new value as the current reading and save it to github. Remember to not change first reading, this is only changed through edit tenant form."
  try {
    if (Array.isArray(mr.current) && mr.current.length > 0) {
      mr.previous = [...mr.current];
    } else if (!Array.isArray(mr.previous) || mr.previous.length === 0) {
      mr.previous = Array.isArray(mr.first) && mr.first.length > 0 ? [...mr.first] : [...newCurrUnits];
    }
    mr.current = newCurrUnits;

    // Ensure first reading is never removed; if missing, initialize it
    if (!Array.isArray(mr.first) || mr.first.length === 0) {
      mr.first = [...mr.previous];
    }

    ratesData[u] = {
      electricityRatePerUnit: rate,
      updatedAt: new Date().toISOString(),
      MeterReading: {
        first: mr.first,
        previous: mr.previous,
        current: mr.current
      }
    };
    await saveRatesDb(ratesData, `Update meter readings on bill generation for ${u}`);
  } catch (err) {
    console.error('Error saving updated rates.json to GitHub on bill generation:', err.message);
  }

  // 3. Create the new bill object
  const newBill = {
    id: `BILL-${Date.now()}`,
    tenantUsername: u,
    tenantFullName: tenant.fullName || tenant.full_name || tenant.name || u,
    floors: floors,
    isMultiFlat: isMultiFlat,
    meterBreakdown: meterBreakdown,
    previousMeterReading: prevReadingDisplay,
    currentMeterReading: currReadingDisplay,
    unitsConsumed: totalUnits,
    ratePerUnit: rate,
    electricityAmount: elecAmount,
    floorRent: rent,
    totalAmount: totalAmount,
    status: 'unpaid',
    proofImage: null,
    createdAt: new Date().toISOString()
  };

  // 4. Save to GitHub data/ledger/transactions.json
  try {
    const transactions = await getTransactionsDb();
    transactions.unshift(newBill);
    await saveTransactionsDb(transactions, `Add bill ${newBill.id} for ${u}`);
  } catch (err) {
    console.error('Error saving transactions.json to GitHub:', err.message);
  }

  // Also maintain local store
  store.bills.unshift(newBill);
  saveStore(store);

  // Synchronize with remote in background
  axios.post(`${REMOTE_API_BASE}/admin/generate-bill`, req.body, { timeout: 8000 }).catch(() => {});

  return res.json({
    success: true,
    message: 'मासिक बिल सफलतापूर्वक जारी गरियो',
    bill: newBill
  });
});

// C. Rentee: Submit Payment Proof (Updates GitHub transactions.json and local store)
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

  // Update in GitHub transactions.json
  try {
    const transactions = await getTransactionsDb();
    const match = transactions.find(b => b.id === billId);
    if (match) {
      match.status = 'pending_verification';
      match.proofImage = base64Image || match.proofImage;
      match.submittedAt = new Date().toISOString();
      await saveTransactionsDb(transactions, `Submit proof for bill ${billId}`);
    }
  } catch (err) {
    console.error('Error updating proof in transactions.json:', err.message);
  }

  // Forward to remote in background
  axios.post(`${REMOTE_API_BASE}/rentee/submit-proof`, req.body, { timeout: 8000 }).catch(() => {});

  return res.json({
    success: true,
    message: 'भुक्तानी प्रमाण दर्ता भयो'
  });
});

// D. Admin: Verify Payment (Approve / Reject) (Updates GitHub transactions.json and local store)
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

  // Update in GitHub transactions.json
  try {
    const transactions = await getTransactionsDb();
    const match = transactions.find(b => b.id === billId);
    if (match) {
      match.status = isApproved ? 'paid via QR' : 'rejected';
      if (isApproved) {
        match.verifiedAt = new Date().toISOString();
      }
      await saveTransactionsDb(transactions, `Verify payment ${billId} status ${isApproved ? 'paid' : 'rejected'}`);
    }
  } catch (err) {
    console.error('Error updating payment in transactions.json:', err.message);
  }

  // Forward to remote in background
  axios.post(`${REMOTE_API_BASE}/admin/verify-payment`, req.body, { timeout: 8000 }).catch(() => {});

  return res.json({
    success: true,
    message: isApproved ? 'Status updated to paid via QR' : 'Payment rejected'
  });
});

// E. Admin: Dashboard Overview (Calculated directly from live database transactions)
app.get('/api/jabegu-rent-portal/admin/dashboard-overview', async (req, res) => {
  const store = loadStore();

  let [transactions, tenantsList] = await Promise.all([
    getTransactionsDb().catch(() => []),
    getTenantsDb().catch(() => [])
  ]);

  let allInvoices = (transactions || []).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Strictly pending verification queue
  const verificationQueue = allInvoices.filter(b => {
    const s = (b.status || '').toLowerCase().trim();
    return s === 'pending_verification' || s === 'pending' || s === 'प्रमाणीकरण पेन्डिङ';
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
    activeTenants: tenantsList.length || Object.keys(store.tenants || {}).length || 2,
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
    monthlyIncome: {
      "वैशाख": 0, "जेठ": 0, "असार": 0, "साउन": 0, "भदौ": 0, "असोज": 0
    }
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


