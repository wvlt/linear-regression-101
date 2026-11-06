/* Course player for one stage, with an in-browser Python kernel. */
(() => {
  const STORE = "lr101-checks";
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
  const $ = (s) => document.querySelector(s);

  marked.setOptions({ gfm: true, breaks: false });

  let D = null;
  let view = null;
  let pyodide = null;
  let starting = null;
  const mdCache = new Map();

  const stageNum = (id) => String(parseInt(id.slice(1), 10));
  const allRungs = () => D.stages.flatMap((s) => s.parts.flatMap((p) => p.rungs.map((r) => ({ s, p, r }))));
  const findStage = (id) => D.stages.find((s) => s.id === id);

  function checks() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
    catch { return {}; }
  }
  function saveChecks(c) { localStorage.setItem(STORE, JSON.stringify(c)); }
  function rungDone(r) {
    const c = checks()[r.n] || {};
    return !!(c.run && c.see && c.say);
  }
  function doneCount() { return allRungs().filter(({ r }) => rungDone(r)).length; }
  function currentRung() {
    return allRungs().find(({ r }) => !rungDone(r)) || allRungs().at(-1);
  }

  function ring(frac) {
    const r = 11.5, c = 2 * Math.PI * r, dash = Math.max(0, Math.min(1, frac)) * c;
    const label = frac >= 1 ? "✓" : `${Math.round(frac * 100)}`;
    return `<svg class="ring" viewBox="0 0 28 28" aria-hidden="true"><circle class="track" cx="14" cy="14" r="${r}"/><circle class="fill" cx="14" cy="14" r="${r}" stroke-dasharray="${dash} ${c}"/><text x="14" y="15">${label}</text></svg>`;
  }

  function setKernel(state, text) {
    const el = $("#kernel");
    el.className = "kernel" + (state ? " " + state : "");
    el.textContent = text;
  }

  function setNav(open) {
    document.body.classList.toggle("nav-open", open);
    const backdrop = $("#backdrop");
    const menu = $("#menu");
    if (backdrop) backdrop.hidden = !open;
    if (menu) menu.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderSide() {
    const c0 = D.course;
    document.title = `${c0.title} · ${c0.org}`;
    $("#course-title").innerHTML = `${c0.title}<span class="dot">.</span>`;
    const org = $("#org");
    org.textContent = c0.org;
    org.href = c0.org_url;
    $("#tagline").textContent = c0.tagline;
    $("#repo-link").href = c0.repo_url;
    $("#learner").textContent = `${D.learner} · ${D.curriculum_version}`;
    $("#updated").textContent = `Brief dated ${D.updated}`;

    const total = allRungs().length;
    const done = doneCount();
    const cur = currentRung();
    $("#overall-fill").style.width = `${Math.round((done / total) * 100)}%`;
    $("#overall-text").textContent = done === total
      ? `${total} of ${total} rungs marked`
      : `${done} of ${total} rungs marked · ticks stay in this browser`;

    const btn = $("#continue");
    btn.innerHTML = `<span class="arrow">→</span>${done ? "Continue" : "Start"} · Stage ${stageNum(cur.s.id)}, Rung ${cur.r.n}<small>${cur.r.title} · ~${cur.r.minutes} min</small>`;
    btn.onclick = () => { setNav(false); location.hash = `#/${cur.s.id}/r${cur.r.n}`; };

    const tree = $("#tree");
    tree.innerHTML = "";
    for (const [tier, tname] of Object.entries(D.tiers)) {
      const h = document.createElement("div");
      h.className = "tier eyebrow";
      h.textContent = `Tier ${tier} — ${tname}`;
      tree.appendChild(h);
      for (const s of D.stages.filter((x) => x.tier === tier)) tree.appendChild(stageNode(s, done, total));
    }
  }

  function stageNode(s, done, total) {
    const el = document.createElement("div");
    const frac = done / total;
    el.className = "stage current open";
    el.dataset.id = s.id;
    el.innerHTML = `
      <div class="stage-row">
        ${ring(frac)}
        <div>
          <div class="stage-name">Stage ${stageNum(s.id)} · ${s.name}<span class="chev">▶</span></div>
          <div class="stage-sub">${done} / ${s.parts.reduce((n, p) => n + p.rungs.length, 0)} rungs · ${s.hours} h</div>
        </div>
        <div class="stage-hours">${frac >= 1 ? "done" : "now"}</div>
      </div>
      <div class="rungs"></div>`;
    const rungs = el.querySelector(".rungs");
    for (const p of s.parts) {
      const ph = document.createElement("div");
      ph.className = "part";
      ph.textContent = `Part ${p.id} — ${p.title}`;
      rungs.appendChild(ph);
      for (const r of p.rungs) {
        const re = document.createElement("div");
        const isDone = rungDone(r);
        re.className = "rung" + (isDone ? " done" : "");
        re.dataset.stage = s.id;
        re.dataset.rung = r.n;
        re.innerHTML = `<span class="mark">${isDone ? "✓" : "○"}</span><span class="rung-title">Rung ${r.n} — ${r.title}</span><span class="mins">${r.minutes} min</span>`;
        re.onclick = (e) => { e.stopPropagation(); setNav(false); location.hash = `#/${s.id}/r${r.n}`; };
        rungs.appendChild(re);
      }
    }
    el.querySelector(".stage-row").onclick = () => {
      el.classList.toggle("open");
      if (!view || view.stage !== s.id) location.hash = `#/${s.id}`;
    };
    return el;
  }

  function syncSide() {
    document.querySelectorAll(".rung").forEach((el) => {
      el.classList.toggle("active", !!(view && !view.doc && view.stage === el.dataset.stage && view.rung === el.dataset.rung));
    });
  }

  async function fetchMd(path) {
    if (mdCache.has(path)) return mdCache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    const txt = await res.text();
    mdCache.set(path, txt);
    return txt;
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s/g, "-");
  }

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function sliceBetween(md, startHeading, endHeading) {
    const start = md.indexOf(startHeading);
    if (start < 0) return "";
    const from = start + startHeading.length;
    const end = endHeading ? md.indexOf(endHeading, from) : -1;
    return md.slice(from, end < 0 ? undefined : end).trim();
  }

  function parseBrief(md) {
    const rungs = [];
    const re = /^### Rung (\w+) — .+$/gm;
    const marks = [];
    let m;
    while ((m = re.exec(md))) marks.push({ n: m[1], at: m.index, end: m.index + m[0].length });
    const codaAt = md.indexOf("## What this stage does not do");
    marks.forEach((item, i) => {
      const next = i + 1 < marks.length ? marks[i + 1].at : (codaAt < 0 ? md.length : codaAt);
      rungs.push({ n: item.n, body: md.slice(item.end, next).trim() });
    });
    return {
      why: sliceBetween(md, "## Why this stage exists", "## Contract"),
      concepts: sliceBetween(md, "## Ten minutes of concepts", "## Part A"),
      coda: sliceBetween(md, "## What this stage does not do", null),
      rungs,
    };
  }

  function splitGloss(raw) {
    const lines = raw.replace(/\s+$/, "").split("\n");
    const parsed = lines.map((line) => {
      const at = line.indexOf(" :: ");
      if (at < 0) return { src: line, gloss: "" };
      return { src: line.slice(0, at).trimEnd(), gloss: line.slice(at + 4).trim() };
    });
    return { code: parsed.map((l) => l.src).join("\n"), parsed };
  }

  function attachCheck(container, rung) {
    const paras = [...container.querySelectorAll("p")];
    const el = paras.find((p) => p.textContent.trim() === "Check");
    if (!el) return;
    const card = document.createElement("div");
    card.className = "check-card";
    const state = checks()[rung.n] || {};
    const tick = (key, label) => `<button type="button" data-k="${key}" class="${state[key] ? "on" : ""}">${state[key] ? "☑" : "☐"} ${label}</button>`;
    card.innerHTML = `
      <div class="row">${tick("run", "Run")}${tick("see", "See")}${tick("say", "Say")}</div>
      <div class="hint">${rung.id} · ticks stay in this browser. They mark the rung; they are not a grade.</div>`;
    card.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const all = checks();
        const row = all[rung.n] || {};
        row[b.dataset.k] = !row[b.dataset.k];
        all[rung.n] = row;
        saveChecks(all);
        renderSide();
        syncSide();
        const on = row[b.dataset.k];
        const label = b.dataset.k[0].toUpperCase() + b.dataset.k.slice(1);
        b.classList.toggle("on", on);
        b.textContent = `${on ? "☑" : "☐"} ${label}`;
      };
    });
    el.after(card);
  }

  function attachCells(container) {
    const codes = [...container.querySelectorAll("pre code.language-python")];
    const cells = [];
    codes.forEach((code, i) => {
      const pre = code.parentElement;
      const { code: source, parsed } = splitGloss(code.textContent);
      const cell = document.createElement("div");
      cell.className = "py-cell";
      const heading = pre.previousElementSibling;
      const title = heading && heading.tagName === "H4" ? heading.textContent.trim() : "Python";
      if (heading && heading.tagName === "H4") heading.remove();
      const lines = document.createElement("div");
      lines.className = "py-lines";
      parsed.forEach((line) => {
        const row = document.createElement("div");
        if (!line.src && !line.gloss) { row.className = "py-line blank"; lines.appendChild(row); return; }
        row.className = "py-line";
        const src = document.createElement("span");
        src.className = "src";
        src.textContent = line.src || " ";
        row.appendChild(src);
        if (line.gloss) {
          const gloss = document.createElement("span");
          gloss.className = "gloss";
          gloss.textContent = line.gloss;
          row.appendChild(gloss);
        }
        lines.appendChild(row);
      });
      const bar = document.createElement("div");
      bar.className = "cell-bar";
      bar.innerHTML = codes.length > 1 ? `<div class="cell-kicker">Cell ${i + 1} of ${codes.length}</div>` : "";
      const titleEl = document.createElement("div");
      titleEl.className = "cell-title";
      titleEl.textContent = title;
      bar.appendChild(titleEl);
      const run = document.createElement("button");
      run.type = "button";
      run.className = "run";
      run.textContent = "Run";
      const foot = document.createElement("div");
      foot.className = "cell-foot";
      foot.appendChild(run);
      const out = document.createElement("div");
      out.className = "cell-out";
      cell.append(bar, lines, foot, out);
      pre.replaceWith(cell);
      run.onclick = () => execute(source, run, out);
      cells.push({ source, run, out });
    });
    if (cells.length > 1) {
      const all = document.createElement("button");
      all.type = "button";
      all.className = "run-rung";
      all.textContent = "Run from the top";
      cells[0].run.closest(".py-cell").before(all);
      all.onclick = async () => {
        all.disabled = true;
        for (const cell of cells) await execute(cell.source, cell.run, cell.out);
        all.disabled = false;
      };
    }
  }

  function showOutput(out, text, isErr) {
    out.classList.add("visible");
    out.classList.toggle("err", isErr);
    out.innerHTML = "";
    const re = /__PNG__([A-Za-z0-9+/=]+)__ENDPNG__/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      const chunk = text.slice(last, m.index).trim();
      if (chunk) out.appendChild(document.createTextNode(chunk + "\n"));
      const img = document.createElement("img");
      img.alt = "Plot from this cell";
      img.src = "data:image/png;base64," + m[1];
      out.appendChild(img);
      last = m.index + m[0].length;
    }
    const rest = text.slice(last).trim();
    if (rest) out.appendChild(document.createTextNode((out.childNodes.length ? "\n" : "") + rest));
    if (!out.childNodes.length) out.textContent = isErr ? text : "(no output)";
  }

  async function ensureKernel() {
    if (pyodide) return pyodide;
    if (starting) return starting;
    starting = (async () => {
      setKernel("busy", "Starting…");
      await loadScript(PYODIDE + "pyodide.js");
      const py = await loadPyodide({ indexURL: PYODIDE });
      setKernel("busy", "Loading…");
      await py.loadPackage(["numpy", "pandas", "scikit-learn", "matplotlib"]);
      const csv = await (await fetch("data/orders.csv")).text();
      py.FS.writeFile("/orders.csv", csv);
      await py.runPythonAsync(PRELUDE);
      pyodide = py;
      setKernel("ready", "In this tab");
      return py;
    })();
    try {
      return await starting;
    } catch (e) {
      starting = null;
      setKernel("", "Failed");
      throw e;
    }
  }

  async function execute(source, button, out) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "Running";
    out.classList.add("visible");
    out.classList.remove("err");
    out.textContent = pyodide ? "Running…" : "Starting the kernel. The first run downloads Python.";
    let chunks = [];
    try {
      const py = await ensureKernel();
      const take = (s) => chunks.push(s.endsWith("\n") ? s : s + "\n");
      py.setStdout({ batched: take });
      py.setStderr({ batched: take });
      await py.runPythonAsync(source);
      showOutput(out, chunks.join(""), false);
    } catch (e) {
      let msg = (chunks.join("") + "\n" + (e.message || String(e))).trim();
      if (/NameError/.test(msg)) msg += "\n\nRun the cells above this one first. They share the kernel in this tab.";
      showOutput(out, msg, true);
    } finally {
      button.disabled = false;
      button.textContent = previous;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.loadPyodide) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  const PRELUDE = `
import io, base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
matplotlib.rcParams.update({
    "axes.edgecolor": "#1b1814",
    "axes.labelcolor": "#1b1814",
    "xtick.color": "#4a4239",
    "ytick.color": "#4a4239",
    "text.color": "#1b1814",
    "axes.titlecolor": "#1b1814",
    "font.size": 11,
    "figure.facecolor": "#f2ede3",
    "axes.facecolor": "#f2ede3",
    "savefig.facecolor": "#f2ede3",
})

def show(fig=None):
    fig = fig or plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight")
    plt.close(fig)
    png = base64.b64encode(buf.getvalue()).decode()
    print("__PNG__" + png + "__ENDPNG__")
`;

  function wirePager(flat, idx) {
    $("#prev").disabled = idx <= 0;
    $("#next").disabled = idx < 0 || idx >= flat.length - 1;
    $("#prev").onclick = () => { if (idx > 0) { const t = flat[idx - 1]; location.hash = `#/${t.s.id}/r${t.r.n}`; } };
    $("#next").onclick = () => { if (idx >= 0 && idx < flat.length - 1) { const t = flat[idx + 1]; location.hash = `#/${t.s.id}/r${t.r.n}`; } };
  }

  async function show() {
    const content = $("#content");
    try {
      if (view.doc) {
        const md = await fetchMd(view.doc);
        content.innerHTML = marked.parse(md);
        content.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href");
          if (/^https?:/.test(href)) a.target = "_blank";
        });
        $("#crumbs").innerHTML = `<b>${view.doc.split("/").pop()}</b>`;
        wirePager([], -1);
        $("#main").scrollTo(0, 0);
      } else {
        const s = findStage(view.stage);
        if (!s) throw new Error("No stage " + view.stage);
        const md = await fetchMd(s.brief);
        const brief = parseBrief(md);
        const flat = allRungs();
        const idx = flat.findIndex((x) => x.s.id === s.id && x.r.n === view.rung);
        const item = idx >= 0 ? flat[idx] : flat[0];
        const rungMd = brief.rungs.find((r) => r.n === item.r.n);
        if (!rungMd) throw new Error("No rung " + view.rung);
        const ideas = item.r.n === "0" ? `
          <details class="ideas">
            <summary>Why this stage, and the six words it uses</summary>
            ${marked.parse(brief.why)}
            ${marked.parse(brief.concepts)}
          </details>` : "";
        const coda = item.r.n === "4" ? marked.parse("## What this page does not do\n\n" + brief.coda) : "";
        content.innerHTML = `
          <header class="rung-head">
            <div class="eyebrow">Part ${item.p.id} — ${item.p.title}</div>
            <h1>${item.r.title}</h1>
          </header>
          ${ideas}
          ${marked.parse(rungMd.body)}
          ${coda}`;
        attachCheck(content, item.r);
        attachCells(content);
        const pill = `<span class="pill ${rungDone(item.r) ? "done" : "current"}">${rungDone(item.r) ? "marked" : `${idx + 1} of ${flat.length}`}</span>`;
        $("#crumbs").innerHTML = `<b>Rung ${item.r.n}</b>${pill}`;
        wirePager(flat, idx);
        $("#main").scrollTo(0, 0);
      }
    } catch (e) {
      content.innerHTML = `<div class="err">Could not load the brief (${escapeHtml(e.message)}). Serve the repository root — <code>just site</code> — and open <code>http://localhost:8000/#/s00/r0</code>.</div>`;
    }
    syncSide();
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    if (!h) {
      const cur = currentRung();
      location.replace(`#/${cur.s.id}/r${cur.r.n}`);
      return;
    }
    if (h.startsWith("doc/")) view = { doc: h.slice(4) };
    else {
      const [stage, rung] = h.split("/");
      view = { stage, rung: rung ? rung.replace(/^r/, "") : null };
    }
    show();
  }

  $("#menu").onclick = () => setNav(!document.body.classList.contains("nav-open"));
  $("#backdrop").onclick = () => setNav(false);

  fetch("data.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      D = d;
      renderSide();
      window.addEventListener("hashchange", () => { setNav(false); route(); });
      route();
    })
    .catch((e) => {
      $("#content").innerHTML = `<div class="err">Could not load data.json (${escapeHtml(e.message)}).</div>`;
    });
})();
