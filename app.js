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
    btn.onclick = () => { location.hash = `#/${cur.s.id}/r${cur.r.n}`; };

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
        re.onclick = (e) => { e.stopPropagation(); location.hash = `#/${s.id}/r${r.n}`; };
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

  function attachChecks(container, stage) {
    const rungs = stage.parts.flatMap((p) => p.rungs);
    container.querySelectorAll("h3").forEach((h) => {
      const m = h.textContent.match(/^Rung (\w+) — /);
      h.id = slug(h.textContent);
      if (!m) return;
      const r = rungs.find((x) => x.n === m[1]);
      if (!r) return;
      if (rungDone(r)) h.classList.add("is-done");
      if (view && view.rung === r.n && !rungDone(r)) h.classList.add("is-current");
      let el = h.nextElementSibling;
      while (el && !/^H[1-3]$/.test(el.tagName)) {
        if (el.tagName === "P" && el.textContent.trim() === "Check") {
          const card = document.createElement("div");
          card.className = "check-card";
          const state = checks()[r.n] || {};
          card.innerHTML = `
            <div class="row">
              <button type="button" data-k="run" class="${state.run ? "on" : ""}">${state.run ? "☑" : "☐"} Run</button>
              <button type="button" data-k="see" class="${state.see ? "on" : ""}">${state.see ? "☑" : "☐"} See</button>
              <button type="button" data-k="say" class="${state.say ? "on" : ""}">${state.say ? "☑" : "☐"} Say</button>
            </div>
            <div class="hint">${r.id} · ticks stay in this browser. They mark the rung; they are not a grade.</div>`;
          card.querySelectorAll("button").forEach((b) => {
            b.onclick = () => {
              const all = checks();
              const row = all[r.n] || {};
              row[b.dataset.k] = !row[b.dataset.k];
              all[r.n] = row;
              saveChecks(all);
              renderSide();
              syncSide();
              const on = row[b.dataset.k];
              b.classList.toggle("on", on);
              b.textContent = `${on ? "☑" : "☐"} ${b.dataset.k[0].toUpperCase()}${b.dataset.k.slice(1)}`;
              h.classList.toggle("is-done", rungDone(r));
              h.classList.toggle("is-current", view && view.rung === r.n && !rungDone(r));
            };
          });
          el.after(card);
          break;
        }
        el = el.nextElementSibling;
      }
    });
  }

  function attachCells(container) {
    container.querySelectorAll("pre code.language-python").forEach((code) => {
      const pre = code.parentElement;
      const cell = document.createElement("div");
      cell.className = "py-cell";
      pre.parentNode.insertBefore(cell, pre);
      cell.appendChild(pre);
      const bar = document.createElement("div");
      bar.className = "cell-bar";
      bar.innerHTML = `<span class="label">Python · in this browser</span>`;
      const run = document.createElement("button");
      run.type = "button";
      run.className = "run";
      run.textContent = "Run";
      bar.appendChild(run);
      const out = document.createElement("div");
      out.className = "cell-out";
      cell.appendChild(bar);
      cell.appendChild(out);
      run.onclick = () => execute(code.textContent, run, out);
    });
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
      setKernel("busy", "Loading Python…");
      await loadScript(PYODIDE + "pyodide.js");
      const py = await loadPyodide({ indexURL: PYODIDE });
      setKernel("busy", "Loading pandas and scikit-learn…");
      await py.loadPackage(["numpy", "pandas", "scikit-learn", "matplotlib"]);
      const csv = await (await fetch("data/orders.csv")).text();
      py.FS.writeFile("/orders.csv", csv);
      await py.runPythonAsync(PRELUDE);
      pyodide = py;
      setKernel("ready", "Kernel ready");
      return py;
    })();
    try {
      return await starting;
    } catch (e) {
      starting = null;
      setKernel("", "Kernel failed");
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
      const msg = (chunks.join("") + "\n" + (e.message || String(e))).trim();
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

  function renderNow() {
    const cur = currentRung();
    const nxt = allRungs()[allRungs().findIndex(({ r }) => r.n === cur.r.n) + 1];
    $("#now").style.display = "";
    $("#now").innerHTML = `<b>Now — ${cur.r.title}.</b> Press Run on the cell. The first press downloads Python into this tab; the fit stays here.<div class="next"><b>Next</b> &nbsp;${nxt ? `Rung ${nxt.r.n} — ${nxt.r.title}` : "You have marked every rung."}</div>`;
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
        $("#crumbs").innerHTML = `<b>${view.doc}</b>`;
        $("#now").style.display = "none";
        $("#prev").disabled = true;
        $("#next").disabled = true;
        $("#main").scrollTo(0, 0);
      } else {
        const s = findStage(view.stage);
        if (!s) throw new Error("No stage " + view.stage);
        const md = await fetchMd(s.brief);
        content.innerHTML = marked.parse(md);
        attachChecks(content, s);
        attachCells(content);
        renderNow();
        const r = view.rung ? s.parts.flatMap((p) => p.rungs).find((x) => x.n === view.rung) : null;
        const part = r ? s.parts.find((p) => p.rungs.includes(r)) : null;
        const pill = r
          ? `<span class="pill ${rungDone(r) ? "done" : "current"}">${rungDone(r) ? "marked" : "you are here"}</span>`
          : `<span class="pill current">the brief</span>`;
        $("#crumbs").innerHTML = `Tier ${s.tier} › <b>Stage ${stageNum(s.id)} · ${s.name}</b>`
          + (part ? ` › Part ${part.id}` : "")
          + (r ? ` › <b>Rung ${r.n}</b>` : "")
          + pill;
        const flat = allRungs();
        const idx = r ? flat.findIndex((x) => x.r.n === r.n) : -1;
        $("#prev").disabled = idx <= 0;
        $("#next").disabled = idx < 0 || idx >= flat.length - 1;
        $("#prev").onclick = () => { const t = flat[idx - 1]; location.hash = `#/${t.s.id}/r${t.r.n}`; };
        $("#next").onclick = () => { const t = flat[idx + 1]; location.hash = `#/${t.s.id}/r${t.r.n}`; };
        if (r) document.getElementById(r.anchor)?.scrollIntoView();
        else $("#main").scrollTo(0, 0);
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

  fetch("data.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      D = d;
      renderSide();
      window.addEventListener("hashchange", route);
      route();
    })
    .catch((e) => {
      $("#content").innerHTML = `<div class="err">Could not load data.json (${escapeHtml(e.message)}).</div>`;
    });
})();
