// api/backup.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GITHUB_TOKEN = process.env.JABEGU_RENT_PORTAL_BACKUP_SECRET;
  const REPO_OWNER = "Ningsang-Jabegu";
  const REPO_NAME = "jabegu-rent-portal-backup";

  const { filePath, jsonData, commitMessage } = req.body;

  if (!filePath || !jsonData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

  try {
    let sha = null;
    
    // १. पहिले नै फाइल छ कि छैन र त्यसको SHA कोड के हो भनी जाँच्ने
    try {
      const fileRes = await fetch(url, {
        headers: { 
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        sha = fileData.sha;
      }
    } catch (e) {
      // यदि फाइल फेला परेन भने शा (sha) कोड खाली नै रहन्छ
      console.log("File not found or new backup file initialization.");
    }

    // २. डेटालाई Base64 मा इन्कोड गर्ने
    const contentBase64 = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');

    const payload = {
      message: commitMessage || "Data backup from Rent Portal",
      content: contentBase64
    };
    if (sha) payload.sha = sha;

    // ३. GitHub API मा PUT रिक्वेस्ट पठाएर फाइल सेभ/अपडेट गर्ने
    const githubRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (githubRes.ok) {
      return res.status(200).json({ success: true, message: 'Backup completed successfully!' });
    } else {
      const errorData = await githubRes.json();
      return res.status(githubRes.status).json({ error: 'GitHub Backup Failed', details: errorData.message });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'GitHub Backup Failed', details: error.message });
  }
}