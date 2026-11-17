/* =========================================================
   CBNU FS — 임원 관리(관리자) 패널
   · 이메일 + 비밀번호 로그인, 매직링크, 비밀번호 설정
   · admin_emails 에 등록된 이메일만 사용 가능
   · site_data(기본정보·임원·선수단·회계·공지·일정·FAQ) 수정
   · 접수된 지원서·건의사항 확인 및 상태 변경
   ========================================================= */

(function () {
  "use strict";

  var APP = window.CBNU_APP;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (err) { return {}; }
  }

  var DEFAULT_SETTINGS = {
    site: { name: "CBNU FS", fullName: "충북대학교 풋살동아리 CBNU FS", school: "충북대학교", est: "2016", tagline: "", description: "" },
    hero: { motto: "", sub: "", stats: [] },
    mottoBand: "",
    training: [],
    apply: { eligibility: [], timeline: [], fees: [] },
    contact: { instagram: { label: "", url: "" }, openchat: { label: "", url: "" }, email: "", place: "" },
    links: { googleForm: "", openchat: "", instagram: "" }
  };

  var STATUS_APPLICATION = ["접수", "검토중", "면접", "합격", "불합격"];
  var STATUS_SUGGESTION = ["접수", "검토중", "반영", "보류", "반려"];
  var TAGS = ["모집", "공지", "일정"];
  var POSITIONS = ["GK", "FIXO", "ALA", "PIVO"];
  var ICONS = ["icon-ball", "icon-pin", "icon-shield", "icon-run", "icon-heart"];

  var state = {
    session: null,
    admin: false,
    checking: false,
    tab: "basic",
    applications: [],
    suggestions: [],
    admins: [],
    needPassword: false,
    message: null
  };

  var panel = null;
  var body = null;
  var tabsEl = null;
  var headActions = null;

  /* ---------------- 공통 DOM ---------------- */
  function makeField(spec, value) {
    var wrap = el("label", "adm-field" + (spec.wide ? " is-wide" : ""));
    if (spec.label) { wrap.appendChild(el("span", "adm-label", spec.label)); }

    var input;
    if (spec.type === "textarea") {
      input = el("textarea", "adm-input");
      input.rows = spec.rows || 3;
      input.value = value === null || value === undefined ? "" : String(value);
    } else if (spec.type === "select") {
      input = el("select", "adm-input");
      (spec.options || []).forEach(function (opt) {
        var option = el("option", null, opt.label !== undefined ? opt.label : opt);
        option.value = opt.value !== undefined ? opt.value : opt;
        input.appendChild(option);
      });
      input.value = value === null || value === undefined ? "" : String(value);
    } else {
      input = el("input", "adm-input");
      input.type = spec.type || "text";
      if (spec.step) { input.step = spec.step; }
      if (spec.min !== undefined) { input.min = spec.min; }
      if (spec.type === "number") {
        input.value = value === null || value === undefined || value === "" ? "" : String(value);
      } else {
        input.value = value === null || value === undefined ? "" : String(value);
      }
    }

    if (spec.placeholder) { input.placeholder = spec.placeholder; }
    if (spec.key) { input.setAttribute("data-field", spec.key); }
    wrap.appendChild(input);
    return wrap;
  }

  function fieldRow(specs, source) {
    var row = el("div", "adm-fields");
    specs.forEach(function (spec) {
      row.appendChild(makeField(spec, source ? source[spec.key] : ""));
    });
    return row;
  }

  function collect(container, specs) {
    return $$("[data-row]", container).map(function (row) {
      var out = {};
      specs.forEach(function (spec) {
        var input = row.querySelector('[data-field="' + spec.key + '"]');
        var raw = input ? String(input.value).trim() : "";
        if (spec.type === "number") {
          out[spec.key] = raw === "" ? 0 : Number(raw.replace(/[^0-9.-]/g, ""));
        } else {
          out[spec.key] = raw;
        }
      });
      return out;
    });
  }

  function hasContent(item) {
    return Object.keys(item).some(function (key) {
      var v = item[key];
      return v !== "" && v !== null && v !== undefined && v !== 0;
    });
  }

  function card(title, desc) {
    var box = el("section", "adm-card");
    if (title) {
      var head = el("div", "adm-card-head");
      head.appendChild(el("h3", null, title));
      if (desc) { head.appendChild(el("p", null, desc)); }
      box.appendChild(head);
    }
    return box;
  }

  function button(label, variant, onClick) {
    var btn = el("button", "adm-btn" + (variant ? " adm-btn-" + variant : ""), label);
    btn.type = "button";
    if (onClick) { btn.addEventListener("click", onClick); }
    return btn;
  }

  function note(text) {
    return el("p", "adm-note", text);
  }

  function weekday(iso) {
    var names = ["일", "월", "화", "수", "목", "금", "토"];
    var d = new Date(String(iso) + "T00:00:00");
    return isNaN(d.getTime()) ? "" : names[d.getDay()];
  }

  function client() {
    return APP && typeof APP.client === "function" ? APP.client() : null;
  }

  function toast(message) {
    if (APP && typeof APP.toast === "function") { APP.toast(message); }
  }

  /* ---------------- 패널 열기/닫기 ---------------- */
  function init() {
    panel = $("#adminPanel");
    if (!panel) { return; }
    body = $("#adminBody");
    tabsEl = $("#adminTabs");
    headActions = $("#adminHeadActions");

    var openers = $$("[data-admin-open]");
    openers.forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        openPanel();
      });
    });

    var closeBtn = $("#adminClose");
    if (closeBtn) { closeBtn.addEventListener("click", closePanel); }

    panel.addEventListener("click", function (event) {
      if (event.target === panel) { closePanel(); }
    });

    document.addEventListener("keydown", function (event) {
      if ((event.key === "Escape" || event.key === "Esc") && !panel.hidden) {
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { return; }
        closePanel();
      }
    });

    var c = client();
    if (c) {
      c.auth.onAuthStateChange(function (event, session) {
        var nextSession = session || null;
        // 인증 콜백 안에서 곧바로 다른 요청을 보내면 잠금이 걸릴 수 있어 다음 틱으로 넘긴다.
        window.setTimeout(function () {
          state.session = nextSession;
          if (event === "SIGNED_OUT") {
            state.admin = false;
            if (!panel.hidden) { renderViews(); }
            return;
          }
          if (event === "PASSWORD_RECOVERY") {
            state.needPassword = true;
            openPanel();
            return;
          }
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
            checkAdmin().then(function () {
              if (!panel.hidden) { renderViews(); }
            });
          }
        }, 0);
      });
    }

    // 초대/재설정 링크로 들어온 경우 비밀번호 설정 화면을 연다
    var hash = String((APP && APP.initialHash) || window.location.hash || "");
    if (/type=(recovery|invite)/.test(hash) || /access_token=/.test(hash)) {
      state.needPassword = true;
      window.setTimeout(openPanel, 600);
    }

    refreshSession();
  }

  function openPanel() {
    if (!panel) { return; }
    panel.hidden = false;
    document.body.classList.add("admin-open");
    document.body.style.overflow = "hidden";
    renderViews();
    refreshSession();
    var close = $("#adminClose");
    if (close) { close.focus(); }
  }

  function closePanel() {
    if (!panel) { return; }
    panel.hidden = true;
    document.body.classList.remove("admin-open");
    document.body.style.overflow = "";
  }

  function refreshSession() {
    var c = client();
    if (!c) {
      state.session = null;
      state.admin = false;
      state.checking = false;
      if (!panel || panel.hidden) { return; }
      renderViews();
      return;
    }
    state.checking = true;
    renderHead();
    c.auth.getSession().then(function (res) {
      state.session = res && res.data ? res.data.session : null;
      return checkAdmin();
    }).then(function () {
      state.checking = false;
      renderViews();
    }).catch(function () {
      state.checking = false;
      renderViews();
    });
  }

  function checkAdmin() {
    var c = client();
    state.session = state.session || null;
    if (!c || !state.session || !state.session.user) {
      state.admin = false;
      return Promise.resolve(false);
    }
    return c.from("admin_emails").select("email").limit(1).then(function (res) {
      state.admin = !(res && res.error) && Array.isArray(res && res.data) && res.data.length > 0;
      return state.admin;
    }).catch(function () {
      state.admin = false;
      return false;
    });
  }

  /* ---------------- 화면 ---------------- */
  function renderHead() {
    if (!headActions) { return; }
    headActions.innerHTML = "";

    if (!client()) {
      headActions.appendChild(el("span", "adm-badge adm-badge-warn", "Supabase 미설정"));
      return;
    }

    if (state.session && state.session.user) {
      headActions.appendChild(el("span", "adm-badge", state.session.user.email || ""));
      if (state.admin) {
        headActions.appendChild(button("비밀번호 설정", "outline", function () {
          state.needPassword = true;
          renderViews();
        }));
        headActions.appendChild(button("로그아웃", "ghost", function () {
          var c = client();
          if (!c) { return; }
          c.auth.signOut().then(function () {
            state.admin = false;
            state.session = null;
            toast("로그아웃했습니다.");
            renderViews();
          });
        }));
      }
    }
  }

  function renderTabs() {
    if (!tabsEl) { return; }
    tabsEl.innerHTML = "";
    var showTabs = state.session && state.admin && !state.needPassword;
    tabsEl.hidden = !showTabs;
    if (!showTabs) { return; }

    var tabs = [
      { id: "basic", label: "기본정보" },
      { id: "training", label: "훈련·회비" },
      { id: "staff", label: "임원진" },
      { id: "squad", label: "선수단" },
      { id: "finance", label: "회계" },
      { id: "notices", label: "공지" },
      { id: "schedule", label: "일정" },
      { id: "faq", label: "FAQ" },
      { id: "applications", label: "지원서" },
      { id: "suggestions", label: "건의사항" },
      { id: "admins", label: "관리자" }
    ];

    tabs.forEach(function (tab) {
      var btn = el("button", "adm-tab" + (state.tab === tab.id ? " is-active" : ""), tab.label);
      btn.type = "button";
      btn.addEventListener("click", function () {
        state.tab = tab.id;
        renderTabs();
        renderBody();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderViews() {
    renderHead();
    renderTabs();
    renderBody();
  }

  function messageBox(text, variant) {
    var box = el("p", "adm-message" + (variant ? " is-" + variant : ""), text);
    return box;
  }

  function renderBody() {
    if (!body) { return; }
    body.innerHTML = "";
    body.scrollTop = 0;

    if (!client()) {
      var box = card("Supabase 연결이 필요합니다");
      box.appendChild(note("supabase-config.js 에 프로젝트 URL과 anon key가 설정되어야 관리자 기능이 동작합니다."));
      body.appendChild(box);
      return;
    }

    if (state.needPassword) { renderPasswordView(); return; }
    if (!state.session || !state.session.user) { renderLoginView(); return; }
    if (!state.admin) { renderNoAccessView(); return; }

    switch (state.tab) {
      case "basic": renderBasic(); break;
      case "training": renderTraining(); break;
      case "staff": renderStaffTab(); break;
      case "squad": renderSquadTab(); break;
      case "finance": renderFinanceTab(); break;
      case "notices": renderNoticesTab(); break;
      case "schedule": renderScheduleTab(); break;
      case "faq": renderFaqTab(); break;
      case "applications": fetchApplications(); break;
      case "suggestions": fetchSuggestions(); break;
      case "admins": fetchAdmins(); break;
      default: renderBasic();
    }
  }

  /* ---------------- 로그인 ---------------- */
  function renderLoginView() {
    var box = card("임원 로그인", "동아리 임원 계정으로 로그인하면 사이트 내용을 직접 수정할 수 있습니다.");
    var form = el("form", "adm-form");
    form.appendChild(makeField({ key: "email", label: "이메일", type: "email", placeholder: "name@example.com" }, ""));
    form.appendChild(makeField({ key: "password", label: "비밀번호", type: "password", placeholder: "비밀번호" }, ""));

    var actions = el("div", "adm-form-actions");
    var loginBtn = button("로그인", "primary", null);
    loginBtn.setAttribute("type", "submit");
    actions.appendChild(loginBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = String(form.querySelector('[data-field="email"]').value).trim();
      var password = String(form.querySelector('[data-field="password"]').value);
      if (!email) { toast("이메일을 입력해 주세요."); return; }
      if (!password) { toast("비밀번호를 입력해 주세요."); return; }
      loginBtn.disabled = true;
      client().auth.signInWithPassword({ email: email, password: password }).then(function (res) {
        loginBtn.disabled = false;
        if (res && res.error) {
          toast("로그인하지 못했습니다: " + res.error.message);
          return;
        }
        state.session = res.data.session;
        return checkAdmin().then(renderViews);
      }).catch(function (err) {
        loginBtn.disabled = false;
        toast("로그인하지 못했습니다: " + (err && err.message ? err.message : "알 수 없는 오류"));
      });
    });

    box.appendChild(form);
    box.appendChild(note("처음 로그인하는 경우: 관리자가 보낸 초대 메일의 링크를 누르면 비밀번호를 설정할 수 있습니다. 비밀번호가 없다면 아래 '로그인 링크 메일 받기'로 들어온 뒤 비밀번호를 설정하세요."));

    var alt = el("div", "adm-form-actions");
    var emailInput = form.querySelector('[data-field="email"]');

    alt.appendChild(button("로그인 링크 메일 받기", "outline", function () {
      var email = String(emailInput.value).trim();
      if (!email) { toast("이메일을 먼저 입력해 주세요."); return; }
      client().auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      }).then(function (res) {
        if (res && res.error) { toast("메일을 보내지 못했습니다: " + res.error.message); return; }
        toast("로그인 링크를 메일로 보냈습니다. 메일함을 확인해 주세요.");
      }).catch(function () { toast("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."); });
    }));

    alt.appendChild(button("비밀번호 재설정 메일", "outline", function () {
      var email = String(emailInput.value).trim();
      if (!email) { toast("이메일을 먼저 입력해 주세요."); return; }
      client().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      }).then(function (res) {
        if (res && res.error) { toast("메일을 보내지 못했습니다: " + res.error.message); return; }
        toast("비밀번호 재설정 링크를 메일로 보냈습니다.");
      }).catch(function () { toast("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."); });
    }));

    box.appendChild(alt);
    body.appendChild(box);
  }

  function renderPasswordView() {
    var box = card("비밀번호 설정", "지금 새 비밀번호를 정하면 다음부터는 이메일과 비밀번호로 바로 로그인할 수 있습니다.");
    var form = el("form", "adm-form");
    form.appendChild(makeField({ key: "password", label: "새 비밀번호 (8자 이상)", type: "password", placeholder: "" }, ""));
    form.appendChild(makeField({ key: "password2", label: "새 비밀번호 확인", type: "password", placeholder: "" }, ""));
    var actions = el("div", "adm-form-actions");
    var saveBtn = button("비밀번호 저장", "primary", null);
    saveBtn.setAttribute("type", "submit");
    actions.appendChild(saveBtn);
    actions.appendChild(button("나중에", "ghost", function () {
      state.needPassword = false;
      renderViews();
    }));
    form.appendChild(actions);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var pw = String(form.querySelector('[data-field="password"]').value);
      var pw2 = String(form.querySelector('[data-field="password2"]').value);
      if (pw.length < 8) { toast("비밀번호는 8자 이상으로 정해 주세요."); return; }
      if (pw !== pw2) { toast("비밀번호가 서로 다릅니다."); return; }
      saveBtn.disabled = true;
      client().auth.updateUser({ password: pw }).then(function (res) {
        saveBtn.disabled = false;
        if (res && res.error) { toast("저장하지 못했습니다: " + res.error.message); return; }
        state.needPassword = false;
        toast("비밀번호를 저장했습니다. 이제 이메일과 비밀번호로 로그인할 수 있습니다.");
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        return checkAdmin().then(renderViews);
      }).catch(function () {
        saveBtn.disabled = false;
        toast("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });
    });

    box.appendChild(form);
    body.appendChild(box);
  }

  function renderNoAccessView() {
    var box = card("관리자 권한이 없습니다");
    box.appendChild(note((state.session && state.session.user ? state.session.user.email : "이 계정") + " 은(는) 관리자 목록(admin_emails)에 없습니다. 동아리 관리자에게 이메일 추가를 요청하세요."));
    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("로그아웃", "outline", function () {
      client().auth.signOut().then(function () {
        state.session = null;
        state.admin = false;
        renderViews();
      });
    }));
    box.appendChild(actions);
    body.appendChild(box);
  }

  /* ---------------- 저장 ---------------- */
  function settings() {
    var base = clone(DEFAULT_SETTINGS);
    var current = (APP && typeof APP.settings === "function") ? APP.settings() : {};
    var merged = Object.assign(base, clone(current));
    merged.site = Object.assign(clone(DEFAULT_SETTINGS.site), current.site || {});
    merged.hero = Object.assign(clone(DEFAULT_SETTINGS.hero), current.hero || {});
    merged.apply = Object.assign(clone(DEFAULT_SETTINGS.apply), current.apply || {});
    merged.contact = Object.assign(clone(DEFAULT_SETTINGS.contact), current.contact || {});
    merged.contact.instagram = Object.assign({ label: "", url: "" }, (current.contact || {}).instagram || {});
    merged.contact.openchat = Object.assign({ label: "", url: "" }, (current.contact || {}).openchat || {});
    merged.links = Object.assign(clone(DEFAULT_SETTINGS.links), current.links || {});
    if (!Array.isArray(merged.training)) { merged.training = []; }
    return merged;
  }

  function saveKey(key, value, done) {
    var c = client();
    if (!c) { toast("Supabase 연결이 없습니다."); return; }
    c.from("site_data").upsert(
      { key: key, value: value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    ).then(function (res) {
      if (res && res.error) {
        toast("저장하지 못했습니다: " + res.error.message);
        return;
      }
      APP.applyRows([{ key: key, value: value }]);
      APP.render();
      toast("저장했습니다. 사이트에 바로 반영됩니다.");
      if (typeof done === "function") { done(); }
      renderBody();
    }).catch(function (err) {
      toast("저장하지 못했습니다: " + (err && err.message ? err.message : "알 수 없는 오류"));
    });
  }

  function saveSettings(mutator) {
    var s = settings();
    mutator(s);
    saveKey("settings", s);
  }

  /* ---------------- 기본정보 ---------------- */
  function renderBasic() {
    var s = settings();
    var box = card("기본정보 · 모토 · 연락처", "저장하면 사이트 상단과 소개 영역, 문의 버튼에 바로 반영됩니다.");

    var grid = el("div", "adm-grid");
    [
      { key: "name", label: "사이트 이름", value: s.site.name },
      { key: "fullName", label: "정식 명칭", value: s.site.fullName },
      { key: "tagline", label: "한 줄 소개", value: s.site.tagline, wide: true },
      { key: "description", label: "소개 문단", value: s.site.description, type: "textarea", rows: 4, wide: true },
      { key: "motto", label: "히어로 모토 (줄바꿈은 <br>)", value: s.hero.motto, type: "textarea", rows: 2, wide: true },
      { key: "sub", label: "히어로 부제", value: s.hero.sub, type: "textarea", rows: 2, wide: true },
      { key: "mottoBand", label: "모토 띠 문구", value: s.mottoBand, type: "textarea", rows: 3, wide: true }
    ].forEach(function (f) {
      grid.appendChild(makeField(f, f.value));
    });
    box.appendChild(grid);

    var saveRow = el("div", "adm-form-actions");
    saveRow.appendChild(button("기본정보 저장", "primary", function () {
      var values = {};
      $$('[data-field]', grid).forEach(function (input) {
        values[input.getAttribute("data-field")] = String(input.value).trim();
      });
      saveSettings(function (st) {
        st.site = Object.assign({}, st.site, {
          name: values.name,
          fullName: values.fullName,
          tagline: values.tagline,
          description: values.description
        });
        st.hero = Object.assign({}, st.hero, { motto: values.motto, sub: values.sub });
        st.mottoBand = values.mottoBand;
      });
    }));
    box.appendChild(saveRow);
    body.appendChild(box);

    // 연락처
    var contactBox = card("연락처 · 링크", "비워 두면 해당 버튼은 '준비 중' 안내를 띄웁니다.");
    var cGrid = el("div", "adm-grid");
    var c = s.contact || {};
    var insta = c.instagram || {};
    var openchat = c.openchat || {};
    [
      { key: "place", label: "훈련 장소 표기", value: c.place },
      { key: "email", label: "이메일", value: c.email },
      { key: "instaLabel", label: "인스타그램 표기", value: insta.label },
      { key: "instaUrl", label: "인스타그램 주소", value: insta.url },
      { key: "chatLabel", label: "오픈채팅 표기", value: openchat.label },
      { key: "chatUrl", label: "오픈채팅 주소", value: openchat.url },
      { key: "formUrl", label: "구글 폼 주소", value: (s.links || {}).googleForm }
    ].forEach(function (f) {
      cGrid.appendChild(makeField(f, f.value));
    });
    contactBox.appendChild(cGrid);

    var cActions = el("div", "adm-form-actions");
    cActions.appendChild(button("연락처 저장", "primary", function () {
      var values = {};
      $$('[data-field]', cGrid).forEach(function (input) {
        values[input.getAttribute("data-field")] = String(input.value).trim();
      });
      saveSettings(function (st) {
        st.contact = Object.assign({}, st.contact, {
          place: values.place,
          email: values.email,
          instagram: { label: values.instaLabel, url: values.instaUrl },
          openchat: { label: values.chatLabel, url: values.chatUrl }
        });
        st.links = Object.assign({}, st.links, {
          instagram: values.instaUrl,
          openchat: values.chatUrl,
          googleForm: values.formUrl
        });
      });
    }));
    contactBox.appendChild(cActions);
    body.appendChild(contactBox);
  }

  /* ---------------- 훈련 · 회비 ---------------- */
  function renderTraining() {
    var s = settings();

    var box = card("훈련 안내 카드", "홈페이지 '동아리 소개' 영역의 3개 카드를 수정합니다.");
    var rows = el("div", "adm-rows");
    (s.training || []).forEach(function (item) {
      var row = el("div", "adm-row");
      row.setAttribute("data-row", "1");
      var fields = el("div", "adm-grid");
      fields.appendChild(makeField({ key: "title", label: "제목", placeholder: "정기 훈련" }, item.title));
      fields.appendChild(makeField({ key: "icon", label: "아이콘", type: "select", options: ICONS }, item.icon || "icon-ball"));
      fields.appendChild(makeField({ key: "line1", label: "첫 줄", wide: true }, (item.lines || [])[0] || ""));
      fields.appendChild(makeField({ key: "line2", label: "둘째 줄", wide: true }, (item.lines || [])[1] || ""));
      row.appendChild(fields);
      rows.appendChild(row);
    });
    box.appendChild(rows);
    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("훈련 안내 저장", "primary", function () {
      var items = collect(rows, [
        { key: "title" }, { key: "icon" }, { key: "line1" }, { key: "line2" }
      ]).map(function (r) {
        return { title: r.title, icon: r.icon, lines: [r.line1, r.line2].filter(function (v) { return v !== ""; }) };
      }).filter(function (r) { return r.title || r.lines.length; });
      saveSettings(function (st) { st.training = items; });
    }));
    box.appendChild(actions);
    body.appendChild(box);

    var applyBox = card("지원 안내 · 회비", "지원서 접수 영역의 안내 문구입니다. 줄 단위로 입력하세요.");
    var apply = s.apply || {};
    var aGrid = el("div", "adm-grid");
    aGrid.appendChild(makeField({ key: "eligibility", label: "지원 자격 (한 줄에 하나)", type: "textarea", rows: 5, wide: true }, (apply.eligibility || []).join("\n")));
    aGrid.appendChild(makeField({ key: "timeline", label: "모집 일정 (한 줄에 하나)", type: "textarea", rows: 5, wide: true }, (apply.timeline || []).join("\n")));
    applyBox.appendChild(aGrid);

    var feeRows = el("div", "adm-rows");
    (apply.fees || []).forEach(function (fee) {
      var row = el("div", "adm-row");
      row.setAttribute("data-row", "1");
      var fields = el("div", "adm-grid");
      fields.appendChild(makeField({ key: "label", label: "항목", placeholder: "월 회비" }, fee.label));
      fields.appendChild(makeField({ key: "value", label: "내용", wide: true }, fee.value));
      row.appendChild(fields);
      feeRows.appendChild(row);
    });
    applyBox.appendChild(feeRows);
    applyBox.appendChild(el("p", "adm-note", "회비 항목은 추가·삭제할 수 있습니다."));
    var feeActions = el("div", "adm-form-actions");
    feeActions.appendChild(button("항목 추가", "outline", function () {
      var row = el("div", "adm-row");
      row.setAttribute("data-row", "1");
      var fields = el("div", "adm-grid");
      fields.appendChild(makeField({ key: "label", label: "항목" }, ""));
      fields.appendChild(makeField({ key: "value", label: "내용", wide: true }, ""));
      row.appendChild(fields);
      feeRows.appendChild(row);
    }));
    feeActions.appendChild(button("지원 안내 저장", "primary", function () {
      var values = {};
      $$('[data-field]', aGrid).forEach(function (input) {
        values[input.getAttribute("data-field")] = String(input.value);
      });
      var fees = collect(feeRows, [{ key: "label" }, { key: "value" }]).filter(function (r) { return r.label || r.value; });
      saveSettings(function (st) {
        st.apply = Object.assign({}, st.apply, {
          eligibility: values.eligibility.split("\n").map(function (v) { return v.trim(); }).filter(Boolean),
          timeline: values.timeline.split("\n").map(function (v) { return v.trim(); }).filter(Boolean),
          fees: fees
        });
      });
    }));
    applyBox.appendChild(feeActions);
    body.appendChild(applyBox);
  }

  /* ---------------- 리스트 편집 공통 ---------------- */
  function listEditor(config) {
    var box = card(config.title, config.desc);
    var rows = el("div", "adm-rows");
    box.appendChild(rows);

    function addRow(item) {
      var row = el("div", "adm-row");
      row.setAttribute("data-row", "1");
      var head = el("div", "adm-row-head");
      head.appendChild(el("span", "adm-row-no", String($$(".adm-row", rows).length + 1)));
      head.appendChild(el("div", "adm-row-tools"));
      var tools = head.querySelector(".adm-row-tools");
      var del = button("삭제", "danger", function () {
        if (!window.confirm("이 항목을 목록에서 삭제할까요?")) { return; }
        row.parentNode.removeChild(row);
        renumber();
      });
      tools.appendChild(del);
      row.appendChild(head);
      row.appendChild(fieldRow(config.fields, item || {}));
      rows.appendChild(row);
      renumber();
    }

    function renumber() {
      $$(".adm-row", rows).forEach(function (row, i) {
        var no = row.querySelector(".adm-row-no");
        if (no) { no.textContent = String(i + 1); }
      });
    }

    (config.items || []).forEach(function (item) { addRow(item); });

    if (!(config.items || []).length) {
      box.appendChild(el("p", "adm-note", config.empty || "등록된 항목이 없습니다."));
    }

    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("항목 추가", "outline", function () { addRow({}); }));
    actions.appendChild(button("저장", "primary", function () {
      var values = collect(rows, config.fields).filter(hasContent);
      if (typeof config.normalize === "function") { values = config.normalize(values); }
      config.save(values);
    }));
    box.appendChild(actions);
    body.appendChild(box);
  }

  function renderStaffTab() {
    var data = APP.data();
    listEditor({
      title: "임원진",
      desc: "직책·이름·소속·담당을 수정하거나 추가·삭제할 수 있습니다.",
      items: data.staff || [],
      fields: [
        { key: "role", label: "직책", placeholder: "회장" },
        { key: "name", label: "이름" },
        { key: "dept", label: "학과·학년", placeholder: "경영학부 3학년" },
        { key: "duty", label: "담당", placeholder: "팀 운영 · 대외 협력" },
        { key: "intro", label: "소개", type: "textarea", rows: 2, wide: true }
      ],
      save: function (items) { saveKey("staff", items); }
    });
  }

  function renderSquadTab() {
    var data = APP.data();
    listEditor({
      title: "선수단",
      desc: "등번호·포지션·이름을 수정하거나 추가·삭제할 수 있습니다.",
      items: data.squad || [],
      fields: [
        { key: "no", label: "등번호", type: "number", min: 0 },
        { key: "pos", label: "포지션", type: "select", options: POSITIONS },
        { key: "name", label: "이름" },
        { key: "dept", label: "학과·학번", placeholder: "경영학부 24학번" },
        { key: "intro", label: "한 줄 소개", wide: true }
      ],
      normalize: function (items) {
        return items.map(function (p) { return p; }).sort(function (a, b) { return (Number(a.no) || 0) - (Number(b.no) || 0); });
      },
      save: function (items) { saveKey("squad", items); }
    });
  }

  function renderNoticesTab() {
    var data = APP.data();
    listEditor({
      title: "공지사항",
      desc: "최근 공지가 위에 오도록 날짜를 넣어 주세요.",
      items: data.notices || [],
      fields: [
        { key: "date", label: "날짜", type: "date" },
        { key: "tag", label: "분류", type: "select", options: TAGS },
        { key: "title", label: "제목", wide: true },
        { key: "body", label: "내용", type: "textarea", rows: 3, wide: true }
      ],
      normalize: function (items) {
        return items.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      },
      save: function (items) { saveKey("notices", items); }
    });
  }

  function renderScheduleTab() {
    var data = APP.data();
    listEditor({
      title: "다가오는 일정",
      desc: "요일은 날짜에서 자동으로 계산됩니다.",
      items: data.schedule || [],
      fields: [
        { key: "date", label: "날짜", type: "date" },
        { key: "title", label: "일정 이름" },
        { key: "time", label: "시간", placeholder: "20:00" },
        { key: "place", label: "장소", wide: true }
      ],
      normalize: function (items) {
        return items.map(function (item) {
          item.day = weekday(item.date);
          return item;
        }).sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
      },
      save: function (items) { saveKey("schedules", items); }
    });
  }

  function renderFaqTab() {
    var data = APP.data();
    listEditor({
      title: "자주 묻는 질문",
      desc: "질문과 답변을 추가·수정·삭제할 수 있습니다.",
      items: data.faq || [],
      fields: [
        { key: "q", label: "질문", wide: true },
        { key: "a", label: "답변", type: "textarea", rows: 3, wide: true }
      ],
      save: function (items) { saveKey("faqs", items); }
    });
  }

  /* ---------------- 회계 ---------------- */
  function renderFinanceTab() {
    var data = APP.data();
    var finance = data.finance || {};

    var box = card("이월금", "이월금과 거래 내역으로 잔액이 자동 계산됩니다.");
    var grid = el("div", "adm-grid");
    grid.appendChild(makeField({ key: "openingBalance", label: "이월금 (원)", type: "number", min: 0 }, finance.openingBalance || 0));
    grid.appendChild(makeField({ key: "openingDate", label: "이월 기준일", type: "date" }, finance.openingDate || ""));
    box.appendChild(grid);

    var txTitle = el("h4", "adm-sub-title", "거래 내역");
    box.appendChild(txTitle);

    var rows = el("div", "adm-rows");
    box.appendChild(rows);

    var txFields = [
      { key: "date", label: "날짜", type: "date" },
      { key: "type", label: "구분", type: "select", options: [{ value: "income", label: "수입" }, { value: "expense", label: "지출" }] },
      { key: "category", label: "분류", placeholder: "회비" },
      { key: "desc", label: "내역" },
      { key: "amount", label: "금액 (원)", type: "number", min: 0 },
      { key: "note", label: "비고" }
    ];

    function addTx(tx) {
      var row = el("div", "adm-row");
      row.setAttribute("data-row", "1");
      var head = el("div", "adm-row-head");
      head.appendChild(el("span", "adm-row-no", String($$(".adm-row", rows).length + 1)));
      var tools = el("div", "adm-row-tools");
      tools.appendChild(button("삭제", "danger", function () {
        if (!window.confirm("이 내역을 삭제할까요?")) { return; }
        rows.removeChild(row);
      }));
      head.appendChild(tools);
      row.appendChild(head);
      row.appendChild(fieldRow(txFields, tx || {}));
      rows.appendChild(row);
    }

    (finance.transactions || []).forEach(addTx);

    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("내역 추가", "outline", function () {
      addTx({ date: new Date().toISOString().slice(0, 10), type: "expense" });
    }));
    actions.appendChild(button("회계 저장", "primary", function () {
      var opening = Number(String($('[data-field="openingBalance"]', grid).value).replace(/[^0-9.-]/g, "")) || 0;
      var openingDate = String($('[data-field="openingDate"]', grid).value);
      var txs = collect(rows, txFields).filter(function (t) { return t.desc || t.amount; });
      txs.sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
      saveKey("finance", {
        openingBalance: opening,
        openingDate: openingDate,
        transactions: txs
      });
    }));
    box.appendChild(actions);
    body.appendChild(box);
  }

  /* ---------------- 지원서 / 건의사항 ---------------- */
  function fetchApplications() {
    var c = client();
    if (!c) { return; }
    body.innerHTML = "";
    body.appendChild(el("p", "adm-note", "불러오는 중입니다..."));
    c.from("applications").select("*").order("created_at", { ascending: false }).then(function (res) {
      if (res && res.error) {
        renderApplicationsTab(res.error.message);
        return;
      }
      state.applications = (res && res.data) || [];
      renderApplicationsTab();
    }).catch(function () { renderApplicationsTab("목록을 불러오지 못했습니다."); });
  }

  function renderApplicationsTab(errorText) {
    if (body.querySelector(".adm-list-loading")) { body.innerHTML = ""; }
    var box = card("접수된 지원서", "상태를 바꾸면 바로 저장됩니다.");
    if (errorText) { box.appendChild(messageBox(errorText, "warn")); }

    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("새로고침", "outline", fetchApplications));
    box.appendChild(actions);

    if (!state.applications.length) {
      box.appendChild(el("p", "adm-note", "아직 접수된 지원서가 없습니다."));
      body.innerHTML = "";
      body.appendChild(box);
      return;
    }

    state.applications.forEach(function (app) {
      var item = el("article", "adm-list-item");
      var head = el("div", "adm-list-head");
      head.appendChild(el("strong", null, app.name || "(이름 없음)"));
      head.appendChild(el("span", "adm-list-meta", (app.position || "포지션 미정") + " · " + (app.created_at ? app.created_at.slice(0, 10) : "")));
      item.appendChild(head);

      var statusWrap = el("div", "adm-status");
      statusWrap.appendChild(el("span", "adm-label", "상태"));
      var select = el("select", "adm-input adm-input-sm");
      STATUS_APPLICATION.forEach(function (s) {
        var opt = el("option", null, s);
        opt.value = s;
        select.appendChild(opt);
      });
      if (STATUS_APPLICATION.indexOf(app.status) !== -1) { select.value = app.status; }
      select.addEventListener("change", function () {
        updateStatus("applications", app.id, select.value);
      });
      statusWrap.appendChild(select);
      statusWrap.appendChild(button("삭제", "danger", function () {
        if (!window.confirm("이 지원서를 삭제할까요?")) { return; }
        removeRow("applications", app.id);
      }));
      item.appendChild(statusWrap);

      var detail = el("details", "adm-detail");
      var summary = el("summary", null, "지원 내용 보기");
      detail.appendChild(summary);
      var dl = el("dl", "adm-dl");
      [
        ["학과·학번", app.major || "-"],
        ["학번", app.student_id || "-"],
        ["연락처", app.phone || "-"],
        ["포지션", app.position || "-"],
        ["경력", app.experience || "-"],
        ["지원 동기", app.motivation || "-"],
        ["접수 시각", app.created_at ? app.created_at.replace("T", " ").slice(0, 16) : "-"]
      ].forEach(function (pair) {
        var row = el("div", "adm-dl-row");
        row.appendChild(el("dt", null, pair[0]));
        row.appendChild(el("dd", null, pair[1]));
        dl.appendChild(row);
      });
      detail.appendChild(dl);
      item.appendChild(detail);

      box.appendChild(item);
    });

    body.innerHTML = "";
    body.appendChild(box);
  }

  function fetchSuggestions() {
    var c = client();
    if (!c) { return; }
    body.innerHTML = "";
    body.appendChild(el("p", "adm-note", "불러오는 중입니다..."));
    c.from("suggestions").select("*").order("created_at", { ascending: false }).then(function (res) {
      if (res && res.error) {
        renderSuggestionsTab(res.error.message);
        return;
      }
      state.suggestions = (res && res.data) || [];
      renderSuggestionsTab();
    }).catch(function () { renderSuggestionsTab("목록을 불러오지 못했습니다."); });
  }

  function renderSuggestionsTab(errorText) {
    var box = card("접수된 건의사항", "상태를 바꾸면 바로 저장됩니다.");
    if (errorText) { box.appendChild(messageBox(errorText, "warn")); }

    var actions = el("div", "adm-form-actions");
    actions.appendChild(button("새로고침", "outline", fetchSuggestions));
    box.appendChild(actions);

    if (!state.suggestions.length) {
      box.appendChild(el("p", "adm-note", "아직 접수된 건의사항이 없습니다."));
      body.innerHTML = "";
      body.appendChild(box);
      return;
    }

    state.suggestions.forEach(function (item) {
      var wrap = el("article", "adm-list-item");
      var head = el("div", "adm-list-head");
      head.appendChild(el("strong", null, item.title || "(제목 없음)"));
      head.appendChild(el("span", "adm-list-meta", (item.category || "기타") + " · " + (item.is_anonymous ? "익명" : (item.author_name || "기명")) + " · " + (item.created_at ? item.created_at.slice(0, 10) : "")));
      wrap.appendChild(head);

      wrap.appendChild(el("p", "adm-list-body", item.content || ""));

      var statusWrap = el("div", "adm-status");
      statusWrap.appendChild(el("span", "adm-label", "상태"));
      var select = el("select", "adm-input adm-input-sm");
      STATUS_SUGGESTION.forEach(function (s) {
        var opt = el("option", null, s);
        opt.value = s;
        select.appendChild(opt);
      });
      if (STATUS_SUGGESTION.indexOf(item.status) !== -1) { select.value = item.status; }
      select.addEventListener("change", function () {
        updateStatus("suggestions", item.id, select.value);
      });
      statusWrap.appendChild(select);
      statusWrap.appendChild(button("삭제", "danger", function () {
        if (!window.confirm("이 건의사항을 삭제할까요?")) { return; }
        removeRow("suggestions", item.id);
      }));
      wrap.appendChild(statusWrap);

      box.appendChild(wrap);
    });

    body.innerHTML = "";
    body.appendChild(box);
  }

  function updateStatus(table, id, status) {
    var c = client();
    if (!c) { return; }
    c.from(table).update({ status: status }).eq("id", id).then(function (res) {
      if (res && res.error) { toast("상태를 저장하지 못했습니다: " + res.error.message); return; }
      toast("상태를 '" + status + "'(으)로 바꿨습니다.");
    }).catch(function () { toast("상태를 저장하지 못했습니다."); });
  }

  function removeRow(table, id) {
    var c = client();
    if (!c) { return; }
    c.from(table).delete().eq("id", id).then(function (res) {
      if (res && res.error) { toast("삭제하지 못했습니다: " + res.error.message); return; }
      toast("삭제했습니다.");
      if (table === "applications") { fetchApplications(); } else { fetchSuggestions(); }
    }).catch(function () { toast("삭제하지 못했습니다."); });
  }

  /* ---------------- 관리자 이메일 ---------------- */
  function fetchAdmins() {
    var c = client();
    if (!c) { return; }
    body.innerHTML = "";
    body.appendChild(el("p", "adm-note", "불러오는 중입니다..."));
    c.from("admin_emails").select("email,created_at").order("email").then(function (res) {
      if (res && res.error) {
        renderAdminsTab(res.error.message);
        return;
      }
      state.admins = (res && res.data) || [];
      renderAdminsTab();
    }).catch(function () { renderAdminsTab("목록을 불러오지 못했습니다."); });
  }

  function renderAdminsTab(errorText) {
    var box = card("관리자 이메일", "여기에 등록된 이메일만 사이트를 수정할 수 있습니다.");
    if (errorText) { box.appendChild(messageBox(errorText, "warn")); }

    var list = el("div", "adm-admins");
    state.admins.forEach(function (row) {
      var line = el("div", "adm-admin-line");
      line.appendChild(el("span", null, row.email));
      if (state.session && state.session.user && row.email === state.session.user.email) {
        line.appendChild(el("span", "adm-badge", "나"));
      } else {
        line.appendChild(button("삭제", "danger", function () {
          if (!window.confirm(row.email + " 을(를) 관리자에서 삭제할까요?")) { return; }
          var c = client();
          if (!c) { return; }
          c.from("admin_emails").delete().eq("email", row.email).then(function (res) {
            if (res && res.error) { toast("삭제하지 못했습니다: " + res.error.message); return; }
            toast("관리자에서 삭제했습니다.");
            fetchAdmins();
          }).catch(function () { toast("삭제하지 못했습니다."); });
        }));
      }
      list.appendChild(line);
    });
    box.appendChild(list);

    var form = el("div", "adm-form-actions");
    var inputWrap = makeField({ key: "newAdmin", label: "이메일 추가", type: "email", placeholder: "name@example.com" }, "");
    box.appendChild(inputWrap);
    form.appendChild(button("관리자 추가", "primary", function () {
      var email = String($('[data-field="newAdmin"]', box).value).trim().toLowerCase();
      if (!email || email.indexOf("@") === -1) { toast("이메일을 정확히 입력해 주세요."); return; }
      var c = client();
      if (!c) { return; }
      c.from("admin_emails").insert({ email: email }).then(function (res) {
        if (res && res.error) { toast("추가하지 못했습니다: " + res.error.message); return; }
        toast("관리자를 추가했습니다. 이 메일로 로그인하면 바로 수정할 수 있습니다.");
        fetchAdmins();
      }).catch(function () { toast("추가하지 못했습니다."); });
    }));
    box.appendChild(form);
    box.appendChild(note("새 관리자는 '임원 관리 → 로그인 링크 메일 받기'로 들어와 비밀번호를 설정하면 됩니다."));

    body.innerHTML = "";
    body.appendChild(box);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
