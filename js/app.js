(function () {
  var letters = ALFABET.letters;
  var KEY = "alfabetkowo-v1";
  var PASTELS = ["#ffc2cc", "#ffd3a8", "#ffe9a0", "#c8f2b0", "#a8efe6", "#c5dcff", "#ddd0ff", "#ffc8ea"];
  var MODE_KEY = { listen: "heard", reveal: "revealed", speak: "spoken", find: "found" };
  var COACH = {
    listen: "Dotknij literki, a Sówka ją powie.",
    reveal: "Dotknij pustego miejsca, a literka się pojawi.",
    speak: "Dotknij pustego miejsca, posłuchaj i powtórz.",
    find: "Posłuchaj i wybierz dobrą literkę."
  };
  var WIN = {
    listen: "Super! Wszystkie literki mają swój głos.",
    reveal: "Wszystkie literki odkryte!",
    speak: "Pięknie mówisz wszystkie literki!",
    find: "Wszystkie literki znalezione!"
  };

  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var audioCtx = null;
  var speakGen = 0;
  var rec = null;
  var recGen = 0;
  var lastSpeech = "";
  var justPopped = null;
  var justShaken = null;
  var current = null;
  var attempts = 0;
  var wakeLock = null;
  var round = { choices: [], target: null, misses: 0 };

  var state = load();

  var grid = document.getElementById("grid");
  var coach = document.getElementById("coach");
  var meterFill = document.getElementById("meterFill");
  var meterText = document.getElementById("meterText");
  var starCount = document.getElementById("starCount");
  var todayCount = document.getElementById("todayCount");
  var owl = document.getElementById("owl");
  var donePanel = document.getElementById("donePanel");
  var welcome = document.getElementById("welcome");
  var speakModal = document.getElementById("speakModal");
  var infoModal = document.getElementById("infoModal");
  var completeModal = document.getElementById("completeModal");
  var resetModal = document.getElementById("resetModal");
  var bigLetter = document.getElementById("bigLetter");
  var bigLower = document.getElementById("bigLower");
  var bigWord = document.getElementById("bigWord");
  var micBtn = document.getElementById("micBtn");
  var micStatus = document.getElementById("micStatus");
  var heardLine = document.getElementById("heardLine");
  var btnManual = document.getElementById("btnManual");
  var winText = document.getElementById("winText");
  var pageUrl = document.getElementById("pageUrl");

  function blank() {
    return {
      mode: "listen",
      stars: 0,
      sound: true,
      lower: true,
      welcomed: false,
      heard: [],
      revealed: [],
      spoken: [],
      found: [],
      badges: {},
      day: "",
      today: 0
    };
  }

  function localDay() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function cleanList(arr) {
    var ok = {};
    letters.forEach(function (l) { ok[l.ch] = true; });
    return (Array.isArray(arr) ? arr : []).filter(function (ch) { return ok[ch]; });
  }

  function load() {
    var data = blank();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") {
        data.stars = Number(raw.stars) || 0;
        data.sound = raw.sound !== false;
        data.lower = raw.lower !== false;
        data.welcomed = !!raw.welcomed;
        data.heard = cleanList(raw.heard);
        data.revealed = cleanList(raw.revealed);
        data.spoken = cleanList(raw.spoken);
        data.found = cleanList(raw.found);
        data.badges = raw.badges || {};
        data.day = raw.day || "";
        data.today = Number(raw.today) || 0;
      }
    } catch (e) { /* zostaw pusty stan */ }
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* prywatny tryb */ }
  }

  function ensureDay() {
    var day = localDay();
    if (state.day !== day) {
      state.day = day;
      state.today = 0;
    }
  }

  function letterBy(ch) {
    for (var i = 0; i < letters.length; i++) {
      if (letters[i].ch === ch) return letters[i];
    }
    return null;
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, t, dur) {
    if (!audioCtx) return;
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function blip() {
    if (!state.sound || !audioCtx) return;
    tone(680, audioCtx.currentTime, 0.05);
  }

  function ding(big) {
    if (!state.sound || !audioCtx) return;
    var t = audioCtx.currentTime;
    tone(523, t, 0.12);
    tone(659, t + 0.09, 0.12);
    tone(784, t + 0.18, 0.16);
    if (big) tone(1046, t + 0.3, 0.22);
  }

  function buzz() {
    if (!state.sound || !audioCtx) return;
    tone(180, audioCtx.currentTime, 0.14);
  }

  function pickVoice() {
    var voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    var pl = voices.filter(function (v) { return /pl/i.test(v.lang); });
    return pl.filter(function (v) { return /zosia|paulina|female|kobieta/i.test(v.name); })[0] || pl[0] || null;
  }

  function speak(text, opts) {
    opts = opts || {};
    var my = ++speakGen;
    lastSpeech = text || lastSpeech;
    function finish() {
      if (my !== speakGen) return;
      if (opts.onend) opts.onend();
    }
    if (!text || !state.sound || !window.speechSynthesis) {
      finish();
      return;
    }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "pl-PL";
    u.rate = opts.slow ? 0.78 : 0.9;
    u.pitch = 1.05;
    var voice = pickVoice();
    if (voice) u.voice = voice;
    u.onend = finish;
    u.onerror = finish;
    var apple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    if (apple) window.speechSynthesis.speak(u);
    else setTimeout(function () {
      if (my !== speakGen) return;
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
    }, 40);
  }

  function confetti(n) {
    var colors = ["#ff5d73", "#ffb703", "#6ec8ff", "#7bd67a", "#b388eb", "#ff8a3d"];
    for (var i = 0; i < n; i++) {
      var bit = document.createElement("span");
      bit.className = "confetti";
      bit.setAttribute("aria-hidden", "true");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colors[i % colors.length];
      bit.style.width = (6 + Math.random() * 8) + "px";
      bit.style.height = (8 + Math.random() * 10) + "px";
      bit.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      bit.style.animationDelay = (Math.random() * 0.15) + "s";
      bit.style.animationDuration = (0.9 + Math.random() * 0.6) + "s";
      document.body.appendChild(bit);
      setTimeout(function (el) { el.remove(); }, 1600, bit);
    }
  }

  function hop(cls) {
    owl.classList.add(cls);
    setTimeout(function () { owl.classList.remove(cls); }, cls === "is-listen" ? 2000 : 700);
  }

  function stayAwake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
    }).catch(function () {});
  }

  function setCoach(text, phrase) {
    coach.textContent = text;
    coach.classList.toggle("is-phrase", !!phrase);
  }

  function progressKey() {
    return MODE_KEY[state.mode];
  }

  function isKnown(letter) {
    if (state.mode === "listen" || state.mode === "find") return true;
    return state[progressKey()].indexOf(letter.ch) !== -1;
  }

  function nextCh() {
    if (state.mode !== "reveal" && state.mode !== "speak") return null;
    var key = progressKey();
    for (var i = 0; i < letters.length; i++) {
      if (state[key].indexOf(letters[i].ch) === -1) return letters[i].ch;
    }
    return null;
  }

  function mark(key, ch) {
    if (state[key].indexOf(ch) !== -1) return { added: false, complete: false };
    ensureDay();
    state[key].push(ch);
    state.stars += 1;
    state.today += 1;
    var complete = state[key].length === letters.length;
    if (complete) {
      state.badges[key] = true;
      state.stars += 5;
    }
    save();
    return { added: true, complete: complete };
  }

  function updateChrome() {
    starCount.textContent = "⭐ " + state.stars;
    todayCount.textContent = "dziś " + state.today;
    var count = state[progressKey()].length;
    meterFill.style.width = (count / letters.length * 100) + "%";
    meterText.textContent = count + " z " + letters.length;
    document.querySelectorAll(".modes button").forEach(function (btn) {
      var mode = btn.dataset.mode;
      btn.classList.toggle("is-active", mode === state.mode);
      btn.setAttribute("aria-pressed", mode === state.mode ? "true" : "false");
      btn.classList.toggle("is-done", !!state.badges[MODE_KEY[mode]]);
    });
    document.getElementById("btnSound").textContent = state.sound ? "🔊" : "🔇";
    document.getElementById("btnSound").setAttribute("aria-pressed", state.sound ? "true" : "false");
    document.getElementById("btnCase").setAttribute("aria-pressed", state.lower ? "true" : "false");
    document.getElementById("btnSound").setAttribute("aria-label", state.sound ? "Wyłącz dźwięk" : "Włącz dźwięk");
    document.getElementById("btnCase").setAttribute("aria-label", state.lower ? "Ukryj małe literki" : "Pokaż małe literki");
  }

  function tileEl(letter, guide) {
    var known = isKnown(letter);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    if (!known) btn.classList.add("is-empty");
    if (letter.ch === guide) btn.classList.add("is-next");
    if (letter.ch === justPopped) btn.classList.add("is-pop");
    if (letter.ch === justShaken) btn.classList.add("is-shake");
    if (state.mode === "find" && round.misses >= 2 && round.target && letter.ch === round.target.ch) {
      btn.classList.add("is-hint");
    }
    btn.dataset.ch = letter.ch;
    btn.style.setProperty("--tile", PASTELS[letter.i % PASTELS.length]);
    btn.setAttribute("aria-label", known ? ("Litera " + letter.ch + ", " + letter.word) : "Puste miejsce");
    if (known) {
      var pair = document.createElement("span");
      pair.className = "pair";
      var glyph = document.createElement("span");
      glyph.className = "glyph";
      glyph.textContent = letter.ch;
      pair.appendChild(glyph);
      if (state.lower) {
        var small = document.createElement("span");
        small.className = "small";
        small.textContent = letter.lower;
        pair.appendChild(small);
      }
      btn.appendChild(pair);
      var emo = document.createElement("span");
      emo.className = "emo";
      emo.textContent = letter.emoji;
      emo.setAttribute("aria-hidden", "true");
      btn.appendChild(emo);
    } else {
      var mystery = document.createElement("span");
      mystery.className = "mystery";
      mystery.textContent = "✦";
      mystery.setAttribute("aria-hidden", "true");
      btn.appendChild(mystery);
    }
    return btn;
  }

  function render() {
    var findDone = state.mode === "find" && state.found.length === letters.length;
    grid.className = "grid mode-" + (state.mode === "find" && !findDone ? "find" : "all");
    if (findDone) {
      grid.hidden = true;
      donePanel.hidden = false;
      return;
    }
    grid.hidden = false;
    donePanel.hidden = true;
    var list = state.mode === "find" ? round.choices : letters;
    var guide = nextCh();
    var poppedNow = justPopped;
    var shakenNow = justShaken;
    var nodes = document.createDocumentFragment();
    list.forEach(function (letter) { nodes.appendChild(tileEl(letter, guide)); });
    grid.replaceChildren(nodes);
    if (poppedNow || shakenNow) {
      setTimeout(function () {
        if (justPopped === poppedNow) justPopped = null;
        if (justShaken === shakenNow) justShaken = null;
      }, 520);
    }
  }

  function winFx() {
    confetti(80);
    ding(true);
    hop("is-happy");
    winText.textContent = WIN[state.mode];
    completeModal.hidden = false;
  }

  function softFx() {
    confetti(12);
    ding(false);
    hop("is-happy");
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function deal() {
    var pool = letters.filter(function (l) { return state.found.indexOf(l.ch) === -1; });
    if (!pool.length) {
      round = { choices: [], target: null, misses: 0 };
      return;
    }
    var target = pool[Math.floor(Math.random() * pool.length)];
    var decoys = letters.filter(function (l) {
      return l.ch !== target.ch && state.found.indexOf(l.ch) === -1;
    });
    if (decoys.length < 3) {
      letters.forEach(function (l) {
        if (l.ch !== target.ch && decoys.indexOf(l) === -1) decoys.push(l);
      });
    }
    shuffle(decoys);
    round = {
      target: target,
      choices: shuffle([target].concat(decoys.slice(0, 3))),
      misses: 0
    };
  }

  function promptTarget() {
    var t = round.target;
    if (!t) return;
    if (round.misses >= 2) {
      setCoach(t.caption + " " + t.emoji, true);
      speak(t.speech, { slow: true });
    } else {
      setCoach("Gdzie jest literka " + t.name + "?", true);
      speak("Gdzie jest literka " + t.name + "?");
    }
  }

  function setMode(mode, speakNow) {
    closeSpeak();
    state.mode = mode;
    if (mode === "find" && state.found.length < letters.length &&
        (!round.target || state.found.indexOf(round.target.ch) !== -1)) {
      deal();
    }
    render();
    updateChrome();
    if (mode === "find" && round.target) {
      if (speakNow) promptTarget();
      else setCoach(COACH.find, false);
    } else if (state[progressKey()].length === letters.length && mode !== "find") {
      setCoach(WIN[mode], true);
    } else {
      setCoach(COACH[mode], false);
    }
  }

  function onListen(letter) {
    var res = mark("heard", letter.ch);
    justPopped = letter.ch;
    render();
    updateChrome();
    setCoach(letter.caption + " " + letter.emoji, true);
    var tail = res.complete ? " Brawo! To już całe abecadło!" : "";
    speak(letter.speech + tail);
    if (res.complete) winFx();
    else if (res.added) blip();
    else blip();
  }

  function onReveal(letter) {
    var was = state.revealed.indexOf(letter.ch) !== -1;
    var res = was ? { added: false, complete: false } : mark("revealed", letter.ch);
    if (!was) justPopped = letter.ch;
    render();
    updateChrome();
    setCoach(letter.caption + " " + letter.emoji, true);
    speak(letter.speech + (res.complete ? " Brawo! To już całe abecadło!" : ""));
    if (res.complete) winFx();
    else if (res.added) softFx();
    else blip();
  }

  function onFind(letter) {
    if (!round.target) return;
    if (letter.ch === round.target.ch) {
      var res = mark("found", letter.ch);
      justPopped = letter.ch;
      if (res.complete) {
        render();
        updateChrome();
        setCoach(WIN.find, true);
        speak("Brawo! Znasz całe abecadło!");
        winFx();
        return;
      }
      deal();
      render();
      updateChrome();
      softFx();
      if (round.target) {
        setCoach("Tak! Gdzie jest literka " + round.target.name + "?", true);
        speak("Tak! Gdzie jest literka " + round.target.name + "?");
      }
      return;
    }
    justShaken = letter.ch;
    round.misses += 1;
    buzz();
    hop("is-oops");
    render();
    promptTarget();
  }

  function setMic(on) {
    micBtn.classList.toggle("is-on", on);
    micBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function stopRec() {
    recGen += 1;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        rec.abort();
      } catch (e) { /* już zatrzymane */ }
      rec = null;
    }
    setMic(false);
  }

  function judgeAll(letter, texts) {
    var nearText = "";
    var any = "";
    for (var i = 0; i < texts.length; i++) {
      var text = String(texts[i] || "").trim();
      if (!text) continue;
      if (!any) any = text;
      var result = ALFABET.judge(letter, text);
      if (result === "ok") return { result: "ok", text: text };
      if (result === "near" && !nearText) nearText = text;
    }
    if (nearText) return { result: "near", text: nearText };
    if (!any) return { result: "empty", text: "" };
    return { result: "no", text: any };
  }

  function succeedSpeak(letter) {
    stopRec();
    speakGen += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    micStatus.textContent = "Tak!";
    softFx();
    setTimeout(function () {
      var res = mark("spoken", letter.ch);
      closeSpeak();
      justPopped = letter.ch;
      render();
      updateChrome();
      setCoach(letter.caption + " " + letter.emoji, true);
      if (res.complete) {
        speak("Brawo! Pięknie mówisz całe abecadło!");
        winFx();
      } else if (state.spoken.length % 8 === 0) {
        speak("Brawo!");
      }
    }, 420);
  }

  function failSpeak(letter, message, heard) {
    stopRec();
    micStatus.textContent = message;
    heardLine.textContent = heard ? ("Usłyszałam: " + heard.slice(0, 70)) : "";
    buzz();
    hop("is-oops");
    attempts += 1;
    if (attempts >= 3) {
      micStatus.textContent = message + " Naciśnij mikrofon.";
      return;
    }
    speak(message + " " + letter.name, {
      slow: true,
      onend: function () {
        setTimeout(function () {
          if (!speakModal.hidden) startRec(letter);
        }, 260);
      }
    });
  }

  function startRec(letter, echoTries) {
    if (!Rec) {
      btnManual.hidden = false;
      micStatus.textContent = "Powiedz literkę na głos i naciśnij gwiazdkę.";
      return;
    }
    echoTries = echoTries || 0;
    stopRec();
    var my = recGen;
    var recognition = new Rec();
    rec = recognition;
    recognition.lang = "pl-PL";
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = false;
    var started = performance.now();
    var restart = false;
    setMic(true);
    micStatus.textContent = "Teraz ty!";
    heardLine.textContent = "";
    var timer = setTimeout(function () {
      if (my !== recGen || speakModal.hidden) return;
      stopRec();
      micStatus.textContent = "Naciśnij mikrofon i powiedz literkę.";
    }, 8000);

    recognition.onresult = function (event) {
      if (my !== recGen) return;
      var interim = "";
      var finals = [];
      for (var i = 0; i < event.results.length; i++) {
        var result = event.results[i];
        if (result.isFinal) {
          for (var j = 0; j < result.length; j++) finals.push(result[j].transcript);
        } else if (result[0]) {
          interim += result[0].transcript;
        }
      }
      if (interim) heardLine.textContent = interim;
      if (!finals.length) return;
      clearTimeout(timer);
      if (performance.now() - started < 650 && echoTries < 1) {
        restart = true;
        return;
      }
      var judged = judgeAll(letter, finals);
      if (judged.text) heardLine.textContent = "Usłyszałam: " + judged.text.slice(0, 70);
      if (judged.result === "ok") succeedSpeak(letter);
      else if (judged.result === "near") failSpeak(letter, letter.nearHint, judged.text);
      else if (judged.result === "empty") failSpeak(letter, "Nie słyszę. Powiedz głośniej.", "");
      else failSpeak(letter, "Jeszcze raz!", judged.text);
    };

    recognition.onerror = function (event) {
      if (my !== recGen) return;
      clearTimeout(timer);
      setMic(false);
      if (!event || event.error === "aborted") return;
      restart = false;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micStatus.textContent = "Mikrofon jest wyłączony. Powiedz literkę i naciśnij gwiazdkę.";
        btnManual.hidden = false;
        return;
      }
      if (event.error === "network") {
        micStatus.textContent = "Do słuchania potrzebny jest internet.";
        return;
      }
      if (event.error === "no-speech") {
        micStatus.textContent = "Nie słyszę. Naciśnij mikrofon i powiedz głośniej.";
        return;
      }
      micStatus.textContent = "Naciśnij mikrofon i spróbuj jeszcze raz.";
    };

    recognition.onend = function () {
      if (my !== recGen) return;
      setMic(false);
      if (restart && !speakModal.hidden) startRec(letter, echoTries + 1);
    };

    try { recognition.start(); }
    catch (e) {
      clearTimeout(timer);
      micStatus.textContent = "Naciśnij mikrofon i powiedz literkę.";
    }
  }

  function openSpeak(letter) {
    if (state.spoken.indexOf(letter.ch) !== -1) {
      blip();
      setCoach(letter.caption + " " + letter.emoji, true);
      speak(letter.speech);
      return;
    }
    current = letter;
    attempts = 0;
    btnManual.hidden = !!Rec;
    bigLetter.textContent = letter.ch;
    bigLower.textContent = state.lower ? letter.lower : "";
    bigWord.textContent = letter.emoji + " " + letter.word;
    micStatus.textContent = "Słuchaj…";
    heardLine.textContent = "";
    setMic(false);
    speakModal.hidden = false;
    owl.classList.add("is-listen");
    speak(letter.speech, {
      onend: function () {
        if (speakModal.hidden || current !== letter) return;
        if (!Rec) {
          micStatus.textContent = "Powiedz literkę na głos i naciśnij gwiazdkę.";
          btnManual.hidden = false;
          return;
        }
        setTimeout(function () {
          if (!speakModal.hidden && current === letter) startRec(letter);
        }, 280);
      }
    });
  }

  function closeSpeak() {
    stopRec();
    speakGen += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speakModal.hidden = true;
    owl.classList.remove("is-listen");
    current = null;
  }

  function onTile(letter) {
    unlockAudio();
    if (state.mode === "listen") onListen(letter);
    else if (state.mode === "reveal") onReveal(letter);
    else if (state.mode === "speak") openSpeak(letter);
    else onFind(letter);
  }

  function resetMode() {
    var key = progressKey();
    state[key] = [];
    state.badges[key] = false;
    if (state.mode === "find") deal();
    save();
    render();
    updateChrome();
    setCoach(COACH[state.mode], false);
    if (state.mode === "find" && round.target) promptTarget();
  }

  grid.addEventListener("click", function (event) {
    var btn = event.target.closest(".tile");
    if (!btn) return;
    var letter = letterBy(btn.dataset.ch);
    if (letter) onTile(letter);
  });

  document.querySelectorAll(".modes button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      unlockAudio();
      setMode(btn.dataset.mode, true);
    });
  });

  document.getElementById("btnSound").addEventListener("click", function () {
    state.sound = !state.sound;
    if (!state.sound && window.speechSynthesis) window.speechSynthesis.cancel();
    save();
    updateChrome();
  });

  document.getElementById("btnCase").addEventListener("click", function () {
    state.lower = !state.lower;
    save();
    render();
    updateChrome();
  });

  document.getElementById("btnInfo").addEventListener("click", function () {
    infoModal.hidden = false;
  });

  document.getElementById("btnInfoClose").addEventListener("click", function () {
    infoModal.hidden = true;
  });

  infoModal.addEventListener("click", function (event) {
    if (event.target === infoModal) infoModal.hidden = true;
  });

  document.getElementById("btnResetAsk").addEventListener("click", function () {
    infoModal.hidden = true;
    resetModal.hidden = false;
  });

  document.getElementById("btnResetNo").addEventListener("click", function () {
    resetModal.hidden = true;
  });

  document.getElementById("btnResetYes").addEventListener("click", function () {
    unlockAudio();
    resetModal.hidden = true;
    resetMode();
  });

  document.getElementById("btnReplay").addEventListener("click", function () {
    unlockAudio();
    if (state.mode === "find" && round.target) promptTarget();
    else if (lastSpeech) speak(lastSpeech);
    else speak(COACH[state.mode]);
  });

  document.getElementById("btnAgain").addEventListener("click", function () {
    unlockAudio();
    resetMode();
  });

  document.getElementById("btnWinAgain").addEventListener("click", function () {
    unlockAudio();
    completeModal.hidden = false;
    completeModal.hidden = true;
    resetMode();
  });

  document.getElementById("btnWinStay").addEventListener("click", function () {
    completeModal.hidden = true;
  });

  document.getElementById("btnStart").addEventListener("click", function () {
    unlockAudio();
    stayAwake();
    state.welcomed = true;
    save();
    welcome.hidden = true;
    speak("Cześć! Jestem Sówka. Dotknij literki.");
  });

  micBtn.addEventListener("click", function () {
    if (!current) return;
    unlockAudio();
    speakGen += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    startRec(current);
  });

  document.getElementById("btnHear").addEventListener("click", function () {
    if (!current) return;
    unlockAudio();
    stopRec();
    speak(current.speech, {
      slow: true,
      onend: function () {
        setTimeout(function () {
          if (current && !speakModal.hidden) startRec(current);
        }, 280);
      }
    });
  });

  document.getElementById("btnSpeakClose").addEventListener("click", closeSpeak);

  btnManual.addEventListener("click", function () {
    if (current) succeedSpeak(current);
  });

  window.addEventListener("contextmenu", function (event) {
    if (event.target.closest && event.target.closest(".tile, .mic, .modes")) event.preventDefault();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.welcomed) stayAwake();
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { pickVoice(); };
  }

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  pageUrl.textContent = "chopke20.github.io/alfabety";
  ensureDay();
  if (state.mode !== "listen" && state.mode !== "reveal" && state.mode !== "speak" && state.mode !== "find") {
    state.mode = "listen";
  }
  if (!state.welcomed) welcome.hidden = false;
  setMode(state.mode, false);
  updateChrome();
})();
