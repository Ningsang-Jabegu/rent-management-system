const I18nObj = {
  labelObj: {
    en_US: "English",
    es_ES: "Español",
    fr_FR: "Français",
    th_TH: "ไทย",
    tr_TR: "Türkçe",
    vi_VN: "Tiếng Việt",
    zh_CN: "简体中文",
    ne_NP: "नेपाली",
    dz_BT: "བོད་སྐད",
    hi_IN: "हिन्दी",
    ko_KR: "한국어",
  },

  currentLang: "en_US",

  init: function (data) {
    const self = this;
    // Merge configured languages with those available in LandObj so the menu shows all options
    const configuredLangs = data?.custom_html?.lang || [];
    const allLangKeys = Object.keys(LandObj || {});
    const langs = Array.from(new Set([...(configuredLangs || []), ...allLangKeys]));

    // Ensure currentLang is among available languages
    if (!langs.includes(this.currentLang)) {
      this.currentLang = langs[0] || this.currentLang;
    }

    this.activedObj = LandObj[this.currentLang] || {};
    this.renderLangMenu(langs);
    this.initEvent();
  },

  renderLangMenu(langs) {
    // Remove existing dropdown to avoid duplicates
    $("#language_select").remove();

    const menuItems = [];
    langs.forEach((lang) => {
      const label = I18nObj.labelObj[lang] || lang;
      menuItems.push(`
          <a href="javascript:void(0)" onclick="I18nObj.changeLang('${lang}')" data-lang="${lang}">
            ${label}
          </a>
        `);
    });

    const activeLabel = I18nObj.labelObj[this.currentLang] || this.currentLang;

    // Append dropdown inside the login panel so it stays within the sign-in box
    $(".login-wrapper").append(`
         <div class="dropdown language-select" id="language_select">
          <span class="dropdown-label">${activeLabel}</span>
          <span class="dropdown-arrow">▼</span>

          <span class="dropdown-menu">
            ${menuItems.join("")}
          </span>
        </div>  
      `);
  },

  initEvent() {
    const self = this;
    $("#body_content").on("click", "#language_select", function (event) {
      $(this).toggleClass("actived");
    });
    // Close dropdown when clicking outside
    $(document).on('click', function(e){
      const $target = $(e.target);
      if (!$target.closest('#language_select').length) {
        $('#language_select').removeClass('actived');
      }
    });
  },

  $t: function (key) {
    if (this.activedObj[key]) {
      return this.activedObj[key];
    } else {
      return key;
    }
  },

  changeLang(lang) {
    $("#login_msg").text(""); // Clear error message
    // Update only the dropdown label inside the language control
    $("#language_select .dropdown-label").text(I18nObj.labelObj[lang] || lang);

    this.currentLang = lang;
    this.activedObj = LandObj[lang] || {};
    this.renderHtmlLang();

    // Close menu and mark selected item
    $('#language_select').removeClass('actived');
    $('#language_select .dropdown-menu a').removeClass('selected');
    $(`#language_select .dropdown-menu a[data-lang="${lang}"]`).addClass('selected');
  },

  renderHtmlLang() {
    // For text content
    $("[data-i18n]").each(function () {
      var key = $(this).data("i18n");
      var translation = I18nObj.$t(key);
      $(this).text(translation);
    });

    $("[data-i18n-placeholder]").each(function () {
      var key = $(this).data("i18n-placeholder");
      var translation = I18nObj.$t(key);
      $(this).prop("placeholder", translation);
    });
  },
};
