/* =========================================================
   CBNU FS — 화면 동작
   data.js의 기본값 + Supabase site_data 를 읽어 각 섹션을 그리고,
   내비게이션·필터·폼·모달 같은 상호작용을 처리합니다.
   ========================================================= */

(function () {
  "use strict";

  var DEFAULTS = window.CBNU_FS || {};
  var CONFIG = window.CBNU_FS_SUPABASE || {};
  // supabase-js가 URL 해시를 소거하기 전에 초대/재설정 링크 여부를 기억해 둔다.
  var INITIAL_HASH = String(window.location.hash || "");

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (err) { return {}; }
  }

  var DATA = clone(DEFAULTS);
  DATA.settings = {};

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var money = new Intl.NumberFormat("ko-KR");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function formatMoney(n) {
    return money.format(Math.round(n)) + "원";
  }

  function formatDate(iso) {
    if (!iso) { return ""; }
    return iso.replace(/-/g, ".");
  }

  function formatDayMonth(iso) {
    var parts = String(iso).split("-");
    return parts.length === 3 ? parts[1] + "." + parts[2] : iso;
  }

  function toMinutes(iso) {
    var d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function safeArray(value) { return Array.isArray(value) ? value : []; }

  /* ---------------- Supabase 클라이언트 ---------------- */
  var client = null;

  function getClient() {
    if (client) { return client; }
    if (!CONFIG.url || !CONFIG.anonKey) { return null; }
    if (!window.supabase || typeof window.supabase.createClient !== "function") { return null; }
    try {
      client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (err) {
      client = null;
    }
    return client;
  }

  /* ---------------- 원격 데이터 병합 ---------------- */
  function defaultSettings() {
    var hero = DEFAULTS.hero || {};
    return {
      site: clone(DEFAULTS.site || {}),
      hero: { motto: hero.motto || "", sub: hero.sub || "", stats: clone(hero.stats || []) },
      mottoBand: DEFAULTS.mottoBand || "",
      training: clone(DEFAULTS.training || []),
      apply: clone(DEFAULTS.apply || {}),
      contact: clone(DEFAULTS.contact || {}),
      links: clone(DEFAULTS.links || {})
    };
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== "object") { return; }
    if (settings.site) { DATA.site = Object.assign({}, DATA.site, settings.site); }
    if (settings.hero) { DATA.hero = Object.assign({}, DATA.hero, settings.hero); }
    if (typeof settings.mottoBand === "string") { DATA.mottoBand = settings.mottoBand; }
    if (Array.isArray(settings.training)) { DATA.training = settings.training; }
    if (settings.apply) { DATA.apply = Object.assign({}, DATA.apply, settings.apply); }
    if (settings.contact) { DATA.contact = Object.assign({}, DATA.contact, settings.contact); }
    if (settings.links) { DATA.links = Object.assign({}, DATA.links, settings.links); }
    DATA.settings = Object.assign({}, DATA.settings, settings);
  }

  function applyRemoteRows(rows) {
    if (!DATA.settings || !Object.keys(DATA.settings).length) {
      DATA.settings = defaultSettings();
    }
    safeArray(rows).forEach(function (row) {
      if (!row || !row.key) { return; }
      var value = row.value;
      if (value === null || value === undefined) { return; }
      switch (row.key) {
        case "settings": applySettings(value); break;
        case "staff": if (Array.isArray(value)) { DATA.staff = value; } break;
        case "squad": if (Array.isArray(value)) { DATA.squad = value; } break;
        case "finance": if (value && typeof value === "object") { DATA.finance = value; } break;
        case "notices": if (Array.isArray(value)) { DATA.notices = value; } break;
        case "schedules": if (Array.isArray(value)) { DATA.schedule = value; } break;
        case "faqs": if (Array.isArray(value)) { DATA.faq = value; } break;
        default: break;
      }
    });
  }

  function loadRemote() {
    var c = getClient();
    if (!c) { return Promise.resolve(false); }
    return c.from("site_data").select("key,value").then(function (res) {
      if (res && res.error) { throw res.error; }
      var rows = (res && res.data) || [];
      if (!rows.length) { return false; }
      applyRemoteRows(rows);
      return true;
    }).catch(function (err) {
      if (window.console && console.warn) { console.warn("[CBNU FS] Supabase 데이터를 불러오지 못했습니다.", err); }
      return false;
    });
  }

  /* ---------------- 히어로 ---------------- */
  function renderHero() {
    var hero = DATA.hero || {};
    var motto = $("#heroMotto");
    if (motto && hero.motto) { motto.innerHTML = hero.motto; }
    var sub = $("#heroSub");
    if (sub && hero.sub) { sub.textContent = hero.sub; }

    var list = $("#heroStats");
    if (!list) { return; }
    list.innerHTML = "";
    safeArray(hero.stats).forEach(function (stat) {
      var li = el("li", "hero-stat");
      var strong = el("strong");
      strong.appendChild(document.createTextNode(stat.value));
      if (stat.unit) { strong.appendChild(el("em", null, stat.unit)); }
      li.appendChild(strong);
      li.appendChild(el("span", null, stat.label));
      list.appendChild(li);
    });
  }

  /* ---------------- 소개 / 가치 / 훈련 ---------------- */
  function renderAbout() {
    var grid = $("#valueGrid");
    if (grid) {
      grid.innerHTML = "";
      safeArray(DATA.values).forEach(function (value, i) {
        var card = el("article", "value-card reveal");
        card.style.transitionDelay = (i * 70) + "ms";

        var iconWrap = el("span", "value-icon");
        iconWrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#' + value.icon + '"></use></svg>';
        card.appendChild(iconWrap);

        var body = el("div", "value-body");
        body.appendChild(el("p", "value-kicker", value.title));
        body.appendChild(el("h3", "value-title", value.subtitle));
        body.appendChild(el("p", "value-desc", value.desc));
        card.appendChild(body);

        grid.appendChild(card);
      });
    }

    var motto = $("#mottoText");
    if (motto) { motto.textContent = DATA.mottoBand || ""; }

    var training = $("#trainingGrid");
    if (training) {
      training.innerHTML = "";
      safeArray(DATA.training).forEach(function (item) {
        var card = el("article", "training-card reveal");
        var head = el("div", "training-head");
        head.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#' + (item.icon || "icon-ball") + '"></use></svg>';
        head.appendChild(el("h3", null, item.title));
        card.appendChild(head);
        safeArray(item.lines).forEach(function (line, idx) {
          card.appendChild(el("p", idx === 0 ? "training-main" : "training-sub", line));
        });
        training.appendChild(card);
      });
    }

    var stripTraining = $("#stripTraining");
    if (stripTraining && DATA.training && DATA.training[0]) {
      stripTraining.textContent = (DATA.training[0].lines || [])[0] || "";
    }
    var stripPlace = $("#stripPlace");
    if (stripPlace && DATA.training && DATA.training[1]) {
      stripPlace.textContent = (DATA.training[1].lines || [])[0] || "";
    }

    var lead = $("#aboutLead");
    if (lead && DATA.site && DATA.site.description) { lead.textContent = DATA.site.description; }
  }

  /* ---------------- 임원진 ---------------- */
  function renderStaff() {
    var grid = $("#staffGrid");
    if (!grid) { return; }
    grid.innerHTML = "";
    var staff = safeArray(DATA.staff);

    staff.forEach(function (person, i) {
      var card = el("article", "staff-card reveal");
      card.style.transitionDelay = (i * 60) + "ms";

      if (person.role) { card.appendChild(el("span", "staff-role", person.role)); }

      var avatar = el("div", "staff-avatar", person.name ? person.name.charAt(0) : "?");
      card.appendChild(avatar);

      card.appendChild(el("h4", "staff-name", person.name));
      if (person.dept) { card.appendChild(el("p", "staff-dept", person.dept)); }
      if (person.duty) { card.appendChild(el("p", "staff-duty", person.duty)); }
      if (person.intro) { card.appendChild(el("p", "staff-intro", "“" + person.intro + "”")); }

      grid.appendChild(card);
    });

    if (!staff.length) {
      grid.appendChild(el("p", "empty-state", "등록된 임원 정보가 없습니다."));
    }

    var count = $("#staffCount");
    if (count) { count.textContent = staff.length + "명"; }
  }

  /* ---------------- 선수단 ---------------- */
  var POSITIONS = [
    { key: "all", label: "전체" },
    { key: "GK", label: "GK" },
    { key: "FIXO", label: "FIXO" },
    { key: "ALA", label: "ALA" },
    { key: "PIVO", label: "PIVO" }
  ];

  var squadFilter = "all";

  function renderSquad(filter) {
    var grid = $("#squadGrid");
    if (!grid) { return; }
    var squad = safeArray(DATA.squad);
    var key = filter || squadFilter || "all";
    var list = key === "all" ? squad : squad.filter(function (p) { return p.pos === key; });

    grid.innerHTML = "";

    list.forEach(function (player, i) {
      var card = el("article", "player-card");
      card.style.transitionDelay = (i * 30) + "ms";

      var top = el("div", "player-top");
      var pos = String(player.pos || "").trim();
      top.appendChild(el("span", "pos-chip pos-" + pos.toLowerCase(), pos || "—"));
      top.appendChild(el("span", "player-no", ("0" + player.no).slice(-2)));
      card.appendChild(top);

      card.appendChild(el("h4", "player-name", player.name));
      if (player.dept) { card.appendChild(el("p", "player-dept", player.dept)); }
      if (player.intro) { card.appendChild(el("p", "player-intro", player.intro)); }

      grid.appendChild(card);
    });

    if (!list.length) {
      grid.appendChild(el("p", "empty-state", "해당 포지션의 선수가 아직 없습니다."));
    }
  }

  function renderSquadTabs() {
    var tabs = $("#positionTabs");
    var squad = safeArray(DATA.squad);
    if (!tabs) { return; }
    tabs.innerHTML = "";

    POSITIONS.forEach(function (pos) {
      var count = pos.key === "all" ? squad.length : squad.filter(function (p) { return p.pos === pos.key; }).length;
      var active = pos.key === squadFilter;
      var btn = el("button", "chip" + (active ? " is-active" : ""));
      btn.type = "button";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.appendChild(document.createTextNode(pos.label));
      btn.appendChild(el("span", "chip-count", count));
      btn.addEventListener("click", function () {
        squadFilter = pos.key;
        $$(".chip", tabs).forEach(function (other) {
          other.classList.remove("is-active");
          other.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        renderSquad(pos.key);
      });
      tabs.appendChild(btn);
    });

    var count = $("#squadCount");
    if (count) { count.textContent = squad.length + "명"; }
  }

  /* ---------------- 지원 안내 ---------------- */
  function renderApplyInfo() {
    var apply = DATA.apply || {};

    var eligibility = $("#applyEligibility");
    if (eligibility) {
      eligibility.innerHTML = "";
      safeArray(apply.eligibility).forEach(function (text) {
        eligibility.appendChild(el("li", null, text));
      });
    }

    var timeline = $("#applyTimeline");
    if (timeline) {
      timeline.innerHTML = "";
      safeArray(apply.timeline).forEach(function (text, i) {
        var li = el("li");
        li.appendChild(el("span", "step-no", ("0" + (i + 1)).slice(-2)));
        li.appendChild(el("span", "step-text", text));
        timeline.appendChild(li);
      });
    }

    var fees = $("#applyFees");
    if (fees) {
      fees.innerHTML = "";
      safeArray(apply.fees).forEach(function (row) {
        var wrap = el("div", "info-row");
        wrap.appendChild(el("dt", null, row.label));
        wrap.appendChild(el("dd", null, row.value));
        fees.appendChild(wrap);
      });
    }
  }

  /* ---------------- 회계 ---------------- */
  var financeState = { type: "all", month: "all" };

  function buildLedger() {
    var finance = DATA.finance || {};
    var rows = safeArray(finance.transactions).map(function (tx, i) {
      return {
        date: tx.date,
        type: tx.type === "income" ? "income" : "expense",
        category: tx.category || "",
        desc: tx.desc || "",
        amount: Number(tx.amount) || 0,
        note: tx.note || "",
        order: i
      };
    });

    rows.sort(function (a, b) {
      var diff = toMinutes(a.date) - toMinutes(b.date);
      return diff !== 0 ? diff : a.order - b.order;
    });

    var balance = Number(finance.openingBalance) || 0;
    var openingDate = finance.openingDate || (rows.length ? rows[0].date : "");

    rows.forEach(function (row) {
      balance += row.type === "income" ? row.amount : -row.amount;
      row.balance = balance;
    });

    return {
      rows: rows,
      opening: Number(finance.openingBalance) || 0,
      openingDate: openingDate,
      income: rows.reduce(function (sum, r) { return r.type === "income" ? sum + r.amount : sum; }, 0),
      expense: rows.reduce(function (sum, r) { return r.type === "expense" ? sum + r.amount : sum; }, 0),
      balance: balance
    };
  }

  function renderFinance() {
    var ledger = buildLedger();
    var cards = $("#financeCards");

    if (cards) {
      cards.innerHTML = "";
      var items = [
        { label: "총 수입", value: ledger.income, tone: "income", note: "회비·후원·기타" },
        { label: "총 지출", value: ledger.expense, tone: "expense", note: "코트·장비·대회·친목" },
        { label: "현재 잔액", value: ledger.balance, tone: "balance", note: "이월금 " + formatMoney(ledger.opening) + " 포함" }
      ];
      items.forEach(function (item) {
        var card = el("article", "finance-card finance-" + item.tone);
        card.appendChild(el("p", "finance-label", item.label));
        card.appendChild(el("p", "finance-value", formatMoney(item.value)));
        card.appendChild(el("p", "finance-note", item.note));
        cards.appendChild(card);
      });
    }

    var select = $("#financeMonth");
    var months = [];
    ledger.rows.forEach(function (row) {
      var key = String(row.date).slice(0, 7);
      if (months.indexOf(key) === -1) { months.push(key); }
    });
    months.sort();

    if (select) {
      select.innerHTML = "";
      var allOpt = el("option", null, "전체 기간");
      allOpt.value = "all";
      select.appendChild(allOpt);
      months.slice().reverse().forEach(function (key) {
        var parts = key.split("-");
        var opt = el("option", null, parts[0] + "년 " + Number(parts[1]) + "월");
        opt.value = key;
        select.appendChild(opt);
      });
      if (financeState.month !== "all" && months.indexOf(financeState.month) === -1) {
        financeState.month = "all";
      }
      select.value = financeState.month;
    }

    renderLedger(ledger);

    var caption = $("#financeCaption");
    if (caption) {
      caption.textContent = ledger.rows.length + "건의 내역 · " + formatDate(ledger.openingDate) + " 이월금 " + formatMoney(ledger.opening) + " 기준";
    }
  }

  function renderLedger(ledger) {
    var body = $("#ledgerBody");
    var foot = $("#ledgerFoot");
    if (!body) { return; }

    var rows = ledger.rows.filter(function (row) {
      if (financeState.type !== "all" && row.type !== financeState.type) { return false; }
      if (financeState.month !== "all" && String(row.date).slice(0, 7) !== financeState.month) { return false; }
      return true;
    }).slice().reverse();

    body.innerHTML = "";

    if (!rows.length) {
      var emptyRow = el("tr");
      var emptyCell = el("td", "empty-cell", "조건에 맞는 내역이 없습니다.");
      emptyCell.colSpan = 6;
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    }

    rows.forEach(function (row) {
      var tr = el("tr");

      var dateCell = el("td", "cell-date", formatDate(row.date));
      dateCell.setAttribute("data-label", "날짜");
      tr.appendChild(dateCell);

      var typeCell = el("td", "cell-type");
      typeCell.setAttribute("data-label", "구분");
      typeCell.appendChild(el("span", "type-badge type-" + row.type, row.type === "income" ? "수입" : "지출"));
      tr.appendChild(typeCell);

      var descCell = el("td", "cell-desc");
      descCell.setAttribute("data-label", "내역");
      descCell.appendChild(el("span", "desc-main", row.desc));
      if (row.category) { descCell.appendChild(el("span", "desc-tag", row.category)); }
      tr.appendChild(descCell);

      var amountCell = el("td", "num cell-amount " + row.type, (row.type === "income" ? "+" : "−") + money.format(row.amount));
      amountCell.setAttribute("data-label", "금액");
      tr.appendChild(amountCell);

      var balanceCell = el("td", "num cell-balance", money.format(row.balance));
      balanceCell.setAttribute("data-label", "잔액");
      tr.appendChild(balanceCell);

      var noteCell = el("td", "cell-note" + (row.note ? "" : " is-empty"), row.note || "—");
      noteCell.setAttribute("data-label", "비고");
      tr.appendChild(noteCell);

      body.appendChild(tr);
    });

    if (foot) {
      foot.innerHTML = "";
      var incomeSum = rows.reduce(function (s, r) { return r.type === "income" ? s + r.amount : s; }, 0);
      var expenseSum = rows.reduce(function (s, r) { return r.type === "expense" ? s + r.amount : s; }, 0);
      var tr = el("tr");
      var cell = el("td");
      cell.colSpan = 6;
      var text = "표시된 내역 " + rows.length + "건 · 수입 " + formatMoney(incomeSum) + " · 지출 " + formatMoney(expenseSum);
      cell.appendChild(el("span", "foot-text", text));
      tr.appendChild(cell);
      foot.appendChild(tr);
    }
  }

  /* ---------------- FAQ ---------------- */
  function renderFaq() {
    var list = $("#faqList");
    if (!list) { return; }
    list.innerHTML = "";

    safeArray(DATA.faq).forEach(function (item, i) {
      var wrap = el("div", "faq-item reveal");
      wrap.style.transitionDelay = (i * 40) + "ms";

      var heading = el("h3", "faq-q-wrap");
      var btn = el("button", "faq-q");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "faq-a-" + i);

      btn.appendChild(el("span", "faq-index", "Q" + (i + 1)));
      btn.appendChild(el("span", "faq-question", item.q));
      var icon = el("span", "faq-icon");
      icon.setAttribute("aria-hidden", "true");
      btn.appendChild(icon);

      heading.appendChild(btn);
      wrap.appendChild(heading);

      var answer = el("div", "faq-a");
      answer.id = "faq-a-" + i;
      var inner = el("div", "faq-a-inner");
      inner.appendChild(el("p", null, item.a));
      answer.appendChild(inner);
      wrap.appendChild(answer);

      btn.addEventListener("click", function () {
        var isOpen = wrap.classList.contains("is-open");
        $$(".faq-item.is-open", list).forEach(function (other) {
          if (other === wrap) { return; }
          other.classList.remove("is-open");
          var otherBtn = $(".faq-q", other);
          if (otherBtn) { otherBtn.setAttribute("aria-expanded", "false"); }
        });
        wrap.classList.toggle("is-open", !isOpen);
        btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });

      list.appendChild(wrap);
    });
  }

  /* ---------------- 공지 / 일정 ---------------- */
  function renderNews() {
    var noticeList = $("#noticeList");
    if (noticeList) {
      noticeList.innerHTML = "";
      safeArray(DATA.notices).forEach(function (notice, i) {
        var card = el("article", "notice-card reveal");
        card.style.transitionDelay = (i * 60) + "ms";

        var meta = el("div", "notice-meta");
        var tag = notice.tag || "공지";
        meta.appendChild(el("span", "notice-tag tag-" + (tag === "모집" ? "join" : tag === "일정" ? "schedule" : "notice"), tag));
        meta.appendChild(el("time", "notice-date", formatDate(notice.date)));
        card.appendChild(meta);

        card.appendChild(el("h3", "notice-title", notice.title));
        card.appendChild(el("p", "notice-body", notice.body));
        noticeList.appendChild(card);
      });
    }

    var scheduleList = $("#scheduleList");
    if (scheduleList) {
      scheduleList.innerHTML = "";
      safeArray(DATA.schedule).forEach(function (item) {
        var li = el("li", "schedule-item");
        var date = el("div", "schedule-date");
        date.appendChild(el("strong", null, formatDayMonth(item.date)));
        date.appendChild(el("span", null, (item.day || "") + "요일"));
        li.appendChild(date);

        var body = el("div", "schedule-body");
        body.appendChild(el("p", "schedule-title", item.title));
        body.appendChild(el("p", "schedule-info", (item.time || "") + " · " + (item.place || "")));
        li.appendChild(body);

        scheduleList.appendChild(li);
      });
    }
  }

  /* ---------------- 문의 링크 ---------------- */
  function resolveLink(key) {
    var links = DATA.links || {};
    var contact = DATA.contact || {};
    if (key === "instagram") {
      return links.instagram || (contact.instagram && contact.instagram.url) || "";
    }
    if (key === "openchat") {
      return links.openchat || (contact.openchat && contact.openchat.url) || "";
    }
    if (key === "email") {
      return contact.email || "";
    }
    return links[key] || "";
  }

  function linkLabel(key) {
    if (key === "googleForm") { return "구글 폼"; }
    if (key === "instagram") { return "인스타그램"; }
    return "오픈채팅";
  }

  function renderContact() {
    var contact = DATA.contact || {};
    var insta = contact.instagram || {};
    var label = $("#instagramLabel");
    if (label && insta.label) { label.textContent = insta.label; }

    var meta = $("#contactMeta");
    if (meta) {
      var bits = [];
      if (contact.place) { bits.push(contact.place); }
      if (contact.email) { bits.push(contact.email); }
      meta.textContent = bits.join(" · ");
    }

    $$("[data-link]").forEach(function (node) {
      var key = node.getAttribute("data-link");
      var url = resolveLink(key);
      if (node.tagName === "A") {
        if (url) {
          node.setAttribute("href", url);
          if (/^https?:/i.test(url) || /^mailto:/i.test(url)) {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          }
        } else {
          node.setAttribute("href", "#");
        }
      }
    });
  }

  function initContact() {
    $$("[data-link]").forEach(function (node) {
      if (node.dataset.linkBound) { return; }
      node.dataset.linkBound = "1";
      node.addEventListener("click", function (event) {
        var key = node.getAttribute("data-link");
        var url = resolveLink(key);
        if (url) {
          if (node.tagName !== "A") {
            event.preventDefault();
            window.open(url, "_blank", "noopener");
          }
          return;
        }
        event.preventDefault();
        var labelText = node.getAttribute("data-contact-label") || linkLabel(key);
        openModal({
          title: labelText + " 링크 준비 중",
          body:
            '<p class="modal-text">' + labelText + ' 주소가 아직 연결되지 않았습니다. 동아리 임원진에게 직접 문의해 주세요.</p>' +
            '<p class="modal-hint">관리자(임원 관리)에서 연락처·링크를 등록하면 이 버튼이 바로 연결됩니다.</p>',
          actions: [{ label: "확인", variant: "primary" }]
        });
      });
    });
  }

  /* ---------------- 모달 ---------------- */
  var modal = null;
  var lastFocus = null;

  function openModal(options) {
    if (!modal) { return; }
    modal.querySelector("#modalTitle").textContent = options.title || "";
    var body = modal.querySelector("#modalBody");
    body.innerHTML = "";
    if (options.bodyNode) {
      body.appendChild(options.bodyNode);
    } else {
      body.innerHTML = options.body || "";
    }

    var actions = modal.querySelector("#modalActions");
    actions.innerHTML = "";

    safeArray(options.actions).forEach(function (action) {
      var btn = el("button", "btn " + (action.variant === "ghost" ? "btn-outline" : action.variant === "dark" ? "btn-dark" : "btn-primary"), action.label);
      btn.type = "button";
      btn.addEventListener("click", function () {
        if (typeof action.onClick === "function") { action.onClick(); }
        else { closeModal(); }
      });
      actions.appendChild(btn);
    });

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    var closeBtn = modal.querySelector("#modalClose");
    if (closeBtn) { closeBtn.focus(); }
  }

  function closeModal() {
    if (!modal || modal.hidden) { return; }
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    window.setTimeout(function () {
      modal.hidden = true;
      if (lastFocus && typeof lastFocus.focus === "function") { lastFocus.focus(); }
    }, 180);
  }

  function initModal() {
    modal = $("#modal");
    if (!modal) { return; }
    modal.querySelector("#modalClose").addEventListener("click", closeModal);
    $$("[data-modal-close]", modal).forEach(function (node) {
      node.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Esc") {
        if (document.body.classList.contains("admin-open")) { return; }
        closeModal();
      }
    });
  }

  /* ---------------- 토스트 ---------------- */
  var toastTimer = null;
  function showToast(message) {
    var toast = $("#toast");
    if (!toast) { return; }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function fallbackCopy(text) {
    var area = el("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text, done) {
    var finish = function (ok) {
      if (ok) {
        showToast("복사했어요. 담당자에게 붙여넣기로 전달해 주세요.");
      } else {
        showToast("복사에 실패했어요. 내용을 길게 눌러 직접 복사해 주세요.");
      }
      if (typeof done === "function") { done(ok); }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        finish(true);
      }).catch(function () {
        finish(fallbackCopy(text));
      });
    } else {
      finish(fallbackCopy(text));
    }
  }

  /* ---------------- 폼 ---------------- */
  function setError(fieldId, message) {
    var input = document.getElementById(fieldId);
    var error = document.querySelector('[data-error-for="' + fieldId + '"]');
    if (input) {
      input.classList.toggle("is-invalid", Boolean(message));
      if (message) { input.setAttribute("aria-invalid", "true"); }
      else { input.removeAttribute("aria-invalid"); }
    }
    if (error) { error.textContent = message || ""; }
  }

  function clearErrors(form) {
    $$(".field-error", form).forEach(function (node) { node.textContent = ""; });
    $$(".is-invalid", form).forEach(function (node) { node.classList.remove("is-invalid"); });
  }

  function fieldValue(id) {
    var node = document.getElementById(id);
    return node ? String(node.value).trim() : "";
  }

  function focusFirstInvalid(form) {
    var invalid = form.querySelector(".is-invalid");
    if (invalid) {
      invalid.focus();
      var rect = invalid.getBoundingClientRect();
      if (rect.top < 90 || rect.bottom > window.innerHeight) {
        invalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function digitsOnly(text) {
    return String(text || "").replace(/[^0-9]/g, "");
  }

  // "경영학부 25학번 (2025012345)" 처럼 섞여 있어도 학번(6자리 이상)만 뽑아낸다.
  function extractStudentId(text) {
    var groups = String(text || "").match(/[0-9]{6,}/g) || [];
    if (!groups.length) { return null; }
    groups.sort(function (a, b) { return b.length - a.length; });
    return groups[0];
  }

  function buildApplySummary(values) {
    var lines = [
      "[CBNU FS 신입 부원 지원서]",
      "",
      "이름: " + values.name,
      "학과/학번: " + values.dept,
      "연락처: " + values.phone,
      "선호 포지션: " + (values.position || "미정"),
      "경력: " + (values.career || "없음"),
      "",
      "지원 동기:",
      values.motivation,
      "",
      "— CBNU FS 웹사이트 지원서에서 작성"
    ];
    return lines.join("\n");
  }

  function buildSuggestSummary(values) {
    var lines = [
      "[CBNU FS 건의사항]",
      "",
      "분류: " + values.category,
      "제목: " + values.title,
      "익명 여부: " + (values.anonymous ? "익명" : (values.author ? "기명 (" + values.author + ")" : "기명")),
      "",
      "내용:",
      values.content,
      "",
      "— CBNU FS 웹사이트 건의사항에서 작성"
    ];
    return lines.join("\n");
  }

  function showSummaryModal(title, summary, hint, submitNote) {
    var node = el("div", "summary-wrap");
    node.appendChild(el("pre", "summary", summary));
    node.appendChild(el("p", "summary-hint", hint));
    if (submitNote) { node.appendChild(el("p", "summary-status", submitNote)); }

    openModal({
      title: title,
      bodyNode: node,
      actions: [
        { label: "내용 복사하기", variant: "primary", onClick: function () { copyText(summary); } },
        { label: "닫기", variant: "ghost" }
      ]
    });
  }

  function submitApplication(values) {
    var c = getClient();
    if (!c) { return Promise.reject(new Error("supabase-unavailable")); }
    return c.from("applications").insert({
      name: values.name,
      major: values.dept,
      student_id: extractStudentId(values.dept),
      phone: values.phone,
      position: values.position,
      experience: values.career || null,
      motivation: values.motivation,
      status: "접수"
    });
  }

  function submitSuggestion(values) {
    var c = getClient();
    if (!c) { return Promise.reject(new Error("supabase-unavailable")); }
    return c.from("suggestions").insert({
      title: values.title,
      category: values.category,
      content: values.content,
      is_anonymous: Boolean(values.anonymous),
      author_name: values.anonymous ? null : (values.author || null),
      status: "접수"
    });
  }

  function initForms() {
    var applyForm = $("#applyForm");
    if (applyForm) {
      applyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        clearErrors(applyForm);

        var valid = true;

        if (!fieldValue("applyName")) { setError("applyName", "이름을 입력해 주세요."); valid = false; }
        if (!fieldValue("applyDept")) { setError("applyDept", "학과와 학번을 입력해 주세요."); valid = false; }

        var phone = digitsOnly(fieldValue("applyPhone"));
        if (!phone) { setError("applyPhone", "연락처를 입력해 주세요."); valid = false; }
        else if (phone.length < 9 || phone.length > 11) { setError("applyPhone", "연락 가능한 번호를 정확히 입력해 주세요."); valid = false; }

        if (!fieldValue("applyPosition")) { setError("applyPosition", "선호 포지션을 선택해 주세요."); valid = false; }

        if (fieldValue("applyMotivation").length < 10) {
          setError("applyMotivation", "지원 동기를 10자 이상 적어 주세요.");
          valid = false;
        }

        if (!valid) { focusFirstInvalid(applyForm); return; }

        var values = {
          name: fieldValue("applyName"),
          dept: fieldValue("applyDept"),
          phone: fieldValue("applyPhone"),
          position: fieldValue("applyPosition"),
          career: fieldValue("applyCareer"),
          motivation: fieldValue("applyMotivation")
        };
        var summary = buildApplySummary(values);

        var button = applyForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; }

        submitApplication(values).then(function (res) {
          if (button) { button.disabled = false; }
          if (res && res.error) { throw res.error; }
          applyForm.reset();
          showSummaryModal(
            "지원서가 접수되었습니다",
            summary,
            "접수 내용은 동아리 임원진이 확인 후 3일 안에 연락드립니다. 필요하면 아래에서 복사해 두세요.",
            "접수 번호 없이 저장되었으며, 중복 제출을 피하려면 한 번만 눌러 주세요."
          );
          showToast("지원서가 접수되었습니다.");
        }).catch(function (err) {
          if (button) { button.disabled = false; }
          if (window.console && console.warn) { console.warn("[CBNU FS] 지원서 저장 실패", err); }
          showSummaryModal(
            "지원서 내용을 확인해 주세요",
            summary,
            "자동 접수에 실패했습니다. 아래 버튼으로 복사한 뒤 오픈채팅이나 문자로 담당자에게 전달해 주세요.",
            null
          );
        });
      });

      $$("input, select, textarea", applyForm).forEach(function (input) {
        input.addEventListener("input", function () {
          if (input.id) { setError(input.id, ""); }
        });
        input.addEventListener("change", function () {
          if (input.id) { setError(input.id, ""); }
        });
      });
    }

    var suggestForm = $("#suggestForm");
    if (suggestForm) {
      var anonBox = document.getElementById("suggestAnon");
      var nameField = document.getElementById("suggestNameField");

      function syncAnon() {
        if (!nameField) { return; }
        var isAnon = anonBox && anonBox.checked;
        nameField.hidden = Boolean(isAnon);
      }
      if (anonBox) { anonBox.addEventListener("change", syncAnon); }
      syncAnon();

      suggestForm.addEventListener("submit", function (event) {
        event.preventDefault();
        clearErrors(suggestForm);

        var valid = true;
        if (!fieldValue("suggestTitle")) { setError("suggestTitle", "제목을 입력해 주세요."); valid = false; }
        if (!fieldValue("suggestCategory")) { setError("suggestCategory", "분류를 선택해 주세요."); valid = false; }
        if (fieldValue("suggestBody").length < 10) {
          setError("suggestBody", "내용을 10자 이상 적어 주세요.");
          valid = false;
        }
        if (!valid) { focusFirstInvalid(suggestForm); return; }

        var values = {
          title: fieldValue("suggestTitle"),
          category: fieldValue("suggestCategory"),
          content: fieldValue("suggestBody"),
          anonymous: Boolean(anonBox && anonBox.checked),
          author: fieldValue("suggestAuthor")
        };
        var summary = buildSuggestSummary(values);

        var button = suggestForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; }

        submitSuggestion(values).then(function (res) {
          if (button) { button.disabled = false; }
          if (res && res.error) { throw res.error; }
          suggestForm.reset();
          syncAnon();
          showSummaryModal(
            "건의사항이 접수되었습니다",
            summary,
            "접수된 건의는 다음 정기 운영 회의에서 안건으로 다뤄지고, 반영 여부를 2주 안에 안내드립니다.",
            null
          );
          showToast("건의사항이 접수되었습니다.");
        }).catch(function (err) {
          if (button) { button.disabled = false; }
          if (window.console && console.warn) { console.warn("[CBNU FS] 건의사항 저장 실패", err); }
          showSummaryModal(
            "건의 내용을 확인해 주세요",
            summary,
            "자동 접수에 실패했습니다. 아래 버튼으로 복사해 오픈채팅으로 보내거나 총무에게 직접 전달해 주세요.",
            null
          );
        });
      });

      $$("input, select, textarea", suggestForm).forEach(function (input) {
        input.addEventListener("input", function () {
          if (input.id) { setError(input.id, ""); }
        });
        input.addEventListener("change", function () {
          if (input.id) { setError(input.id, ""); }
        });
      });
    }
  }

  /* ---------------- 필터 (한 번만 연결) ---------------- */
  var filtersReady = false;

  function initFilters() {
    if (filtersReady) { return; }
    filtersReady = true;

    var select = $("#financeMonth");
    if (select) {
      select.addEventListener("change", function () {
        financeState.month = select.value;
        renderLedger(buildLedger());
      });
    }

    var filter = $("#financeTypeFilter");
    if (filter) {
      $$(".chip", filter).forEach(function (chip) {
        chip.addEventListener("click", function () {
          $$(".chip", filter).forEach(function (other) {
            other.classList.remove("is-active");
            other.setAttribute("aria-pressed", "false");
          });
          chip.classList.add("is-active");
          chip.setAttribute("aria-pressed", "true");
          financeState.type = chip.getAttribute("data-type");
          renderLedger(buildLedger());
        });
      });
    }
  }

  /* ---------------- 내비게이션 ---------------- */
  function initNav() {
    var header = $("#siteHeader");
    var toggle = $("#navToggle");
    var nav = $("#primaryNav");

    function setOpen(open) {
      if (!toggle || !nav) { return; }
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        setOpen(!document.body.classList.contains("nav-open"));
      });
    }

    if (nav) {
      $$("a", nav).forEach(function (link) {
        link.addEventListener("click", function () { setOpen(false); });
      });
      $$("[data-admin-open]", nav).forEach(function (btn) {
        btn.addEventListener("click", function () { setOpen(false); });
      });
    }

    document.addEventListener("keydown", function (event) {
      if ((event.key === "Escape" || event.key === "Esc") && document.body.classList.contains("nav-open")) {
        setOpen(false);
        if (toggle) { toggle.focus(); }
      }
    });

    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth > 980 && lastWidth <= 980) { setOpen(false); }
      lastWidth = window.innerWidth;
    });

    var onScroll = function () {
      if (header) { header.classList.toggle("is-scrolled", window.scrollY > 8); }
      var toTop = $("#toTop");
      if (toTop) { toTop.classList.toggle("is-visible", window.scrollY > 700); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var toTop = $("#toTop");
    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // 스크롤 위치에 맞춰 현재 섹션 표시
    var links = $$(".nav-link");
    var sections = links.map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    }).filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          links.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (section) { spy.observe(section); });
    }
  }

  /* ---------------- 등장 애니메이션 ---------------- */
  var revealObserver = null;

  function initReveal() {
    var items = $$(".reveal");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    items.forEach(function (item) { revealObserver.observe(item); });

    // JS로 나중에 추가된 카드도 관찰
    var gridObserver = new MutationObserver(function () {
      $$(".reveal:not(.is-visible)").forEach(function (item) { revealObserver.observe(item); });
    });
    gridObserver.observe(document.body, { childList: true, subtree: true });
  }

  function initFooter() {
    var year = $("#footerYear");
    if (year) { year.textContent = String(new Date().getFullYear()); }
    var title = $("#brandText");
    if (title && DATA.site && DATA.site.name) { title.textContent = DATA.site.name; }
  }

  /* ---------------- 전체 렌더 ---------------- */
  function renderAll() {
    renderHero();
    renderAbout();
    renderStaff();
    renderSquadTabs();
    renderSquad(squadFilter);
    renderApplyInfo();
    renderFinance();
    renderFaq();
    renderNews();
    renderContact();
  }

  /* ---------------- 시작 ---------------- */
  function boot() {
    DATA.settings = defaultSettings();
    initModal();
    initContact();
    initFilters();
    initForms();
    initNav();
    initFooter();
    renderAll();
    initReveal();

    loadRemote().then(function (loaded) {
      if (!loaded) { return; }
      renderAll();
      document.dispatchEvent(new CustomEvent("cbnu:data-loaded"));
    }).catch(function () { /* 기본 data.js 값으로 동작 */ });
  }

  window.CBNU_APP = {
    data: function () { return DATA; },
    initialHash: INITIAL_HASH,
    settings: function () { return DATA.settings || {}; },
    render: renderAll,
    applyRows: applyRemoteRows,
    reload: function () {
      return loadRemote().then(function (loaded) {
        renderAll();
        return loaded;
      });
    },
    client: getClient,
    config: CONFIG,
    toast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    copy: copyText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
