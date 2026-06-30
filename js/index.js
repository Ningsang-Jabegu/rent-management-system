const IndexObj = {
  init: function () {
    const self = this;
    setTimeout(function () {
      $("#body_loading").addClass("hide");
    }, 800);

    $("#login_btn").on("click", function () {
      self.authenticateUser();
    });
  },

  authenticateUser: function () {
    $("#login_msg").text("");
    const username = $("#account_input").val().trim().toLowerCase();
    const password = $("#account_password").val();

    if (!username || !password) {
      $("#login_msg").text(
        "कृपया प्रयोगकर्ता नाम र पासवर्ड प्रविष्ट गर्नुहोस्।",
      );
      return;
    }

    // Role-Based Route Navigation Router Rules
    if (username === "devendra" || username === "admin") {
      window.location.href = "rent-portal.html?role=owner";
    } else if (username === "tenant" || username === "rentee") {
      window.location.href = "rent-portal.html?role=rentee";
    } else {
      $("#login_msg").text("त्रुटि: अवैध खाता पहिचान वा पासवर्ड मिलेन।");
    }
  },
};

// const PortalDashboard = {
//   analyticsChartInstance: null,

//   init: function() {
//     setTimeout(function () {
//       $("#body_loading").addClass("hide");
//     }, 600);

//     // Render Scalable Lucide Icons Framework Vector Graphics
//     if (typeof lucide !== 'undefined') {
//       lucide.createIcons();
//     }

//     const params = new URLSearchParams(window.location.search);
//     const userRole = params.get("role");

//     this.renderRoleWorkspace(userRole);
//   },

//   renderRoleWorkspace: function(role) {
//     if (role === "owner") {
//       $("#owner_workspace").removeClass("hide");
//       $("#active_role_badge").text("Owner Account");
//       $("#dynamic_welcome_title").text("नमस्ते, घरधनी बुबा (Devendra)");
//       this.initIncomeAnalyticsChart();
//     } else if (role === "rentee") {
//       $("#rentee_workspace").removeClass("hide");
//       $("#active_role_badge").text("Tenant Account");
//       $("#dynamic_welcome_title").text("नमस्ते, नारायण श्रेष्ठ");
//     } else {
//       window.location.href = "index.html";
//     }
//   },

//   initIncomeAnalyticsChart: function() {
//     const ctx = document.getElementById('incomeAnalyticsChart');
//     if (!ctx) return;

//     // Destroy existing instance to prevent runtime garbage allocation
//     if (this.analyticsChartInstance) {
//       this.analyticsChartInstance.destroy();
//     }

//     // Initialize Chart.js Analytics Data Layers
//     this.analyticsChartInstance = new Chart(ctx, {
//       type: 'bar',
//       data: {
//         labels: ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज'],
//         datasets: [{
//           label: 'मासिक आम्दानी संकलन (रू)',
//           data: [45000, 45000, 48200, 45000, 52100, 45540],
//           backgroundColor: 'rgba(215, 176, 109, 0.6)',
//           borderColor: '#d7b06d',
//           borderWidth: 2,
//           borderRadius: 6
//         }]
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false,
//         plugins: {
//           legend: { display: false }
//         },
//         scales: {
//           y: {
//             grid: { color: 'rgba(255, 255, 255, 0.05)' },
//             ticks: { color: 'rgba(245, 248, 251, 0.6)' }
//           },
//           x: {
//             grid: { display: false },
//             ticks: { color: 'rgba(245, 248, 251, 0.6)' }
//           }
//         }
//       }
//     });
//   },

//   calculateNewInvoice: function() {
//     const units = parseInt($("#owner_units").val()) || 0;
//     const baseRent = 15000;
//     const ratePerUnit = 12; // Flat billing baseline condition rule
//     const computedSum = baseRent + (units * ratePerUnit);

//     // Live sync data changes across matrix layout components
//     $("#tenant_due_display").text(`रू ${computedSum.toLocaleString()}.००`);
//     $("#ledger_amount_label").text(`रू ${computedSum.toLocaleString()}`);
//     $("#owner_collected_display").text(`रू ${(30000 + computedSum).toLocaleString()}.००`);

//     // Mutate and update dynamic EMVCo/Fonepay Locked Payload matching billing metrics
//     const updatedPayload = `00020101021230300010NEPALPAY0115984100000052040000530352454${computedSum.toFixed(2).length}${computedSum.toFixed(2)}5802NP5915LaxmiP_Jabegu6008BHAKTAPUR62110107INV10246304`;
//     $("#tenant_qr").attr("src", `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(updatedPayload)}`);

//     alert(`विवरण सफलतापूर्वक अद्यावधिक भयो! नयाँ कुल भाडा महशुल: रू ${computedSum}`);
//   },

//   updateLedgerState: function(status) {
//     const badge = $("#admin_badge, #tenant_status_badge");
//     badge.removeClass("status-pending status-paid status-hold");
//     badge.addClass(`status-${status.toLowerCase()}`).text(status);
//     alert(`भाडा लेजर रेकर्ड स्थिति [${status}] मा अद्यावधिक भयो।`);
//   },

//   triggerLogout: function() {
//     window.location.href = "index.html";
//   }
// };

// Application Router Allocation Layer Lifecycle Execution

const PortalDashboard = {
  analyticsChartInstance: null,
  currentRole: null, // Tracks the dynamic role session determined by URL search params

  init: function () {
    const self = this;

    setTimeout(function () {
      $("#body_loading").addClass("hide");
    }, 600);

    // Render Scalable Lucide Icons Framework Vector Graphics
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    const params = new URLSearchParams(window.location.search);
    this.currentRole = params.get("role");

    // 1. Initial view setup based on URL role
    this.renderRoleWorkspace(this.currentRole);

    // 2. Bind navigation event listeners to handle your new pages safely
    this.initNavigation();
  },

  renderRoleWorkspace: function (role) {
    if (role === "owner") {
      $("#owner_workspace").removeClass("hide");
      $("#active_role_badge").text("Owner Account");
      $("#dynamic_welcome_title").text("नमस्ते, घरधनी बुबा (Devendra)");
      this.initIncomeAnalyticsChart();
    } else if (role === "rentee") {
      $("#rentee_workspace").removeClass("hide");
      $("#active_role_badge").text("Tenant Account");
      $("#dynamic_welcome_title").text("नमस्ते, नारायण श्रेष्ठ");
    } else {
      window.location.href = "index.html";
    }
  },

  initNavigation: function () {
    const self = this;

    // Handles sidebar click matching your new data-target architecture
    $(".nav-item, .mobile-nav-link").on("click", function (e) {
      e.preventDefault();

      // Switch visual active link indicators
      $(".nav-item").removeClass("active");
      $(this).addClass("active");

      let targetWorkspace = $(this).attr("data-target");

      // Dynamic Role Routing Strategy for generic overview queries
      if (targetWorkspace === "overview_workspace") {
        targetWorkspace =
          self.currentRole === "owner" ? "owner_workspace" : "rentee_workspace";
      }

      // Safe clean sweep: hide all existing views before toggling target unhide transitions
      $(
        "#owner_workspace, #rentee_workspace, #tenants_workspace, #payments_workspace, #lease_workspace",
      ).addClass("hide");

      // Reveal targeted section container element viewport
      $("#" + targetWorkspace).removeClass("hide");

      // Re-render structural vectors if loaded inside newly active hidden wrappers
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }

      // Auto-collapse mobile navigation slide draw layouts safely
      if ($(window).width() <= 1024) {
        $(".app-sidebar").css("transform", "translateX(-100%)");
      }
    });

    // Mobile Navigation Draw Layout Toggle Trigger Wireframes
    $(".mobile-top-bar button").on("click", function () {
      // Toggle side-pane visual offsets
      const sidebar = $(".app-sidebar");
      if (
        sidebar.css("transform") === "none" ||
        sidebar.css("transform") === "matrix(1, 0, 0, 1, 0, 0)"
      ) {
        sidebar.css("transform", "translateX(-100%)");
      } else {
        sidebar.css("transform", "translateX(0)");
      }
    });
  },

  initIncomeAnalyticsChart: function () {
    const ctx = document.getElementById("incomeAnalyticsChart");
    if (!ctx) return;

    // Destroy existing instance to prevent runtime garbage allocation
    if (this.analyticsChartInstance) {
      this.analyticsChartInstance.destroy();
    }

    // Initialize Chart.js Analytics Data Layers
    this.analyticsChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज"],
        datasets: [
          {
            label: "मासिक आम्दानी संकलन (रू)",
            data: [45000, 45000, 48200, 45000, 52100, 45540],
            backgroundColor: "rgba(215, 176, 109, 0.6)",
            borderColor: "#d7b06d",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "rgba(245, 248, 251, 0.6)" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "rgba(245, 248, 251, 0.6)" },
          },
        },
      },
    });
  },

  calculateNewInvoice: function () {
    const units = parseInt($("#owner_units").val()) || 0;
    const baseRent = 15000;
    const ratePerUnit = 12; // Flat billing baseline condition rule
    const computedSum = baseRent + units * ratePerUnit;

    // Live sync data changes across matrix layout components
    $("#tenant_due_display").text(`रू ${computedSum.toLocaleString()}.००`);
    $("#ledger_amount_label").text(`रू ${computedSum.toLocaleString()}`);
    $("#owner_collected_display").text(
      `रू ${(30000 + computedSum).toLocaleString()}.००`,
    );

    // Mutate and update dynamic EMVCo/Fonepay Locked Payload matching billing metrics
    const updatedPayload = `00020101021230300010NEPALPAY0115984100000052040000530352454${computedSum.toFixed(2).length}${computedSum.toFixed(2)}5802NP5915LaxmiP_Jabegu6008BHAKTAPUR62110107INV10246304`;
    $("#tenant_qr").attr(
      "src",
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(updatedPayload)}`,
    );

    alert(
      `विवरण सफलतापूर्वक अद्यावधिक भयो! नयाँ कुल भाडा महशुल: रू ${computedSum}`,
    );
  },

  updateLedgerState: function (status) {
    const badge = $("#admin_badge, #tenant_status_badge");
    badge.removeClass("status-pending status-paid status-hold");
    badge.addClass(`status-${status.toLowerCase()}`).text(status);
    alert(`भाडा लेजर रेकर्ड स्थिति [${status}] मा अद्यावधिक भयो।`);
  },

  triggerLogout: function () {
    window.location.href = "index.html";
  },
};

$(document).ready(function () {
  // 1. Check if we are inside the active property ledger workspace view
  if (window.location.pathname.includes("rent-portal.html")) {
    PortalDashboard.init();
  } else {
    // 2. FALLBACK SAFE RUNTIME: Execute landing page initialization immediately 
    // if loadConfig hasn't initialized it, clearing the loading animation.
    if (typeof IndexObj !== "undefined") {
      IndexObj.init();
    }
  }
});

// Keep this wrapper intact in case your networking hardware pushes JSON data streams
function loadConfig(data) {
  if (typeof IndexObj !== "undefined") {
    IndexObj.init(data);
  }
}