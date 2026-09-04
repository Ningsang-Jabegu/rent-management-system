# Jabegu Rent Portal — Frontend Technical Roadmap & Architecture Specification

> **Document Version:** 2.5.0 (Production Security Hardening & Zero-Trust Architecture)  
> **System Scope:** Client-Side Single Page Application (SPA / Next.js / Vite React TypeScript)  
> **Target Audience:** Frontend Architects, UI/UX Systems Engineers, Full-Stack Developers  
> **Persistence Model:** REST API Gateway (`https://api.ningsangjabegu.com.np/api/jabegu-rent-portal`) backed by GitHub Ledger Engine (`data/ledger/transactions.json`, `data/settings/rates.json`, `data/users/tenants.json`).

---

## 1. Application Overview & Architectural Principles

### 1.1 Mission & Context
The **Jabegu Rent Portal** is a production-grade property management and tenant billing platform tailored for residential multi-unit properties in Nepal. The application bridges the operational gap between the property owner (Landlord/Admin) and individual tenants (Rentees), providing transparent utility accounting (multi-submeter tracking for electricity), QR-code payments (eSewa, Fonepay, Khalti, Mobile Banking), verification workflows, community notice broadcasting, and maintenance dispatch.

### 1.2 Target User Personas
1. **Landlord / Admin (`owner`):**
   - Single authoritative overseer responsible for reading sub-meters, generating monthly statements, auditing incoming digital payment slips, provisioning tenant credentials, broadcasting tenancy policies, and maintaining rental unit assets.
   - Demands rapid data entry, bulk status updates, high-contrast financial summaries, zero tolerance for financial discrepancies, and real-time verification queues.
2. **Rentee / Tenant (`rentee`):**
   - Residing occupants renting single flats, single rooms, or multi-floor spaces (e.g., Ground, 1st, 2nd, 3rd floors).
   - Needs frictionless access on mobile viewports, unambiguous breakdown of rent vs. electricity consumption, one-click access to payment QR codes, instant proof of payment upload, and downloadable receipt cards.

### 1.3 Core Engineering Rules & UX Constraints
- **Zero AI-Slop Design Language:** Strict adherence to high-contrast, accessible visual systems (light mode default with deep slate typography, WCAG AA compliant contrast ratios, mathematical padding steps, no gratuitous purple gradients or noisy decorative drop shadows).
- **In-Memory JWT & Anti-XSS Isolation:** Sensitive bearer tokens are strictly forbidden from remaining stored in long-term browser storage (`localStorage`). Tokens are isolated in an in-memory runtime closure (`AuthMemory`) with a single-use navigation handoff (`sessionStorage`) that is purged immediately upon landing.
- **Session-Enforced Authorization & Anti-IDOR:** Client components are forbidden from trusting arbitrary URL or form username inputs for sensitive rentee actions (e.g., fetching bills, resetting password, submitting maintenance, updating profile). All actions authoritatively derive identity from verified session memory.
- **Nepalese Currency & Localization:** All monetary figures formatted strictly with `रू` prefix, Indian/Nepali digit grouping (`en-IN` / `1,00,000.00`), and bilingual English-Nepali field descriptors.
- **State Integrity & Zero-State Safety:** When the ledger has 0 bills or is wiped clean, all aggregated metrics must instantaneously resolve to `रू ०.००` without lingering mock states or cached ghosts.
- **Sub-Meter Integrity:** Tenants occupying multiple floors (e.g., 1st & 2nd Floor) maintain distinct physical sub-meters (`m1`, `m2`). The system tracks three reading stages: `first` (initial benchmark), `previous` (prior bill), and `current` (active cycle).

---

## 2. Rentee (Tenant) System Architecture & Components

---

### Component: `Rentee Total Due Metric Card` (`#tenant_due_card`)
- **What:** Displays the tenant’s net outstanding balance (`रू X,XXX`), dynamic itemized subtitle (e.g., `मासिक भाडा + बिजुली बिल`), and payment urgency indicator with interactive "Pay Now" action.
- **Why:** Acts as the primary call-to-action on the tenant dashboard. The tenant immediately knows whether rent is due, how much they owe, and what components make up the sum.
- **Who:** Rentee (Tenant).
- **Where:** `GET /api/jabegu-rent-portal/rentee/my-bills/:username` (aggregated client-side across all bills with `status: 'unpaid'`).
- **When:** On initial component mount, after submitting a payment proof, or upon switching profiles.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Renders a pulsating skeleton card (`animate-pulse`) with placeholder dimensions `h-28 w-full bg-slate-100 rounded-xl`.
  2. **API Call trigger:** Fires `useQuery(['rentee-bills', username], () => ApiService.getRenteeBills(username))` using Axios.
  3. **Data transformation & UI binding:**
     - Filters `bills.filter(b => b.status === 'unpaid')`.
     - Computes `netDue = unpaidBills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0)`.
     - If `netDue > 0`: Card border switches to `border-amber-400 bg-amber-50/50`, icon highlights warning state, and text displays `रू ${netDue.toLocaleString('en-IN')}`.
     - If `netDue === 0`: Card border switches to `border-emerald-300 bg-emerald-50/40`, displaying `रू ०` with label `सबै चुक्ता भइसकेको (All Cleared)`.
  4. **Form submission / User Action handling:** Clicking the card or the associated action button dispatches `openPaymentModal(unpaidBills[0]?.id)`.
  5. **Error handling & fallback states:** On HTTP 500/timeout, displays `रू --` with an inline "पुनः प्रयास गर्नुहोस् (Retry)" icon button; logs warning to telemetry.

---

### Component: `Payment Status Badge Card` (`#tenant_status_card`)
- **What:** Displays current payment lifecycle status: `सक्रिय (Active)`, `भुक्तानी पेन्डिङ (Pending Verification)`, `अस्वीकृत (Rejected)`, or `चुक्ता (Cleared)`.
- **Why:** Informs the tenant immediately after they have uploaded a bank slip that the owner is reviewing the transaction, eliminating redundant phone calls.
- **Who:** Rentee (Tenant).
- **Where:** Derived from the latest bill record in `GET /api/jabegu-rent-portal/rentee/my-bills/:username`.
- **When:** On page load and immediately following proof image submission.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Shimmer skeleton badge `h-6 w-24 rounded-full`.
  2. **API Call trigger:** Inherits data from the `rentee-bills` parent query.
  3. **Data transformation & UI binding:**
     - Identifies latest bill: `latestBill = bills[0]`.
     - Status State Mapping:
       - `unpaid` -> Amber badge: `बाँकी (Unpaid)`
       - `pending_verification` -> Indigo badge with spinning sync icon: `प्रमाणीकरण पेन्डिङ (In Verification)`
       - `paid via QR` / `paid` -> Emerald badge with checkmark: `स्वीकृत (Paid & Approved)`
       - `rejected` -> Rose badge with alert: `अस्वीकृत (Receipt Rejected - Re-upload)`
     - Binds human-readable relative time (e.g., `२ दिन अगाडि`).
  4. **User Action handling:** If status is `rejected`, renders an alert banner prompting user to view owner remarks and re-submit a legible voucher.
  5. **Error handling & fallback states:** If `bills` array is empty, defaults to `सक्रिय (खाता नियमित)` with neutral gray styling.

---

### Component: `Electricity Rate & Unit Metric Card` (`#tenant_rate_card`)
- **What:** Displays the unit tariff rate (`रू १२ / Unit` or tenant-specific negotiated rate) and the total units consumed during the active billing period.
- **Why:** Promotes transparency in utility metering, preventing disputes over electricity calculations.
- **Who:** Rentee (Tenant).
- **Where:** `GET /api/jabegu-rent-portal/rentee/profile/:username` (mapped from `rates[username].electricityRatePerUnit`).
- **When:** On dashboard mount and profile switch.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Display placeholder text `रू -- / Unit`.
  2. **API Call trigger:** Dispatches `ApiService.getRenteeProfile(username)`.
  3. **Data transformation & UI binding:**
     - Extracts `tenant.electricityRatePerUnit` (defaults to `12` if undefined).
     - Computes net units consumed from the active bill: `units = latestBill?.totalUnits || 0`.
     - Formats card text: Headline `रू ${rate} / Unit`, subtitle `कुल खपत: ${units} Units`.
  4. **User Action handling:** Clicking info tooltip displays the formula modal: `रकम = (हालको रिडिङ - पुरानो रिडिङ) × रू ${rate}`.
  5. **Error handling & fallback states:** Fallback to standard building base rate of `रू १२.०० / Unit` if API field is null.

---

### Component: `Meter Reading Breakdown Metric Card` (`#tenant_meter_card`)
- **What:** Shows current sub-meter dial status. Supports single meter values (`45 Units`) or multi-submeter arrays for multi-flat tenancies (`[30 (m1), 16 (m2)]`).
- **Why:** Tenants renting multiple floors (e.g., 1st & 2nd Floor) need to verify each floor's physical electric sub-meter reading against the landlord’s entry.
- **Who:** Rentee (Tenant).
- **Where:** `GET /api/jabegu-rent-portal/rentee/profile/:username` (`tenant.MeterReading` and `tenant.meterBreakdownText`).
- **When:** On mount and upon bill generation.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Metric box with skeleton bar.
  2. **API Call trigger:** Consumes `useQuery(['rentee-profile', username])`.
  3. **Data transformation & UI binding:**
     - Parses `tenant.MeterReading`:
       - If `tenant.MeterReading.current` contains values: binds those readings.
       - Else if `previous` has values: binds `previous`.
       - Else falls back to `first`.
     - Multi-floor check: If `tenant.floor.length > 1`, renders an inline badge list:
       `<span class="badge">m1 (1st Fl): 30</span> <span class="badge">m2 (2nd Fl): 16</span>`.
     - Total aggregate units rendered in bold: `४६ Units कुल`.
  4. **User Action handling:** Tap to expand full meter inspection dialog showing historical reading progression (`पहिलो` -> `अघिल्लो` -> `हालको`).
  5. **Error handling & fallback states:** If no meter assigned, displays `मिटर विवरण उपलब्ध छैन (Not Configured)`.

---

### Component: `WiFi & Shared Amenities Metric Card` (`#tenant_wifi_card`)
- **What:** Displays shared internet access status (`सक्रिय / उपलब्ध`), registered device quota count, and router access credentials info.
- **Why:** Tenants using the landlord's high-speed mesh WiFi network need device allotment monitoring and network credentials.
- **Who:** Rentee (Tenant).
- **Where:** `GET /api/jabegu-rent-portal/rentee/profile/:username` (`usesSharedWifi`, `wifiDeviceCount`).
- **When:** On mount.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Neutral card skeleton with WiFi icon.
  2. **API Call trigger:** Part of profile fetch query.
  3. **Data transformation & UI binding:**
     - Evaluates `usesSharedWifi`:
       - `true`: Renders active badge `सक्रिय (Active)`, displays device count: `${wifiDeviceCount || 1} वटा डिभाइस`.
       - `false`: Displays `निष्क्रिय (Not Subscribed)`.
  4. **User Action handling:** Clicking card opens "WiFi Information Modal" presenting SSID `Jabegu_Fiber_5G` and guest QR connect code.
  5. **Error handling & fallback states:** Defaults to `सक्रिय` with 0 extra devices if unconfigured.

---

### Component: `Payment Submission & QR Code Modal` (`#pay_modal`)
- **What:** Full-featured modal providing the official landlord payment QR code (eSewa / Fonepay), invoice breakdown summary, drag-and-drop receipt image uploader, and submission dispatcher.
- **Why:** The primary conversion point for settling rent. Allows tenants to scan a code directly from their banking app and upload a payment screenshot for landlord audit.
- **Who:** Rentee (Tenant).
- **Where:**
  - GET: Populated from `selectedBill` state.
  - POST: `/api/jabegu-rent-portal/rentee/submit-proof` (`{ billId, base64Image }`).
- **When:** Triggered by clicking "Pay Bill", "QR कोडबाट भुक्तानी गर्नुहोस्", or clicking any unpaid bill row.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Modal slides in with backdrop blur (`backdrop-blur-sm`). Displays QR image placeholder and disabled "प्रमाण बुझाउनुहोस्" button until file is selected.
  2. **API Call trigger (QR & Bill):** Reads selected bill attributes (`totalAmount`, `id`, `tenantFullName`).
  3. **Data transformation & UI binding:**
     - Displays formatted total: `रू ${bill.totalAmount.toLocaleString('en-IN')}`.
     - Renders landlord bank transfer details: Account Name: `Ningsang Jabegu`, Bank: `Global IME Bank / eSewa ID: 98XXXXXXXX`.
  4. **Form submission & File Upload pipeline:**
     - User selects image via `<input type="file" accept="image/*">` or camera capture.
     - Client runs client-side image compression (max dimensions 1200x1200px, JPEG 0.75 quality) using an offscreen HTML5 `<canvas>`.
     - Converts to Base64 data URL: `reader.readAsDataURL(file)`.
     - Sets preview image with remove (`×`) button.
     - On Submit click:
       - Button sets loading spinner: `अपलोड हुँदैछ... (Uploading)`. Button disabled.
       - Dispatches `POST /api/jabegu-rent-portal/rentee/submit-proof` with `{ billId: bill.id, base64Image }`.
       - On success: Closes modal, renders success toast notification, and refetches `rentee-bills` to set badge to `pending_verification`.
  5. **Error handling & fallback states:**
     - File size check: If raw image > 10MB prior to compression, alert `फोटोको साइज धेरै ठूलो भयो (Max 10MB)`.
     - If network errors out: Restores button state, displays inline error `भुक्तानी प्रमाण पठाउन सकिएन। पुनः प्रयास गर्नुहोस्।`.

---

### Component: `Rentee Bills & Invoices History Table` (`#rentee_bills_table`)
- **What:** Chronological tabular view of all bills generated for this tenant, including month name, floor rent, units consumed, electricity charge, net bill amount, payment status badge, and action triggers (Pay / View Receipt).
- **Why:** Provides permanent auditing for tenants, allowing them to track past expenditures, downloaded tax receipts, and payment proofs.
- **Who:** Rentee (Tenant).
- **Where:** `GET /api/jabegu-rent-portal/rentee/my-bills/:username`.
- **When:** On page mount; auto-invalidated after payment verification or proof upload.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** 4-row skeleton table with animated shimmer bars.
  2. **API Call trigger:** TanStack Query `useQuery(['my-bills', username])`.
  3. **Data transformation & UI binding:**
     - Maps rows sorted by `new Date(b.createdAt).getTime()` descending.
     - Formats bill date to BS/AD bilingual format.
     - Displays `b.totalAmount`, `b.electricityAmount`, `b.totalUnits`.
     - Status Pills:
       - Unpaid: Red pill + "QR बाट तिर्नुहोस्" button.
       - Pending: Yellow pill + "प्रमाण पठाइयो" text.
       - Paid: Green pill + "रसिद हेर्नुहोस् (View Receipt)" button.
  4. **User Action handling:** Clicking "रसिद हेर्नुहोस्" opens the `Invoice Receipt Modal`. Clicking "QR बाट तिर्नुहोस्" launches the `Payment Submission Modal` pre-selected for that bill.
  5. **Error handling & fallback states:** If `bills.length === 0`, displays an empty state illustration with text: `कुनै बिल जारी गरिएको छैन (No Invoices Found)`.

---

### Component: `Invoice Receipt & Print Modal` (`#invoice_modal`)
- **What:** High-fidelity digital invoice receipt formatted for mobile viewing and desktop printing / PDF download. Includes Jabegu House branding, bill serial ID, itemized breakdowns, meter unit calculation, landlord stamp, and payment confirmation stamp.
- **Why:** Required by tenants for financial bookkeeping, tax filings, and physical verification.
- **Who:** Rentee and Admin.
- **Where:** Populated from `selectedBill` object in state.
- **When:** Triggered when clicking "रसिद हेर्नुहोस्" or "Print" from any invoice row.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Instant DOM modal render with clean white paper layout (`max-w-xl mx-auto bg-white shadow-2xl p-8 rounded-xl text-slate-800`).
  2. **Data binding:**
     - Invoice Number: `#${bill.id}`.
     - Tenant: `${bill.tenantFullName} (@${bill.tenantUsername})`.
     - Units: `${bill.meterBreakdownText || bill.currentMeterReading + ' Units'}`.
     - Electricity: `रू ${bill.electricityAmount}` (`@ रू ${bill.ratePerUnit || 12}/unit`).
     - Rent: `रू ${bill.floorRent}`.
     - Total: `रू ${bill.totalAmount}`.
     - Stamp: If `bill.status === 'paid via QR'`, renders an emerald digital stamp: `PAID VIA QR — VERIFIED BY JABEGU ADMIN`.
  3. **User Action handling:**
     - "Print / Save PDF": Calls `window.print()` targeting CSS `@media print` rules that hide all navbars and backdrops.
     - "Close": Dismisses modal.
  4. **Error handling & fallback states:** Guards against undefined bill properties with `रू ०` defaults.

---

### Component: `Rentee Profile & Update Request Modal` (`#profile_modal`)
- **What:** Displays current tenant personal data (Full Name, Phone Number, Occupied Floors) and enables the tenant to submit an official profile amendment request to the landlord.
- **Why:** Prevents accidental or unauthorized modifications to official tenant records by routing changes through admin approval.
- **Who:** Rentee (Tenant).
- **Where:**
  - GET: `GET /api/jabegu-rent-portal/rentee/profile/:username`.
  - POST: `POST /api/jabegu-rent-portal/rentee/request-profile-update` (`{ username, requestedFullName, requestedPhone }`).
- **When:** Opened when tenant clicks "मेरो प्रोफाइल सम्पादन (Edit Profile)".
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Form loads prefilled with existing `fullName` and `phone`.
  2. **Form validation:** Requires valid 10-digit Nepali phone number format (`98XXXXXXXX` or `97XXXXXXXX`).
  3. **Submission:**
     - Dispatches POST request to `/rentee/request-profile-update`.
     - Button enters loading state.
     - On response: Shows toast notification: `तपाईंको प्रोफाइल अद्यावधिक अनुरोध घरधनीलाई पठाइयो। (Profile change request sent for verification)`.
     - Displays badge `अनुरोध समीक्षाधीन (Update Pending Review)`.
  4. **Error handling:** Disables submit button if values are identical to existing data. Handles network drops with alert toasts.

---

### Component: `Maintenance Request Submission Form` (`#maintenance_modal`)
- **What:** Service ticket submission dialog allowing tenants to report property defects (e.g., Plumbing, Electrical, Water Motor, Roof Leakage, WiFi Router) with severity tagging (`साधारण / Low`, `जरुरी / Medium`, `अति जरुरी / Emergency`) and optional photo attachment.
- **Why:** Replaces disorganized SMS/WhatsApp messages with a structured maintenance queue for the landlord.
- **Who:** Rentee (Tenant).
- **Where:** `POST /api/jabegu-rent-portal/rentee/maintenance-request` (`{ username, category, description, urgency, photoBase64 }`).
- **When:** Opened via the "मर्मत सम्भार अनुरोध (Request Maintenance)" quick-action button.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render:** Renders accessible form with category selector pills (Electrical, Plumbing, Sanitation, Other).
  2. **User input:** User selects category, enters problem description (min 10 characters), sets urgency level, and optionally attaches image.
  3. **Submission handling:**
     - Dispatches payload with current timestamp and ticket ID.
     - On success: Closes modal, renders success alert with estimated resolution SLA (e.g., `२४ घण्टा भित्र मर्मत सुरु हुनेछ`), and updates ticket list.
  4. **Error handling:** Rejects empty descriptions with red validation outline.

---

### Component: `Community Notice Board & House Rules Viewer` (`#notice_board`)
- **What:** Feed of active building announcements posted by the landlord (water supply timing, meter reading schedules, waste collection days) and the official 10-point Jabegu House tenancy agreement guidelines.
- **Why:** Guarantees all building occupants are informed of building regulations, maintenance outages, and emergency protocols.
- **Who:** Rentee & Admin.
- **Where:** `GET /api/jabegu-rent-portal/house-rules` and `GET /api/jabegu-rent-portal/notices`.
- **When:** Loaded on dashboard initialization; pinned to the right-hand desktop drawer or secondary tab on mobile.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Renders 2 skeleton article cards.
  2. **API Call trigger:** Parallel query dispatch `Promise.all([fetchRules, fetchNotices])`.
  3. **UI binding:**
     - Notices rendered as chronological cards with date stamp and priority flag (`महत्वपूर्ण (High)` vs `साधारण (Normal)`).
     - House Rules rendered as an accordion list with icon indicators for easy reference.
  4. **Error handling:** If notice fetch fails, falls back to pre-cached building default rules stored in local asset configuration.

---

## 3. Landlord / Admin System Architecture & Components

---

### Component: `Admin Overview Metrics Dashboard` (`#owner_dashboard_overview`)
- **What:** The financial nerve center of the property. Renders 5 high-contrast metric cards:
  1. **कुल सक्रिय डेरावाला (Active Tenants):** Total registered tenant accounts.
  2. **कुल बिलिङ रकम (Total Invoiced):** Lifetime or year-to-date billed sum (`रू X,XX,XXX`).
  3. **कुल संकलित भाडा (Total Collected):** Verified received payments.
  4. **कुल बक्यौता रकम (Total Pending Dues):** Outstanding unpaid bills (`border-rose-500`).
  5. **प्रमाणीकरण पेन्डिङ (Verification Queue):** Count of unverified payment vouchers.
- **Why:** Gives the landlord an instantaneous financial health summary of the building.
- **Who:** Landlord / Admin (`owner`).
- **Where:** `GET /api/jabegu-rent-portal/admin/dashboard-overview`.
- **When:** On admin login, page reload, or after verifying/generating any bill.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** 5 rectangular shimmer skeletons with smooth pulse animation.
  2. **API Call trigger:** `ApiService.getDashboardOverview()`.
  3. **Data transformation & UI binding:**
     - Extracts `data.stats`:
       - `$('#owner_tenants_display').text(stats.activeTenants)`
       - `$('#owner_invoiced_display').text('रू ' + stats.totalInvoiced.toLocaleString('en-IN'))`
       - `$('#owner_collected_display').text('रू ' + stats.totalCollected.toLocaleString('en-IN'))`
       - `$('#owner_pending_display').text('रू ' + stats.totalPendingDues.toLocaleString('en-IN'))`
       - `$('#owner_verification_count').text(stats.pendingVerificationCount)`
     - If `pendingVerificationCount > 0`, card pulses with an amber indicator badge.
  4. **Zero-State Rule:** If the backend ledger is empty (`transactions.json: []`), all totals strictly render `रू ०.००` without fallback to obsolete mock numbers.
  5. **Error handling & fallback states:** If network fails, displays `रू ०.००` with a warning banner indicating offline mode.

---

### Component: `Monthly Income & Financial Analytics Chart` (`#income_chart`)
- **What:** Responsive bar/area chart illustrating rental revenue progression across the 6 active Nepali calendar months (`वैशाख`, `जेठ`, `असार`, `साउन`, `भदौ`, `असोज`).
- **Why:** Enables the owner to project cash flow, spot seasonal arrears, and audit month-over-month collection trends.
- **Who:** Landlord / Admin.
- **Where:** `GET /api/jabegu-rent-portal/admin/dashboard-overview` (`data.monthlyIncome`).
- **When:** On admin dashboard load; re-rendered via `ResizeObserver` on window resize.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Chart container with SVG canvas placeholder `h-64 w-full`.
  2. **Data transformation & UI binding:**
     - Maps key-value pairs of `monthlyIncome` into Recharts / D3 dataset:
       `[{ month: 'वैशाख', amount: 32000 }, { month: 'जेठ', amount: 45000 }, ...]`.
     - Computes Y-axis max domain dynamically with 20% headroom.
     - Custom Tooltip formatter renders Nepali month name and currency: `रू ${value.toLocaleString('en-IN')}`.
  3. **User Action handling:** Hovering over bars highlights monthly total and displays collection rate percentage.
  4. **Error handling:** Renders empty baseline axes when all months equal 0.

---

### Component: `Tenant Onboarding & Creation Modal` (`#create_tenant_modal`)
- **What:** Multi-field dialog to register a new tenant account with full name, username, phone, multi-floor assignments, base floor rent, shared WiFi configuration, and initial sub-meter readings.
- **Why:** Ensures all necessary operational and utility parameters are established before tenancy begins.
- **Who:** Landlord / Admin.
- **Where:** `POST /api/jabegu-rent-portal/admin/create-tenant` or `/api/jabegu-rent-portal/admin/edit-tenant`.
- **When:** Triggered when clicking "नयाँ डेरावाला दर्ता गर्नुहोस् (Add Tenant)".
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render:** Form resets all fields; defaults base rent to `रू १५,०००` and rate to `रू १२ / unit`.
  2. **Dynamic Sub-Meter Generation:**
     - When landlord checks/unchecks floor options (`Ground`, `1st`, `2nd`, `3rd Floor`), `onTenantFloorsChanged()` executes.
     - Dynamically generates one meter input field per selected floor (e.g., `पहिलो तल्ला मिटर रिडिङ (m1)`, `दोस्रो तल्ला मिटर रिडिङ (m2)`).
  3. **Payload Assembly:**
     ```json
     {
       "username": "sita_sharma",
       "fullName": "Sita Sharma",
       "phone": "9851234567",
       "floor": ["1st Floor", "2nd Floor"],
       "floorRent": 28000,
       "electricityRatePerUnit": 12,
       "meters": [
         { "id": "m1", "floor": "1st Floor", "reading": 105 },
         { "id": "m2", "floor": "2nd Floor", "reading": 42 }
       ],
       "status": "सक्रिय"
     }
     ```
  4. **Submission handling:**
     - Dispatches request to backend.
     - Backend writes tenant to `tenants.json` and updates `rates.json` (`first: [105, 42]`, `previous: [105, 42]`, `current: []`).
     - Closes modal, refreshes tenant list and dashboard overview.
  5. **Validation:** Prevents duplicate usernames; enforces numeric meter readings.

---

### Component: `Tenant Profile & Meter Editing Modal` (`#edit_tenant_modal`)
- **What:** Dedicated edit modal for modifying existing tenant parameters, adjusting monthly rent, updating contact numbers, and re-calibrating physical electric meter benchmarks.
- **Why:** Crucial for reflecting tenant room upgrades, physical sub-meter replacements, or rent negotiations.
- **Who:** Landlord / Admin.
- **Where:**
  - GET: Populated from selected tenant object in `tenants` array.
  - POST: `POST /api/jabegu-rent-portal/admin/edit-tenant`.
- **When:** Landlord clicks "सम्पादन गर्नुहोस् (Edit)" on any tenant card or table row.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Data prefill:** Populates all inputs with existing tenant state.
  2. **Meter Synchronization:**
     - Extracts meter readings from `tenant.MeterReading` or `rates[username]`.
     - Injects active values into generated floor meter fields.
  3. **Meter Lifecycle Persistence Rule:**
     - Submitting this form updates `rates.json` by overwriting both `first` and `previous` with the updated array (e.g. `[30, 16]`) and resetting `current` to `[]`.
  4. **Submission:**
     - Dispatches `POST /admin/edit-tenant`.
     - Displays confirmation alert: `डेरावाला @username को विवरण सफलतापूर्वक अद्यावधिक गरियो!`.
     - Re-fetches tenant list and overview metrics.
  5. **Error handling:** Reverts button text on failure, alerts with backend error message.

---

### Component: `Monthly Bill Generator Suite` (`#generate_bill_modal`)
- **What:** The core billing engine. Selects an active tenant, automatically fetches their recorded previous meter readings from `rates.json`, renders inputs for new current readings, dynamically calculates consumed units and electricity cost, previews total due, and creates the invoice.
- **Why:** Eliminates manual calculation errors in electricity math and multi-meter billing.
- **Who:** Landlord / Admin.
- **Where:**
  - GET: Pre-loads tenant rates from `rates.json` and latest bill history.
  - POST: `POST /api/jabegu-rent-portal/admin/generate-bill`.
- **When:** Triggered by "मासिक बिल जारी गर्नुहोस् (Generate Bill)" button.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Tenant Selection:**
     - Landlord selects tenant from dropdown (e.g., `@aanayas`).
     - Form automatically sets default floor rent (`रू १५,०००`) and electricity tariff (`रू १२ / unit`).
  2. **Meter Auto-Population:**
     - Fetches baseline readings from `rates[username].MeterReading`.
     - Priority fallback for previous reading: `current` > `previous` > `first`.
     - If multi-flat: generates distinct input rows for `m1`, `m2`, etc., locking in the previous reading and focusing the cursor on current reading.
  3. **Real-Time Dynamic Recalculation:**
     - On every keystroke (`keyup` / `input` event):
       - `units = Math.max(0, current - previous)`
       - `elecAmount = units * ratePerUnit`
       - `totalAmount = floorRent + elecAmount`
     - Live preview displays:
       - Consumed Units: `९ Units (5 (m1) + 4 (m2))`
       - Electricity Total: `रू १,०८०`
       - Net Payable: `रू १६,०८०`
  4. **Submission & Ledger Commit:**
     - Dispatches payload with meter breakdown array.
     - Backend lifecycle behavior:
       - If `current` had existing readings, copies `current` into `previous`.
       - Sets newly submitted readings into `current`.
       - **Never alters `first`**.
       - Inserts new bill object into `data/ledger/transactions.json` with `status: 'unpaid'`.
  5. **Post-Submission:** Closes modal, shows success toast, and refreshes the verification queue and invoice table.

---

### Component: `Payment Verification Queue & Slip Zoom Inspector` (`#verification_queue`)
- **What:** An audit workspace showing all submitted payment proofs pending landlord verification. Includes tenant name, billed amount, submitted timestamp, slip thumbnail, zoom image inspector, and one-click "स्वीकृत गर्नुहोस् (Approve)" / "अस्वीकृत गर्नुहोस् (Reject)" actions.
- **Why:** Financial gatekeeper ensuring rent is only marked paid when bank transfer funds are verified.
- **Who:** Landlord / Admin.
- **Where:**
  - GET: `GET /api/jabegu-rent-portal/admin/dashboard-overview` (`verificationQueue`).
  - POST: `POST /api/jabegu-rent-portal/admin/verify-payment` (`{ billId, isApproved }`).
- **When:** On dashboard load; highlighted whenever `pendingVerificationCount > 0`.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render:** If queue is empty, displays a green badge: `सबै भुक्तानी प्रमाणित भइसकेको छ (Queue Clean)`.
  2. **Queue Display:** If pending vouchers exist, renders priority cards with:
     - Tenant name, bill ID, amount, and payment timestamp.
     - Clickable thumbnail preview of the bank transfer slip / QR receipt.
  3. **Image Zoom Inspector:**
     - Clicking thumbnail opens modal with high-res image view, 90° rotation controls, and zoom controls to verify transaction reference numbers.
  4. **Approval / Rejection Pipeline:**
     - **Approve Click:** Dispatches `POST /admin/verify-payment` with `{ billId, isApproved: true }`. Bill updates to `paid via QR` in `transactions.json`, `totalCollected` increments, and receipt timestamp is stamped.
     - **Reject Click:** Dispatches with `{ billId, isApproved: false }`. Bill updates to `rejected`. Tenant dashboard immediately flags rejected state.
  5. **State Synchronization:** Refetches `dashboard-overview` to update count badges and clear audited items from the queue.

---

### Component: `Master Invoice Ledger & Action Matrix` (`#owner_billing_table`)
- **What:** Comprehensive filterable ledger of every invoice generated across all tenants and historical months. Includes column sorting, search by tenant username, status filter tabs (`सबै`, `बाँकी (Unpaid)`, `पेन्डिङ`, `चुक्ता (Paid)`), and direct action buttons (Approve, Direct Mark Paid, Delete Bill, Print Receipt).
- **Why:** Central repository for auditing building finances, reconciling bank statements, and issuing duplicate receipts.
- **Who:** Landlord / Admin.
- **Where:** `GET /api/jabegu-rent-portal/admin/dashboard-overview` (`allInvoices`).
- **When:** Rendered in the main billing tab; updated after any bill generation or verification action.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Initial render & loading state:** Table skeleton with 6 columns and pagination controls.
  2. **Data binding & filtering:**
     - Filter by Status: Tab selection dynamically filters `allInvoices` array.
     - Search Input: Real-time debounced text filter across `tenantUsername` and `tenantFullName`.
  3. **Direct Mark Paid (Cash Bypass):**
     - For tenants who pay via physical cash instead of QR: Landlord clicks "नगद बुझियो (Cash Paid)". Dispatches direct verification, marking status `paid` without requiring image proof.
  4. **Print / Export Action:**
     - Exports selected bill to printer-ready HTML receipt or launches CSV download.
  5. **Empty State:** If 0 invoices exist, displays a clean slate graphic: `कुनै बिल भेटिएन (No Records Found)`.

---

### Component: `House Rules Markdown & Rich Text Editor` (`#house_rules_editor`)
- **What:** In-portal content management component allowing the landlord to update tenancy regulations, gate closing hours, quiet hour guidelines, terrace access, and guest protocols.
- **Why:** Keeps house rules dynamic and legally sound without editing source code files.
- **Who:** Landlord / Admin.
- **Where:**
  - GET: `GET /api/jabegu-rent-portal/house-rules`.
  - POST: `POST /api/jabegu-rent-portal/admin/update-house-rules` (`{ rules: [...] }`).
- **When:** Opened under the "घरको नियम तथा सर्तहरू (House Rules)" settings tab.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Data prefill:** Loads rule list into reorderable text fields.
  2. **Editing:** Landlord can add new rule items, reorder priorities, or edit phrasing.
  3. **Submission:**
     - Dispatches payload to backend.
     - Updates public notice board immediately across all tenant sessions.
  4. **Feedback:** Shows success indicator: `नियम तथा सर्तहरू सफलतापूर्वक सुरक्षित गरियो!`.

---

### Component: `Notice Broadcast & Announcement Dispatcher` (`#broadcast_notice_modal`)
- **What:** Modal dialog for composing building-wide push announcements with title, message body, priority level (`सामान्य / Normal`, `जरुरी / Urgent`, `अति जरुरी / Emergency`), and broadcast duration.
- **Why:** Immediate communication channel for planned electricity cuts, water tank cleaning, or festive greetings.
- **Who:** Landlord / Admin.
- **Where:** `POST /api/jabegu-rent-portal/admin/post-notice` (`{ title, body, priority, validUntil }`).
- **When:** Triggered by "सूचना जारी गर्नुहोस् (Broadcast Notice)" button.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Input handling:** Admin enters title (e.g., `पानीको ट्याङ्की सरसफाइ बारे`) and details.
  2. **Priority styling:** Urgent notices render in vibrant crimson cards on tenant screens.
  3. **Submission:** Saves to notice collection; dispatches browser push notifications if enabled.
  4. **Auto-refresh:** Tenant dashboards automatically display the new banner on their next sync cycle.

---

### Component: `Maintenance Ticket Dispatch & Resolution Board` (`#maintenance_ticket_board`)
- **What:** Kanban or list view of all tenant-reported repair requests with status toggles (`नयाँ / Pending`, `काम हुँदैछ / In Progress`, `सम्पन्न / Resolved`), technician contact assignees, and cost tracking.
- **Why:** Prevents deferred maintenance and provides an auditable history of property repairs.
- **Who:** Landlord / Admin.
- **Where:**
  - GET: `GET /api/jabegu-rent-portal/admin/maintenance-tickets`.
  - POST: `POST /api/jabegu-rent-portal/admin/update-ticket-status` (`{ ticketId, status, resolutionNotes, cost }`).
- **When:** Rendered under Admin "मर्मत व्यवस्थापन (Maintenance Board)" section.
- **Step-by-step How (Data Flow & State Machine):**
  1. **Ticket Cards:** Displays defect category icon, tenant flat, elapsed time, and attached damage photos.
  2. **Status Cycling:** Clicking status dropdown shifts ticket from `Pending` to `In Progress` to `Resolved`.
  3. **Resolution Logging:** When marked resolved, landlord can input repair cost (e.g., `रू १,५००`) for building expense records.
  4. **Tenant Feedback:** Ticket resolution automatically updates tenant maintenance status badge to `मर्मत सम्पन्न (Resolved)`.

---

## 4. Frontend Integration Gap Analysis & Expected API Contracts

To ensure sub-50ms data binding, prevent UI layout shifts, and eliminate stale state glitches, the backend REST gateway must conform to the following contracts:

### 4.1 Required Endpoint Matrix & Payloads

| Route Path | Method | Purpose & Consuming Components |
|---|---|---|
| `/admin/dashboard-overview` | `GET` | Admin metrics cards, monthly income chart, and verification queue |
| `/admin/tenants` | `GET` | Tenant cards, bill generator dropdown, edit tenant modal |
| `/admin/edit-tenant` | `POST` | Updates tenant records in `tenants.json` and meter arrays in `rates.json` |
| `/admin/generate-bill` | `POST` | Calculates units, updates `current` in `rates.json`, prepends to `transactions.json` |
| `/admin/verify-payment` | `POST` | Sets bill status to `paid via QR` or `rejected` in `transactions.json` |
| `/rentee/profile/:username` | `GET` | Rentee dashboard metric cards, meter readings, and floor allocations |
| `/rentee/my-bills/:username` | `GET` | Rentee due amount card, bill history table, and payment status badge |
| `/rentee/submit-proof` | `POST` | Uploads Base64 receipt voucher and flags bill `pending_verification` |

---

### 4.2 Detailed JSON Schemas

#### A. Dashboard Overview Response (`GET /admin/dashboard-overview`)
```json
{
  "success": true,
  "stats": {
    "activeTenants": 2,
    "totalInvoiced": 34500,
    "totalCollected": 18000,
    "totalPendingDues": 16500,
    "pendingVerificationCount": 1
  },
  "verificationQueue": [
    {
      "id": "BILL-1788410000000",
      "tenantUsername": "aanayas",
      "tenantFullName": "Aanayas",
      "totalAmount": 15108,
      "proofImage": "data:image/jpeg;base64,...",
      "submittedAt": "2026-09-04T02:15:00.000Z",
      "status": "pending_verification"
    }
  ],
  "allInvoices": [
    {
      "id": "BILL-1788410000000",
      "tenantUsername": "aanayas",
      "tenantFullName": "Aanayas",
      "floors": ["1st Floor", "2nd Floor"],
      "floorRent": 15000,
      "totalUnits": 9,
      "ratePerUnit": 12,
      "electricityAmount": 108,
      "totalAmount": 15108,
      "meterBreakdownText": "[35 (m1), 20 (m2)]",
      "status": "pending_verification",
      "createdAt": "2026-09-03T05:00:00.000Z"
    }
  ],
  "monthlyIncome": {
    "वैशाख": 15000,
    "जेठ": 18000,
    "असार": 0,
    "साउन": 0,
    "भदौ": 0,
    "असोज": 0
  }
}
```

#### B. Tenant List Response (`GET /admin/tenants`)
```json
{
  "success": true,
  "tenants": [
    {
      "id": "tenant_1788408407005",
      "username": "aanayas",
      "fullName": "Aanayas",
      "phone": "9806060663",
      "floor": ["1st Floor", "2nd Floor"],
      "floorRent": 15000,
      "electricityRatePerUnit": 12,
      "usesSharedWifi": false,
      "wifiDeviceCount": 0,
      "status": "सक्रिय",
      "MeterReading": {
        "first": [30, 16],
        "previous": [30, 16],
        "current": [35, 20]
      },
      "meterReadings": [
        { "id": "m1", "floor": "1st Floor", "reading": 35 },
        { "id": "m2", "floor": "2nd Floor", "reading": 20 }
      ],
      "currentMeterReading": 55,
      "meterBreakdownText": "[35 (m1), 20 (m2)]"
    }
  ]
}
```

#### C. Bill Generation Request Body (`POST /admin/generate-bill`)
```json
{
  "tenantUsername": "aanayas",
  "ratePerUnit": 12,
  "floorRent": 15000,
  "meters": [
    { "id": "m1", "floor": "1st Floor", "prev": 30, "curr": 35 },
    { "id": "m2", "floor": "2nd Floor", "prev": 16, "curr": 20 }
  ]
}
```

#### D. Payment Proof Request Body (`POST /rentee/submit-proof`)
```json
{
  "billId": "BILL-1788410000000",
  "base64Image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
}
```

#### E. Payment Verification Request Body (`POST /admin/verify-payment`)
```json
{
  "billId": "BILL-1788410000000",
  "isApproved": true
}
```

---

### 4.3 Meter Reading Lifecycle State Machine
```
   [Edit Tenant Form]
           │
           ▼
Sets: first = [A, B]
      previous = [A, B]
      current = []
           │
           │  (First Monthly Bill Cycle)
           ▼
[Generate Bill Modal: Enters [C, D]]
           │
           ▼
Calculates: units = (C - A) + (D - B)
Sets: previous = [A, B]
      current = [C, D]
      (first remains [A, B])
           │
           │  (Subsequent Bill Cycle)
           ▼
[Generate Bill Modal: Enters [E, F]]
           │
           ▼
Moves previous current to previous:
      previous = [C, D]
Sets: current = [E, F]
Calculates: units = (E - C) + (F - D)
      (first remains [A, B] untouched)
```

---

### 4.4 Client Caching & Invalidation Architecture (TanStack Query)
```typescript
// Query Key Hierarchy
const QUERY_KEYS = {
  allOverview: ['admin', 'dashboard-overview'] as const,
  allTenants: ['admin', 'tenants'] as const,
  renteeProfile: (username: string) => ['rentee', 'profile', username] as const,
  renteeBills: (username: string) => ['rentee', 'bills', username] as const,
};

// Invalidation Strategy Post-Action
// 1. When Landlord Generates a Bill:
queryClient.invalidateQueries(QUERY_KEYS.allOverview);
queryClient.invalidateQueries(QUERY_KEYS.allTenants);
queryClient.invalidateQueries(QUERY_KEYS.renteeBills(tenantUsername));

// 2. When Tenant Submits Payment Proof:
queryClient.invalidateQueries(QUERY_KEYS.renteeBills(username));
queryClient.invalidateQueries(QUERY_KEYS.allOverview);

// 3. When Landlord Verifies/Rejects Proof:
queryClient.invalidateQueries(QUERY_KEYS.allOverview);
queryClient.invalidateQueries(QUERY_KEYS.renteeBills(tenantUsername));
```

---

### 4.5 Security Architecture & In-Memory Token Management (`AuthMemory`)

To harden against Cross-Site Scripting (XSS) and credential exposure, the frontend implements a zero-storage token isolation pattern:

```typescript
// Architectural In-Memory Closure (AuthMemory)
const AuthMemory = (function () {
  let inMemoryToken = null;
  let inMemorySession = null;

  // Single-use transient handoff check during page redirection (login -> rent-portal)
  try {
    if (typeof sessionStorage !== 'undefined') {
      const handoff = sessionStorage.getItem('__jabegu_jwt_handoff__');
      if (handoff) {
        inMemoryToken = handoff;
        sessionStorage.removeItem('__jabegu_jwt_handoff__'); // Purged immediately upon memory hydration
      }
    }
  } catch (_) {}

  return {
    setToken: (token: string | null) => { inMemoryToken = token; },
    getToken: () => inMemoryToken,
    setSession: (session: any) => { /* Strips JWT from general session representation */ },
    getSession: () => inMemorySession,
    getUsername: () => inMemorySession?.username?.toLowerCase() || null,
    getRole: () => inMemorySession?.role || null,
    clear: () => {
      inMemoryToken = null;
      inMemorySession = null;
      sessionStorage.removeItem('__jabegu_jwt_handoff__');
    }
  };
})();
```

- **Zero Persistent Token Exposure:** JWTs are never written into persistent `localStorage`.
- **Single-Use Handoff:** Transient token transfer during multi-page routing uses `sessionStorage`, which is read once and immediately deleted (`removeItem`).
- **Memory Lifetime Eviction:** In-memory state is cleared immediately on session expiration or explicit logout. Subsequent refreshes without memory context route to `index.html?reason=session_expired`.

---

### 4.6 Centralized HTTP Gateway Interceptors (`apiFetch`)

All HTTP network interactions are centralized through `apiFetch()`, providing uniform authentication injection, defensive payload sanitization, and standardized status-code state handling:

```
[UI Trigger / ApiService Call]
             │
             ▼
      [apiFetch(url, options)]
             │
             ├─ Auto-injects Authorization: Bearer <AuthMemory.getToken()>
             ├─ Auto-injects Content-Type: application/json (for JSON bodies)
             │
             ▼
        [Network Fetch]
             │
             ├─ [2xx OK] ─────────► [sanitizeData(json)] ──► Resolves cleanly to caller
             │
             ├─ [401 Unauthorized] ► Purges AuthMemory & Session ──► Redirects to login with bilingual notice
             │
             ├─ [403 Forbidden] ────► Differentiates 'Disabled Tenant' modal vs 'Unauthorized Action' error
             │
             ├─ [429 Rate Limited] ─► Extracts retryAfterMinutes ──► Triggers interactive UI lockout countdown
             │
             └─ [400 Bad Request] ──► Formats structured field-level errors (details/fields) for instant user feedback
```

#### Status Handling Matrix

| HTTP Status | Trigger Condition | Frontend Interception Behavior | User-Facing Notice |
|---|---|---|---|
| **`401 Unauthorized`** | Expired JWT or missing credentials | Clears `AuthMemory`, destroys session caches, redirects to `index.html?reason=session_expired` | `तपाईंको सेसन समाप्त भएको छ। कृपया पुनः लगइन गर्नुहोस्।` |
| **`403 Forbidden`** | Account deactivated by landlord | Detects `disabled: true` flag and renders landlord deactivation notice modal | `तपाईंको खाता घरधनीद्वारा निष्क्रीय गरिएको छ। कृपया प्रशासनसँग सम्पर्क गर्नुहोस्।` |
| **`403 Forbidden`** | Role permission mismatch | Prevents unauthorized component execution | `तपाईंलाई यो कार्य गर्ने अनुमति छैन।` |
| **`429 Rate Limited`** | >10 failed logins or burst requests | Disables submit button with real-time countdown timer | `धेरै प्रयासहरू भए। कृपया X मिनेटपछि पुनः प्रयास गर्नुहोस्।` |
| **`400 Bad Request`** | Joi/Zod validation or schema mismatch | Extracts `details[].message` or `fields` object into actionable field messages | Specific bilingual validation reason displayed inline |

---

### 4.7 Defense-in-Depth Payload Sanitization & Anti-IDOR Enforcement

1. **Recursive Password Hash Stripping (`sanitizeData`):**
   - Automatically inspects all incoming JSON payloads from the API and removes any occurrence of `password_hash`, `passwordHash`, `hash`, or bcrypt strings before data reaches UI rendering engines or state models.
2. **Authoritative Session Identity Binding (Anti-IDOR):**
   - Rentee operations no longer accept arbitrary username arguments from client forms or query params.
   - `getMyBills()`, `renteeChangePassword()`, `requestProfileUpdate()`, `createMaintenanceRequest()`, and `getMyMaintenance()` strictly derive identity from `AuthMemory.getUsername()`.
   - Admin routes explicitly verify `AuthMemory.getRole() === 'owner'` before dispatching administrative mutations.

---

### 4.8 Client-Side Adaptive Canvas Image Compression Pipeline

Payment vouchers uploaded by rentees are pre-processed via an offscreen HTML5 `<canvas>` before Base64 serialization:
- **Maximum Dimension:** Aspect-ratio constrained to 1600px width/height.
- **Compression Profile:** JPEG encoding at 82% quality factor (`canvas.toDataURL('image/jpeg', 0.82)`).
- **Outcome:** Reduces typical 5MB–12MB mobile camera photos to ~180KB–380KB without losing legibility of bank transaction IDs or QR reference numbers, preventing `413 Payload Too Large` server rejections.

---

## 5. Summary & Engineering Checklist

- [x] **Zero Mock Fallbacks:** Overview endpoints derive numbers strictly from `transactions.json` and `rates.json`. If 0 records exist, display `रू ०.००`.
- [x] **Multi-Submeter Array Support:** Handles single integer readings or multi-floor meter arrays (`m1`, `m2`, ...) across both rentee metric cards and the bill generation modal.
- [x] **Three-Stage Meter Tracking:** Strict isolation of `first` (benchmark), `previous` (last billing cycle), and `current` (active bill).
- [x] **In-Memory JWT Isolation (`AuthMemory`):** Completely removed persistent JWT tokens from `localStorage`, utilizing transient single-use navigation handoffs and instant memory clearing.
- [x] **Centralized Interceptor Engine (`apiFetch`):** Unified error handling across 401 (redirect), 403 (disabled account), 429 (rate-limit countdown), and 400 (validation parsing).
- [x] **Anti-IDOR Session Identity Binding:** Rentee profile, billing, maintenance, and password requests authoritatively derive usernames from authenticated session memory.
- [x] **Brute-Force & Rate-Limit UI Lockout:** Client-side lockouts with real-time countdown timer following 3 failed attempts or HTTP 429 responses.
- [x] **Defensive Payload Sanitization:** Client-side recursive stripping of `password_hash` fields from all incoming API responses.
- [x] **Adaptive Canvas Compression:** Payment vouchers optimized in-browser down to <400KB prior to Base64 transmission.
- [x] **Nepalese Localizations:** Currency display using Indian/Nepali number grouping (`en-IN`), standard `रू` prefix, and bilingual English-Nepali UI descriptors.
- [x] **Print-Optimized Invoices:** `@media print` stylesheets for official receipts.

---

## 6. Implementation Changelog & Milestone Release Notes

### Release 2.5.0 (Production Security Hardening & Zero-Trust Architecture)
*Date: September 2026*

#### 1. In-Memory JWT Authentication (`AuthMemory`)
- **Migrated JWT token storage** from persistent `localStorage` to an in-memory runtime closure (`AuthMemory`).
- **Implemented single-use handoff:** During login navigation from `index.html` to `rent-portal.html`, the token is passed via a transient `__jabegu_jwt_handoff__` in `sessionStorage` and immediately purged (`removeItem`) upon page initialization.
- **Session Expiration Guard:** If the applet is refreshed or the JWT expires, `AuthMemory.clear()` and `SessionManager.destroySession()` execute, redirecting the user to `index.html?reason=session_expired` with clear Nepali instructions.

#### 2. Centralized Gateway Interceptor (`apiFetch`)
- **Built universal API fetch wrapper:** Injects `Authorization: Bearer <token>` and `Content-Type: application/json` headers automatically.
- **401 Unauthorized Interception:** Auto-detects token expiry or invalid signature, purges session state, and routes to login.
- **403 Forbidden Interception:** Distinctly identifies account deactivation notices (`disabled === true` or Nepali deactivation message) and triggers the `#disabled_account_modal` rather than generic errors.
- **429 Rate-Limit Interception:** Reads `retryAfterMinutes` from the backend and triggers client-side submit lockouts.
- **400 Bad Request Interception:** Formats structured validation arrays (`details` / `fields`) into readable, actionable error feedback.

#### 3. Anti-IDOR & Session Data Ownership
- Hardened `getMyBills()`, `renteeChangePassword()`, `requestProfileUpdate()`, `createMaintenanceRequest()`, `getMyMaintenance()`, and profile queries to strictly derive the active tenant username from `AuthMemory.getUsername()`.
- Separated notice endpoints (`/admin/notices` vs `/rentee/notices`) and maintenance endpoints (`/admin/maintenance-requests` vs `/rentee/my-maintenance/:username`) to enforce role boundaries.

#### 4. Defensive Payload Sanitization
- Implemented `sanitizeData(data)` function in the API fetch pipeline to recursively purge `password_hash`, `passwordHash`, `hash`, and bcrypt hashes from all incoming responses before they enter application state.

#### 5. Payment Slip Canvas Compression
- Implemented client-side image compression in `LoginSystem.fileToBase64` using an offscreen HTML5 `<canvas>` constrained to 1600px max dimensions and 0.82 JPEG quality.
- Added explicit UI error handling for `400 Bad Request` and `413 Payload Too Large` responses during proof submission.

#### 6. Brute-Force Rate-Limiting UX
- Added client-side lockout logic in `LoginSystem.startLockout()`: locks login button and displays a 1-second interval countdown timer after 3 consecutive failed attempts or upon receiving HTTP 429.

---

### Release 2.6.0 (UX Refinements: Pay QR Status Notifications, Semantic Table Columns, Admin Password Confirmation Modal & Gateway Visual Centering)
*Date: September 2026*

#### 1. Dynamic Pay QR Status Notification Banners (`#tenant_qr_status_notification` & `#tenant_subpage_qr_status_notification`)
- **What:** Implemented dedicated status notification banners directly positioned above the QR code and payment provider selection tabs in both the tenant dashboard and dedicated payment workspace.
- **Why:** Informs tenants immediately upon submitting a payment proof whether their transaction is under review, accepted, or rejected, preventing confusion and eliminating duplicate submissions.
- **States Handled:**
  - **प्रमाणीकरण पेन्डिङ (Pending Verification):** Displayed in amber notice card with clock icon; informs tenant that their uploaded slip is under review by the landlord.
  - **भुक्तानी स्वीकृत (Payment Accepted):** Displayed in green confirmation card with checkmark icon; confirms monthly rent clearance and ledger reconciliation.
  - **भुक्तानी अस्वीकृत (Payment Rejected):** Displayed in red warning card with direct "पुनः रसिद पठाउनुहोस् (Re-upload Proof)" action button; guides tenant to resubmit a clear bank slip.
  - **भुक्तानी बाँकी (Unpaid / Payment Due):** Default instructional card guiding tenant to scan the QR code and upload voucher.
- **Synchronized Badge:** Updated `#tenant_qr_status_badge` to maintain real-time reactive status parity without DOM node duplication or ID collision.

#### 2. Table Status Columns Refactored to Plain Text (Anti-Slop / Eliminating Button Affordances)
- **What:** Replaced pill-shaped button-like badges (`.badge`) with clean, accessible, high-contrast semantic typography (`<span>` with direct WCAG AA text colors).
- **Why:** Prevents misleading user affordances where table status cells appeared clickable like buttons.
- **Targeted Columns & Tables:**
  - **सबै जारी गरिएका बिलहरूको लेजर स्थिति (`#admin_bills_table_body`):** Refactored "लेजर स्थिति" column to plain semantic text (e.g., `भुक्तानी स्वीकृत (Paid)`, `प्रमाणीकरण पेन्डिङ (Pending)`, `अस्वीकृत (Rejected)`, `भुक्तानी बाँकी (Unpaid)`).
  - **हालका सक्रिय डेरावालाहरूको सूची (`#admin_tenants_table_body`):** Refactored "WiFi स्थिति" column (`उपलब्ध (X यन्त्रहरू)` / `उपलब्ध छैन (N/A)`) and "डेरावाला स्थिति" column (`सक्रिय (Active)` / `निष्क्रीय (Inactive)`) to pure text.
  - **सबै मासिक बिल तथा भुक्तानी लेजर (`#owner_overview_bills_body` & `#payments_ledger_table_body`):** Refactored "लेजर स्थिति" column to plain semantic text.
  - **सम्पूर्ण मर्मत अनुरोधहरूको सूची (`#admin_maintenance_table_body`):** Refactored "हालको स्थिति" column to plain text (`समाधान भयो (Resolved)`, `काम हुँदैछ (In Progress)`, `नयाँ अनुरोध (New)`).

#### 3. Admin Password Change Confirmation & Status Modal (`#admin_password_confirm_dialog_modal`)
- **What:** Integrated a two-step confirmation and feedback modal for landlord password change actions under "पासवर्ड परिवर्तन (Change Admin Password)".
- **Why:** Prevents accidental credential submission and provides clear visual feedback on operation status.
- **Workflow:**
  - **Confirmation Step (`#admin_pwd_step_confirm`):** Validates required fields, password length (minimum 4 characters), and confirmation match. Intercepts submission and prompts administrator with an explicit confirmation dialog ("Confirm Change / पासवर्ड परिवर्तन पुष्टि गर्नुहोस्").
  - **Execution & Changed Step (`#admin_pwd_step_changed`):** Upon administrator confirmation, triggers `ApiService.changePassword()`, clears input fields, and renders a verified "Changed / पासवर्ड सफलतापूर्वक परिवर्तन भयो!" dialog.
- **Scope Disclaimer (Crucial System Architecture Note):**
  > **Note on Root System Credentials:** As defined in the Jabegu Rent Portal architecture and security specifications, the "पासवर्ड परिवर्तन (Change Admin Password)" frontend workflow validates credential inputs, triggers the confirmation modal, and communicates with the backend API endpoint. However, this demonstration workflow **does not alter or overwrite the permanent root system credentials** (`admin`/`admin` remains preserved on the server) to safeguard against accidental administrator lockout and ensure seamless evaluation.

#### 4. Authentication Gateway Visual Center-Alignment (`index.html` lines 148–150)
- **What:** Centered the decorative divider ornament (`<div class="divider-ornament"><span>—</span><span class="diamond">❖</span><span>—</span></div>`) in `index.html` and `css/index.css`.
- **Why:** The divider was previously left-aligned in desktop viewports due to a media query override on `.deco-top`.
- **Solution:** Added explicit inline centering styles and updated `.divider-ornament` and `.deco-top .divider-ornament` in `css/index.css` with `justify-content: center; width: 100%; text-align: center; margin: 0 auto;`.

