#!/usr/bin/env node
/*
 * Перевірка даних підручника. Запуск:  node tools/validate.js
 * Не потребує жодних пакетів. Якщо в системі встановлено `katex`, додатково
 * перевіряється синтаксис кожної формули.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
function load(file, names) {
  const code = fs.readFileSync(path.join(root, file), "utf8") + "\n;({" + names.join(",") + "})";
  try { return vm.runInNewContext(code, {}, { filename: file }); }
  catch (e) { console.error("✗ Не вдалося прочитати " + file + ": " + e.message); process.exit(1); }
}

const { TEXTBOOK_DATA } = load("js/data.js", ["TEXTBOOK_DATA"]);
const { TEXTBOOKS, TEXTBOOK_MAP } = load("js/textbooks.js", ["TEXTBOOKS", "TEXTBOOK_MAP"]);
const { ALT_SOLUTIONS } = load("js/alt-solutions.js", ["ALT_SOLUTIONS"]);

let katex = null;
try { katex = require("katex"); } catch (e) { /* необов'язково */ }

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(where + ": " + msg);
const warn = (where, msg) => warnings.push(where + ": " + msg);
let formulas = 0;

function checkText(where, html) {
  if (typeof html !== "string" || !html.trim()) return err(where, "порожнє або відсутнє текстове поле");
  if (/[\u0008\u000b\u000c\u000d\t]/.test(html)) {
    err(where, "керувальний символ у тексті. Імовірно, у формулі пропущено подвоєння зворотного слеша (\\\\frac замість \\frac)");
  }
  const text = html.replace(/<br\s*\/?>/g, " ");
  const singles = (text.replace(/\$\$/g, "").match(/\$/g) || []).length;
  if (singles % 2) err(where, "непарна кількість знаків $ — формула не закрита");
  if (katex) {
    const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
    let m;
    while ((m = re.exec(text))) {
      formulas++;
      try { katex.renderToString(m[1] || m[2], { throwOnError: true, displayMode: !!m[1] }); }
      catch (e) { err(where, "формула «" + (m[1] || m[2]).slice(0, 60) + "»: " + e.message.slice(0, 80)); }
    }
  }
}

/* --- теми --- */
const topicIds = new Set();
TEXTBOOK_DATA.topics.forEach((t, ti) => {
  const w = "topics[" + ti + "]";
  if (!t.id) err(w, "немає id");
  if (topicIds.has(t.id)) err(w, "id повторюється: " + t.id);
  topicIds.add(t.id);
  ["title", "shortTitle", "goal", "nushIndex", "theoryHTML"].forEach((k) => checkText(w + "." + k, t[k]));
  if (!t.icon) err(w, "немає icon");
  if (!Array.isArray(t.exercises) || !t.exercises.length) return err(w, "немає exercises");
  if (t.exercises.length !== 18) warn(w, "у тренажері " + t.exercises.length + " завдань (очікувалось 18)");
  t.exercises.forEach((e, i) => {
    const we = (t.id || w) + ".exercises[" + (i + 1) + "]";
    if (![1, 2, 3, 4].includes(e.level)) err(we, "level має бути 1–4");
    checkText(we + ".task", e.task);
    checkText(we + ".solution", e.solution);
  });
});

/* --- самоперевірка --- */
const exam = TEXTBOOK_DATA.examQuestions;
if (exam.length < 20) warn("examQuestions", "лише " + exam.length + " завдань (рекомендовано 20+)");
const ids = new Set();
exam.forEach((q) => {
  const w = "exam#" + q.id;
  if (ids.has(q.id)) err(w, "id повторюється");
  ids.add(q.id);
  checkText(w + ".question", q.question);
  if (q.type === "choice") {
    if (!Array.isArray(q.options) || q.options.length < 2) err(w, "потрібні options");
    else if (!(q.correct >= 0 && q.correct < q.options.length)) err(w, "correct поза межами options");
    q.options && q.options.forEach((o, i) => checkText(w + ".options[" + i + "]", o));
    checkText(w + ".explanation", q.explanation);
  } else if (q.type === "match") {
    if (!q.leftItems || !q.rightOptions || !q.correctMatches) err(w, "потрібні leftItems, rightOptions, correctMatches");
    else if (q.correctMatches.length !== q.leftItems.length) err(w, "correctMatches має ту саму довжину, що leftItems");
    checkText(w + ".explanation", q.explanation);
  } else if (q.type === "short") {
    if (!/^-?\d+([.,]\d+)?$/.test(String(q.correctAnswer))) err(w, "correctAnswer має бути числом");
    checkText(w + ".explanation", q.explanation);
  } else if (q.type === "open") {
    checkText(w + ".sampleSolution", q.sampleSolution);
  } else err(w, "невідомий type: " + q.type);
});

/* --- панель підручників та альтернативні розв'язання --- */
const bookIds = new Set(TEXTBOOKS.map((b) => b.id));
TEXTBOOKS.forEach((b) => { if (!b.short) err("TEXTBOOKS." + b.id, "немає short"); });
Object.keys(TEXTBOOK_MAP).forEach((tid) => {
  if (!topicIds.has(tid)) err("TEXTBOOK_MAP", "невідома тема " + tid);
  Object.keys(TEXTBOOK_MAP[tid]).forEach((bid) => { if (!bookIds.has(bid)) err("TEXTBOOK_MAP." + tid, "невідомий підручник " + bid); });
});
Object.keys(ALT_SOLUTIONS).forEach((tid) => {
  const topic = TEXTBOOK_DATA.topics.find((t) => t.id === tid);
  if (!topic) return err("ALT_SOLUTIONS", "невідома тема " + tid);
  Object.keys(ALT_SOLUTIONS[tid]).forEach((n) => {
    if (!(n >= 1 && n <= topic.exercises.length)) err("ALT_SOLUTIONS." + tid, "немає завдання №" + n);
    Object.keys(ALT_SOLUTIONS[tid][n]).forEach((bid) => {
      const w = "ALT_SOLUTIONS." + tid + "[" + n + "]." + bid;
      if (bid !== "other" && !bookIds.has(bid)) err(w, "невідомий підручник");
      checkText(w + ".html", ALT_SOLUTIONS[tid][n][bid].html);
    });
  });
});

/* --- підсумок --- */
const exCount = TEXTBOOK_DATA.topics.reduce((s, t) => s + t.exercises.length, 0);
console.log("Тем: " + TEXTBOOK_DATA.topics.length + " · вправ у тренажері: " + exCount + " · завдань самоперевірки: " + exam.length +
  (katex ? " · формул перевірено: " + formulas : " · (katex не встановлено — формули не перевірялись)"));
warnings.forEach((w) => console.log("⚠ " + w));
if (errors.length) {
  errors.forEach((e) => console.error("✗ " + e));
  console.error("\nЗнайдено помилок: " + errors.length);
  process.exit(1);
}
console.log("✓ Дані коректні");
