// api/get-user-name.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { user, role } = req.query;
  if (!user || !role) {
    return res
      .status(400)
      .json({ error: "User and Role parameters are required" });
  }

  const githubToken = process.env.JABEGU_RENT_PORTAL_BACKUP_SECRET;

  if (!githubToken) {
    return res
      .status(500)
      .json({ error: "GitHub Token missing in environment variables." });
  }
  const OWNER = "Ningsang-Jabegu";
  const REPO = "jabegu-rent-portal-backup";

  let filePath = "tenants.json";
  if (role === "owner") {
    filePath = "admin.json";
  }

  try {
    const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/users/${filePath}`;

    const response = await fetch(githubUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3.raw",
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "GitHub data fetch failed" });
    }

    const usersList = await response.json();

    const currentUser = usersList.find(
      (u) => u.username.toLowerCase() === user.toLowerCase(),
    );

    if (currentUser && currentUser.full_name) {
      // 🔥 मुख्य सुरक्षा फिक्स: नाम के साथ भूमिका (role) भी रिटर्न करें
      return res.status(200).json({ 
        name: currentUser.full_name,
        role: role 
      });
    } else {
      return res.status(404).json({ error: "प्रयोगकर्ताको नाम फेला परेन।" });
    }
  } catch (error) {
    return res.status(500).json({ error: "ब्याकइन्डमा प्राविधिक त्रुटि आयो।" });
  }
}