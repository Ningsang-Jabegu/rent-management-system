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
    const passwordPlain = $("#account_password").val();

    // युजरनेम र पासवर्ड खाली भए नभएको जाँच गर्ने
    if (!username || !passwordPlain) {
      $("#login_msg").text("कृपया प्रयोगकर्ता नाम र पासवर्ड प्रविष्ट गर्नुहोस्।");
      return;
    }

    // लगइन बटनलाई डिसेबल गर्ने र एनिमेसन देखाउने
    $("#login_btn").prop("disabled", true).find(".btn-text").text("प्रमाणिकरण हुँदैछ...");

    // Vercel Serverless API सँग सञ्चार गर्ने
    $.ajax({
      url: "/api/login",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        username: username,
        password: passwordPlain
      }),
      success: function (response) {
        if (response.success) {
          // सफलता: प्राप्त रोलको आधारमा ड्यासबोर्डमा पठाउने
          window.location.href = `rent-portal.html?role=${response.role}`;
        }
      },
      error: function (xhr) {
        // विफलता: सर्भरले पठाएको त्रुटि सन्देश स्क्रिनमा देखाउने
        const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : "API सँग जडान हुन सकेन।";
        $("#login_msg").text(errorMsg);
        
        // बटनलाई पुनः सक्रिय बनाउने
        $("#login_btn").prop("disabled", false).find(".btn-text").text("लगइन गर्नुहोस्");
      }
    });
  },
};

const PortalDashboard = {
  analyticsChartInstance: null,
  currentRole: null, 

  init: function () {
    const self = this;

    setTimeout(function () {
      $("#body_loading").addClass("hide");
    }, 600);

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    const params = new URLSearchParams(window.location.search);
    this.currentRole = params.get("role");

    this.renderRoleWorkspace(this.currentRole);
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

    $(".nav-item, .mobile-nav-link").on("click", function (e) {
      e.preventDefault();

      $(".nav-item").removeClass("active");
      $(this).addClass("active");

      let targetWorkspace = $(this).attr("data-target");

      if (targetWorkspace === "overview_workspace") {
        targetWorkspace =
          self.currentRole === "owner" ? "owner_workspace" : "rentee_workspace";
      }

      $(
        "#owner_workspace, #rentee_workspace, #tenants_workspace, #payments_workspace, #lease_workspace",
      ).addClass("hide");

      $("#" + targetWorkspace).removeClass("hide");

      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }

      if ($(window).width() <= 1024) {
        $(".app-sidebar").css("transform", "translateX(-100%)");
      }
    });

    $(".mobile-top-bar button").on("click", function () {
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

    if (this.analyticsChartInstance) {
      this.analyticsChartInstance.destroy();
    }

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
    const ratePerUnit = 12; 
    const computedSum = baseRent + units * ratePerUnit;

    $("#tenant_due_display").text(`रू ${computedSum.toLocaleString()}.००`);
    $("#ledger_amount_label").text(`रू ${computedSum.toLocaleString()}`);
    $("#owner_collected_display").text(
      `रू ${(30000 + computedSum).toLocaleString()}.००`,
    );

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
  if (window.location.pathname.includes("rent-portal.html")) {
    PortalDashboard.init();
  } else {
    if (typeof IndexObj !== "undefined") {
      IndexObj.init();
    }
  }
});

function loadConfig(data) {
  if (typeof IndexObj !== "undefined") {
    IndexObj.init(data);
  }
}

function fetchTenantsData() {
  const REPO_OWNER = "Ningsang-Jabegu";
  const REPO_NAME = "jabegu-rent-portal-backup";
  const FILE_PATH = "data/users/tenants.json";
  const GITHUB_TOKEN = "YOUR_PERSONAL_ACCESS_TOKEN"; // तपाईँको सेक्रेट टोकन

  $.ajax({
    url: `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    type: "GET",
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json"
    },
    success: function(response) {
      // GitHub ले फाइलको कन्टेन्ट 'Base64' इन्कोडिङमा फर्काउँछ
      const decodedData = atob(response.content);
      const tenantsList = JSON.parse(decodedData);
      console.log("खोजिएको डेरावाला डेटा:", tenantsList);
      
      // यहाँ तपाईँले युजरनेम र पासवर्ड म्याच गराउने लोजिक राख्न सक्नुहुन्छ
    },
    error: function(err) {
      console.error("फाइल खोज्दा वा लोड गर्दा त्रुटि भयो:", err);
    }
  });
}


function triggerCloudBackup(path, data, message) {
  $.ajax({
    url: "/api/backup", // Vercel को सर्भरलेस एन्डपोइन्ट
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      filePath: path,
      jsonData: data,
      commitMessage: message
    }),
    success: function (response) {
      console.log("ब्याकअप स्थिति:", response.message);
    },
    error: function (xhr, status, error) {
      console.error("सुरक्षित ब्याकअप असफल भयो:", xhr.responseJSON ? xhr.responseJSON.error : error);
    }
  });
}
