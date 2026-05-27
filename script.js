(function () {
  const ROWS = 6;
  const COLS = 5;
  // Day 0 is the first puzzle. Change START_DATE to reset the rotation.
  const START_DATE = new Date(2026, 4, 25); // 2026-05-25 (month is 0-indexed)

  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const messageEl = document.getElementById("message");
  const puzzleInfoEl = document.getElementById("puzzle-info");

  const dayIndex = computeDayIndex();
  const dateKey = formatDateKey(new Date());
  const target = WORDS[((dayIndex % WORDS.length) + WORDS.length) % WORDS.length];
  // Guess validation uses the larger dictionary; the answer pool stays curated in words.js.
  const validSet = DICTIONARY;

  const state = loadState() || {
    date: dateKey,
    guesses: [],
    status: "playing", // "playing" | "won" | "lost"
  };

  // If saved state is from another day, reset.
  if (state.date !== dateKey) {
    state.date = dateKey;
    state.guesses = [];
    state.status = "playing";
    saveState();
  }

  let current = "";

  renderInfo();
  buildBoard();
  buildKeyboard();
  replayState();
  bindInput();

  if (state.status !== "playing") {
    showMessage(state.status === "won" ? "축하해요! 🎉" : `정답: ${target.toUpperCase()}`);
  }

  // ---------- setup ----------

  function computeDayIndex() {
    const now = new Date();
    const a = Date.UTC(START_DATE.getFullYear(), START_DATE.getMonth(), START_DATE.getDate());
    const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((b - a) / 86400000);
  }

  function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function renderInfo() {
    puzzleInfoEl.textContent = `#${dayIndex + 1} · ${dateKey}`;
  }

  function buildBoard() {
    for (let r = 0; r < ROWS; r++) {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.row = String(r);
      for (let c = 0; c < COLS; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        row.appendChild(tile);
      }
      boardEl.appendChild(row);
    }
  }

  function buildKeyboard() {
    const rows = [
      ["q","w","e","r","t","y","u","i","o","p"],
      ["a","s","d","f","g","h","j","k","l"],
      ["ENTER","z","x","c","v","b","n","m","BACK"],
    ];
    rows.forEach(keys => {
      const row = document.createElement("div");
      row.className = "kb-row";
      keys.forEach(k => {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.dataset.key = k;
        btn.textContent = k === "BACK" ? "⌫" : k;
        if (k === "ENTER" || k === "BACK") btn.classList.add("wide");
        btn.addEventListener("click", () => handleKey(k));
        row.appendChild(btn);
      });
      keyboardEl.appendChild(row);
    });
  }

  function bindInput() {
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Enter") { handleKey("ENTER"); e.preventDefault(); return; }
      if (k === "Backspace") { handleKey("BACK"); e.preventDefault(); return; }
      if (/^[a-zA-Z]$/.test(k)) { handleKey(k.toLowerCase()); e.preventDefault(); }
    });
  }

  // ---------- gameplay ----------

  function handleKey(k) {
    if (state.status !== "playing") return;
    clearMessage();
    if (k === "ENTER") return submitGuess();
    if (k === "BACK") {
      current = current.slice(0, -1);
      paintCurrent();
      return;
    }
    if (/^[a-z]$/.test(k) && current.length < COLS) {
      current += k;
      paintCurrent();
    }
  }

  function paintCurrent() {
    const row = state.guesses.length;
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(row, c);
      const ch = current[c] || "";
      tile.textContent = ch;
      tile.classList.toggle("filled", !!ch);
    }
  }

  function submitGuess() {
    if (current.length < COLS) {
      shakeRow(state.guesses.length);
      showMessage("5글자를 모두 입력해주세요", true);
      return;
    }
    if (!validSet.has(current)) {
      shakeRow(state.guesses.length);
      showMessage("단어 목록에 없어요", true);
      return;
    }

    const guess = current;
    const result = scoreGuess(guess, target);
    state.guesses.push({ word: guess, result });
    current = "";

    paintRow(state.guesses.length - 1, guess, result);
    updateKeyboard(guess, result);

    if (guess === target) {
      state.status = "won";
      saveState();
      setTimeout(() => showMessage("축하해요! 🎉"), 500);
      return;
    }

    if (state.guesses.length >= ROWS) {
      state.status = "lost";
      saveState();
      setTimeout(() => showMessage(`정답: ${target.toUpperCase()}`), 500);
      return;
    }

    saveState();
  }

  // Standard Wordle scoring: greens first, then yellows from remaining letters.
  function scoreGuess(guess, answer) {
    const res = new Array(COLS).fill("absent");
    const remain = {};
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        res[i] = "correct";
      } else {
        remain[answer[i]] = (remain[answer[i]] || 0) + 1;
      }
    }
    for (let i = 0; i < COLS; i++) {
      if (res[i] === "correct") continue;
      const g = guess[i];
      if (remain[g] > 0) {
        res[i] = "present";
        remain[g]--;
      }
    }
    return res;
  }

  function paintRow(rowIdx, guess, result, animate = true) {
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(rowIdx, c);
      tile.textContent = guess[c];
      tile.classList.add("filled");
      const apply = () => {
        tile.classList.remove("correct", "present", "absent");
        tile.classList.add(result[c]);
      };
      if (animate) {
        setTimeout(() => {
          tile.classList.add("flip");
          setTimeout(apply, 250);
          setTimeout(() => tile.classList.remove("flip"), 500);
        }, c * 250);
      } else {
        apply();
      }
    }
  }

  function updateKeyboard(guess, result) {
    // Priority: correct > present > absent. Don't downgrade.
    const priority = { correct: 3, present: 2, absent: 1 };
    for (let i = 0; i < COLS; i++) {
      const key = keyboardEl.querySelector(`.key[data-key="${guess[i]}"]`);
      if (!key) continue;
      const next = result[i];
      const currentState = key.classList.contains("correct") ? "correct"
        : key.classList.contains("present") ? "present"
        : key.classList.contains("absent") ? "absent"
        : null;
      if (!currentState || priority[next] > priority[currentState]) {
        key.classList.remove("correct", "present", "absent");
        key.classList.add(next);
      }
    }
  }

  function replayState() {
    state.guesses.forEach((g, i) => paintRow(i, g.word, g.result, false));
    state.guesses.forEach(g => updateKeyboard(g.word, g.result));
  }

  // ---------- helpers ----------

  function tileAt(r, c) {
    return boardEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
  }

  function shakeRow(rowIdx) {
    const row = boardEl.querySelector(`.row[data-row="${rowIdx}"]`);
    if (!row) return;
    row.querySelectorAll(".tile").forEach(t => {
      t.classList.add("shake");
      setTimeout(() => t.classList.remove("shake"), 400);
    });
  }

  function showMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.classList.toggle("error", isError);
  }

  function clearMessage() {
    messageEl.textContent = "";
    messageEl.classList.remove("error");
  }

  function saveState() {
    try {
      localStorage.setItem("family-wordle-state", JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem("family-wordle-state");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
})();
