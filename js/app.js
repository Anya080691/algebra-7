"use strict";

/* =====================================================================
 *  Інтерактивний підручник з алгебри (7 клас)
 *  Без збірки та залежностей: відкривається як звичайний статичний сайт.
 *  Дані:   js/data.js (теми, тренажер, самоперевірка)
 *          js/textbooks.js (панель підручників)
 *          js/alt-solutions.js (розв'язання за різними підручниками)
 *          js/widgets.js (інтерактивні блоки)
 * ===================================================================== */

const LEVELS = {
  1: { text: "Початковий рівень", cls: "lvl-1" },
  2: { text: "Середній рівень", cls: "lvl-2" },
  3: { text: "Достатній рівень", cls: "lvl-3" },
  4: { text: "Високий рівень", cls: "lvl-4" }
};

const ALT = typeof ALT_SOLUTIONS !== "undefined" ? ALT_SOLUTIONS : {};
const MAP = typeof TEXTBOOK_MAP !== "undefined" ? TEXTBOOK_MAP : {};
const BOOKS = typeof TEXTBOOKS !== "undefined" ? TEXTBOOKS : [];
const bookById = (id) => BOOKS.find((b) => b.id === id);

/* ---------------------------------------------------------------------
 *  Прогрес учня (зберігається лише в браузері через localStorage)
 * --------------------------------------------------------------------- */
const Store = (() => {
  const KEY = "algebra7:v1";
  let memory = { ex: {}, exam: null, book: "" };

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return memory;
      const data = JSON.parse(raw);
      data.ex = data.ex || {};
      return data;
    } catch (e) {
      return memory;
    }
  }
  function write(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватний режим */ }
  }

  return {
    status(topicId, n) { return read().ex[topicId + ":" + n] || ""; },
    mark(topicId, n, value) {
      const s = read();
      if (value) s.ex[topicId + ":" + n] = value; else delete s.ex[topicId + ":" + n];
      write(s);
    },
    topicStats(topicId, total) {
      const s = read();
      let ok = 0, err = 0;
      for (let n = 1; n <= total; n++) {
        const v = s.ex[topicId + ":" + n];
        if (v === "ok") ok++; else if (v === "err") err++;
      }
      return { ok, err, total };
    },
    exam() { return read().exam; },
    saveExam(result) {
      const s = read();
      const best = s.exam && s.exam.best > result.score ? s.exam.best : result.score;
      s.exam = { best, last: result.score, grade: result.grade, date: new Date().toISOString() };
      write(s);
    },
    book() { return read().book || ""; },
    setBook(id) { const s = read(); s.book = id; write(s); },
    reset() { write({ ex: {}, exam: null, book: read().book || "" }); }
  };
})();

/* ---------------------------------------------------------------------
 *  Формули (MathJax)
 * --------------------------------------------------------------------- */
let mathQueue = Promise.resolve();
function renderMath(target) {
  const node = target || document.getElementById("contentArea");
  const run = () => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      const ready = window.MathJax.startup && window.MathJax.startup.promise
        ? window.MathJax.startup.promise : Promise.resolve();
      mathQueue = mathQueue
        .then(() => ready)
        .then(() => window.MathJax.typesetPromise([node]))
        .catch((err) => console.warn("MathJax:", err));
      return true;
    }
    return false;
  };
  if (!run()) {
    let tries = 0;
    const timer = setInterval(() => { if (run() || ++tries > 100) clearInterval(timer); }, 150);
  }
}
window.renderMath = renderMath;

/* ---------------------------------------------------------------------
 *  Допоміжні
 * --------------------------------------------------------------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const contentArea = () => $("#contentArea");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function topics() { return TEXTBOOK_DATA.topics; }
function topicIndexById(id) { return topics().findIndex((t) => t.id === id); }

/* ---------------------------------------------------------------------
 *  Маршрути: #/topic/3, #/topic/3/practice, #/exam, #/books
 * --------------------------------------------------------------------- */
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "exam") return { page: "exam" };
  if (parts[0] === "books") return { page: "books" };
  if (parts[0] === "topic") {
    const idx = parseInt(parts[1], 10);
    if (idx >= 0 && idx < topics().length) return { page: "topic", index: idx, tab: parts[2] === "practice" ? "practice" : "theory" };
  }
  return { page: "topic", index: 0, tab: "theory" };
}

let practiceFilter = "all";
let lastTopicIndex = -1;

function render() {
  const route = parseRoute();
  if (route.page === "topic") {
    if (route.index !== lastTopicIndex) practiceFilter = "all";
    lastTopicIndex = route.index;
    renderTopic(route.index, route.tab);
  } else if (route.page === "exam") {
    renderExam();
  } else {
    renderBooks();
  }
  renderSidebar(route);
  closeSidebar();
  window.scrollTo({ top: 0 });
  const area = contentArea();
  area.focus({ preventScroll: true });
}

/* ---------------------------------------------------------------------
 *  Бічна панель
 * --------------------------------------------------------------------- */
function renderSidebar(route) {
  const nav = $("#navList");
  let html = `<li class="nav-section">Теми курсу</li>`;
  topics().forEach((t, i) => {
    const st = Store.topicStats(t.id, t.exercises.length);
    const active = route.page === "topic" && route.index === i;
    html += `
      <li class="nav-item">
        <a class="nav-btn${active ? " active" : ""}" href="#/topic/${i}" ${active ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">${t.icon}</span>
          <span class="nav-text">${t.shortTitle}</span>
          <span class="nav-chip" title="Розв'язано правильно">${st.ok}/${st.total}</span>
        </a>
      </li>`;
  });

  const exam = Store.exam();
  html += `<li class="nav-section">Перевірка знань</li>
    <li class="nav-item">
      <a class="nav-btn exam-btn${route.page === "exam" ? " active" : ""}" href="#/exam" ${route.page === "exam" ? 'aria-current="page"' : ""}>
        <span class="nav-icon" aria-hidden="true">🎓</span>
        <span class="nav-text">Підсумкова самоперевірка (${TEXTBOOK_DATA.examQuestions.length} завдань)</span>
        ${exam ? `<span class="nav-chip">${exam.grade}/12</span>` : ""}
      </a>
    </li>
    <li class="nav-section">Довідка</li>
    <li class="nav-item">
      <a class="nav-btn${route.page === "books" ? " active" : ""}" href="#/books" ${route.page === "books" ? 'aria-current="page"' : ""}>
        <span class="nav-icon" aria-hidden="true">📚</span>
        <span class="nav-text">Панель підручників</span>
      </a>
    </li>`;
  nav.innerHTML = html;
}

function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#menuToggle").setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
}

/* ---------------------------------------------------------------------
 *  Сторінка теми
 * --------------------------------------------------------------------- */
function progressBarHTML(st) {
  const okPct = Math.round((st.ok / st.total) * 100);
  const errPct = Math.round((st.err / st.total) * 100);
  return `
    <div class="progress" data-progress>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${st.total}" aria-valuenow="${st.ok}" aria-label="Розв'язано правильно">
        <span class="progress-ok" style="width:${okPct}%"></span><span class="progress-err" style="width:${errPct}%"></span>
      </div>
      <div class="progress-label">Правильно: <strong>${st.ok}</strong> з ${st.total}${st.err ? ` · потребують повторення: <strong>${st.err}</strong>` : ""}</div>
    </div>`;
}

function myBookLineHTML(topic) {
  const bookId = Store.book();
  if (!bookId || !MAP[topic.id] || !MAP[topic.id][bookId]) return "";
  const b = bookById(bookId);
  return `<div class="my-book-line">📘 У підручнику «${esc(b ? b.short : bookId)}»: <strong>${esc(MAP[topic.id][bookId])}</strong></div>`;
}

function renderTopic(index, tab) {
  const topic = topics()[index];
  const st = Store.topicStats(topic.id, topic.exercises.length);

  const theoryPanel = `
    <div id="panel-theory">
      ${topic.theoryHTML}
      <div class="widgets" id="widgets"></div>
      <div class="next-row">
        <a class="submit-exam-btn as-link" href="#/topic/${index}/practice">Перейти до тренажера (${topic.exercises.length} задач) →</a>
      </div>
    </div>`;

  const practicePanel = `<div id="panel-practice">${practiceHTML(topic, index)}</div>`;

  contentArea().innerHTML = `
    <div class="topic-hero">
      <h2>${topic.title}</h2>
      <div class="meta-grid">
        <div class="meta-box"><strong>🎯 Мета навчання (компетентності):</strong>${topic.goal}</div>
        <div class="meta-box"><strong>🇺🇦 Індекс НУШ / групи результатів:</strong>${topic.nushIndex}</div>
      </div>
      ${myBookLineHTML(topic)}
      ${progressBarHTML(st)}
    </div>

    <nav class="topic-tabs" aria-label="Розділи теми">
      <a class="tab-btn${tab === "theory" ? " active" : ""}" href="#/topic/${index}" ${tab === "theory" ? 'aria-current="page"' : ""}>📖 Теорія та життєві приклади</a>
      <a class="tab-btn${tab === "practice" ? " active" : ""}" href="#/topic/${index}/practice" ${tab === "practice" ? 'aria-current="page"' : ""}>⚡ Тренажер (${topic.exercises.length} задач)</a>
    </nav>

    ${tab === "theory" ? theoryPanel : practicePanel}`;

  if (tab === "theory") initWidgets(topic);
  applyFilter();
  renderMath();
}

function initWidgets(topic) {
  const ids = (typeof WIDGETS_BY_TOPIC !== "undefined" && WIDGETS_BY_TOPIC[topic.id]) || [];
  const host = $("#widgets");
  ids.forEach((id) => {
    if (typeof WIDGETS === "undefined" || !WIDGETS[id]) return;
    const mount = document.createElement("div");
    mount.className = "widget-mount";
    host.appendChild(mount);
    WIDGETS[id](mount);
  });
}

/* ---------- Тренажер ---------- */
function solutionSources(topic, n) {
  const ex = topic.exercises[n - 1];
  const sources = [{ id: "base", label: "Покроково", html: ex.solution }];
  const alt = (ALT[topic.id] && ALT[topic.id][n]) || {};
  Object.keys(alt).forEach((bookId) => {
    const entry = alt[bookId];
    const book = bookById(bookId);
    const label = bookId === "other" ? (entry.title || "Інший спосіб") : (book ? book.short : bookId);
    let caption = "";
    if (book) {
      const meta = [book.authors, [book.publisher, book.year].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
      caption = `<div class="sol-source">За підходом підручника «${esc(book.short)}»${meta ? " — " + esc(meta) : ""}${entry.title ? ". " + esc(entry.title) : ""}</div>`;
    }
    sources.push({ id: bookId, label, html: caption + entry.html });
  });
  return sources;
}

function exerciseHTML(topic, n) {
  const ex = topic.exercises[n - 1];
  const lvl = LEVELS[ex.level];
  const status = Store.status(topic.id, n);
  const sources = solutionSources(topic, n);
  const preferred = Store.book();
  const activeId = sources.some((s) => s.id === preferred) ? preferred : "base";

  const tabs = sources.length > 1
    ? `<div class="sol-tabs" role="tablist" aria-label="Способи розв'язання">
        ${sources.map((s) => `<button type="button" role="tab" class="sol-tab${s.id === activeId ? " active" : ""}" aria-selected="${s.id === activeId}" data-action="sol-tab" data-src="${s.id}">${esc(s.label)}</button>`).join("")}
      </div>` : "";

  const panes = sources.map((s) => `<div class="sol-pane${s.id === activeId ? " active" : ""}" data-src="${s.id}">${s.html}</div>`).join("");

  return `
    <article class="exercise-item" id="ex-${n}" data-n="${n}" data-level="${ex.level}" data-status="${status}">
      <div class="ex-header">
        <strong>Приклад №${n}</strong>
        <span class="ex-header-right">
          <span class="ex-state" aria-live="polite">${stateLabel(status)}</span>
          <span class="ex-badge ${lvl.cls}">${lvl.text}</span>
        </span>
      </div>
      <div class="ex-task">${ex.task}</div>
      <div class="ex-actions">
        <button type="button" class="toggle-sol-btn" data-action="solution" aria-expanded="false" aria-controls="sol-${n}">💡 Показати розв'язання</button>
        <span class="self-check" role="group" aria-label="Самоперевірка">
          <button type="button" class="mark-btn mark-ok${status === "ok" ? " on" : ""}" data-action="mark" data-value="ok" aria-pressed="${status === "ok"}">✓ Розв'язав(ла) правильно</button>
          <button type="button" class="mark-btn mark-err${status === "err" ? " on" : ""}" data-action="mark" data-value="err" aria-pressed="${status === "err"}">✗ Не вийшло</button>
        </span>
      </div>
      <div class="solution-panel" id="sol-${n}">
        ${tabs}
        ${panes}
      </div>
    </article>`;
}

function stateLabel(status) {
  if (status === "ok") return "✓ зараховано";
  if (status === "err") return "↻ повторити";
  return "";
}

function practiceHTML(topic) {
  const total = topic.exercises.length;
  const hasAlt = ALT[topic.id] && Object.keys(ALT[topic.id]).length > 0;
  const filters = [
    ["all", "Усі"], ["1", "Початковий"], ["2", "Середній"], ["3", "Достатній"], ["4", "Високий"], ["todo", "Ще не зараховані"]
  ];
  let html = `
    <div class="exercise-controls">
      <div>
        <h3>✍️ Тренажер і самоперевірка (${total} завдань)</h3>
        <p class="muted">Розв'яжіть завдання в зошиті, позначте результат і лише потім відкрийте розв'язання.${hasAlt ? " Біля деяких завдань є вкладки з іншими способами розв'язання." : ""}</p>
      </div>
      <button type="button" class="toggle-sol-btn" data-action="toggle-all">👁️ Показати / сховати всі розв'язання</button>
    </div>
    <div class="filter-row" role="group" aria-label="Фільтр завдань">
      ${filters.map(([v, label]) => `<button type="button" class="filter-btn${practiceFilter === v ? " active" : ""}" data-action="filter" data-value="${v}" aria-pressed="${practiceFilter === v}">${label}</button>`).join("")}
    </div>
    <p class="empty-note" id="emptyNote" hidden>У цьому фільтрі немає завдань.</p>`;
  for (let n = 1; n <= total; n++) html += exerciseHTML(topic, n);
  html += `<div class="next-row"><button type="button" class="link-btn" data-action="reset-topic">Скинути позначки цієї теми</button></div>`;
  return html;
}

function applyFilter() {
  const items = document.querySelectorAll(".exercise-item");
  if (!items.length) return;
  let visible = 0;
  items.forEach((el) => {
    const show = practiceFilter === "all"
      || (practiceFilter === "todo" ? el.dataset.status !== "ok" : el.dataset.level === practiceFilter);
    el.classList.toggle("is-hidden", !show);
    if (show) visible++;
  });
  const note = $("#emptyNote");
  if (note) note.hidden = visible !== 0;
}

function refreshProgress(topic) {
  const st = Store.topicStats(topic.id, topic.exercises.length);
  const holder = $("[data-progress]");
  if (holder) holder.outerHTML = progressBarHTML(st);
  renderSidebar(parseRoute());
}

/* ---------------------------------------------------------------------
 *  Панель підручників
 * --------------------------------------------------------------------- */
function altCountByBook() {
  const counts = {};
  Object.keys(ALT).forEach((topicId) => {
    Object.keys(ALT[topicId]).forEach((n) => {
      Object.keys(ALT[topicId][n]).forEach((bookId) => { counts[bookId] = (counts[bookId] || 0) + 1; });
    });
  });
  return counts;
}

function renderBooks() {
  const mine = Store.book();
  const counts = altCountByBook();
  const cards = BOOKS.map((b) => {
    const meta = [b.publisher, b.year].filter(Boolean).join(", ");
    return `
      <article class="book-card${b.main ? " main" : ""}${mine === b.id ? " mine" : ""}">
        <div class="book-top">
          <h3>${esc(b.title)}</h3>
          ${b.main ? `<span class="pill pill-main">основний</span>` : ""}
          ${mine === b.id ? `<span class="pill pill-mine">ваш</span>` : ""}
        </div>
        <p class="book-authors">${b.authors ? esc(b.authors) : `<span class="muted">Автори не вказані</span>`}</p>
        ${meta ? `<p class="book-meta">${esc(meta)}</p>` : ""}
        ${b.note ? `<p class="book-note">${esc(b.note)}</p>` : ""}
        <p class="book-count">Розв'язань у застосунку: <strong>${counts[b.id] || 0}</strong></p>
      </article>`;
  }).join("");

  const head = `<tr><th scope="col">Тема курсу</th>${BOOKS.map((b) => `<th scope="col" class="${mine === b.id ? "mine-col" : ""}">${esc(b.short)}</th>`).join("")}</tr>`;
  const rows = topics().map((t, i) => `
    <tr>
      <th scope="row"><a href="#/topic/${i}">${t.shortTitle}</a></th>
      ${BOOKS.map((b) => {
        const v = MAP[t.id] && MAP[t.id][b.id];
        return `<td class="${mine === b.id ? "mine-col" : ""}">${v ? esc(v) : `<span class="muted">—</span>`}</td>`;
      }).join("")}
    </tr>`).join("");

  contentArea().innerHTML = `
    <div class="topic-hero">
      <h2>📚 Панель підручників</h2>
      <p class="muted-block">Тут зібрані підручники алгебри для 7 класу, до яких прив'язаний цей курс. Оберіть свій підручник — біля завдань відкриватиметься його спосіб розв'язання (якщо він доданий), а в темах з'явиться номер параграфа.</p>
      <div class="book-select">
        <label for="myBook">Мій підручник:</label>
        <select id="myBook" data-action="my-book">
          <option value="">— не обрано —</option>
          ${BOOKS.map((b) => `<option value="${b.id}"${mine === b.id ? " selected" : ""}>${esc(b.short)}${b.authors ? " — " + esc(b.authors.split(",")[0]) : ""}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="book-grid">${cards}</div>

    <div class="card">
      <h3>Де це в підручнику</h3>
      <p class="muted-block">Номери параграфів вписує вчитель у файлі <code>js/textbooks.js</code> (об'єкт <code>TEXTBOOK_MAP</code>). Порожні комірки означають, що відповідність ще не заповнена.</p>
      <div class="table-scroll">
        <table class="styled-table map-table"><thead>${head}</thead><tbody>${rows}</tbody></table>
      </div>
    </div>

    <div class="card">
      <h3>Джерела й авторські права</h3>
      <p class="muted-block">Перелік складено за відкритими джерелами; звіряйте його з офіційним переліком МОН та ІМЗО. Тексти, задачі й розв'язання з підручників у цей репозиторій не копіюються: способи розв'язання описані власними словами з посиланням на підручник і параграф.</p>
    </div>`;
  renderMath();
}

/* ---------------------------------------------------------------------
 *  Підсумкова самоперевірка
 * --------------------------------------------------------------------- */
function renderExam() {
  const questions = TEXTBOOK_DATA.examQuestions;
  const best = Store.exam();

  let html = `
    <div class="exam-header-card">
      <h2>🎓 Підсумкова самоперевірка з алгебри (7 клас)</h2>
      <p>Робота містить <strong>${questions.length} різнорівневих завдань</strong> (початковий, середній, достатній і високий рівні) за всіма темами курсу.</p>
      <p class="exam-sub">Кожне завдання — <strong>0,5 бала</strong>, максимум — <strong>12 балів</strong>. У завданнях із розгорнутою відповіддю ви самі оцінюєте розв'язання за еталоном.</p>
      ${best ? `<p class="exam-sub">Ваш найкращий результат: <strong>${best.best.toFixed(2).replace(".", ",")}</strong> з 12 балів.</p>` : ""}
    </div>`;

  questions.forEach((q) => {
    let input = "";
    if (q.type === "choice") {
      input = `<div class="options-list">` + q.options.map((opt, i) => `
        <label class="option-label"><input type="radio" name="q_${q.id}" value="${i}"><span>${opt}</span></label>`).join("") + `</div>`;
    } else if (q.type === "match") {
      input = `<div class="match-grid"><div>` + q.leftItems.map((left, i) => `
        <div class="match-row"><span>${left}</span>
          <select class="match-select" id="match_${q.id}_${i}" aria-label="Відповідність для пункту ${i + 1}">
            <option value="-1">Оберіть…</option><option value="0">А</option><option value="1">Б</option><option value="2">В</option><option value="3">Г</option>
          </select></div>`).join("") + `</div><div>` + q.rightOptions.map((r) => `<div class="match-right">${r}</div>`).join("") + `</div></div>`;
    } else if (q.type === "short") {
      input = `<div><input type="text" inputmode="decimal" autocomplete="off" class="short-input" id="short_${q.id}" placeholder="Введіть числову відповідь…" aria-label="Відповідь до завдання ${q.id}"></div>`;
    } else if (q.type === "open") {
      input = `
        <div>
          <textarea class="open-textarea" id="open_${q.id}" placeholder="Запишіть хід розв'язання та відповідь…" aria-label="Розв'язання завдання ${q.id}"></textarea>
          <div class="open-actions"><button type="button" class="toggle-sol-btn" data-action="reveal-sample" data-q="${q.id}">💡 Перевірити еталонне розв'язання</button></div>
          <div class="self-grade-box" id="sample_${q.id}">
            <strong>Еталонне розв'язання:</strong><br>${q.sampleSolution}
            <div class="self-grade-options">
              <strong>Самооцінка (оцінюйте чесно):</strong><br>
              <label><input type="radio" name="self_${q.id}" value="0.5"> Виконано повністю правильно (+0,5 б.)</label>
              <label><input type="radio" name="self_${q.id}" value="0.25"> Є незначна похибка (+0,25 б.)</label>
              <label><input type="radio" name="self_${q.id}" value="0" checked> Не виконано або помилка (0 б.)</label>
            </div>
          </div>
        </div>`;
    }

    html += `
      <section class="exam-question" id="card_q_${q.id}">
        <div class="q-top">
          <span class="q-num">Завдання №${q.id} <span class="q-nush">(${q.nush})</span></span>
          <div><span class="ex-badge ${q.levelClass}">${q.level}</span> <span class="q-points">${q.points} бала</span></div>
        </div>
        <div class="ex-task">${q.question}</div>
        ${input}
        <div class="q-feedback" id="fb_${q.id}"></div>
      </section>`;
  });

  html += `
    <div class="center-row"><button type="button" class="submit-exam-btn" data-action="grade-exam">✅ Завершити роботу та отримати оцінку</button></div>
    <div class="result-banner" id="resultBanner" tabindex="-1">
      <div class="grade-circle" id="finalGrade">12</div>
      <h3 id="resultTitle"></h3>
      <p id="resultDetails" class="muted-block"></p>
      <div id="resultLevels" class="level-breakdown"></div>
      <p id="resultCompetency"></p>
      <div class="center-row"><button type="button" class="toggle-sol-btn" data-action="retry-exam">↺ Пройти ще раз</button></div>
    </div>`;

  contentArea().innerHTML = html;
  renderMath();
}

function sameNumber(input, correct) {
  const norm = (s) => String(s).trim().replace(/\s+/g, "").replace(",", ".").replace("\u2212", "-");
  const a = norm(input);
  if (!/^-?\d+(\.\d+)?$/.test(a)) return false;
  return Math.abs(Number(a) - Number(norm(correct))) < 1e-9;
}

function setFeedback(fb, ok, html) {
  fb.style.display = "block";
  fb.className = "q-feedback " + (ok ? "fb-correct" : "fb-wrong");
  fb.innerHTML = html;
}

function gradeExam() {
  const questions = TEXTBOOK_DATA.examQuestions;
  let total = 0;
  const byLevel = {};

  questions.forEach((q) => {
    const fb = document.getElementById("fb_" + q.id);
    let earned = 0;

    if (q.type === "choice") {
      const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
      if (sel && parseInt(sel.value, 10) === q.correct) {
        earned = q.points;
        setFeedback(fb, true, `✅ <strong>Правильно! (+${q.points} б.)</strong> ${q.explanation}`);
      } else {
        setFeedback(fb, false, `❌ <strong>${sel ? "Помилка" : "Відповіді немає"} (0 б.).</strong> Правильна відповідь: <strong>${q.options[q.correct]}</strong>. ${q.explanation}`);
      }
    } else if (q.type === "match") {
      let right = 0;
      q.correctMatches.forEach((val, i) => {
        const sel = document.getElementById(`match_${q.id}_${i}`);
        if (sel && parseInt(sel.value, 10) === val) right++;
      });
      const n = q.correctMatches.length;
      earned = Number(((right / n) * q.points).toFixed(2));
      if (right === n) setFeedback(fb, true, `✅ <strong>Усі ${n} відповідності правильні! (+${q.points} б.)</strong> ${q.explanation}`);
      else if (right > 0) setFeedback(fb, false, `⚠️ <strong>Частково: ${right} з ${n} (+${earned} б.).</strong> ${q.explanation}`);
      else setFeedback(fb, false, `❌ <strong>Неправильно (0 б.).</strong> ${q.explanation}`);
    } else if (q.type === "short") {
      const value = document.getElementById("short_" + q.id).value;
      if (sameNumber(value, q.correctAnswer)) {
        earned = q.points;
        setFeedback(fb, true, `✅ <strong>Правильно! (+${q.points} б.)</strong> ${q.explanation}`);
      } else {
        setFeedback(fb, false, `❌ <strong>Неправильно (0 б.).</strong> Правильна відповідь: <strong>${q.correctAnswer}</strong>. ${q.explanation}`);
      }
    } else if (q.type === "open") {
      document.getElementById("sample_" + q.id).style.display = "block";
      const radio = document.querySelector(`input[name="self_${q.id}"]:checked`);
      earned = radio ? parseFloat(radio.value) : 0;
      setFeedback(fb, earned > 0, earned > 0
        ? `📝 <strong>За самооцінкою: +${earned} б.</strong> Звірте кожен крок з еталоном.`
        : `📝 <strong>Зараховано 0 б.</strong> Розгляньте еталон вище; за потреби змініть самооцінку та натисніть «Завершити роботу» ще раз.`);
    }

    total += earned;
    const key = q.level;
    byLevel[key] = byLevel[key] || { earned: 0, max: 0, cls: q.levelClass };
    byLevel[key].earned += earned;
    byLevel[key].max += q.points;
  });

  const grade = Math.max(1, Math.min(12, Math.round(total)));
  Store.saveExam({ score: total, grade });

  const banner = $("#resultBanner");
  banner.style.display = "block";
  $("#finalGrade").textContent = grade;
  $("#resultDetails").innerHTML = `Набрано балів: <strong>${total.toFixed(2).replace(".", ",")} з ${questions.reduce((s, q) => s + q.points, 0).toFixed(2).replace(".", ",")}</strong>. Оцінка за 12-бальною шкалою: <strong>${grade}</strong>.`;

  $("#resultLevels").innerHTML = Object.keys(byLevel).map((name) => {
    const l = byLevel[name];
    return `<div class="level-row"><span class="ex-badge ${l.cls}">${name}</span><span>${l.earned.toFixed(2).replace(".", ",")} з ${l.max.toFixed(2).replace(".", ",")}</span></div>`;
  }).join("");

  let title, text;
  if (grade >= 10) {
    title = "🏆 Високий рівень компетентностей!";
    text = "Ви впевнено володієте степенями, формулами скороченого множення, функціями та системами рівнянь.";
  } else if (grade >= 7) {
    title = "👍 Достатній рівень компетентностей";
    text = "Гарний результат! Перегляньте пояснення до завдань із помилками, щоб вийти на високий рівень.";
  } else if (grade >= 4) {
    title = "📘 Середній рівень компетентностей";
    text = "Повторіть теорію й пройдіть тренажер у темах, де були помилки.";
  } else {
    title = "🌱 Початковий рівень — час потренуватися!";
    text = "Поверніться до теми «Повторення (5–6 класи)» і розберіть приклади з розв'язаннями.";
  }
  $("#resultTitle").textContent = title;
  $("#resultCompetency").textContent = text;

  renderSidebar(parseRoute());
  banner.scrollIntoView({ behavior: "smooth", block: "center" });
  renderMath();
}

/* ---------------------------------------------------------------------
 *  Обробники подій (делегування)
 * --------------------------------------------------------------------- */
function currentTopic() {
  const route = parseRoute();
  return route.page === "topic" ? topics()[route.index] : null;
}

function handleClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.tagName === "SELECT") return;
  const action = btn.dataset.action;

  if (action === "solution") {
    const item = btn.closest(".exercise-item");
    const panel = $(".solution-panel", item);
    const open = panel.classList.toggle("visible");
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("opened", open);
    btn.textContent = open ? "🙈 Сховати розв'язання" : "💡 Показати розв'язання";
    if (open) renderMath(panel);
  } else if (action === "sol-tab") {
    const panel = btn.closest(".solution-panel");
    panel.querySelectorAll(".sol-tab").forEach((t) => {
      const on = t === btn;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    panel.querySelectorAll(".sol-pane").forEach((p) => p.classList.toggle("active", p.dataset.src === btn.dataset.src));
  } else if (action === "mark") {
    const topic = currentTopic();
    const item = btn.closest(".exercise-item");
    const n = parseInt(item.dataset.n, 10);
    const value = btn.dataset.value;
    const next = item.dataset.status === value ? "" : value;
    Store.mark(topic.id, n, next);
    item.dataset.status = next;
    $(".ex-state", item).textContent = stateLabel(next);
    item.querySelectorAll(".mark-btn").forEach((b) => {
      const on = b.dataset.value === next;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    refreshProgress(topic);
    applyFilter();
  } else if (action === "filter") {
    practiceFilter = btn.dataset.value;
    document.querySelectorAll(".filter-btn").forEach((b) => {
      const on = b.dataset.value === practiceFilter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    applyFilter();
  } else if (action === "toggle-all") {
    const panels = document.querySelectorAll(".exercise-item:not(.is-hidden) .solution-panel");
    const openAll = Array.from(panels).some((p) => !p.classList.contains("visible"));
    panels.forEach((p) => {
      p.classList.toggle("visible", openAll);
      const b = $(".toggle-sol-btn", p.closest(".exercise-item"));
      b.setAttribute("aria-expanded", String(openAll));
      b.classList.toggle("opened", openAll);
      b.textContent = openAll ? "🙈 Сховати розв'язання" : "💡 Показати розв'язання";
    });
    renderMath();
  } else if (action === "reset-topic") {
    const topic = currentTopic();
    if (topic && confirm("Скинути позначки в цій темі?")) {
      for (let n = 1; n <= topic.exercises.length; n++) Store.mark(topic.id, n, "");
      render();
    }
  } else if (action === "reveal-sample") {
    const box = document.getElementById("sample_" + btn.dataset.q);
    box.style.display = box.style.display === "block" ? "none" : "block";
    renderMath(box);
  } else if (action === "grade-exam") {
    gradeExam();
  } else if (action === "retry-exam") {
    renderExam();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function handleChange(e) {
  const el = e.target;
  if (el.dataset && el.dataset.action === "my-book") {
    Store.setBook(el.value);
    renderBooks();
    $("#myBook").focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  contentArea().addEventListener("click", handleClick);
  contentArea().addEventListener("change", handleChange);

  $("#menuToggle").addEventListener("click", () => {
    $("#sidebar").classList.contains("open") ? closeSidebar() : openSidebar();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });

  $("#resetProgress").addEventListener("click", () => {
    if (confirm("Видалити весь прогрес і результати самоперевірки в цьому браузері?")) {
      Store.reset();
      render();
    }
  });

  window.addEventListener("hashchange", render);
  render();
});
