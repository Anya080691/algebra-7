/*
 * ІНТЕРАКТИВНІ ВІДЖЕТИ
 * --------------------
 * Віджет — це функція, яка отримує порожній контейнер і сама будує в ньому
 * інтерактивний блок. Щоб додати віджет до теми:
 *   1) додайте функцію в об'єкт WIDGETS;
 *   2) вкажіть її id в WIDGETS_BY_TOPIC для потрібної теми.
 * Віджети показуються в кінці вкладки «Теорія».
 */
const WIDGETS_BY_TOPIC = {
  "topic-5": ["linear-graph"]
};

const WIDGETS = {
  "linear-graph": function (root) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const SIZE = 440, C = SIZE / 2, U = 20; // 20 px на одиницю, видно від -11 до 11

    const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",").replace("-", "\u2212");
    const px = (x) => C + x * U;
    const py = (y) => C - y * U;

    root.innerHTML = `
      <div class="widget-card">
        <h4>🎛️ Дослідіть лінійну функцію $y = kx + b$</h4>
        <p class="widget-hint">Рухайте повзунки й спостерігайте, як змінюється пряма. Спробуйте $k = 0$, $b = 0$, від'ємне $k$.</p>
        <div class="widget-body">
          <svg class="widget-plot" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Графік лінійної функції"></svg>
          <div class="widget-controls">
            <label>Кутовий коефіцієнт <i>k</i> = <output id="lg-k-out">1</output>
              <input type="range" id="lg-k" min="-5" max="5" step="0.5" value="1">
            </label>
            <label>Вільний член <i>b</i> = <output id="lg-b-out">0</output>
              <input type="range" id="lg-b" min="-10" max="10" step="0.5" value="0">
            </label>
            <div class="widget-presets">
              <button type="button" data-k="1" data-b="0">y = x</button>
              <button type="button" data-k="-2" data-b="3">y = −2x + 3</button>
              <button type="button" data-k="0" data-b="4">y = 4</button>
            </div>
            <div class="widget-info" id="lg-info" aria-live="polite"></div>
          </div>
        </div>
      </div>`;

    const svg = root.querySelector("svg");
    const kIn = root.querySelector("#lg-k");
    const bIn = root.querySelector("#lg-b");
    const kOut = root.querySelector("#lg-k-out");
    const bOut = root.querySelector("#lg-b-out");
    const info = root.querySelector("#lg-info");

    function el(name, attrs) {
      const e = document.createElementNS(SVG_NS, name);
      for (const key in attrs) e.setAttribute(key, attrs[key]);
      return e;
    }

    // Сітка та осі малюються один раз
    for (let i = -11; i <= 11; i++) {
      svg.appendChild(el("line", { x1: px(i), y1: 0, x2: px(i), y2: SIZE, class: "grid" }));
      svg.appendChild(el("line", { x1: 0, y1: py(i), x2: SIZE, y2: py(i), class: "grid" }));
    }
    svg.appendChild(el("line", { x1: 0, y1: C, x2: SIZE, y2: C, class: "axis" }));
    svg.appendChild(el("line", { x1: C, y1: 0, x2: C, y2: SIZE, class: "axis" }));
    [-10, -5, 5, 10].forEach((t) => {
      const lx = el("text", { x: px(t), y: C + 14, class: "tick", "text-anchor": "middle" });
      lx.textContent = fmt(t);
      svg.appendChild(lx);
      const ly = el("text", { x: C + 5, y: py(t) + 4, class: "tick" });
      ly.textContent = fmt(t);
      svg.appendChild(ly);
    });
    const lx = el("text", { x: SIZE - 12, y: C - 6, class: "axis-label" }); lx.textContent = "x"; svg.appendChild(lx);
    const ly = el("text", { x: C + 8, y: 14, class: "axis-label" }); ly.textContent = "y"; svg.appendChild(ly);

    const line = el("line", { class: "plot-line" });
    const dotY = el("circle", { r: 5, class: "plot-dot" });
    const dotX = el("circle", { r: 5, class: "plot-dot zero" });
    svg.appendChild(line);
    svg.appendChild(dotY);
    svg.appendChild(dotX);

    function formula(k, b) {
      if (k === 0) return "y = " + fmt(b);
      const kPart = k === 1 ? "x" : k === -1 ? "\u2212x" : fmt(k) + "x";
      if (b === 0) return "y = " + kPart;
      return "y = " + kPart + (b > 0 ? " + " : " \u2212 ") + fmt(Math.abs(b));
    }

    function update() {
      const k = parseFloat(kIn.value);
      const b = parseFloat(bIn.value);
      kOut.textContent = fmt(k);
      bOut.textContent = fmt(b);

      line.setAttribute("x1", px(-12)); line.setAttribute("y1", py(k * -12 + b));
      line.setAttribute("x2", px(12));  line.setAttribute("y2", py(k * 12 + b));

      dotY.setAttribute("cx", px(0)); dotY.setAttribute("cy", py(b));
      dotY.style.display = Math.abs(b) <= 11 ? "" : "none";

      let zeroText, hasZero = false, zx = 0;
      if (k !== 0) {
        zx = -b / k; hasZero = true;
        zeroText = "Нуль функції: $x = " + fmt(zx) + "$, точка перетину з віссю $Ox$ — $(" + fmt(zx) + "; 0)$.";
      } else if (b !== 0) {
        zeroText = "Нулів немає: пряма паралельна осі $Ox$ і не перетинає її.";
      } else {
        zeroText = "Пряма збігається з віссю $Ox$: нулем є будь-яке $x$.";
      }
      dotX.setAttribute("cx", px(zx)); dotX.setAttribute("cy", py(0));
      dotX.style.display = hasZero && Math.abs(zx) <= 11 ? "" : "none";

      const trend = k > 0 ? "Функція зростає ($k > 0$)." : k < 0 ? "Функція спадає ($k < 0$)." : "Функція стала ($k = 0$).";
      const kind = b === 0 && k !== 0 ? " Це пряма пропорційність." : "";

      info.innerHTML =
        "<strong>" + formula(k, b) + "</strong><br>" +
        trend + kind + "<br>" +
        "З віссю $Oy$ пряма перетинається в точці $(0; " + fmt(b) + ")$.<br>" + zeroText;

      if (window.renderMath) window.renderMath(info);
    }

    kIn.addEventListener("input", update);
    bIn.addEventListener("input", update);
    root.querySelectorAll(".widget-presets button").forEach((btn) => {
      btn.addEventListener("click", () => {
        kIn.value = btn.dataset.k;
        bIn.value = btn.dataset.b;
        update();
      });
    });
    update();
  }
};
