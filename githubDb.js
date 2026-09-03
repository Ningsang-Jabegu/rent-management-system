import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_TOKEN = process.env.JABEGU_RENT_PORTAL_BACKUP_SECRET || '';
const GITHUB_OWNER = 'Ningsang-Jabegu';
const GITHUB_REPO = 'jabegu-rent-portal-backup';
const GITHUB_BRANCH = 'main';

// In-memory SHA cache to minimize GET calls when updating
const shaCache = new Map();

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Read JSON file from GitHub with local file mirror fallback
 */
export async function getGithubJson(relativeFilePath, defaultValue = {}) {
  const localPath = path.join(__dirname, relativeFilePath);
  
  if (GITHUB_TOKEN) {
    try {
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${relativeFilePath}?ref=${GITHUB_BRANCH}`;
      const res = await axios.get(url, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'User-Agent': 'Rent-Portal',
          Accept: 'application/vnd.github.v3+json'
        },
        timeout: 6000
      });

      if (res.data && res.data.content) {
        shaCache.set(relativeFilePath, res.data.sha);
        const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        
        // Mirror locally for offline/fast fallback
        ensureDirectoryExistence(localPath);
        fs.writeFileSync(localPath, JSON.stringify(parsed, null, 2), 'utf-8');
        return { data: parsed, sha: res.data.sha };
      }
    } catch (err) {
      console.warn(`[GitHub DB] Failed to fetch ${relativeFilePath} from GitHub: ${err.message}. Falling back to local mirror.`);
    }
  }

  // Fallback to local mirror
  try {
    if (fs.existsSync(localPath)) {
      const localData = fs.readFileSync(localPath, 'utf-8');
      return { data: JSON.parse(localData), sha: shaCache.get(relativeFilePath) || null };
    }
  } catch (err) {
    console.error(`[GitHub DB] Error reading local mirror for ${relativeFilePath}:`, err.message);
  }

  return { data: defaultValue, sha: null };
}

/**
 * Write JSON file to GitHub and update local mirror
 */
export async function saveGithubJson(relativeFilePath, newJsonData, commitMessage = 'Update file via Rent Portal') {
  const localPath = path.join(__dirname, relativeFilePath);
  ensureDirectoryExistence(localPath);

  // 1. Immediately write to local mirror
  const formattedJson = JSON.stringify(newJsonData, null, 2);
  fs.writeFileSync(localPath, formattedJson, 'utf-8');

  if (!GITHUB_TOKEN) {
    console.warn(`[GitHub DB] No GITHUB_TOKEN set. Saved ${relativeFilePath} locally only.`);
    return { success: true, data: newJsonData, localOnly: true };
  }

  // 2. Commit to remote GitHub repository
  const encodedContent = Buffer.from(formattedJson, 'utf-8').toString('base64');
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${relativeFilePath}`;

  let currentSha = shaCache.get(relativeFilePath) || null;

  // If SHA unknown, fetch it from GitHub
  if (!currentSha) {
    try {
      const checkRes = await axios.get(`${url}?ref=${GITHUB_BRANCH}`, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'User-Agent': 'Rent-Portal',
          Accept: 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      if (checkRes.data && checkRes.data.sha) {
        currentSha = checkRes.data.sha;
        shaCache.set(relativeFilePath, currentSha);
      }
    } catch (err) {
      // 404 means file doesn't exist yet, so currentSha remains null (create new file)
      if (err.response && err.response.status !== 404) {
        console.warn(`[GitHub DB] Could not check current SHA for ${relativeFilePath}:`, err.message);
      }
    }
  }

  const payload = {
    message: commitMessage,
    content: encodedContent,
    branch: GITHUB_BRANCH
  };
  if (currentSha) {
    payload.sha = currentSha;
  }

  try {
    const putRes = await axios.put(url, payload, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Rent-Portal',
        Accept: 'application/vnd.github.v3+json'
      },
      timeout: 9000
    });

    if (putRes.data && putRes.data.content && putRes.data.content.sha) {
      shaCache.set(relativeFilePath, putRes.data.content.sha);
    }
    return { success: true, data: newJsonData, sha: putRes.data?.content?.sha };
  } catch (err) {
    // If conflict (409), retry once by getting latest SHA
    if (err.response && err.response.status === 409) {
      console.warn(`[GitHub DB] SHA conflict (409) for ${relativeFilePath}. Refetching fresh SHA and retrying...`);
      try {
        const refetch = await axios.get(`${url}?ref=${GITHUB_BRANCH}`, {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Rent-Portal',
            Accept: 'application/vnd.github.v3+json'
          },
          timeout: 5000
        });
        if (refetch.data && refetch.data.sha) {
          payload.sha = refetch.data.sha;
          const retryRes = await axios.put(url, payload, {
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              'User-Agent': 'Rent-Portal',
              Accept: 'application/vnd.github.v3+json'
            },
            timeout: 9000
          });
          if (retryRes.data?.content?.sha) {
            shaCache.set(relativeFilePath, retryRes.data.content.sha);
          }
          return { success: true, data: newJsonData, sha: retryRes.data?.content?.sha };
        }
      } catch (retryErr) {
        console.error(`[GitHub DB] Retry failed for ${relativeFilePath}:`, retryErr.message);
      }
    }

    console.error(`[GitHub DB] Error pushing ${relativeFilePath} to GitHub:`, err.response ? err.response.data : err.message);
    return { success: false, error: err.message, data: newJsonData };
  }
}

// Dedicated helpers for settings/rates.json
export async function getRatesDb() {
  const result = await getGithubJson('data/settings/rates.json', {});
  return result.data || {};
}

export async function saveRatesDb(ratesData, message) {
  return await saveGithubJson('data/settings/rates.json', ratesData, message || 'Update rates.json');
}

// Dedicated helpers for users/tenants.json
export async function getTenantsDb() {
  const result = await getGithubJson('data/users/tenants.json', []);
  return Array.isArray(result.data) ? result.data : [];
}

export async function saveTenantsDb(tenantsList, message) {
  return await saveGithubJson('data/users/tenants.json', tenantsList, message || 'Update tenants.json');
}

// Dedicated helpers for ledger/transactions.json
export async function getTransactionsDb() {
  const result = await getGithubJson('data/ledger/transactions.json', []);
  return Array.isArray(result.data) ? result.data : [];
}

export async function saveTransactionsDb(transactionsList, message) {
  return await saveGithubJson('data/ledger/transactions.json', transactionsList, message || 'Update transactions.json');
}
