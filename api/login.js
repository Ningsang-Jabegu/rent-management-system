// api/login.js
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;
  const GITHUB_TOKEN = process.env.JABEGU_RENT_PORTAL_BACKUP_SECRET;
  const REPO_OWNER = "Ningsang-Jabegu"; 
  const REPO_NAME = "jabegu-rent-portal-backup";

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    let userFound = null;
    let assignedRole = null;

    // १. पहिले admin.json बाट डाटा तान्ने
    try {
      const adminRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/users/admin.json`,
        { 
          headers: { 
            Authorization: `token ${GITHUB_TOKEN}`, 
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache' 
          } 
        }
      );
      
      if (adminRes.ok) {
        const data = await adminRes.json();
        const admins = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
        userFound = admins.find(u => u.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (userFound) assignedRole = "owner";
      }
    } catch (e) {
      console.error("Admin file error:", e);
    }

    // २. यदि एडमिन भेटिएन भने tenants.json मा खोज्ने
    if (!userFound) {
      try {
        const tenantRes = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/users/tenants.json`,
          { 
            headers: { 
              Authorization: `token ${GITHUB_TOKEN}`, 
              'Accept': 'application/vnd.github.v3+json',
              'Cache-Control': 'no-cache' 
            } 
          }
        );
        
        if (tenantRes.ok) {
          const data = await tenantRes.json();
          const tenants = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
          userFound = tenants.find(u => u.username.toLowerCase().trim() === username.toLowerCase().trim());
          if (userFound) assignedRole = "rentee";
        }
      } catch (e) {
        console.error("Tenant file error:", e);
      }
    }

    // ३. यदि प्रयोगकर्ता फेला परेन भने
    if (!userFound) {
      return res.status(401).json({ error: 'त्रुटि: अवैध खाता पहिचान वा पासवर्ड मिलेन।' });
    }

    // ४. Bcrypt म्याचिङ
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