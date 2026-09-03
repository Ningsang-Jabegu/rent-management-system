// js/index.js
// Jabegu Niwas Rent Management Portal - Full-Stack Frontend Engine

const API_BASE_URL = 'https://api.ningsangjabegu.com.np';
const API_BASE = 'https://api.ningsangjabegu.com.np/api/jabegu-rent-portal';

// ==========================================
// ०. सुरक्षित सेसन प्रबन्धक (Unique Season/Session Slug Engine)
// ==========================================
class SessionManager {
  static SESSION_STORAGE_KEY = 'jabegu_active_sessions_v1';
  static CURRENT_SLUG_KEY = 'jabegu_current_sess_slug';

  // Generate unique slug for each session/season
  static generateSlug(username, role) {
    const timestamp = Date.now().toString(36);
    const randomHex = Math.random().toString(36).substring(2, 10);
    const seasonPrefix = 'season_' + new Date().getFullYear();
    return `sess_${seasonPrefix}_${randomHex}_${timestamp}`;
  }

  static createSession(userData) {
    const username = (userData.username || 'aanayas').trim().toLowerCase();
    const role = userData.role || (username === 'admin' ? 'owner' : 'rentee');
    const name = userData.name || userData.fullName || (username === 'admin' ? 'Devendra Kumar Jabegu' : username);
    const slug = this.generateSlug(username, role);

    const sessionObj = {
      slug: slug,
      username: username,
      name: name,
      fullName: name,
      role: role,
      user: {
        username: username,
        role: role,
        name: name,
        fullName: name,
        phone: userData.phone || '९८०६०६०६६३'
      },
      token: userData.token || `jwt_${Math.random().toString(36).substring(2)}`,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };

    const sessions = this.getAllSessions();
    sessions[slug] = sessionObj;
    localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessions));
    sessionStorage.setItem(this.CURRENT_SLUG_KEY, slug);
    localStorage.setItem(this.CURRENT_SLUG_KEY, slug);

    // Keep active user caches synced across all storage keys
    localStorage.setItem('user_session', JSON.stringify(sessionObj));
    localStorage.setItem('currentUser', JSON.stringify(sessionObj));
    localStorage.setItem('username', sessionObj.username);
    localStorage.setItem('name', sessionObj.name);
    localStorage.setItem('role', sessionObj.role);

    return slug;
  }

  static getAllSessions() {
    try {
      return JSON.parse(localStorage.getItem(this.SESSION_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  static getSessionBySlug(slug) {
    if (!slug) return null;
    const sessions = this.getAllSessions();
    const sess = sessions[slug];
    if (!sess) return null;

    // Check expiration
    if (sess.expiresAt && Date.now() > sess.expiresAt) {
      delete sessions[slug];
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessions));
      return null;
    }
    return sess;
  }

  static getCurrentSession() {
    return this.getActiveSession();
  }

  /**
   * Returns active session object: { username, role, name, fullName, user, token, slug }
   * Safely falls back to localStorage 'user_session', 'currentUser', or 'username'/'role'/'name'
   */
  static getActiveSession() {
    // Attempt 1: Look up session by URL slug
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSlug = params.get('sess') || params.get('session');
      if (urlSlug) {
        const sess = this.getSessionBySlug(urlSlug);
        if (sess) {
          sessionStorage.setItem(this.CURRENT_SLUG_KEY, urlSlug);
          return this.formatSessionObject(sess);
        }
      }
    } catch (e) {
      console.warn('URL session lookup error:', e);
    }

    // Attempt 2: Look up session by stored slug in sessionStorage / localStorage
    try {
      const storedSlug = sessionStorage.getItem(this.CURRENT_SLUG_KEY) || localStorage.getItem(this.CURRENT_SLUG_KEY);
      if (storedSlug) {
        const sess = this.getSessionBySlug(storedSlug);
        if (sess) return this.formatSessionObject(sess);
      }
    } catch (e) {
      console.warn('Stored slug session lookup error:', e);
    }

    // Safe fallback 1: parse 'user_session' in localStorage
    try {
      const userSessionRaw = localStorage.getItem('user_session');
      if (userSessionRaw) {
        const parsed = JSON.parse(userSessionRaw);
        if (parsed && (parsed.username || parsed.name)) {
          return this.formatSessionObject(parsed);
        }
      }
    } catch (e) {
      console.warn('user_session fallback parse failed:', e);
    }

    // Safe fallback 2: parse 'currentUser' in localStorage
    try {
      const currentUserRaw = localStorage.getItem('currentUser');
      if (currentUserRaw) {
        const parsed = JSON.parse(currentUserRaw);
        if (parsed && (parsed.username || parsed.name)) {
          return this.formatSessionObject(parsed);
        }
      }
    } catch (e) {
      console.warn('currentUser fallback parse failed:', e);
    }

    // Safe fallback 3: reading legacy plain key-values from localStorage
    try {
      const legacyUser = localStorage.getItem('username');
      const legacyRole = localStorage.getItem('role');
      const legacyName = localStorage.getItem('name');
      if (legacyUser) {
        const fallbackObj = {
          username: legacyUser,
          role: legacyRole || (legacyUser === 'admin' ? 'owner' : 'rentee'),
          name: legacyName || legacyUser
        };
        return this.formatSessionObject(fallbackObj);
      }
    } catch (e) {
      console.warn('localStorage legacy fallback failed:', e);
    }

    return null;
  }

  static formatSessionObject(raw) {
    if (!raw) return null;
    const username = (raw.username || (raw.user && raw.user.username) || raw.name || '').trim().toLowerCase();
    const role = raw.role || (raw.user && raw.user.role) || (username === 'admin' ? 'owner' : 'rentee');
    const name = raw.name || raw.fullName || (raw.user && (raw.user.fullName || raw.user.name)) || username;
    const token = raw.token || '';
    const slug = raw.slug || '';
    const phone = raw.phone || (raw.user && raw.user.phone) || '९८०६०६०६६३';

    return {
      username,
      role,
      name,
      fullName: name,
      user: {
        username,
        role,
        name,
        fullName: name,
        phone
      },
      token,
      slug
    };
  }

  static destroySession() {
    try {
      const slug = sessionStorage.getItem(this.CURRENT_SLUG_KEY) || localStorage.getItem(this.CURRENT_SLUG_KEY);
      if (slug) {
        const sessions = this.getAllSessions();
        delete sessions[slug];
        localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessions));
      }
      sessionStorage.removeItem(this.CURRENT_SLUG_KEY);
      localStorage.removeItem(this.CURRENT_SLUG_KEY);
      localStorage.removeItem('user_session');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('name');
    } catch (e) {
      console.warn('Session destruction error:', e);
    }
  }
}

// Global browser window exposure
window.SessionManager = SessionManager;

// ==========================================
// ०. API Gateway Client Interface (Official Backend)
// ==========================================
const ApiService = {
  // 1. Authentication
  login: async function (username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 || data.disabled === true || (data.error && data.error.toLowerCase().includes('disabled')) || (data.message && data.message.toLowerCase().includes('disabled')) || (data.message && data.message.includes('निष्क्रीय'))) {
      const err = new Error(data.message || data.error || 'तपाईंको खाता घरधनीद्वारा निष्क्रीय गरिएको छ। कृपया प्रशासनसँग सम्पर्क गर्नुहोस्।');
      err.isDisabledAccount = true;
      err.status = 403;
      throw err;
    }
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'प्रमाणिकरण असफल भयो (Authentication failed)');
    }
    return data;
  },

  // 2. Admin Operations
  // A. Fetch Dashboard Overview
  getDashboardOverview: async function () {
    const res = await fetch(`${API_BASE}/admin/dashboard-overview`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'ड्यासबोर्ड विवरण लोड हुन सकेन');
    }
    return data;
  },

  // B. Fetch All Tenants
  getTenants: async function () {
    const res = await fetch(`${API_BASE}/admin/tenants`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'डेरावालाहरूको सूची लोड हुन सकेन');
    }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tenants)) return data.tenants;
    return [];
  },

  // C. Create Tenant
  createTenant: async function (tenantData) {
    const res = await fetch(`${API_BASE}/admin/create-tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantData)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'डेरावाला दर्ता असफल भयो (Tenant creation failed)');
    }
    return data;
  },

  // D. Generate Monthly Bill
  generateBill: async function (billData) {
    const res = await fetch(`${API_BASE}/admin/generate-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'बिल जारी असफल भयो (Bill generation failed)');
    }
    return data;
  },

  // E. Verify Payment (Approve / Reject)
  verifyPayment: async function (billId, isApproved) {
    const res = await fetch(`${API_BASE}/admin/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, isApproved })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'प्रमाणिकरण अपडेट असफल भयो (Verification update failed)');
    }
    return data;
  },

  // F. House Rules (Get & Update)
  getHouseRules: async function () {
    const res = await fetch(`${API_BASE}/admin/house-rules`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'घरको नियम लोड हुन सकेन');
    }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.rules)) return data.rules;
    return [];
  },

  updateHouseRules: async function (rules) {
    const res = await fetch(`${API_BASE}/admin/update-house-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'घरको नियम अद्यावधिक असफल भयो');
    }
    return data;
  },

  // G. Change Admin Password (Issue 11: Only newPassword required)
  changePassword: async function (currentPassword, newPassword) {
    const payload = newPassword ? { newPassword } : { newPassword: currentPassword };
    const res = await fetch(`${API_BASE}/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'पासवर्ड परिवर्तन असफल भयो (Password update failed)');
    }
    return data;
  },

  // H. Admin Reset Tenant Password (Issue 11)
  resetTenantPassword: async function (tenantUsername, newPassword) {
    const res = await fetch(`${API_BASE}/admin/reset-tenant-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantUsername, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'डेरावालाको पासवर्ड रिसेट गर्न सकिएन');
    }
    return data;
  },

  // I. Toggle Tenant Status (सक्रिय / निष्क्रीय)
  toggleTenantStatus: async function (username, status) {
    const res = await fetch(`${API_BASE}/admin/toggle-tenant-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, status })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'डेरावालाको स्थिति परिवर्तन गर्न सकिएन');
    }
    return data;
  },

  // J. Profile Requests Approval Queue (Issue 3)
  getProfileRequests: async function () {
    try {
      const res = await fetch(`${API_BASE}/admin/profile-requests`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.requests)) return data.requests;
      }
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
    } catch (_) {
      return [];
    }
  },

  reviewProfileUpdate: async function (requestId, tenantUsername, isApproved, updatedData) {
    try {
      await fetch(`${API_BASE}/admin/review-profile-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, tenantUsername, isApproved })
      });
    } catch (_) {}

    // Update local storage representation
    try {
      let reqs = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
      reqs = reqs.filter(r => r.id !== requestId);
      localStorage.setItem('jabegu_profile_requests', JSON.stringify(reqs));

      if (isApproved && updatedData) {
        // update tenant in storage
        const currentU = JSON.parse(localStorage.getItem('user_session') || '{}');
        if (currentU.username === tenantUsername) {
          if (updatedData.fullName) currentU.name = updatedData.fullName;
          if (updatedData.phone) currentU.phone = updatedData.phone;
          localStorage.setItem('user_session', JSON.stringify(currentU));
          localStorage.setItem('name', currentU.name);
        }
      }
    } catch (_) {}
    return { success: true };
  },

  // K. Notices System (Issue 8)
  getNotices: async function () {
    try {
      const res = await fetch(`${API_BASE}/admin/notices`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.notices)) return data.notices;
      }
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('jabegu_admin_notices') || '[]');
    } catch (_) {
      return [];
    }
  },

  postNotice: async function (noticeData) {
    try {
      await fetch(`${API_BASE}/admin/post-notice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticeData)
      });
    } catch (_) {}

    try {
      const list = JSON.parse(localStorage.getItem('jabegu_admin_notices') || '[]');
      list.unshift({
        id: 'NOTICE-' + Date.now(),
        ...noticeData,
        createdAt: new Date().toISOString(),
        nepaliDate: new Date().toLocaleDateString('ne-NP')
      });
      localStorage.setItem('jabegu_admin_notices', JSON.stringify(list));
    } catch (_) {}
    return { success: true };
  },

  deleteNotice: async function (noticeId) {
    try {
      await fetch(`${API_BASE}/admin/delete-notice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId })
      });
    } catch (_) {}

    try {
      let list = JSON.parse(localStorage.getItem('jabegu_admin_notices') || '[]');
      list = list.filter(n => n.id !== noticeId);
      localStorage.setItem('jabegu_admin_notices', JSON.stringify(list));
    } catch (_) {}

    try {
      let list = JSON.parse(localStorage.getItem('jabegu_notices') || '[]');
      list = list.filter(n => n.id !== noticeId);
      localStorage.setItem('jabegu_notices', JSON.stringify(list));
    } catch (_) {}
    return { success: true };
  },

  // L. Maintenance System (Issue 8)
  createMaintenanceRequest: async function (payload) {
    const res = await fetch(`${API_BASE}/rentee/create-maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'मर्मत अनुरोध पठाउन सकिएन।');
    }

    try {
      const list = JSON.parse(localStorage.getItem('jabegu_maintenance_requests') || '[]');
      list.unshift(data.request || {
        id: 'MAINT-' + Date.now(),
        ...payload,
        status: 'नयाँ अनुरोध',
        date: new Date().toLocaleDateString('ne-NP'),
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('jabegu_maintenance_requests', JSON.stringify(list));
    } catch (_) {}
    return data;
  },

  getMaintenanceRequests: async function () {
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance-requests`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.requests)) return data.requests;
      }
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('jabegu_maintenance_requests') || '[]');
    } catch (_) {
      return [];
    }
  },

  updateMaintenanceStatus: async function (requestId, status) {
    try {
      await fetch(`${API_BASE}/admin/update-maintenance-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status })
      });
    } catch (_) {}

    try {
      const list = JSON.parse(localStorage.getItem('jabegu_maintenance_requests') || '[]');
      const item = list.find(m => m.id === requestId);
      if (item) {
        item.status = status;
        localStorage.setItem('jabegu_maintenance_requests', JSON.stringify(list));
      }
    } catch (_) {}
    return { success: true };
  },

  // 3. Rentee Operations
  // Rentee Password Change (Issue 11: Requires Current Password & New Password)
  renteeChangePassword: async function (tenantUsername, currentPassword, newPassword) {
    const res = await fetch(`${API_BASE}/rentee/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantUsername, currentPassword, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'पासवर्ड परिवर्तन असफल भयो (Password update failed)');
    }
    return data;
  },

  // Profile Edit Request (Issue 3)
  requestProfileUpdate: async function (tenantUsername, fullName, phone) {
    try {
      await fetch(`${API_BASE}/rentee/request-profile-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantUsername, fullName, phone })
      });
    } catch (_) {}

    const reqObj = {
      id: 'REQ-' + Date.now(),
      tenantUsername,
      fullName,
      phone,
      status: 'pending',
      date: new Date().toLocaleDateString('ne-NP'),
      createdAt: new Date().toISOString()
    };

    try {
      const allReqs = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
      // remove old pending for same user
      const filtered = allReqs.filter(r => !(r.tenantUsername === tenantUsername && r.status === 'pending'));
      filtered.unshift(reqObj);
      localStorage.setItem('jabegu_profile_requests', JSON.stringify(filtered));
      localStorage.setItem(`jabegu_pending_profile_${tenantUsername}`, JSON.stringify(reqObj));
    } catch (_) {}
    return { success: true };
  },
  // A. Fetch Tenant Bills
  getMyBills: async function (tenantUsername) {
    let resolvedUsername = tenantUsername;

    // Safe fallback resolution if tenantUsername is not passed or empty
    if (!resolvedUsername) {
      try {
        const session = (typeof SessionManager !== 'undefined' && typeof SessionManager.getActiveSession === 'function')
          ? SessionManager.getActiveSession()
          : null;
        if (session && session.username) {
          resolvedUsername = session.username;
        }
      } catch (e) {
        console.warn('Session lookup inside getMyBills failed:', e);
      }
    }

    if (!resolvedUsername) {
      try {
        const stored = JSON.parse(localStorage.getItem('user_session') || '{}');
        resolvedUsername = stored.username;
      } catch (_) {}
    }

    if (!resolvedUsername) {
      try {
        const currentU = JSON.parse(localStorage.getItem('currentUser') || '{}');
        resolvedUsername = currentU.username;
      } catch (_) {}
    }

    if (!resolvedUsername) {
      resolvedUsername = localStorage.getItem('username') || 'aanayas';
    }

    resolvedUsername = (resolvedUsername || '').trim().toLowerCase();

    const fetchUrl = `https://api.ningsangjabegu.com.np/api/jabegu-rent-portal/rentee/my-bills/${encodeURIComponent(resolvedUsername)}`;
    const res = await fetch(fetchUrl);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'मासिक बिलहरू लोड हुन सकेन');
    }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.bills)) return data.bills;
    return [];
  },

  // B. Submit Payment Proof Image
  submitProof: async function (billId, base64Image) {
    const res = await fetch(`${API_BASE}/rentee/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, base64Image })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data.error || data.message || 'रसिद अपलोड असफल भयो (Upload failed)');
    }
    return data;
  },

  // C. Serve / Display Proof Image
  getProofImageUrl: function (proof) {
    if (!proof) return './img/logo.png';
    if (proof.startsWith('data:') || proof.startsWith('http://') || proof.startsWith('https://')) {
      return proof;
    }
    const cleanName = proof.replace(/^data\/uploads\/payments\//, '').replace(/^.*\//, '');
    return `${API_BASE}/rentee/payment-proof/${cleanName}`;
  }
};

// ==========================================
// १. लगइन प्रणाली (Login Panel Logic)
// ==========================================
const LoginSystem = {
  init: function () {
    const self = this;

    setTimeout(function () {
      $('#body_loading').addClass('hide');
    }, 400);

    // Auto-fill username from localStorage if available
    const savedUser = localStorage.getItem('username');
    if (savedUser && $('#account_input').length) {
      $('#account_input').val(savedUser);
    }

    $('#account_input').on('keypress', function (e) {
      if (e.which === 13) {
        e.preventDefault();
        $('#account_password').focus();
      }
    });

    $('#login_form').on('submit', function (e) {
      e.preventDefault();
      self.authenticateUser();
    });
  },

  authenticateUser: async function () {
    $('#login_msg').text('');
    const username = $('#account_input').val().trim().toLowerCase();
    const passwordPlain = ($('#account_password').val() || '').trim();

    if (!username || !passwordPlain) {
      $('#login_msg').text('कृपया प्रयोगकर्ता नाम र पासवर्ड प्रविष्ट गर्नुहोस्।');
      return;
    }

    $('#login_btn').prop('disabled', true).find('.btn-text').text('प्रमाणिकरण हुँदैछ...');

    try {
      const response = await ApiService.login(username, passwordPlain);
      if (response && (response.success || response.role || response.token)) {
        const authPayload = {
          username: response.username || username,
          name: response.name || (username === 'admin' ? 'Devendra Kumar Jabegu' : username),
          role: response.role || (username === 'admin' ? 'owner' : 'rentee'),
          token: response.token
        };

        // Persist username, role, and name in localStorage upon successful authentication
        localStorage.setItem('username', authPayload.username);
        localStorage.setItem('name', authPayload.name);
        localStorage.setItem('role', authPayload.role);

        // Create unique season/session slug
        const sessionSlug = SessionManager.createSession(authPayload);
        window.location.href = `rent-portal.html?sess=${encodeURIComponent(sessionSlug)}`;
        return;
      } else {
        throw new Error(response.message || response.error || 'प्रमाणिकरण असफल भयो (Authentication failed)');
      }
    } catch (err) {
      if (err.isDisabledAccount || err.status === 403 || (err.message && (err.message.toLowerCase().includes('disabled') || err.message.includes('निष्क्रीय')))) {
        $('#disabled_modal_text').text('तपाईंको खाता घरधनीद्वारा निष्क्रीय गरिएको छ। कृपया प्रशासनसँग सम्पर्क गर्नुहोस्।');
        $('#disabled_account_modal').removeClass('hide');
      } else {
        $('#login_msg').text(err.message || 'प्रयोगकर्ता नाम वा पासवर्ड मिलेन (Authentication failed)');
      }
      $('#login_btn').prop('disabled', false).find('.btn-text').text('लगइन गर्नुहोस्');
    }
  }
};

// ==========================================
// २. मुख्य ड्यासबोर्ड प्रणाली (Portal Dashboard Logic)
// ==========================================
const PortalDashboard = {
  analyticsChartInstance: null,
  currentSession: null,
  currentRole: null,
  currentUsername: null,
  currentName: null,
  currentBills: [],
  currentTenants: [],
  currentHouseRules: [],
  selectedBillForInspection: null,
  selectedBillForPayment: null,

  init: function () {
    const self = this;

    setTimeout(function () {
      $('#body_loading').addClass('hide');
    }, 350);

    // Retrieve active session securely with universal safe fallbacks
    let session = null;
    try {
      session = (typeof SessionManager !== 'undefined' && typeof SessionManager.getActiveSession === 'function')
        ? SessionManager.getActiveSession()
        : null;
    } catch (e) {
      console.warn('Session retrieval error in init:', e);
    }

    if (!session || !session.username) {
      try {
        const storedSess = JSON.parse(localStorage.getItem('user_session') || 'null');
        if (storedSess && (storedSess.username || storedSess.name)) {
          session = SessionManager.formatSessionObject(storedSess);
        }
      } catch (_) {}
    }

    if (!session || !session.username) {
      try {
        const legacyUser = localStorage.getItem('username');
        if (legacyUser) {
          session = SessionManager.formatSessionObject({
            username: legacyUser,
            role: localStorage.getItem('role') || (legacyUser === 'admin' ? 'owner' : 'rentee'),
            name: localStorage.getItem('name') || legacyUser
          });
        }
      } catch (_) {}
    }

    if (!session || !session.username || !session.role) {
      window.location.href = 'index.html';
      return;
    }

    this.currentSession = session;
    this.currentRole = session.role;
    this.currentUsername = (session.username || '').trim().toLowerCase();
    this.currentName = session.name || session.fullName || (session.user && (session.user.fullName || session.user.name)) || '';

    // Update URL to clean state containing unique session slug if present
    if (session.slug && window.history && window.history.replaceState) {
      const cleanUrl = `${window.location.pathname}?sess=${encodeURIComponent(session.slug)}`;
      window.history.replaceState({ slug: session.slug }, document.title, cleanUrl);
    }

    this.renderWorkspace(this.currentRole);
    this.initNavigation();
    this.initModals();
    this.loadData();
  },

  renderWorkspace: function (role) {
    $('.nav-role-block').addClass('hide');
    $('.workspace-section').addClass('hide');

    // Reset greeting header visibility: Only visible on Overview / Dashboard
    $('#top_greeting_banner').removeClass('hide');

    if (role === 'owner') {
      $('#owner_workspace').removeClass('hide');
      $('#active_role_badge').text('घरधनी खाता (Owner)');
      $('#owner_only_nav_block').removeClass('hide');
      $('.owner-only-action').removeClass('hide');
      $('.tenant-only-action').addClass('hide');
      $('.mobile-owner-tab').removeClass('hide');
      $('.mobile-tenant-tab').addClass('hide');
    } else {
      $('#rentee_workspace').removeClass('hide');
      $('#active_role_badge').text('डेरावाला खाता (Tenant)');
      $('#tenant_only_nav_block').removeClass('hide');
      $('.owner-only-action').addClass('hide');
      $('.tenant-only-action').removeClass('hide');
      $('.mobile-owner-tab').addClass('hide');
      $('.mobile-tenant-tab').removeClass('hide');
    }

    const displayName = this.currentName || (role === 'owner' ? 'Devendra Kumar Jabegu' : this.currentUsername);
    $('#dynamic_welcome_title').text(`स्वागतम्, ${displayName}`);

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  initNavigation: function () {
    const self = this;

    // Toggle off-canvas drawer sidebar
    $('#mobile_menu_toggle').on('click', function (e) {
      e.stopPropagation();
      $('.app-sidebar').toggleClass('sidebar-open');
      $('.sidebar-overlay-backdrop').toggleClass('active');
    });

    // Close when clicking backdrop
    $('.sidebar-overlay-backdrop').on('click', function () {
      $('.app-sidebar').removeClass('sidebar-open');
      $('.sidebar-overlay-backdrop').removeClass('active');
    });

    // Navigation item click handler (Sidebar + Mobile Bottom Nav)
    $('.nav-item, .mobile-bottom-nav-item').on('click', function (e) {
      e.preventDefault();

      const target = $(this).attr('data-target');
      if (target === 'mobile_menu_open') {
        $('.app-sidebar').addClass('sidebar-open');
        $('.sidebar-overlay-backdrop').addClass('active');
        return;
      }

      $('.nav-item, .mobile-bottom-nav-item').removeClass('active');
      $(`[data-target="${target}"]`).addClass('active');

      let resolvedTarget = target;
      if (target === 'overview_workspace') {
        resolvedTarget = self.currentRole === 'owner' ? 'owner_workspace' : 'rentee_workspace';
        // Show Top Greeting Header ONLY on Overview / Dashboard
        $('#top_greeting_banner').removeClass('hide');
      } else {
        // Hide Top Greeting Header on all other sub-pages
        $('#top_greeting_banner').addClass('hide');
      }

      $('.workspace-section').addClass('hide');
      $('#' + resolvedTarget).removeClass('hide');

      // Close mobile drawer if opened
      $('.app-sidebar').removeClass('sidebar-open');
      $('.sidebar-overlay-backdrop').removeClass('active');

      // Scroll smoothly to top on view change
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (self.currentRole === 'rentee') {
        self.checkAndShowProfileRejectionNotice();
      }

      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });

    $(document).on('click', function (e) {
      if (!$(e.target).closest('.app-sidebar, #mobile_menu_toggle, .mobile-bottom-nav').length) {
        $('.app-sidebar').removeClass('sidebar-open');
        $('.sidebar-overlay-backdrop').removeClass('active');
      }
    });
  },

  initModals: function () {
    const self = this;

    // Close any modal on backdrop click or close button
    $('.app-modal-close-btn, .modal-cancel-btn').on('click', function () {
      $('.app-modal-overlay').addClass('hide');
    });

    $('.app-modal-overlay').on('click', function (e) {
      if ($(e.target).hasClass('app-modal-overlay')) {
        $('.app-modal-overlay').addClass('hide');
      }
    });

    // File input preview & base64 convert for Rentee payment proof
    $('#modal_receipt_file').on('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          $('#modal_receipt_preview').attr('src', evt.target.result).removeClass('hide');
          $('#modal_upload_placeholder').addClass('hide');
        };
        reader.readAsDataURL(file);
      }
    });

    // Overview direct file input trigger
    $('#receipt_file_input').on('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        const unpaidBill = self.currentBills.find(b => b.status === 'unpaid') || self.currentBills[0];
        if (unpaidBill) {
          self.openPaymentModal(unpaidBill.id);
          // Transfer selected file to modal
          const reader = new FileReader();
          reader.onload = function (evt) {
            $('#modal_receipt_preview').attr('src', evt.target.result).removeClass('hide');
            $('#modal_upload_placeholder').addClass('hide');
          };
          reader.readAsDataURL(file);
        } else {
          alert('तपाईंको कुनै पनि तिर्न बाँकी बिल भेटिएन।');
        }
      }
    });
  },

  loadData: async function () {
    if (this.currentRole === 'owner') {
      await this.loadOwnerData();
    } else {
      await this.loadRenteeData();
    }
  },

  // ==========================================
  // डेरावाला (Rentee) डाटा लोडिङ र रेन्डरिङ
  // ==========================================
  currentPaymentProvider: 'global_ime',
  currentModalPaymentProvider: 'global_ime',

  loadRenteeData: async function () {
    try {
      let resolvedUsername = this.currentUsername;
      if (!resolvedUsername) {
        try {
          const session = (typeof SessionManager !== 'undefined' && typeof SessionManager.getActiveSession === 'function')
            ? SessionManager.getActiveSession()
            : null;
          if (session && session.username) resolvedUsername = session.username;
        } catch (_) {}
      }
      if (!resolvedUsername) {
        try {
          const parsed = JSON.parse(localStorage.getItem('user_session') || '{}');
          resolvedUsername = parsed.username;
        } catch (_) {}
      }
      if (!resolvedUsername) {
        resolvedUsername = localStorage.getItem('username') || 'aanayas';
      }
      this.currentUsername = (resolvedUsername || '').trim().toLowerCase();

      const [billsList, houseRules] = await Promise.all([
        ApiService.getMyBills(this.currentUsername).catch(e => {
          console.warn('Rentee bills error:', e);
          return [];
        }),
        ApiService.getHouseRules().catch(e => {
          console.warn('House rules error:', e);
          return [];
        })
      ]);

      this.currentBills = billsList || [];
      this.currentHouseRules = houseRules || [];

      this.renderRenteeDashboard();
      this.renderRenteeInvoices();
      this.renderTenantHouseRules(this.currentHouseRules);
      this.renderMaintenanceLogs();
      this.loadNoticesList();
      this.checkAndShowProfileRejectionNotice();
    } catch (e) {
      console.error('Rentee data error:', e);
    }
  },

  getQrPayload: function (provider, bill, totalDue) {
    const session = SessionManager.getActiveSession();
    const tenantName = (session && session.user && session.user.fullName) || this.currentUsername || 'Aanayas Limbu';
    const amountVal = (bill && bill.totalAmount) ? Number(bill.totalAmount) : (Number(totalDue) || 15000);
    const formattedAmount = Number(amountVal).toFixed(2);
    const isPaid = bill && (bill.status === 'paid via QR' || bill.status === 'paid' || bill.status === 'approved' || bill.status === 'भुक्तानी स्वीकृत');

    if (provider === 'global_ime') {
      if (isPaid) {
        return {
          bankCode: 'GLBBNPKA',
          accountName: 'NINGSANG JABEGU',
          BANKNAME: 'Global IME Bank Limited',
          accountNumber: '03607010016463'
        };
      } else {
        return {
          accountNumber: '03607010016463',
          accountName: 'NINGSANG JABEGU',
          remarks: `Flat rent for ${tenantName}`,
          bankCode: 'GLBBNPKA',
          dynamicQrType: 'dynamicQR',
          amount: formattedAmount,
          BANKNAME: 'Global IME Bank Limited'
        };
      }
    } else if (provider === 'esewa') {
      return {
        name: 'Ningsang Jabegu',
        eSewa_id: '9806060663'
      };
    } else if (provider === 'khalti') {
      return {
        Khalti_ID: '9806060663',
        name: 'Ningsang Jabegu'
      };
    }

    // Default fallback
    return {
      accountNumber: '03607010016463',
      accountName: 'NINGSANG JABEGU',
      bankCode: 'GLBBNPKA',
      amount: formattedAmount
    };
  },

  selectPaymentProvider: function (provider) {
    this.currentPaymentProvider = provider;
    $('.payment-tab-btn[data-provider], .qr-provider-btn').removeClass('active');
    $(`.payment-tab-btn[data-provider="${provider}"], [data-provider="${provider}"]`).addClass('active');

    this.updateDashboardQrDisplay();
  },

  selectModalPaymentProvider: function (provider) {
    this.currentModalPaymentProvider = provider;
    $('.payment-tab-btn[data-modal-provider], .modal-provider-btn').removeClass('active');
    $(`.payment-tab-btn[data-modal-provider="${provider}"], [data-modal-provider="${provider}"]`).addClass('active');

    this.updateModalQrDisplay();
  },

  updateDashboardQrDisplay: function () {
    const bills = this.currentBills || [];
    const unpaidBill = bills.find(b => b.status === 'unpaid' || b.status === 'rejected') || bills[0];
    const totalDue = bills
      .filter(b => b.status === 'unpaid' || b.status === 'pending_verification')
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

    const payload = this.getQrPayload(this.currentPaymentProvider, unpaidBill, totalDue);
    const qrString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`;

    $('#tenant_qr, #page_tenant_qr, #tenant_subpage_qr').attr('src', qrUrl);

    // Update account detail labels
    if (this.currentPaymentProvider === 'global_ime') {
      $('#tenant_qr_provider_title, #page_qr_provider_title, #tenant_subpage_qr_title').text('सुरक्षित Global IME बैंक खाता क्युआर');
      $('#tenant_account_no_display, #tenant_subpage_acc_no, #tenant_qr_acc_number, #page_qr_acc_number').text('03607010016463');
      $('#tenant_account_name_display, #tenant_subpage_acc_name, #tenant_qr_acc_name, #page_qr_acc_name').text('NINGSANG JABEGU');
      $('#tenant_qr_bank_name, #page_qr_bank_name').text('Global IME Bank Ltd (Bhaktapur)');
    } else if (this.currentPaymentProvider === 'esewa') {
      $('#tenant_qr_provider_title, #page_qr_provider_title, #tenant_subpage_qr_title').text('सुरक्षित eSewa वालेट क्युआर');
      $('#tenant_account_no_display, #tenant_subpage_acc_no, #tenant_qr_acc_number, #page_qr_acc_number').text('9806060663');
      $('#tenant_account_name_display, #tenant_subpage_acc_name, #tenant_qr_acc_name, #page_qr_acc_name').text('NINGSANG JABEGU');
      $('#tenant_qr_bank_name, #page_qr_bank_name').text('eSewa ID: 9806060663');
    } else if (this.currentPaymentProvider === 'khalti') {
      $('#tenant_qr_provider_title, #page_qr_provider_title, #tenant_subpage_qr_title').text('सुरक्षित Khalti वालेट क्युआर');
      $('#tenant_account_no_display, #tenant_subpage_acc_no, #tenant_qr_acc_number, #page_qr_acc_number').text('9806060663');
      $('#tenant_account_name_display, #tenant_subpage_acc_name, #tenant_qr_acc_name, #page_qr_acc_name').text('NINGSANG JABEGU');
      $('#tenant_qr_bank_name, #page_qr_bank_name').text('Khalti ID: 9806060663');
    }

    const session = SessionManager.getActiveSession();
    const tenantName = (session && session.user && session.user.fullName) || this.currentUsername || 'Aanayas Limbu';
    $('#tenant_qr_remarks, #page_qr_remarks').text(`Flat rent for ${tenantName}`);
    $('#page_qr_amount').text(`रू ${Number(totalDue || (unpaidBill && unpaidBill.totalAmount) || 15000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  },

  updateModalQrDisplay: function () {
    const bill = this.selectedBillForPayment || (this.currentBills && this.currentBills[0]);
    const payload = this.getQrPayload(this.currentModalPaymentProvider, bill);
    const qrString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`;

    $('#modal_qr_image').attr('src', qrUrl);

    if (this.currentModalPaymentProvider === 'global_ime') {
      $('#modal_qr_provider_title').text('घरधनी Global IME बैंक / NepalQR कोड');
      $('#modal_account_detail_line').text('खाता: 03607010016463 (NINGSANG JABEGU)');
      $('#modal_qr_acc_number').text('03607010016463');
      $('#modal_qr_acc_name').text('NINGSANG JABEGU');
    } else if (this.currentModalPaymentProvider === 'esewa') {
      $('#modal_qr_provider_title').text('घरधनी eSewa वालेट QR कोड');
      $('#modal_account_detail_line').text('eSewa ID: 9806060663 (NINGSANG JABEGU)');
      $('#modal_qr_acc_number').text('9806060663');
      $('#modal_qr_acc_name').text('NINGSANG JABEGU');
    } else if (this.currentModalPaymentProvider === 'khalti') {
      $('#modal_qr_provider_title').text('घरधनी Khalti वालेट QR कोड');
      $('#modal_account_detail_line').text('Khalti ID: 9806060663 (NINGSANG JABEGU)');
      $('#modal_qr_acc_number').text('9806060663');
      $('#modal_qr_acc_name').text('NINGSANG JABEGU');
    }
  },

  renderRenteeDashboard: function () {
    const self = this;
    const bills = this.currentBills;
    const latestBill = bills[0] || {
      totalAmount: 15000,
      currentMeterReading: 160,
      status: 'unpaid',
      unitsConsumed: 0,
      electricityAmount: 0,
      floorRent: 15000,
      ratePerUnit: 12
    };

    // Calculate total unpaid & pending
    const totalDue = bills
      .filter(b => b.status === 'unpaid' || b.status === 'pending_verification')
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

    const displayDue = totalDue > 0 ? totalDue : (latestBill.totalAmount || 0);

    // Profile summary header updates
    const session = SessionManager.getActiveSession();
    const displayName = (session && session.user && session.user.fullName) || this.currentUsername || 'डेरावाला';
    const firstLetter = (displayName.charAt(0) || 'A').toUpperCase();
    const assignedFloors = (latestBill.floors && latestBill.floors.length > 0) ? latestBill.floors.join(', ') : 'पहिलो तल्ला (1st Floor)';

    $('#tenant_summary_name').text(displayName);
    $('#tenant_summary_username').text(`@${this.currentUsername}`);
    $('#tenant_summary_floors').text(assignedFloors);
    $('#tenant_profile_avatar').text(firstLetter);

    // Profile workspace subpage updates
    $('#profile_full_name').text(displayName);
    $('#profile_username').text(`@${this.currentUsername}`);
    $('#profile_assigned_floors').text(assignedFloors);
    $('#profile_base_rent').text(`रू ${(Number(latestBill.floorRent) || 15000).toLocaleString()}`);
    $('#profile_elec_rate').text(`रू ${latestBill.ratePerUnit || 12} / Unit`);
    $('#profile_phone').text((session && session.user && session.user.phone) || '९८०६०६०६६३');

    // Pre-fill profile update form
    $('#edit_profile_full_name').val(displayName);
    $('#edit_profile_phone').val((session && session.user && session.user.phone) || '९८०६०६०६६३');

    // Update numbers on screen
    $('#tenant_due_display, #tenant_due_display_2').text(`रू ${Number(displayDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    $('#tenant_meter_reading').text(`${latestBill.currentMeterReading || 0} Units`);
    $('#tenant_elec_rate_display').text(`रू ${latestBill.ratePerUnit || 12} / Unit`);

    // Network Status Card: Issue 1 Wi-Fi Setup
    let tenantInfo = null;
    try {
      const storedTenants = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
      tenantInfo = storedTenants.find(t => t.username === this.currentUsername);
    } catch (_) {}

    if (!tenantInfo && this.currentTenants) {
      tenantInfo = this.currentTenants.find(t => t.username === this.currentUsername);
    }

    const usesWifi = tenantInfo ? (tenantInfo.usesSharedWifi === true || tenantInfo.usesSharedWifi === 'true') : false;
    const deviceCount = tenantInfo ? (tenantInfo.wifiDeviceCount || 1) : 0;

    if (usesWifi) {
      $('#tenant_wifi_status').text(`${deviceCount} यन्त्रहरू`).css('color', '#86efac');
      $('.metric-glass-card .card-meta-desc').filter(function () {
        return $(this).parent().find('#tenant_wifi_status').length > 0;
      }).text(`वाइफाइ यन्त्र नेटवर्क स्थिति: ${deviceCount} यन्त्रहरू`);
    } else {
      $('#tenant_wifi_status').text('N/A').css('color', 'var(--muted)');
      $('.metric-glass-card .card-meta-desc').filter(function () {
        return $(this).parent().find('#tenant_wifi_status').length > 0;
      }).text('N/A');
    }

    // Check if there is any pending profile update request
    try {
      const reqs = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
      const myReq = reqs.find(r => r.tenantUsername === this.currentUsername && r.status === 'pending');
      if (myReq) {
        $('#profile_update_status_container').removeClass('hide');
      } else {
        $('#profile_update_status_container').addClass('hide');
      }
    } catch (_) {}

    // Status Badge
    const badgeHtml = this.getStatusBadge(latestBill.status);
    $('#tenant_status_badge, #tenant_qr_status_badge').replaceWith(
      $(badgeHtml).attr('id', 'tenant_status_badge')
    );

    // Print Receipt button enable/disable check:
    // Only available if at least one bill has status 'paid via QR' or 'paid' or 'approved'
    const paidBill = bills.find(b => b.status === 'paid via QR' || b.status === 'paid' || b.status === 'approved' || b.status === 'भुक्तानी स्वीकृत');
    if (paidBill) {
      $('#btn_print_receipt_overview, #btn_print_receipt_invoices')
        .prop('disabled', false)
        .removeClass('disabled-btn')
        .removeAttr('style')
        .off('click')
        .on('click', function () {
          self.openPrintReceiptModal(paidBill);
        });
    } else {
      $('#btn_print_receipt_overview, #btn_print_receipt_invoices')
        .prop('disabled', true)
        .addClass('disabled-btn')
        .css({ opacity: '0.5', cursor: 'not-allowed' })
        .off('click')
        .on('click', function () {
          alert('अहिलेसम्म कुनै पनि भुक्तानी स्वीकृत (Paid) भएको बिल छैन।');
        });
    }

    // Dynamic QR update
    this.updateDashboardQrDisplay();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  openPrintReceiptModal: function (billOrId) {
    let bill = null;
    if (typeof billOrId === 'string') {
      bill = (this.currentBills || []).find(b => b.id === billOrId);
    } else if (typeof billOrId === 'object' && billOrId !== null) {
      bill = billOrId;
    }

    if (!bill) {
      bill = (this.currentBills || []).find(b => b.status === 'paid via QR' || b.status === 'paid' || b.status === 'approved') || this.currentBills[0] || {};
    }

    const session = SessionManager.getActiveSession();
    const tenantName = (session && session.user && session.user.fullName) || this.currentUsername || 'Aanayas Limbu';
    const assignedFloors = (bill.floors && bill.floors.length > 0) ? bill.floors.join(', ') : 'पहिलो तल्ला (1st Floor)';
    const prevReading = bill.previousMeterReading || 140;
    const currReading = bill.currentMeterReading || 160;
    const units = bill.unitsConsumed || Math.max(0, currReading - prevReading);
    const rate = bill.ratePerUnit || 12;
    const elecAmount = bill.electricityAmount || (units * rate);
    const floorRent = bill.floorRent || 15000;
    const totalAmount = bill.totalAmount || (elecAmount + floorRent);
    const billDate = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ne-NP') : '२०८३-०१-१५';

    $('#print_bill_id').text(bill.id || 'BILL-0001');
    $('#print_bill_date').text(billDate);
    $('#print_tenant_name').text(tenantName);
    $('#print_tenant_floors').text(assignedFloors);
    $('#print_prev_reading').text(prevReading);
    $('#print_curr_reading').text(currReading);
    $('#print_units').text(units);
    $('#print_elec_rate').text(rate);
    $('#print_elec_amount').text(Number(elecAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    $('#print_floor_rent').text(Number(floorRent).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    $('#print_total_amount').text(Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }));

    $('#printable_receipt_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderRenteeInvoices: function () {
    const $tbody = $('#tenant_invoices_table_body, #tenant_invoices_page_body');
    if (!$tbody.length) return;

    $tbody.empty();

    if (this.currentBills.length === 0) {
      $tbody.html('<tr><td colspan="8" class="empty-state-notice">अहिलेसम्म कुनै मासिक बिल जारी गरिएको छैन।</td></tr>');
      return;
    }

    this.currentBills.forEach(bill => {
      const formattedDate = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ne-NP') : '२०८३';
      const badge = this.getStatusBadge(bill.status);
      const hasProof = !!bill.proofImage;
      const isPaid = bill.status === 'paid via QR' || bill.status === 'paid' || bill.status === 'approved' || bill.status === 'भुक्तानी स्वीकृत';

      let actionBtn = '';
      if (isPaid) {
        actionBtn = `
          <button class="table-mini-action-btn" style="background: rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3);" onclick="PortalDashboard.openPrintReceiptModal('${bill.id}')">
            <i data-lucide="printer"></i> रसिद प्रिन्ट
          </button>
        `;
      } else if (bill.status === 'unpaid' || bill.status === 'rejected') {
        actionBtn = `
          <button class="table-mini-action-btn accept-trigger" onclick="PortalDashboard.openPaymentModal('${bill.id}')">
            <i data-lucide="upload-cloud"></i> क्युआर भुक्तानी (Pay QR)
          </button>
        `;
      } else if (hasProof) {
        actionBtn = `
          <button class="table-mini-action-btn hold-trigger" onclick="PortalDashboard.openInspectModal('${bill.id}')">
            <i data-lucide="eye"></i> रसिद हेर्नुहोस्
          </button>
        `;
      } else {
        actionBtn = `
          <button class="table-mini-action-btn" style="background: rgba(255,255,255,0.08); color: var(--muted);" onclick="PortalDashboard.showBillBreakdown('${bill.id}')">
            <i data-lucide="file-text"></i> Breakdown
          </button>
        `;
      }

      const row = `
        <tr>
          <td>
            <strong>${bill.id || 'BILL'}</strong><br/>
            <span style="font-size:11px; color:var(--muted);">${formattedDate}</span>
          </td>
          <td>
            <span style="font-size:12px;">${bill.previousMeterReading || 0} ➔ ${bill.currentMeterReading || 0}</span>
          </td>
          <td>
            <strong style="color:var(--accent-strong);">${bill.unitsConsumed || 0} Units</strong>
          </td>
          <td>रू ${(Number(bill.electricityAmount) || 0).toLocaleString()}</td>
          <td>रू ${(Number(bill.floorRent) || 0).toLocaleString()}</td>
          <td><strong style="color:var(--accent); font-size:14px;">रू ${(Number(bill.totalAmount) || 0).toLocaleString()}</strong></td>
          <td>${badge}</td>
          <td>
            <div class="table-action-button-row">
              ${actionBtn}
              <button class="table-mini-action-btn" style="background: rgba(255,255,255,0.06); color: var(--text);" onclick="PortalDashboard.showBillBreakdown('${bill.id}')" title="विस्तृत विवरण">
                <i data-lucide="info"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      $tbody.append(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderMaintenanceLogs: function () {
    return this.loadMaintenanceList();
  },

  // ==========================================
  // घरधनी (Owner / Admin) डाटा लोडिङ र रेन्डरिङ
  // ==========================================
  loadOwnerData: async function () {
    try {
      const [overviewData, tenantsList, houseRules] = await Promise.all([
        ApiService.getDashboardOverview().catch(e => {
          console.warn('Dashboard overview error:', e);
          return null;
        }),
        ApiService.getTenants().catch(e => {
          console.warn('Tenants list error:', e);
          return [];
        }),
        ApiService.getHouseRules().catch(e => {
          console.warn('House rules error:', e);
          return [];
        })
      ]);

      const tenants = Array.isArray(tenantsList) ? tenantsList : [];
      let allBills = [];
      let verificationQueue = [];
      let stats = null;

      if (overviewData) {
        stats = overviewData.stats;
        allBills = overviewData.allInvoices || [];
        verificationQueue = overviewData.verificationQueue || [];
      }

      this.currentBills = allBills;
      this.currentTenants = tenants;
      this.currentHouseRules = Array.isArray(houseRules) ? houseRules : [];

      this.renderOwnerMetrics(stats, tenants, allBills, verificationQueue);
      this.renderTenantsTable(tenants);
      this.renderOwnerBillingTable(allBills);
      this.renderPaymentVerificationQueue(verificationQueue.length > 0 ? verificationQueue : allBills.filter(b => b.status === 'pending_verification' || b.proofImage));
      this.populateTenantDropdowns(tenants);
      this.renderOwnerHouseRules(this.currentHouseRules);
      this.renderProfileRequestsQueue();
      this.loadNoticesList();
      this.loadMaintenanceList();
      this.initIncomeAnalyticsChart(allBills);
    } catch (err) {
      console.error('Owner data loading error:', err);
    }
  },

  renderOwnerMetrics: function (stats, tenants, bills, verificationQueue) {
    if (stats) {
      $('#owner_total_tenants').text(`${stats.activeTenants || tenants.length || 0} जना`);
      $('#owner_invoiced_display').text(`रू ${(Number(stats.totalInvoiced) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_collected_display').text(`रू ${(Number(stats.totalCollected) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_pending_display').text(`रू ${(Number(stats.totalPendingDues) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_verification_queue_count').text(`${stats.pendingVerificationCount || verificationQueue.length || 0} पेन्डिङ`);
    } else {
      $('#owner_total_tenants').text(`${tenants.length} जना`);

      const totalInvoiced = bills.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
      const totalCollected = bills
        .filter(b => b.status === 'paid via QR' || b.status === 'paid')
        .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
      const totalPending = bills
        .filter(b => b.status === 'unpaid' || b.status === 'pending_verification' || b.status === 'rejected')
        .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
      const pendingCount = bills.filter(b => b.status === 'pending_verification').length;

      $('#owner_invoiced_display').text(`रू ${totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_collected_display').text(`रू ${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_pending_display').text(`रू ${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      $('#owner_verification_queue_count').text(`${pendingCount} पेन्डिङ`);
    }
  },

  renderTenantsTable: function (tenants) {
    const $tbody = $('#admin_tenants_table_body');
    if (!$tbody.length) return;

    $tbody.empty();
    if (!tenants || tenants.length === 0) {
      $tbody.html('<tr><td colspan="6" class="empty-state-notice">कुनै पनि डेरावाला भेटिएन। नयाँ डेरावाला थप्नुहोस्।</td></tr>');
      return;
    }

    // Merge with any locally preserved tenants (for wifi settings)
    let storedTenants = [];
    try {
      storedTenants = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
    } catch (_) {}

    tenants.forEach(t => {
      const storedMatch = storedTenants.find(st => st.username === t.username);
      const usesWifi = (t.usesSharedWifi !== undefined) ? t.usesSharedWifi : (storedMatch ? storedMatch.usesSharedWifi : false);
      const devCount = (t.wifiDeviceCount !== undefined) ? t.wifiDeviceCount : (storedMatch ? storedMatch.wifiDeviceCount : 1);

      const floorsText = Array.isArray(t.floor) ? t.floor.join(', ') : (t.floor || '1st Floor');
      const isDisabled = t.status === 'निष्क्रीय' || t.status === 'disabled';
      const statusBadge = isDisabled
        ? '<span class="badge status-rejected"><i data-lucide="x-circle" style="width:12px;height:12px"></i> निष्क्रीय</span>'
        : '<span class="badge status-paid"><i data-lucide="check-circle-2" style="width:12px;height:12px"></i> सक्रिय</span>';

      const wifiStatusBadge = (usesWifi === true || usesWifi === 'true')
        ? `<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.3);"><i data-lucide="wifi" style="width:12px;height:12px"></i> ${devCount} यन्त्रहरू</span>`
        : '<span style="color: var(--muted-soft); font-size: 12px;">N/A</span>';

      const toggleActionBtn = isDisabled
        ? `<button type="button" class="table-mini-action-btn accept-trigger" onclick="PortalDashboard.toggleTenantStatusAction('${t.username}', 'सक्रिय')" title="सक्रिय बनाउनुहोस्">
            <i data-lucide="user-check"></i> सक्रिय बनाउनुहोस्
           </button>`
        : `<button type="button" class="table-mini-action-btn reject-trigger" onclick="PortalDashboard.toggleTenantStatusAction('${t.username}', 'निष्क्रीय')" title="कोठा छाडेपछि निष्क्रीय गर्नुहोस्">
            <i data-lucide="user-x"></i> निष्क्रीय गर्नुहोस्
           </button>`;

      const resetPwdBtn = `<button type="button" class="table-mini-action-btn" onclick="PortalDashboard.openResetTenantPasswordModal('${t.username}')" title="पासवर्ड रिसेट गर्नुहोस्"><i data-lucide="key-round"></i> रिसेट</button>`;

      const billBtn = isDisabled
        ? `<button type="button" class="table-mini-action-btn" style="opacity: 0.55; cursor: not-allowed; background: rgba(255,255,255,0.05);" onclick="alert('यो डेरावाला निष्क्रीय (Disabled/Moved out) भएकोले बिल जारी गर्न मिल्दैन।')" title="निष्क्रीय डेरावालालाई बिल जारी गर्न मिल्दैन">
            <i data-lucide="ban"></i> बिल रोकिएको
           </button>`
        : `<button type="button" class="table-mini-action-btn accept-trigger" onclick="PortalDashboard.openGenerateBillModalForTenant('${t.username}')">
            <i data-lucide="plus-circle"></i> बिल काट्नुहोस्
           </button>`;

      const row = `
        <tr>
          <td>
            <div class="table-user-meta">
              <span class="user-main-name">${t.fullName || t.username}</span>
              <span class="user-sub-phone">@${t.username} • ${t.phone || '९८५१XXXXXX'}</span>
            </div>
          </td>
          <td>${floorsText}</td>
          <td>${wifiStatusBadge}</td>
          <td><strong>रू ${(Number(t.floorRent) || 15000).toLocaleString()}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-action-button-row">
              ${billBtn}
              ${resetPwdBtn}
              ${toggleActionBtn}
            </div>
          </td>
        </tr>
      `;
      $tbody.append(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  toggleTenantStatusAction: async function (username, targetStatus) {
    const actionText = targetStatus === 'निष्क्रीय' ? 'निष्क्रीय (Disabled/Moved out)' : 'सक्रिय (Active)';
    const confirmMsg = `के तपाईं डेरावाला @${username} लाई ${actionText} बनाउन निश्चित हुनुहुन्छ?`;
    if (!confirm(confirmMsg)) return;

    try {
      await ApiService.toggleTenantStatus(username, targetStatus);
      // Immediately reflect in in-memory array and local storage
      if (Array.isArray(this.currentTenants)) {
        const match = this.currentTenants.find(t => t.username.toLowerCase() === username.toLowerCase());
        if (match) match.status = targetStatus;
      }
      try {
        const stored = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
        const st = stored.find(s => s.username.toLowerCase() === username.toLowerCase());
        if (st) st.status = targetStatus;
        else stored.push({ username, status: targetStatus });
        localStorage.setItem('jabegu_all_tenants', JSON.stringify(stored));
      } catch (_) {}

      alert(`डेरावाला @${username} को स्थिति सफलतापूर्वक "${targetStatus}" मा परिवर्तन गरियो!`);
      await this.loadOwnerData();
    } catch (err) {
      alert(err.message || 'स्थिति परिवर्तन गर्न सकिएन।');
    }
  },

  renderOwnerBillingTable: function (bills) {
    const $tbody = $('#admin_bills_table_body, #owner_overview_bills_body, #payments_ledger_table_body');
    if (!$tbody.length) return;

    $tbody.empty();
    if (!bills || bills.length === 0) {
      $tbody.html('<tr><td colspan="8" class="empty-state-notice">कुनै पनि बिल रेकर्ड भेटिएन।</td></tr>');
      return;
    }

    bills.forEach(bill => {
      const badge = this.getStatusBadge(bill.status);
      const hasProof = !!bill.proofImage;
      const formattedDate = bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('ne-NP') : '२०८३';

      let actionButtons = `
        <button class="table-mini-action-btn" style="background: rgba(255,255,255,0.06); color: var(--text);" onclick="PortalDashboard.showBillBreakdown('${bill.id}')" title="Breakdown">
          <i data-lucide="info"></i>
        </button>
      `;

      if (bill.status === 'pending_verification' || hasProof) {
        actionButtons = `
          <button class="table-mini-action-btn hold-trigger" onclick="PortalDashboard.openInspectModal('${bill.id}')">
            <i data-lucide="eye"></i> Inspect
          </button>
          ${actionButtons}
        `;
      } else if (bill.status === 'unpaid') {
        actionButtons = `
          <button class="table-mini-action-btn accept-trigger" onclick="PortalDashboard.quickApprovePayment('${bill.id}')">
            <i data-lucide="check"></i> Paid
          </button>
          ${actionButtons}
        `;
      }

      const row = `
        <tr>
          <td>
            <strong>${bill.tenantUsername}</strong><br/>
            <span style="font-size:11px; color:var(--muted);">${bill.id} • ${formattedDate}</span>
          </td>
          <td>${(bill.floors || []).join(', ') || 'Flat'}</td>
          <td>${bill.previousMeterReading || 0} ➔ ${bill.currentMeterReading || 0} (<strong>${bill.unitsConsumed || 0} U</strong>)</td>
          <td>रू ${(Number(bill.electricityAmount) || 0).toLocaleString()}</td>
          <td>रू ${(Number(bill.floorRent) || 0).toLocaleString()}</td>
          <td><strong style="color:var(--accent); font-size:14px;">रू ${(Number(bill.totalAmount) || 0).toLocaleString()}</strong></td>
          <td>${badge}</td>
          <td><div class="table-action-button-row">${actionButtons}</div></td>
        </tr>
      `;
      $tbody.append(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderPaymentVerificationQueue: function (bills) {
    const $tbody = $('#payment_verification_queue_body');
    if (!$tbody.length) return;

    $tbody.empty();
    const queue = (bills || []).filter(b => b.status === 'pending_verification' || b.proofImage);

    if (queue.length === 0) {
      $tbody.html('<tr><td colspan="5" class="empty-state-notice"><i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;color:#8cf0a2;"></i> हाल प्रमाणीकरणका लागि कुनै नयाँ भुक्तानी पेन्डिङ छैन।</td></tr>');
      return;
    }

    queue.forEach(bill => {
      const badge = this.getStatusBadge(bill.status);
      const row = `
        <tr>
          <td>
            <strong>${bill.tenantUsername}</strong><br/>
            <span style="font-size:11px; color:var(--muted);">${bill.id}</span>
          </td>
          <td><strong style="color:var(--accent-strong);">रू ${(Number(bill.totalAmount) || 0).toLocaleString()}</strong></td>
          <td>${badge}</td>
          <td>
            <button class="table-mini-action-btn hold-trigger" onclick="PortalDashboard.openInspectModal('${bill.id}')">
              <i data-lucide="image"></i> रसिद हेर्नुहोस् (Inspect)
            </button>
          </td>
          <td>
            <div class="table-action-button-row">
              <button class="table-mini-action-btn accept-trigger" onclick="PortalDashboard.directVerifyPayment('${bill.id}', true)">
                <i data-lucide="check"></i> Approve
              </button>
              <button class="table-mini-action-btn" style="background: #991b1b; color:#fff;" onclick="PortalDashboard.directVerifyPayment('${bill.id}', false)">
                <i data-lucide="x"></i> Reject
              </button>
            </div>
          </td>
        </tr>
      `;
      $tbody.append(row);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  populateTenantDropdowns: function (tenants) {
    const $select = $('#bill_tenant_select, #owner_quick_tenant_select');
    if (!$select.length) return;

    $select.empty();
    $select.append('<option value="">-- डेरावाला छनौट गर्नुहोस् --</option>');

    (tenants || []).forEach(t => {
      const isDisabled = t.status === 'निष्क्रीय' || t.status === 'disabled';
      const label = `${t.fullName || t.username} (@${t.username})${isDisabled ? ' [निष्क्रीय - Disabled]' : ''}`;
      $select.append(`<option value="${t.username}" data-rent="${t.floorRent || 15000}" data-disabled="${isDisabled ? 'true' : 'false'}" data-floors="${(t.floor || []).join(', ')}">${label}</option>`);
    });

    // Auto populate rent when tenant selected
    $('#bill_tenant_select').off('change').on('change', function () {
      const selected = $(this).find(':selected');
      const rent = selected.data('rent') || 15000;
      const isDisabled = selected.data('disabled') === 'true' || selected.data('disabled') === true;

      if (isDisabled) {
        alert('सावधानी: यो डेरावाला निष्क्रीय (Disabled / Moved out) छ।');
      }

      $('#bill_floor_rent').val(rent);
      PortalDashboard.recalculateBillModal();
    });
  },

  // House Rules Renderers
  renderOwnerHouseRules: function (rules) {
    const $container = $('#owner_rules_container');
    if (!$container.length) return;
    if (!rules || rules.length === 0) {
      $container.html('<p class="empty-state-notice">हाल कुनै नियमहरू प्रविष्ट गरिएको छैन। "नियम सम्पादन गर्नुहोस्" बटनबाट नयाँ नियम थप्न सक्नुहुन्छ।</p>');
      return;
    }
    const html = rules.map((r, i) => `${i + 1}. ${r}`).join('<br />');
    $container.html(html);
  },

  renderTenantHouseRules: function (rules) {
    const $container = $('#tenant_rules_container');
    if (!$container.length) return;
    if (!rules || rules.length === 0) {
      $container.html('<p class="empty-state-notice">हाल कुनै नियमहरू प्रविष्ट गरिएको छैन।</p>');
      return;
    }
    const html = rules.map((r, i) => `${i + 1}. ${r}`).join('<br />');
    $container.html(html);
  },

  openEditRulesModal: function () {
    const rules = this.currentHouseRules || [];
    $('#edit_rules_textarea').val(rules.join('\n'));
    $('#edit_rules_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  submitEditRulesAction: async function () {
    const text = $('#edit_rules_textarea').val().trim();
    const rules = text.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);

    if (rules.length === 0) {
      alert('कृपया कम्तिमा एउटा नियम लेख्नुहोस्।');
      return;
    }

    $('#btn_edit_rules_submit').prop('disabled', true).text('सुरक्षित हुँदैछ...');
    try {
      await ApiService.updateHouseRules(rules);
      this.currentHouseRules = rules;
      this.renderOwnerHouseRules(rules);
      alert('घरका नियमहरू सफलतापूर्वक अद्यावधिक गरियो!');
      $('#edit_rules_modal').addClass('hide');
    } catch (err) {
      alert(err.message || 'नियम अद्यावधिक गर्दा त्रुटि भयो।');
    } finally {
      $('#btn_edit_rules_submit').prop('disabled', false).text('नियम सुरक्षित गर्नुहोस्');
    }
  },

  // ==========================================
  // मोडल र अन्तरक्रिया (Modals & Actions)
  // ==========================================

  // 1. Open Inspect Receipt Modal (Admin & Rentee)
  openInspectModal: function (billId) {
    const bill = this.currentBills.find(b => b.id === billId);
    if (!bill) return;

    this.selectedBillForInspection = bill;
    $('#inspect_tenant_name').text(bill.tenantUsername);
    $('#inspect_bill_id').text(bill.id);
    $('#inspect_bill_amount').text(`रू ${(Number(bill.totalAmount) || 0).toLocaleString()}`);
    $('#inspect_bill_status').replaceWith(
      $(this.getStatusBadge(bill.status)).attr('id', 'inspect_bill_status')
    );

    const imageUrl = ApiService.getProofImageUrl(bill.proofImage);
    $('#inspect_proof_image').attr('src', imageUrl);

    // Role-based button visibility (Issue 5)
    const session = (typeof SessionManager !== 'undefined' && typeof SessionManager.getActiveSession === 'function')
      ? SessionManager.getActiveSession()
      : null;
    const isRentee = (session && session.role === 'rentee') || this.currentRole === 'rentee';

    if (isRentee) {
      $('#inspect_reject_btn, #inspect_approve_btn').addClass('hide');
      $('#inspect_rentee_status_block').removeClass('hide');
    } else {
      $('#inspect_reject_btn, #inspect_approve_btn').removeClass('hide');
      $('#inspect_rentee_status_block').addClass('hide');
    }

    $('#inspect_proof_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Approve from Modal
  approveInspectedPayment: async function () {
    if (!this.selectedBillForInspection) return;
    const billId = this.selectedBillForInspection.id;
    $('#inspect_proof_modal').addClass('hide');
    await this.directVerifyPayment(billId, true);
  },

  // Reject from Modal
  rejectInspectedPayment: async function () {
    if (!this.selectedBillForInspection) return;
    const billId = this.selectedBillForInspection.id;
    $('#inspect_proof_modal').addClass('hide');
    await this.directVerifyPayment(billId, false);
  },

  // Verify Payment Direct API call (Issue 7: Real-time UI Removal)
  directVerifyPayment: async function (billId, isApproved) {
    // 1. Optimistically remove row from verification queue table immediately
    $(`#payment_verification_queue_body tr`).filter(function () {
      return $(this).text().includes(billId);
    }).fadeOut(200, function () {
      $(this).remove();
      const remainingRows = $('#payment_verification_queue_body tr').length;
      if (remainingRows === 0) {
        $('#payment_verification_queue_body').html('<tr><td colspan="5" class="empty-state-notice"><i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;color:#8cf0a2;"></i> हाल प्रमाणीकरणका लागि कुनै नयाँ भुक्तानी पेन्डिङ छैन।</td></tr>');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });

    // 2. Decrement pending verification queue badge in real-time
    const curCountText = $('#owner_verification_queue_count').text();
    const curCount = parseInt(curCountText, 10) || 0;
    const nextCount = Math.max(0, curCount - 1);
    $('#owner_verification_queue_count').text(`${nextCount} पेन्डिङ`);

    // 3. Update local bill status in memory
    const b = (this.currentBills || []).find(item => item.id === billId);
    if (b) {
      b.status = isApproved ? 'paid via QR' : 'rejected';
      this.renderOwnerBillingTable(this.currentBills);
    }

    try {
      await ApiService.verifyPayment(billId, isApproved);
      alert(isApproved ? 'भुक्तानी सफलतापूर्वक स्वीकृत भयो (Paid via QR)' : 'भुक्तानी अस्वीकृत गरियो (Payment Rejected)');
      await this.loadOwnerData();
    } catch (err) {
      alert(err.message || 'भुक्तानी प्रमाणिकरण गर्दा त्रुटि भयो।');
      await this.loadOwnerData();
    }
  },

  quickApprovePayment: function (billId) {
    this.directVerifyPayment(billId, true);
  },

  // 2. Open Submit Payment Proof Modal (Rentee)
  openPaymentModal: function (billId) {
    const bill = this.currentBills.find(b => b.id === billId) || this.currentBills[0];
    if (!bill) return;

    this.selectedBillForPayment = bill;
    $('#modal_pay_bill_id').text(bill.id || 'BILL');
    $('#modal_pay_amount').text(`रू ${(Number(bill.totalAmount) || 0).toLocaleString()}`);
    $('#modal_receipt_file').val('');
    $('#modal_receipt_preview').addClass('hide').attr('src', '');
    $('#modal_upload_placeholder').removeClass('hide');
    $('#submit_proof_msg').text('');

    this.updateModalQrDisplay();

    $('#submit_proof_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Submit Payment Proof Form
  submitPaymentProofAction: async function () {
    const bill = this.selectedBillForPayment;
    if (!bill) return;

    const fileInput = document.getElementById('modal_receipt_file');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!file) {
      $('#submit_proof_msg').text('कृपया भुक्तानी रसिद वा स्क्रिनसट फाइल चयन गर्नुहोस्।');
      return;
    }

    $('#modal_submit_proof_btn').prop('disabled', true).text('अपलोड तथा दर्ता हुँदैछ...');
    $('#submit_proof_msg').text('');

    try {
      const base64Image = await this.fileToBase64(file);
      await ApiService.submitProof(bill.id, base64Image);
      alert('भुक्तानी प्रमाण सफलतापूर्वक दर्ता भयो! घरधनीले रुजु गरेपछि स्थिति स्वीकृत हुनेछ।');
      $('#submit_proof_modal').addClass('hide');
      await this.loadRenteeData();
    } catch (err) {
      $('#submit_proof_msg').text(err.message || 'रसिद अपलोड असफल भयो।');
    } finally {
      $('#modal_submit_proof_btn').prop('disabled', false).text('प्रमाण बुझाउनुहोस्');
    }
  },

  fileToBase64: function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  // 3. Create Tenant Modal & Action (Issue 1: Wi-Fi Setup)
  toggleWifiDeviceInput: function (isChecked) {
    if (isChecked) {
      $('#tenant_wifi_devices_block').removeClass('hide');
    } else {
      $('#tenant_wifi_devices_block').addClass('hide');
    }
  },

  openCreateTenantModal: function () {
    $('#create_tenant_form')[0].reset();
    $('#tenant_input_uses_wifi').prop('checked', false);
    $('#tenant_wifi_devices_block').addClass('hide');
    $('#tenant_input_wifi_devices').val('1');
    $('#create_tenant_msg').text('');
    $('#create_tenant_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  submitCreateTenantAction: async function () {
    const username = $('#tenant_input_username').val().trim().toLowerCase();
    const password = $('#tenant_input_password').val().trim();
    const fullName = $('#tenant_input_fullname').val().trim();
    const phone = $('#tenant_input_phone').val().trim();
    const floorRent = Number($('#tenant_input_floorrent').val()) || 15000;
    const usesSharedWifi = $('#tenant_input_uses_wifi').is(':checked');
    const wifiDeviceCount = usesSharedWifi ? (parseInt($('#tenant_input_wifi_devices').val(), 10) || 1) : 0;

    const selectedFloors = [];
    $('input[name="tenant_floors"]:checked').each(function () {
      selectedFloors.push($(this).val());
    });
    if (selectedFloors.length === 0) {
      selectedFloors.push('1st Floor');
    }

    if (!username || !password || !fullName) {
      $('#create_tenant_msg').text('कृपया सबै आवश्यक विवरण भर्नुहोस्।');
      return;
    }

    $('#btn_create_tenant_submit').prop('disabled', true).text('दर्ता हुँदैछ...');

    const payload = {
      username,
      password,
      fullName,
      phone,
      floor: selectedFloors,
      floorRent,
      usesSharedWifi,
      wifiDeviceCount
    };

    try {
      await ApiService.createTenant(payload);

      // Persist wifi settings and tenant info locally
      try {
        let allTenants = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
        allTenants = allTenants.filter(t => t.username !== username);
        allTenants.push(payload);
        localStorage.setItem('jabegu_all_tenants', JSON.stringify(allTenants));
      } catch (_) {}

      alert(`नयाँ डेरावाला @${username} सफलतापूर्वक दर्ता गरियो!`);
      $('#create_tenant_modal').addClass('hide');
      await this.loadOwnerData();
    } catch (err) {
      alert(err.message || 'डेरावाला दर्ता गर्दा त्रुटि भयो।');
    } finally {
      $('#btn_create_tenant_submit').prop('disabled', false).text('डेरावाला दर्ता गर्नुहोस्');
    }
  },

  // 4. Generate Monthly Bill Modal & Action
  openGenerateBillModal: function () {
    $('#generate_bill_form')[0].reset();
    $('#bill_rate_per_unit').val(12);
    $('#bill_floor_rent').val(15000);
    this.recalculateBillModal();
    $('#generate_bill_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  openGenerateBillModalForTenant: function (tenantUsername) {
    const tenant = (this.currentTenants || []).find(t => t.username === tenantUsername);
    if (tenant && (tenant.status === 'निष्क्रीय' || tenant.status === 'disabled')) {
      alert('यो डेरावाला निष्क्रीय (Disabled / Moved out) भएकोले नयाँ बिल जारी गर्न मिल्दैन।');
      return;
    }
    this.openGenerateBillModal();
    $('#bill_tenant_select').val(tenantUsername).trigger('change');
  },

  recalculateBillModal: function () {
    const tenantUsername = $('#bill_tenant_select').val();
    const currentReading = Number($('#bill_current_reading').val()) || 0;
    const rate = Number($('#bill_rate_per_unit').val()) || 12;
    const floorRent = Number($('#bill_floor_rent').val()) || 15000;

    // Find previous reading from tenant's latest bill
    const tenantBills = (this.currentBills || []).filter(b => b.tenantUsername && b.tenantUsername.toLowerCase() === (tenantUsername || '').toLowerCase());
    const prevReading = tenantBills.length > 0 ? (tenantBills[0].currentMeterReading || 0) : 0;
    $('#bill_previous_reading_display').text(`${prevReading} Units`);

    const unitsConsumed = Math.max(0, currentReading - prevReading);
    const electricityAmount = unitsConsumed * rate;
    const total = electricityAmount + floorRent;

    $('#calc_preview_units').text(`${unitsConsumed} Units`);
    $('#calc_preview_elec').text(`रू ${electricityAmount.toLocaleString()}`);
    $('#calc_preview_rent').text(`रू ${floorRent.toLocaleString()}`);
    $('#calc_preview_total').text(`रू ${total.toLocaleString()}`);
  },

  submitGenerateBillAction: async function () {
    const tenantUsername = $('#bill_tenant_select').val();
    const currentMeterReading = Number($('#bill_current_reading').val()) || 0;
    const ratePerUnit = Number($('#bill_rate_per_unit').val()) || 12;
    const floorRent = Number($('#bill_floor_rent').val()) || 15000;

    if (!tenantUsername) {
      alert('कृपया डेरावाला छनौट गर्नुहोस्।');
      return;
    }

    const tenant = (this.currentTenants || []).find(t => t.username === tenantUsername);
    if (tenant && (tenant.status === 'निष्क्रीय' || tenant.status === 'disabled')) {
      alert('यो डेरावाला निष्क्रीय (Disabled / Moved out) भएकोले नयाँ बिल जारी गर्न मिल्दैन।');
      return;
    }

    const payload = {
      tenantUsername,
      currentMeterReading,
      ratePerUnit,
      floorRent
    };

    $('#btn_generate_bill_submit').prop('disabled', true).text('बिल तयार हुँदैछ...');

    try {
      await ApiService.generateBill(payload);
      alert(`सफलतापूर्वक नयाँ मासिक बिल जारी गरियो!`);
      $('#generate_bill_modal').addClass('hide');
      await this.loadOwnerData();
    } catch (err) {
      alert(err.message || 'बिल जारी गर्दा त्रुटि भयो।');
    } finally {
      $('#btn_generate_bill_submit').prop('disabled', false).text('मासिक बिल जारी गर्नुहोस्');
    }
  },

  // 5. Bill Detailed Breakdown View Modal
  showBillBreakdown: function (billId) {
    const bill = this.currentBills.find(b => b.id === billId);
    if (!bill) return;

    $('#breakdown_bill_id').text(bill.id);
    $('#breakdown_prev_reading').text(`${bill.previousMeterReading || 0} Units`);
    $('#breakdown_curr_reading').text(`${bill.currentMeterReading || 0} Units`);
    $('#breakdown_units').text(`${bill.unitsConsumed || 0} Units`);
    $('#breakdown_rate').text(`रू ${bill.ratePerUnit || 12} / Unit`);
    $('#breakdown_elec_cost').text(`रू ${(Number(bill.electricityAmount) || 0).toLocaleString()}`);
    $('#breakdown_floor_rent').text(`रू ${(Number(bill.floorRent) || 0).toLocaleString()}`);
    $('#breakdown_total_due').text(`रू ${(Number(bill.totalAmount) || 0).toLocaleString()}`);
    $('#breakdown_status_badge').replaceWith(
      $(this.getStatusBadge(bill.status)).attr('id', 'breakdown_status_badge')
    );

    $('#bill_breakdown_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // 6. Change Password Modals & Actions
  openChangePasswordModal: function () {
    $('#modal_change_password_form')[0].reset();
    $('#modal_change_password_msg').text('');
    $('#change_password_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // Issue 11: Admin Password Change (Requires only newPassword and confirmPassword)
  submitModalChangePasswordAction: async function () {
    const newPassword = $('#modal_admin_new_password').val().trim();
    const confirmPassword = $('#modal_admin_confirm_password').val().trim();
    const $msg = $('#modal_change_password_msg');

    $msg.text('');

    if (!newPassword || !confirmPassword) {
      $msg.text('कृपया नयाँ पासवर्ड र पुष्टि पासवर्ड भर्नुहोस्।');
      return;
    }

    if (newPassword.length < 4) {
      $msg.text('नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ।');
      return;
    }

    if (newPassword !== confirmPassword) {
      $msg.text('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।');
      return;
    }

    $('#btn_modal_change_password_submit').prop('disabled', true).text('परिवर्तन हुँदैछ...');

    try {
      await ApiService.changePassword('', newPassword);
      alert('एडमिन पासवर्ड सफलतापूर्वक परिवर्तन गरियो!');
      $('#change_password_modal').addClass('hide');
      $('#modal_change_password_form')[0].reset();
    } catch (err) {
      $msg.text(err.message || 'पासवर्ड परिवर्तन असफल भयो।');
    } finally {
      $('#btn_modal_change_password_submit').prop('disabled', false).text('पासवर्ड परिवर्तन सुरक्षित गर्नुहोस्');
    }
  },

  submitChangePasswordAction: async function () {
    const newPassword = $('#admin_new_password').val().trim();
    const confirmPassword = $('#admin_confirm_password').val().trim();
    const $msg = $('#admin_change_password_msg');

    $msg.text('');

    if (!newPassword || !confirmPassword) {
      $msg.text('कृपया नयाँ पासवर्ड र पुष्टि पासवर्ड भर्नुहोस्।');
      return;
    }

    if (newPassword.length < 4) {
      $msg.text('नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ।');
      return;
    }

    if (newPassword !== confirmPassword) {
      $msg.text('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।');
      return;
    }

    $('#btn_change_password_submit').prop('disabled', true).text('परिवर्तन हुँदैछ...');

    try {
      await ApiService.changePassword('', newPassword);
      alert('एडमिन पासवर्ड सफलतापूर्वक परिवर्तन गरियो!');
      $('#admin_change_password_form')[0].reset();
      $msg.css('color', '#8cf0a2').text('पासवर्ड सफलतापूर्वक परिवर्तन भयो!');
    } catch (err) {
      $msg.css('color', '#fca5a5').text(err.message || 'पासवर्ड परिवर्तन असफल भयो।');
    } finally {
      $('#btn_change_password_submit').prop('disabled', false).text('पासवर्ड सुरक्षित गर्नुहोस्');
    }
  },

  // Issue 11: Admin Reset Tenant Password Modal & Action
  openResetTenantPasswordModal: function (username) {
    this.targetTenantForReset = username;
    $('#reset_modal_tenant_username').text(`@${username}`);
    $('#reset_modal_new_password').val('');
    $('#reset_modal_confirm_password').val('');
    $('#reset_modal_msg').text('').removeAttr('style');
    $('#reset_tenant_password_modal').removeClass('hide');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  submitResetTenantPasswordAction: async function () {
    const username = this.targetTenantForReset;
    const newPassword = $('#reset_modal_new_password').val().trim();
    const confirmPassword = $('#reset_modal_confirm_password').val().trim();
    const $msg = $('#reset_modal_msg');

    $msg.text('');

    if (!username) {
      $msg.css('color', '#ff8c8c').text('डेरावाला पहिचान हुन सकेन।');
      return;
    }

    if (!newPassword || !confirmPassword) {
      $msg.css('color', '#ff8c8c').text('कृपया नयाँ पासवर्ड र पुष्टि पासवर्ड दुबै भर्नुहोस्।');
      return;
    }

    if (newPassword.length < 4) {
      $msg.css('color', '#ff8c8c').text('नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ।');
      return;
    }

    if (newPassword !== confirmPassword) {
      $msg.css('color', '#ff8c8c').text('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।');
      return;
    }

    $('#btn_submit_reset_tenant_pwd').prop('disabled', true).text('रिसेट हुँदैछ...');

    try {
      await ApiService.resetTenantPassword(username, newPassword);

      // Also update local store if present
      try {
        const stored = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
        const t = stored.find(item => item.username === username);
        if (t) {
          t.password = newPassword;
          localStorage.setItem('jabegu_all_tenants', JSON.stringify(stored));
        }
      } catch (_) {}

      alert(`डेरावाला @${username} को पासवर्ड सफलतापूर्वक रिसेट भयो!`);
      $('#reset_tenant_password_modal').addClass('hide');
    } catch (err) {
      $msg.css('color', '#ff8c8c').text(err.message || 'पासवर्ड रिसेट असफल भयो।');
    } finally {
      $('#btn_submit_reset_tenant_pwd').prop('disabled', false).text('पासवर्ड रिसेट गर्नुहोस्');
    }
  },

  // Issue 3: Profile Edit Request (Rentee)
  submitProfileUpdateRequestAction: async function () {
    const fullName = $('#edit_profile_full_name').val().trim();
    const phone = $('#edit_profile_phone').val().trim();
    const $msg = $('#profile_update_msg');
    $msg.text('');

    if (!fullName) {
      $msg.css('color', '#ff8c8c').text('कृपया पूरा नाम भर्नुहोस्।');
      return;
    }

    $('#btn_submit_profile_update').prop('disabled', true).text('अनुरोध पठाउँदै...');

    try {
      await ApiService.requestProfileUpdate(this.currentUsername, fullName, phone);
      $msg.css('color', '#86efac').text('विवरण परिवर्तन अनुरोध सफलतापूर्वक घरधनीकहाँ पठाइयो!');
      $('#profile_update_status_container').removeClass('hide');
    } catch (err) {
      $msg.css('color', '#ff8c8c').text(err.message || 'अनुरोध पठाउन असफल भयो।');
    } finally {
      $('#btn_submit_profile_update').prop('disabled', false).text('विवरण परिवर्तन अनुरोध पठाउनुहोस्');
    }
  },

  // Issue 11: Rentee Password Change (Requires currentPassword, newPassword, confirmPassword)
  submitRenteeChangePasswordAction: async function () {
    const currentPassword = $('#rentee_current_password').val().trim();
    const newPassword = $('#rentee_new_password').val().trim();
    const confirmPassword = $('#rentee_confirm_password').val().trim();
    const $msg = $('#rentee_change_pwd_msg');
    $msg.text('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      $msg.css('color', '#ff8c8c').text('कृपया हालको पासवर्ड र नयाँ पासवर्ड भर्नुहोस्।');
      return;
    }

    if (newPassword.length < 4) {
      $msg.css('color', '#ff8c8c').text('नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ।');
      return;
    }

    if (newPassword !== confirmPassword) {
      $msg.css('color', '#ff8c8c').text('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन।');
      return;
    }

    $('#btn_rentee_change_pwd').prop('disabled', true).text('परिवर्तन हुँदैछ...');

    try {
      await ApiService.renteeChangePassword(this.currentUsername, currentPassword, newPassword);
      $msg.css('color', '#86efac').text('पासवर्ड सफलतापूर्वक परिवर्तन भयो!');
      $('#rentee_change_password_form')[0].reset();
      alert('तपाईंको पासवर्ड सफलतापूर्वक परिवर्तन भयो!');
    } catch (err) {
      $msg.css('color', '#ff8c8c').text(err.message || 'पासवर्ड परिवर्तन असफल भयो।');
    } finally {
      $('#btn_rentee_change_pwd').prop('disabled', false).text('पासवर्ड अद्यावधिक गर्नुहोस्');
    }
  },

  // Issue 3: Admin Profile Requests Queue Rendering & Actions
  renderProfileRequestsQueue: function () {
    const $tbody = $('#admin_profile_requests_table_body');
    if (!$tbody.length) return;

    let requests = [];
    try {
      requests = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
    } catch (_) {}

    const pendingRequests = requests.filter(r => r.status === 'pending');

    if (pendingRequests.length === 0) {
      $tbody.html('<tr><td colspan="5" class="empty-state-notice"><i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;color:#8cf0a2;"></i> हाल कुनै पेन्डिङ प्रोफाइल अनुरोध छैन।</td></tr>');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const self = this;
    const rowsHtml = pendingRequests.map(req => {
      const tenant = (self.currentTenants || []).find(t => t.username === req.tenantUsername);
      const curName = (tenant && tenant.fullName) || req.tenantUsername;
      const curPhone = (tenant && tenant.phone) || 'N/A';

      return `
        <tr data-req-id="${req.id}">
          <td>
            <strong>@${req.tenantUsername}</strong>
          </td>
          <td>
            <div style="font-size:13px; font-weight:600; color:var(--text);">${curName}</div>
            <div style="font-size:11px; color:var(--muted);">${curPhone}</div>
          </td>
          <td>
            <div style="font-size:13px; font-weight:600; color:#86efac;">${req.fullName || '—'}</div>
            <div style="font-size:11px; color:var(--muted-soft);">${req.phone || '—'}</div>
          </td>
          <td style="font-size:12px; color:var(--muted);">${req.date || req.createdAt || 'हालै'}</td>
          <td>
            <div class="action-btn-group">
              <button type="button" class="btn-table-action btn-approve" onclick="PortalDashboard.approveProfileRequest('${req.id}')">
                <i data-lucide="check"></i> स्वीकृत
              </button>
              <button type="button" class="btn-table-action btn-reject" onclick="PortalDashboard.rejectProfileRequest('${req.id}')">
                <i data-lucide="x"></i> अस्वीकृत
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    $tbody.html(rowsHtml);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  approveProfileRequest: async function (reqId) {
    try {
      let allReqs = [];
      try {
        allReqs = await ApiService.getProfileRequests();
      } catch (_) {}
      if (!Array.isArray(allReqs) || allReqs.length === 0) {
        allReqs = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
      }
      const req = allReqs.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'approved';
      localStorage.setItem('jabegu_profile_requests', JSON.stringify(allReqs));

      // 1. Call server API to persist change in DB
      await ApiService.reviewProfileUpdate(reqId, req.tenantUsername, true, {
        fullName: req.fullName,
        phone: req.phone
      });

      // 2. Update local storage representation for all tenants
      let allTenants = JSON.parse(localStorage.getItem('jabegu_all_tenants') || '[]');
      const t = allTenants.find(item => item.username.toLowerCase() === req.tenantUsername.toLowerCase());
      if (t) {
        if (req.fullName) { t.fullName = req.fullName; t.full_name = req.fullName; }
        if (req.phone) t.phone = req.phone;
        localStorage.setItem('jabegu_all_tenants', JSON.stringify(allTenants));
      }

      // 3. Update in-memory currentTenants
      if (Array.isArray(this.currentTenants)) {
        const memTenant = this.currentTenants.find(item => item.username.toLowerCase() === req.tenantUsername.toLowerCase());
        if (memTenant) {
          if (req.fullName) { memTenant.fullName = req.fullName; memTenant.full_name = req.fullName; }
          if (req.phone) memTenant.phone = req.phone;
        }
      }

      alert(`@${req.tenantUsername} को प्रोफाइल विवरण (पूरा नाम र फोन नम्बर) डाटाबेसमा सफलतापूर्वक अद्यावधिक गरियो!`);
      this.renderProfileRequestsQueue();
      await this.loadOwnerData();
    } catch (e) {
      alert('प्रोफाइल अनुरोध स्वीकृत गर्दा त्रुटि भयो।');
    }
  },

  rejectProfileRequest: async function (reqId) {
    try {
      let allReqs = [];
      try {
        allReqs = await ApiService.getProfileRequests();
      } catch (_) {}
      if (!Array.isArray(allReqs) || allReqs.length === 0) {
        allReqs = JSON.parse(localStorage.getItem('jabegu_profile_requests') || '[]');
      }
      const req = allReqs.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'rejected';
      localStorage.setItem('jabegu_profile_requests', JSON.stringify(allReqs));

      // 1. Inform server API
      await ApiService.reviewProfileUpdate(reqId, req.tenantUsername, false);

      // 2. Record rejection specifically for this tenant
      const u = req.tenantUsername.toLowerCase();
      localStorage.setItem('jabegu_rejected_profile_notice_' + u, 'true');
      localStorage.removeItem('jabegu_dismissed_rejection_' + u);

      alert(`@${req.tenantUsername} को प्रोफाइल विवरण अनुरोध अस्वीकृत गरियो। डेरावालालाई नेपालीमा सूचना देखाइनेछ।`);
      this.renderProfileRequestsQueue();
    } catch (e) {
      alert('त्रुटि भयो।');
    }
  },

  // Rentee Profile Rejection Notification Handling
  checkAndShowProfileRejectionNotice: function () {
    if (this.currentRole !== 'rentee' || !this.currentUsername) return;
    const u = this.currentUsername.toLowerCase();
    const isDismissed = localStorage.getItem('jabegu_dismissed_rejection_' + u) === 'true';
    const hasRejection = localStorage.getItem('jabegu_rejected_profile_notice_' + u) === 'true';

    const $banner = $('#profile_rejected_notice_banner');
    if (!$banner.length) return;

    if (hasRejection && !isDismissed) {
      $banner.removeClass('hide');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      $banner.addClass('hide');
    }
  },

  dismissProfileRejectionNotice: function () {
    if (!this.currentUsername) return;
    const u = this.currentUsername.toLowerCase();
    localStorage.setItem('jabegu_dismissed_rejection_' + u, 'true');
    $('#profile_rejected_notice_banner').addClass('hide');
  },

  // Notices Management (Admin & Rentee)
  loadNoticesList: async function () {
    let notices = [];
    try {
      notices = await ApiService.getNotices();
    } catch (_) {}

    if (!Array.isArray(notices) || notices.length === 0) {
      notices = [
        {
          id: 'NOTICE-1',
          title: 'पानी ट्याङ्की सफाइ तथा मर्मत सम्बन्धी सूचना',
          urgency: 'जरूरी (Important)',
          message: 'आदरणीय डेरावाला साथीहरू, यस महिनाको पानी ट्याङ्की सफाइ कार्यक्रम आगामी शनिबार विहान ८ बजे हुने भएकोले आवश्यक पानी सुरक्षित गरिराख्नुहोला।',
          date: '२०८३ बैशाख १५',
          author: 'घरधनी कार्यालय'
        },
        {
          id: 'NOTICE-2',
          title: 'डिजिटल भुक्तानी प्रणाली सम्बन्धी जानकारी',
          urgency: 'सामान्य (Normal)',
          message: 'सबै डेरावाला महानुभावहरूले आफ्नो मासिक भाडा र बिजुली बिल अनलाइन क्युआर (Global IME / eSewa / Khalti) मार्फत भुक्तानी गरी भौचर प्रणालीमा अपलोड गरिदिनुहुन अनुरोध छ।',
          date: '२०८३ बैशाख १०',
          author: 'व्यवस्थापन'
        }
      ];
      try {
        localStorage.setItem('jabegu_notices', JSON.stringify(notices));
      } catch (_) {}
    }

    // Render for Rentee
    const $tenantContainer = $('#tenant_notices_container');
    if ($tenantContainer.length) {
      const tenantHtml = notices.map(n => {
        const badgeClass = (n.urgency && n.urgency.includes('जरूरी')) ? 'status-pending' : 'status-paid';
        return `
          <div class="content-glass-card">
            <div class="card-header-inline">
              <h4><i data-lucide="bell-ring"></i> ${n.title}</h4>
              <span class="badge ${badgeClass}">${n.urgency || 'सूचना'}</span>
            </div>
            <p class="panel-inner-text" style="line-height: 1.8;">
              ${n.message}
            </p>
            <div style="font-size: 11px; color: var(--muted); margin-top: 10px;">
              प्रकाशित मिति: ${n.date || 'हालै'} • ${n.author || 'घरधनी कार्यालय'}
            </div>
          </div>
        `;
      }).join('');
      $tenantContainer.html(tenantHtml);
    }

    // Render for Admin
    const $adminContainer = $('#admin_notices_container');
    if ($adminContainer.length) {
      const adminHtml = notices.map(n => {
        const badgeClass = (n.urgency && n.urgency.includes('जरूरी')) ? 'status-pending' : 'status-paid';
        return `
          <div class="content-glass-card" style="margin-bottom: 12px;" data-notice-id="${n.id}">
            <div class="card-header-inline">
              <h5 style="margin: 0; font-size: 14px; font-weight: 700;"><i data-lucide="bell"></i> ${n.title}</h5>
              <div style="display:flex; align-items:center; gap: 8px;">
                <span class="badge ${badgeClass}">${n.urgency || 'सामान्य'}</span>
                <button type="button" class="btn-delete-notice" onclick="PortalDashboard.deleteNoticeAction('${n.id}')" title="यो सूचना मेटाउनुहोस्">
                  <i data-lucide="trash-2"></i> हटाउनुहोस्
                </button>
              </div>
            </div>
            <p class="panel-inner-text" style="margin-top: 6px; font-size: 13px; line-height: 1.6;">
              ${n.message}
            </p>
            <div style="font-size: 11px; color: var(--muted); margin-top: 8px;">
              मिति: ${n.date || 'हालै'}
            </div>
          </div>
        `;
      }).join('');
      $adminContainer.html(adminHtml);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  submitPostNoticeAction: async function () {
    const title = $('#admin_notice_title').val().trim();
    const urgency = $('#admin_notice_urgency').val();
    const message = $('#admin_notice_message').val().trim();
    const $msg = $('#admin_notice_msg');
    $msg.text('');

    if (!title || !message) {
      $msg.css('color', '#ff8c8c').text('कृपया शीर्षक र व्यहोरा दुबै भर्नुहोस्।');
      return;
    }

    $('#btn_admin_post_notice').prop('disabled', true).text('प्रकाशित हुँदैछ...');

    try {
      await ApiService.postNotice({ title, urgency, message, author: 'घरधनी कार्यालय' });
      alert('नयाँ सूचना सफलतापूर्वक प्रकाशित भयो!');
      $('#admin_post_notice_form')[0].reset();
      this.loadNoticesList();
    } catch (err) {
      $msg.css('color', '#ff8c8c').text(err.message || 'सूचना प्रकाशित गर्न सकिएन।');
    } finally {
      $('#btn_admin_post_notice').prop('disabled', false).text('सूचना प्रकाशित गर्नुहोस्');
    }
  },

  deleteNoticeAction: async function (noticeId) {
    if (!confirm('के तपाईं यो सूचना हटाउन निश्चित हुनुहुन्छ?')) return;
    try {
      await ApiService.deleteNotice(noticeId);
      alert('सूचना हटाइयो।');
      this.loadNoticesList();
    } catch (err) {
      alert(err.message || 'सूचना हटाउन सकिएन।');
    }
  },

  // Maintenance Management (Admin & Rentee)
  loadMaintenanceList: async function () {
    let list = [];
    try {
      list = await ApiService.getMaintenanceRequests();
    } catch (_) {}

    // 1. Render Admin Maintenance Table
    const $tbody = $('#admin_maintenance_table_body');
    if ($tbody.length) {
      if (!Array.isArray(list) || list.length === 0) {
        $tbody.html('<tr><td colspan="7" class="empty-state-notice"><i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;color:#8cf0a2;"></i> हाल कुनै मर्मत अनुरोध छैन।</td></tr>');
      } else {
        const rowsHtml = list.map(item => {
          const statusBadge = (item.status === 'समाधान भयो' || item.status === 'resolved')
            ? '<span class="badge status-paid">समाधान भयो</span>'
            : (item.status === 'काम हुँदैछ' || item.status === 'in_progress')
            ? '<span class="badge status-pending">काम हुँदैछ</span>'
            : '<span class="badge status-unpaid">नयाँ अनुरोध</span>';

          return `
            <tr>
              <td><strong>${item.id}</strong></td>
              <td>@${item.tenantUsername}</td>
              <td>${item.issueType}</td>
              <td><span style="font-size:12px; color:var(--accent-strong); font-weight:600;">${item.urgency || 'सामान्य'}</span></td>
              <td style="max-width: 240px; white-space: normal;">${item.description}</td>
              <td>${statusBadge}</td>
              <td>
                <select class="modern-dashboard-input" style="padding: 4px 8px; font-size: 12px; width: auto;" onchange="PortalDashboard.updateMaintenanceStatusAction('${item.id}', this.value)">
                  <option value="नयाँ अनुरोध" ${item.status === 'नयाँ अनुरोध' ? 'selected' : ''}>नयाँ अनुरोध</option>
                  <option value="काम हुँदैछ" ${item.status === 'काम हुँदैछ' || item.status === 'in_progress' ? 'selected' : ''}>काम हुँदैछ</option>
                  <option value="समाधान भयो" ${item.status === 'समाधान भयो' || item.status === 'resolved' ? 'selected' : ''}>समाधान भयो</option>
                </select>
              </td>
            </tr>
          `;
        }).join('');
        $tbody.html(rowsHtml);
      }
    }

    // 2. Render Rentee Maintenance Logs
    const $tenantLogs = $('#tenant_maintenance_logs_container');
    if ($tenantLogs.length) {
      const myLogs = (Array.isArray(list) ? list : []).filter(item => item.tenantUsername === this.currentUsername);
      if (myLogs.length === 0) {
        $tenantLogs.html('<div style="font-size: 12px; color: var(--muted-soft);">कुनै पेन्डिङ अनुरोध छैन।</div>');
      } else {
        const logsHtml = myLogs.map(item => {
          const statusBadge = (item.status === 'समाधान भयो' || item.status === 'resolved')
            ? '<span class="badge status-paid">समाधान भयो</span>'
            : (item.status === 'काम हुँदैछ' || item.status === 'in_progress')
            ? '<span class="badge status-pending">काम हुँदैछ</span>'
            : '<span class="badge status-unpaid">पेन्डिङ</span>';

          return `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                <strong style="font-size: 13px; color: var(--text);">${item.issueType}</strong>
                ${statusBadge}
              </div>
              <p style="font-size: 12px; color: var(--muted); margin: 0 0 4px 0;">${item.description}</p>
              <div style="font-size: 10px; color: var(--muted-soft);">${item.date || 'हालै दर्ता गरिएको'}</div>
            </div>
          `;
        }).join('');
        $tenantLogs.html(logsHtml);
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  submitMaintenanceRequestAction: async function () {
    const issueType = $('#maint_issue_type').val();
    const description = $('#maint_description').val().trim();
    const urgency = $('#maint_urgency').val();

    if (!description) {
      alert('कृपया समस्याको विवरण लेख्नुहोस्।');
      return;
    }

    const payload = {
      tenantUsername: this.currentUsername,
      issueType,
      description,
      urgency
    };

    try {
      await ApiService.createMaintenanceRequest(payload);
      alert('तपाईंको मर्मत अनुरोध दर्ता भयो! घरधनीलाई तुरुन्तै जानकारी गराइएको छ।');
      $('#tenant_maintenance_form')[0].reset();
      this.loadMaintenanceList();
    } catch (err) {
      alert(err.message || 'मर्मत अनुरोध पठाउन सकिएन।');
    }
  },

  updateMaintenanceStatusAction: async function (requestId, status) {
    try {
      await ApiService.updateMaintenanceStatus(requestId, status);
      alert('मर्मत स्थिति सफलतापूर्वक अद्यावधिक गरियो!');
      this.loadMaintenanceList();
    } catch (err) {
      alert(err.message || 'स्थिति अद्यावधिक गर्दा त्रुटि भयो।');
    }
  },

  // Status Badge Formatter Helper
  getStatusBadge: function (status) {
    const s = (status || 'unpaid').toLowerCase();
    if (s === 'paid via qr' || s === 'paid' || s === 'approved' || s === 'भुक्तानी स्वीकृत') {
      return '<span class="badge status-paid"><i data-lucide="check-circle-2" style="width:12px;height:12px"></i> भुक्तानी स्वीकृत</span>';
    }
    if (s === 'pending_verification' || s === 'pending' || s === 'प्रमाणीकरण पेन्डिङ') {
      return '<span class="badge status-pending"><i data-lucide="clock" style="width:12px;height:12px"></i> प्रमाणीकरण पेन्डिङ</span>';
    }
    if (s === 'rejected' || s === 'अस्वीकृत - पुनः पठाउनुहोस्') {
      return '<span class="badge status-rejected"><i data-lucide="x-circle" style="width:12px;height:12px"></i> अस्वीकृत - पुनः पठाउनुहोस्</span>';
    }
    return '<span class="badge status-unpaid"><i data-lucide="alert-circle" style="width:12px;height:12px"></i> UNPAID</span>';
  },

  initIncomeAnalyticsChart: function (bills) {
    const ctx = document.getElementById('incomeAnalyticsChart');
    if (!ctx) return;

    if (this.analyticsChartInstance) this.analyticsChartInstance.destroy();

    const monthlySums = [45000, 48500, 45000, 52000, 45540, 49000];
    if (bills && bills.length > 0) {
      const totalCollected = bills
        .filter(b => b.status === 'paid via QR' || b.status === 'paid')
        .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
      if (totalCollected > 0) {
        monthlySums[5] = totalCollected;
      }
    }

    this.analyticsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज'],
        datasets: [
          {
            label: 'मासिक आम्दानी संकलन (रू)',
            data: monthlySums,
            backgroundColor: 'rgba(201, 169, 110, 0.4)',
            borderColor: '#c9a96e',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: 'rgba(245, 248, 251, 0.6)' }
          },
          x: {
            grid: { display: false },
            ticks: { color: 'rgba(245, 248, 251, 0.6)' }
          }
        }
      }
    });
  },

  triggerLogout: function () {
    SessionManager.destroySession();
    window.location.href = 'index.html';
  },

  copyToClipboard: function (text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert(successMsg || 'क्लिपबोर्डमा प्रतिलिपि भयो (Copied to clipboard!)');
      }).catch(() => {
        prompt('कपी गर्नुहोस्:', text);
      });
    } else {
      prompt('कपी गर्नुहोस्:', text);
    }
  },

  submitMaintenanceRequest: function () {
    this.submitMaintenanceRequestAction();
  }
};

// Global Exposure for HTML Event Handlers
window.PortalDashboard = PortalDashboard;
window.LoginSystem = LoginSystem;
window.ApiService = ApiService;

$(document).ready(function () {
  if ($('#login_form').length > 0) {
    LoginSystem.init();
  }

  if ($('.app-dashboard-container').length > 0) {
    PortalDashboard.init();
  }
});
