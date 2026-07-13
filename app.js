(function () {
  "use strict";

  // ---- Supabase config ----
  var SUPABASE_URL = "https://umqdrgzeapncsauyptea.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_U_ptEnDnSsrF-relRlsCgw_tY4xiztD";
  var SUPABASE_TABLE = "oyasodate_leads";

  var DATA = window.APP_DATA;

  var state = {
    name: "",
    email: "",
    answers: [],       // { key: 'arashi'|... }
    allQuestions: [],  // combined list w/ phase marker
    index: 0,
    season: null,
    trait: null
  };

  // build combined question list: 9 season + trait-intro marker + 8 trait
  function buildQuestionList() {
    var list = DATA.seasonQuestions.map(function (q) {
      return { phase: "season", q: q.q, options: q.options };
    });
    DATA.traitQuestions.forEach(function (q, i) {
      list.push({ phase: "trait", q: q.q, options: q.options, firstTrait: i === 0 });
    });
    return list;
  }

  function $(sel) { return document.querySelector(sel); }

  function showScreen(id) {
    document.querySelectorAll("[data-screen]").forEach(function (el) {
      el.hidden = el.id !== id;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------- entry form ----------------
  $("#form-entry").addEventListener("submit", function (e) {
    e.preventDefault();
    state.name = $("#input-name").value.trim();
    state.email = $("#input-email").value.trim();
    if (!state.name || !state.email) return;
    state.allQuestions = buildQuestionList();
    state.index = 0;
    showScreen("screen-quiz");
    renderQuestion();
  });

  // ---------------- quiz ----------------
  function renderQuestion() {
    var total = state.allQuestions.length;
    var item = state.allQuestions[state.index];

    $("#progress-fill").style.width = Math.round((state.index / total) * 100) + "%";
    $("#q-counter").textContent = "質問 " + (state.index + 1) + " / " + total;

    var introEl = $("#trait-intro");
    var qWrap = $("#question-wrap");

    if (item.phase === "trait" && item.firstTrait) {
      introEl.hidden = false;
      qWrap.style.display = "none";
      $("#btn-trait-continue").onclick = function () {
        introEl.hidden = true;
        qWrap.style.display = "";
        paintQuestion(item);
      };
      return;
    }

    introEl.hidden = true;
    qWrap.style.display = "";
    paintQuestion(item);
  }

  function paintQuestion(item) {
    $("#q-text").textContent = item.q;
    var optWrap = $("#q-options");
    optWrap.innerHTML = "";
    item.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "q-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", function () {
        state.answers.push(opt.key);
        state.index++;
        if (state.index >= state.allQuestions.length) {
          finishQuiz();
        } else {
          renderQuestion();
        }
      });
      optWrap.appendChild(btn);
    });
  }

  // ---------------- scoring ----------------
  function tally(keys, validKeys) {
    var counts = {};
    validKeys.forEach(function (k) { counts[k] = 0; });
    keys.forEach(function (k) { if (counts.hasOwnProperty(k)) counts[k]++; });
    var best = validKeys[0];
    validKeys.forEach(function (k) { if (counts[k] > counts[best]) best = k; });
    return best;
  }

  function finishQuiz() {
    var seasonAnswers = state.answers.slice(0, 9);
    var traitAnswers = state.answers.slice(9, 17);
    state.season = tally(seasonAnswers, ["arashi", "nagi", "fukamari", "minori"]);
    state.trait = tally(traitAnswers, ["kenshin", "sekinin", "reisei", "kyodo"]);
    showScreen("screen-loading");
    setTimeout(submitAndShowResult, 900);
  }

  // ---------------- supabase ----------------
  function saveLead() {
    var url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE;
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        name: state.name,
        email: state.email,
        season: state.season,
        trait: state.trait
      })
    }).catch(function (err) {
      console.warn("lead save failed (non-blocking):", err);
    });
  }

  function submitAndShowResult() {
    saveLead().then(renderResult);
    // safety: if fetch hangs, still show result after a short delay
    setTimeout(renderResult, 2500);
  }

  var resultRendered = false;
  function renderResult() {
    if (resultRendered) return;
    resultRendered = true;

    var season = state.season, trait = state.trait;
    var seasonLabel = DATA.seasonLabels[season];
    var traitLabel = DATA.traitLabels[trait];
    var bridge = DATA.bridges[season + "|" + trait];

    $("#result-eyebrow").textContent = state.name + " 様の結果";
    $("#result-title").innerHTML =
      "あなたは今〈" + seasonLabel + "〉を<br>〈" + traitLabel + "〉として過ごしています";

    var body =
      escapeHtml(DATA.seasonTexts[season]) +
      "\n\n<strong>" + escapeHtml(bridge) + "</strong>\n\n" +
      escapeHtml(DATA.traitTexts[trait]) +
      "\n\n" + escapeHtml(DATA.closing);

    $("#result-body").innerHTML = body;

    renderCards();

    // update URL so this result is bookmarkable / linkable from step-mails
    var params = new URLSearchParams({ season: season, trait: trait, name: state.name });
    history.replaceState(null, "", "?" + params.toString());

    showScreen("screen-result");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- gift cards (canvas-generated, downloadable) ----------------
  var CARD_TEXTS = [
    "今日は、ここまでで、\n大丈夫です。",
    "ここまで歩いてきた、\nその強さは、本物です。",
    "これでいいんです。\n今のあなたに、必要な学びが、\nちゃんとここにあります。"
  ];
  var CARD_GRADIENTS = [
    ["#C99A94", "#8C87A6"],
    ["#93A7B8", "#8C87A6"],
    ["#7FA98B", "#93A7B8"]
  ];

  function renderCards() {
    var row = $("#cards-row");
    row.innerHTML = "";
    CARD_TEXTS.forEach(function (text, i) {
      var el = document.createElement("div");
      el.className = "mini-card";
      var p = document.createElement("div");
      p.textContent = text;
      p.style.whiteSpace = "pre-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "画像を保存";
      btn.addEventListener("click", function () {
        downloadCard(text, CARD_GRADIENTS[i]);
      });
      el.appendChild(p);
      el.appendChild(btn);
      row.appendChild(el);
    });
  }

  function downloadCard(text, gradient) {
    var canvas = $("#card-canvas");
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, gradient[0]);
    grad.addColorStop(1, gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // soft vignette circles for texture
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(w * 0.15, h * 0.85, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.9, h * 0.1, 220, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 64px 'Hiragino Mincho ProN', 'Yu Mincho', serif";

    var lines = text.split("\n");
    var lineHeight = 92;
    var startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(function (line, i) {
      ctx.fillText(line, w / 2, startY + i * lineHeight);
    });

    ctx.font = "400 30px 'Zen Kaku Gothic New', sans-serif";
    ctx.globalAlpha = 0.85;
    ctx.fillText("親育て診断", w / 2, h - 90);

    var link = document.createElement("a");
    link.download = "oyasodate-card.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ---------------- direct-link support (from step-mails) ----------------
  (function tryDirectResult() {
    var params = new URLSearchParams(window.location.search);
    var season = params.get("season");
    var trait = params.get("trait");
    var name = params.get("name");
    if (season && trait && DATA.seasonTexts[season] && DATA.traitTexts[trait]) {
      state.season = season;
      state.trait = trait;
      state.name = name || "あなた";
      resultRendered = false;
      renderResult();
    }
  })();
})();
