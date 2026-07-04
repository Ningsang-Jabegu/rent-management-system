// api/get-tenant-name.js
// यसले Vercel मा सेट गरिएको GITHUB_PAT प्रयोग गरेर निजी रिपोबाट सुरक्षित रूपमा डेटा तान्छ

export default async function handler(req, res) {
  // केवल GET रिक्वेस्ट मात्र स्वीकार गर्ने
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ error: 'User parameter is required' });
  }

  // Vercel Environment Variables बाट गिटहब टोकन लिने
  // (पक्का गर्नुहोस् कि Vercel Dashboard मा GITHUB_PAT सेट गरिएको छ)
  const githubToken = process.env.GITHUB_PAT; 

  // तपाईँको निजी रिपोजिटरीको विवरण यहाँ भर्नुहोस्
  const OWNER = "NingsangJabegu";
  const REPO = "ArthaPath-Nepal";
  const FILE_PATH = "data/tenants.json"; // tenants.json फाइल रहेको बाटो

  try {
    // गिटहब API मार्फत निजी फाइलको कन्टेन्ट मगाउने (टोकन सहित हेडर पठाइएको छ)
    const githubUrl = `https://api.github.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
    const response = await fetch(githubUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw' // फाइलको र (Raw) टेक्स्ट कन्टेन्ट सिधै लिनका लागि
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'गिटहबबाट डेटा तान्न सकिएन।' });
    }

    const tenantsList = await response.json();

    // युजरनेम म्याच गराउने र नाम खोज्ने
    const currentTenant = tenantsList.find(
      t => t.username.toLowerCase() === user.toLowerCase() || t.id === user.toLowerCase()
    );

    if (currentTenant && currentTenant.name) {
      return res.status(200).json({ name: currentTenant.name });
    } else {
      return res.status(404).json({ error: 'डेरावाला भेटिएन।' });
    }

  } catch (error) {
    return res.status(500).json({ error: 'सर्भरमा प्राविधिक समस्या आयो।' });
  }
}