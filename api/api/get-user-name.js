// api/get-user-name.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { user, role } = req.query;
  if (!user || !role) {
    return res.status(400).json({ error: 'User and Role parameters are required' });
  }

  const githubToken = process.env.GITHUB_PAT; 
  const OWNER = "Ningsang-Jabegu";
  const REPO = "jabegu-rent-portal-backup";
  
  // रोलको आधारमा गिटहबमा तोकिएको सही फाइलको बाटो
  let filePath = "data/users/tenants.json"; 
  if (role === "owner") {
    filePath = "data/users/admin.json"; // अथवा तपाईँको एडमिन लिस्ट भएको single/multiple JSON फाइल
  }

  try {
    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    
    const response = await fetch(githubUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'GitHub data fetch failed' });
    }

    const usersList = await response.json();

    // १. तपाईँको नयाँ JSON संरचना अनुसार 'username' म्याच गराउने
    const currentUser = usersList.find(
      u => u.username.toLowerCase() === user.toLowerCase()
    );

    // २. 'full_name' कुञ्जीबाट नाम तानेर फ्रन्टइन्डमा फर्काउने
    if (currentUser && currentUser.full_name) {
      return res.status(200).json({ name: currentUser.full_name });
    } else {
      return res.status(404).json({ error: 'प्रयोगकर्ताको नाम फेला परेन।' });
    }

  } catch (error) {
    return res.status(500).json({ error: 'ब्याकइन्डमा प्राविधिक त्रुटि आयो।' });
  }
}