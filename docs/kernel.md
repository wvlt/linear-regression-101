# How the kernel works

GitHub Pages serves files. It does not run Python. This player runs Python in the browser.

The first time you press **Run**, the page loads [Pyodide](https://pyodide.org/) 0.27.7 from jsDelivr, then the packages `numpy`, `pandas`, `scikit-learn` and `matplotlib`. That download is the kernel. It stays in the tab. Later cells reuse it. Nothing is sent to a server: the CSV is fetched from this site, and the fit happens on your machine.

`data/orders.csv` is written into the kernel's filesystem as `/orders.csv` before your cell runs. Cells in one rung share that kernel, so run them from the top: the second cell can see the names the first one created. A new tab starts a new kernel. A phone and a laptop do not share one.

A cell that calls `show(fig)` prints the figure under the output. `show` is defined by the player, not by scikit-learn.

## What this is not

The full course, [Predictive Analytics 101](https://github.com/wvlt/predictive-analytics-101), fits models with `uv run` on your laptop, writes a run directory, and gates later stages on SQL, a temporal split and an interval. Those do not fit in this page. Pyodide cannot be the kernel for that course. It can host this stage: one CSV, one line, mean absolute error beside the baseline.

Ticks for Run / See / Say stay in `localStorage` in this browser. They are a progress marker for the proof of concept, not a grade.
