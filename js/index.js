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
      $("#login_msg").text(
        "कृपया प्रयोगकर्ता नाम र पासवर्ड प्रविष्ट गर्नुहोस्।",
      );
      return;
    }

    $("#login_btn")
      .prop("disabled", true)
      .find(".btn-text")
      .text("प्रमाणिकरण हुँदैछ...");

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
        const errorMsg = xhr.responseJSON
          ? xhr.responseJSON.error
          : "API सँग जडान हुन सकेन।";
        $("#login_msg").text(errorMsg);
        $("#login_btn")
          .prop("disabled", false)
          .find(".btn-text")
          .text("लगइन गर्नुहोस्");
      },
    });
  },
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
    const self = this;

    // सबै रोल ब्लकहरू सुरुमा लुकाउने
    $(".nav-role-block").addClass("hide");

    // URL बाट 'user' (जस्तै: ?role=owner&user=admin) प्यारामिटर तान्ने
    const params = new URLSearchParams(window.location.search);
    const usernameParam = params.get("user")
      ? params.get("user").trim().toLowerCase()
      : "";

    // डेटा लोड हुँदै गर्दा देखिने अस्थायी सन्देश
    $("#dynamic_welcome_title").text("स्वागतम्, विवरण लोड हुँदैछ...");

    if (role === "owner") {
      $("#owner_workspace").removeClass("hide");
      $("#active_role_badge").text("घरधनी खाता (Owner)");
      $("#owner_only_nav_block").removeClass("hide");

      this.initIncomeAnalyticsChart();
    } else if (role === "rentee") {
      $("#rentee_workspace").removeClass("hide");
      $("#active_role_badge").text("डेरावाला खाता (Tenant)");
      $("#tenant_only_nav_block").removeClass("hide");
    } else {
      window.location.href = "index.html";
      return;
    }

    // Vercel Serverless API मार्फत प्राइभेट गिटहबको JSON बाट full_name मगाउने
    $.ajax({
      url: `/api/get-user-name?user=${encodeURIComponent(usernameParam)}&role=${role}`,
      type: "GET",
      dataType: "json",
      success: function (response) {
        if (response && response.name) {
          // गिटहबको 'full_name' सिधै यहाँ देखा पर्छ
          $("#dynamic_welcome_title").text(`स्वागतम्, ${response.name}`);
        } else {
          const defaultName =
            role === "owner" ? "घरधनी सदस्य" : "डेरावाला सदस्य";
          $("#dynamic_welcome_title").text(`स्वागतम्, ${defaultName}`);
        }
      },
      error: function () {
        // नेटवर्क वा API फेल हुँदाको ब्याकअप हार्डकोडेड नामहरू
        const fallbackName =
          role === "owner" ? "Devendra Kumar Jabegu" : "डेरावाला";
        $("#dynamic_welcome_title").text(`स्वागतम्, ${fallbackName}`);
      },
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  initNavigation: function () {
    const self = this;

    // मोबाइल मेनु आइकन कन्ट्रोल
    $("#mobile_menu_toggle").on("click", function (e) {
      e.stopPropagation();
      $(".app-sidebar").toggleClass("sidebar-open");
    });

    // ट्याब चेन्ज कन्ट्रोल
    $(".nav-item").on("click", function (e) {
      e.preventDefault();

      $(".nav-item").removeClass("active");
      $(this).addClass("active");

      let target = $(this).attr("data-target");

      // ओभरभ्यु थिच्दा रोल अनुसारको ओभरभ्यु विन्डो सेट गर्ने
      if (target === "overview_workspace") {
        target =
          self.currentRole === "owner" ? "owner_workspace" : "rentee_workspace";
      }

      // 🔥 सबै रोलका सम्पूर्ण विन्डोजहरू एकमुष्ट हाइड गर्ने फिक्स
      $(".workspace-section").addClass("hide");

      // एक्टिभ विन्डो शो गर्ने
      $("#" + target).removeClass("hide");
      $(".app-sidebar").removeClass("sidebar-open");

      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }
    });

    // बाहिर क्लिक गर्दा मोबाइल मेनु बन्द गर्ने
    $(document).on("click", function (e) {
      if (!$(e.target).closest(".app-sidebar, #mobile_menu_toggle").length) {
        $(".app-sidebar").removeClass("sidebar-open");
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
        datasets: [
          {
            label: "मासिक आम्दानी संकलन (रू)",
            data: [45000, 48500, 45000, 52000, 45540, 49000],
            backgroundColor: "rgba(201, 169, 110, 0.4)",
            borderColor: "#c9a96e",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  },

  calculateNewInvoice: function () {
    const units = parseInt($("#owner_units").val()) || 0;
    const baseRent = 15000;
    const ratePerUnit = 12;
    const totalBill = baseRent + units * ratePerUnit;

    // दुवै ड्यासबोर्डमा रकम परिवर्तन प्रतिबिम्बित गराउने
    $("#ledger_amount_label").text(`रू ${totalBill.toLocaleString()}`);
    $("#tenant_due_display").text(`रू ${totalBill.toLocaleString()}.००`);
    $("#owner_collected_display").text(
      `रू ${(30000 + totalBill).toLocaleString()}.००`,
    );

    // नयाँ क्युआर कोड जेनेरेट गर्ने
    const updatedQRData = `00020101021230300010NEPALPAY0115984100000052040000530352454${totalBill.toFixed(2).length}${totalBill.toFixed(2)}5802NP5915LaxmiP_Jabegu6008BHAKTAPUR62110107INV10246304`;
    $("#tenant_qr").attr(
      "src",
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(updatedQRData)}`,
    );

    alert(`सफलतापूर्वक बिल गणना गरियो! नयाँ रकम: रू ${totalBill}`);
  },

  updateLedgerState: function (state) {
    $("#admin_badge, #tenant_status_badge")
      .text(state)
      .attr("class", `badge status-${state.toLowerCase()}`);
    alert(`भाडा लेजर स्थिति अपडेट भयो: ${state}`);
  },

  triggerLogout: function () {
    window.location.href = "index.html";
  },
};
