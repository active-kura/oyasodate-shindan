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
  // paper: #F6F1E6  paper-deep: #EFE7D8  ink: #3A4750  ink-soft: #6B7680
  // wakatake(green): #7FA98B  sakuranezu(rose): #C99A94  usugumo(blue-gray): #93A7B8  fuji(purple): #8C87A6
  var CARDS = [
    {
      lines: ["今日は、ここまでで、", "大丈夫です。"],
      accent: "#93A7B8",
      motif: "rain"
    },
    {
      lines: ["ここまで歩いてきた、", "その強さは、本物です。"],
      accent: "#C99A94",
      motif: "path"
    },
    {
      lines: ["これでいいんです。", "今のあなたに、必要な学びが、", "ちゃんとここにあります。"],
      accent: "#7FA98B",
      motif: "light"
    }
  ];

  function renderCards() {
    var row = $("#cards-row");
    row.innerHTML = "";
    CARDS.forEach(function (card) {
      var el = document.createElement("div");
      el.className = "mini-card";
      el.style.background =
        "linear-gradient(160deg, " + card.accent + "cc, " + card.accent + "66), var(--paper)";
      var p = document.createElement("div");
      p.textContent = card.lines.join("\n");
      p.style.whiteSpace = "pre-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "画像を保存";
      btn.addEventListener("click", function () {
        downloadCard(card);
      });
      el.appendChild(p);
      el.appendChild(btn);
      row.appendChild(el);
    });
  }

  function drawMotif(ctx, type, accent, w, h) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;

    if (type === "rain") {
      ctx.globalAlpha = 0.16;
      [[0.32, 0.24, 130], [0.5, 0.20, 100], [0.66, 0.25, 115]].forEach(function (c) {
        ctx.beginPath();
        ctx.arc(w * c[0], h * c[1], c[2], 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      var drops = [[0.30, 0.40], [0.42, 0.46], [0.54, 0.40], [0.62, 0.48], [0.70, 0.42]];
      drops.forEach(function (d, i) {
        var x = w * d[0], y0 = h * d[1], len = 46 + (i % 2) * 18;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x - 10, y0 + len);
        ctx.stroke();
      });

    } else if (type === "path") {
      ctx.globalAlpha = 0.20;
      var pts = [
        [0.18, 0.86], [0.27, 0.80], [0.36, 0.83], [0.45, 0.76],
        [0.54, 0.79], [0.63, 0.72], [0.72, 0.75], [0.81, 0.68]
      ];
      pts.forEach(function (p, i) {
        ctx.beginPath();
        ctx.ellipse(w * p[0], h * p[1], i % 2 === 0 ? 15 : 11, i % 2 === 0 ? 22 : 16, -0.4, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (type === "light") {
      var cx = w * 0.78, cy = h * 0.22;
      ctx.globalAlpha = 0.20;
      ctx.beginPath();
      ctx.arc(cx, cy, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 4;
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190);
        ctx.lineTo(cx + Math.cos(a) * 250, cy + Math.sin(a) * 250);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function wrapAndDraw(ctx, text, cx, cy, maxWidth, lineHeight) {
    var paragraphs = text.split("\n");
    var lines = [];
    paragraphs.forEach(function (p) {
      if (ctx.measureText(p).width <= maxWidth) {
        lines.push(p);
        return;
      }
      var chars = p.split("");
      var line = "";
      chars.forEach(function (ch) {
        var test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);
    });
    var startY = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(function (line, i) {
      ctx.fillText(line, cx, startY + i * lineHeight);
    });
    return lines.length;
  }

  function downloadCard(card) {
    var canvas = $("#card-canvas");
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;

    ctx.fillStyle = "#F6F1E6";
    ctx.fillRect(0, 0, w, h);

    var base = ctx.createRadialGradient(w * 0.5, h * 0.62, 60, w * 0.5, h * 0.62, w * 0.85);
    base.addColorStop(0, "#FBF8F1");
    base.addColorStop(1, "#EFE7D8");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    drawMotif(ctx, card.motif, card.accent, w, h);

    ctx.strokeStyle = "#3A475026";
    ctx.lineWidth = 2;
    ctx.strokeRect(54, 54, w - 108, h - 108);
    ctx.strokeStyle = "#3A475014";
    ctx.strokeRect(66, 66, w - 132, h - 132);

    ctx.fillStyle = card.accent;
    ctx.textAlign = "center";
    ctx.font = "500 26px 'Zen Kaku Gothic New', sans-serif";
    ctx.globalAlpha = 0.9;
    ctx.fillText("親 育 て 診 断", w / 2, h * 0.30);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#3A4750";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 58px 'Hiragino Mincho ProN', 'Yu Mincho', serif";
    wrapAndDraw(ctx, card.lines.join("\n"), w / 2, h * 0.52, w - 220, 90);

    ctx.strokeStyle = "#3A475030";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.855);
    ctx.lineTo(w * 0.58, h * 0.855);
    ctx.stroke();

    ctx.fillStyle = "#6B7680";
    ctx.font = "400 24px 'Zen Kaku Gothic New', sans-serif";
    ctx.fillText("なおみよワークショップ研究所", w / 2, h * 0.90);

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
