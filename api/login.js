// api/login.js
import axios from 'axios';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;
  const GITHUB_TOKEN = process.env.JABEGU_RENT_PORTAL_BACKUP_SECRET;
  const REPO_OWNER = "Ningsang-Jabegu"; // <-- आफ्नो साँचो GitHub Username यहाँ राख्नुहोस्
  const REPO_NAME = "jabegu-rent-portal-backup";

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    let userFound = null;
    let assignedRole = null;

    // १. पहिले admin.json बाट डाटा तान्ने
    try {
      const adminRes = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/users/admin.json`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Cache-Control': 'no-cache' } }
      );
      const admins = JSON.parse(Buffer.from(adminRes.data.content, 'base64').toString('utf-8'));
      userFound = admins.find(u => u.username.toLowerCase().trim() === username.toLowerCase().trim());
      if (userFound) assignedRole = "owner";
    } catch (e) {
      if (e.response && e.response.status !== 404) throw e;
    }

    // २. यदि एडमिन भेटिएन भने tenants.json मा खोज्ने
    if (!userFound) {
      try {
        const tenantRes = await axios.get(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/users/tenants.json`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Cache-Control': 'no-cache' } }
        );
        const tenants = JSON.parse(Buffer.from(tenantRes.data.content, 'base64').toString('utf-8'));
        userFound = tenants.find(u => u.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (userFound) assignedRole = "rentee";
      } catch (e) {
        if (e.response && e.response.status !== 404) throw e;
      }
    }

    // ३. यदि प्रयोगकर्ता फेला परेन भने
    if (!userFound) {
      return res.status(401).json({ error: 'त्रुटि: अवैध खाता पहिचान वा पासवर्ड मिलेन।' });
    }

    // ४. Bcrypt म्याचिङ (सुरक्षित तरिकाले पासवर्ड दाँज्ने)
    // यहाँ हामी .replace(/^\$2y\$/, '$2a$') थप्छौँ जसले ह्यासको संस्करणलाई सुरक्षित रूपमा मिलाउँछ
    const cleanHash = userFound.password_hash.replace(/^\$2y\$/, '$2a$').replace(/^\$2b\$/, '$2a$');
    const isPasswordValid = bcrypt.compareSync(password, cleanHash);
    
    if (isPasswordValid) {
      return res.status(200).json({ success: true, role: assignedRole, name: userFound.full_name });
    } else {
      return res.status(401).json({ error: 'त्रुटि: अवैध खाता पहिचान वा पासवर्ड मिलेन।' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'प्रणालीमा समस्या आयो। कृपया फेरि प्रयास गर्नुहोला।' });
  }
}