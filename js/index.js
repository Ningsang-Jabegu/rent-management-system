// js/index.js

$(document).ready(function () {
  // यदि हामी लगइन पेज (index.html) मा छौँ भने लगइन फर्म एक्टिभ गराउने
  if ($("#login_form").length > 0) {
    LoginSystem.init();
  }
  
  // यदि हामी ड्यासबोर्ड पेज (rent-portal.html) मा छौँ भने ड्यासबोर्ड एक्टिभ गराउने
  if ($(".app-dashboard-container").length > 0) {
    PortalDashboard.init();
  }
});

// ==========================================
// १. लगइन प्रणाली (Login Panel Logic)
// ==========================================
const LoginSystem = {
  init: function () {
    const self = this;
    setTimeout(function () {
      $("#body_loading").addClass("hide");
    }, 600);

    // युजरनेममा 'Enter' थिच्दा फोकस पासवर्डमा लैजाने
    $("#account_input").on("keypress", function (e) {
      if (e.which === 13) {
        e.preventDefault();
        $("#account_password").focus();
      }
    });

    // फर्म सबमिट व्यवस्थापन
    $("#login_form").on("submit", function (e) {
      e.preventDefault();
      self.authenticateUser();
    });
  },

  authenticateUser: function () {
    $("#login_msg").text("");
    const username = $("#account_input").val().trim().toLowerCase();
    const passwordPlain = $("#account_password").val();

    if (!username || !passwordPlain) {
      $("#login_msg").text("कृपया प्रयोगकर्ता नाम र पासवर्ड प्रविष्ट गर्नुहोस्।");
      return;
    }

    $("#login_btn").prop("disabled", true).find(".btn-text").text("प्रमाणिकरण हुँदैछ...");

    $.ajax({
      url: "/api/login",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ username: username, password: passwordPlain }),
      success: function (response) {
        if (response.success) {
          window.location.href = `rent-portal.html?role=${response.role}`;
        }
      },
      error: function (xhr) {
        const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : "API सँग जडान हुन सकेन।";
        $("#login_msg").text(errorMsg);
        $("#login_btn").prop("disabled", false).find(".btn-text").text("लगइन गर्नुहोस्");
      }
    });
  }
};

// ==========================================
// २. मुख्य ड्यासबोर्ड प्रणाली (Portal Dashboard Logic)
// ==========================================
const PortalDashboard = {
  analyticsChartInstance: null,
  currentRole: null,

  init: function () {
    setTimeout(function () {
      $("#body_loading").addClass("hide");
    }, 600);

    // URL बाट गुडिरहेको रोल (owner वा rentee) लिने
    const params = new URLSearchParams(window.location.search);
    this.currentRole = params.get("role");

    // ड्यासबोर्डमा रोल अनुसारको आवरण तयार गर्ने
    this.renderWorkspace(this.currentRole);
    
    // साइडबारका लिंकहरू क्लिक गर्दा सेक्सन टगल गराउने न्याभिगेसन सुचारु गर्ने
    this.initNavigation();
  },

  renderWorkspace: function (role) {
    if (role === "owner") {
      $("#owner_workspace").removeClass("hide");
      $("#active_role_badge").text("घरधनी खाता (Owner)");
      $("#dynamic_welcome_title").text("स्वागतम्, घरधनी बुबा (Devendra)");
      
      // घरधनीका लागि मात्र देखिने तत्वहरू सक्रिय गर्ने
      $(".owner-only-action").removeClass("hide");
      $(".tenant-only-action").addClass("hide");
      
      this.initIncomeAnalyticsChart();
    } else if (role === "rentee") {
      $("#rentee_workspace").removeClass("hide");
      $("#active_role_badge").text("डेरावाला खाता (Tenant)");
      $("#dynamic_welcome_title").text("स्वागतम्, नारायण श्रेष्ठ");
      
      // डेरावालाका लागि मात्र देखिने तत्वहरू सक्रिय गर्ने
      $(".tenant-only-action").removeClass("hide");
      $(".owner-only-action").addClass("hide");
    } else {
      // यदि रोल नमिलेमा सिधै लगइन विन्डोमा फिर्ता लैजाने
      window.location.href = "index.html";
    }
    
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  initNavigation: function () {
    const self = this;

    $(".nav-item").on("click", function (e) {
      e.preventDefault();

      // १. साइडबारको एक्टिभ क्लास व्यवस्थापन
      $(".nav-item").removeClass("active");
      $(this).addClass("active");

      // २. क्लिक गरिएको ट्याबको टार्गेट नाम लिने
      let target = $(this).attr("data-target");

      // ३. यदि 'Overview' थिचेको हो भने युजर रोल अनुसार सहि वर्कस्पेस छान्ने
      if (target === "overview_workspace") {
        target = (self.currentRole === "owner") ? "owner_workspace" : "rentee_workspace";
      }

      // 🔥 मुख्य फिक्स: पहिले .workspace-section क्लास भएका सबै डिभहरूलाई सुरक्षित रूपमा लुकाउने
      $(".workspace-section").addClass("hide");

      // ४. अब चाहिएको टार्गेट विन्डोलाई मात्र अन-हाइड (Show) गर्ने
      $("#" + target).removeClass("hide");

      // ५. आइकनहरू ताजा गराउने (Lucide Icons Render)
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    });
  },

  initIncomeAnalyticsChart: function () {
    const ctx = document.getElementById("incomeAnalyticsChart");
    if (!ctx) return;

    if (this.analyticsChartInstance) this.analyticsChartInstance.destroy();

    this.analyticsChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज"],
        datasets: [{
          label: "मासिक आम्दानी संकलन (रू)",
          data: [45000, 48500, 45000, 52000, 45540, 49000],
          backgroundColor: "rgba(201, 169, 110, 0.4)",
          borderColor: "#c9a96e",
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  },

  calculateNewInvoice: function () {
    const units = parseInt($("#owner_units").val()) || 0;
    const baseRent = 15000;
    const ratePerUnit = 12;
    const totalBill = baseRent + (units * ratePerUnit);

    // दुवै ड्यासबोर्डमा रकम परिवर्तन प्रतिबिम्बित गराउने
    $("#ledger_amount_label").text(`रू ${totalBill.toLocaleString()}`);
    $("#tenant_due_display").text(`रू ${totalBill.toLocaleString()}.००`);
    $("#owner_collected_display").text(`रू ${(30000 + totalBill).toLocaleString()}.००`);

    // नयाँ क्युआर कोड जेनेरेट गर्ने
    const updatedQRData = `00020101021230300010NEPALPAY0115984100000052040000530352454${totalBill.toFixed(2).length}${totalBill.toFixed(2)}5802NP5915LaxmiP_Jabegu6008BHAKTAPUR62110107INV10246304`;
    $("#tenant_qr").attr("src", `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(updatedQRData)}`);

    alert(`सफलतापूर्वक बिल गणना गरियो! नयाँ रकम: रू ${totalBill}`);
  },

  updateLedgerState: function (state) {
    $("#admin_badge, #tenant_status_badge").text(state).attr("class", `badge status-${state.toLowerCase()}`);
    alert(`भाडा लेजर स्थिति अपडेट भयो: ${state}`);
  },

  triggerLogout: function () {
    window.location.href = "index.html";
  }
};