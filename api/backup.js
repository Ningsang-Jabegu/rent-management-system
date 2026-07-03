// api/backup.js
import axios from 'axios'; // Vercel मा fetch वा axios प्रयोग गर्न सकिन्छ

export default async function handler(req, res) {
  // केवल POST रिक्वेस्ट मात्र स्वीकार गर्ने
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel को Settings बाट सेक्रेट टोकन तान्ने
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
      const fileRes = await axios.get(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      sha = fileRes.data.sha;
    } catch (e) {
      // यदि फाइल फेला परेन भने (४०४), sha = null नै रहन्छ (नयाँ फाइल बन्छ)
      if (e.response && e.response.status !== 404) {
        throw e;
      }
    }

    // २. डेटालाई Base64 मा इन्कोड गर्ने
    const contentBase64 = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');

    const payload = {
      message: commitMessage || "Data backup from Rent Portal",
      content: contentBase64
    };
    if (sha) payload.sha = sha;

    // ३. GitHub API मा PUT रिक्वेस्ट पठाएर फाइल सेभ/अपडेट गर्ने
    const githubRes = await axios.put(url, payload, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    return res.status(200).json({ success: true, message: 'Backup completed successfully!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'GitHub Backup Failed', details: error.message });
  }
}