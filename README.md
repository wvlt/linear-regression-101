# Linear regression 101

**A proof of concept: the Predictive Analytics 101 player, with a kernel on the page.**

One stage. Forty Fernhill customers. Predict `monthly_spend` from `orders_last_90d`. The mean first, then a line, then the same line on rows it did not fit. Every error is mean absolute error, reported beside the baseline.

This is not the course. The course is [Predictive Analytics 101](https://github.com/wvlt/predictive-analytics-101): ten stages, from the target and the honest split through monitoring. That repository stays the curriculum. This one answers a narrower question: can the brief and a runnable cell live on the same page, hosted as static files.

They can, for this stage. Press **Run**. Python starts in the browser (Pyodide). Nothing is installed and nothing is sent to a server. The limit is the same one the full course is built around: a browser kernel is enough for one CSV and ordinary least squares, and it is the wrong place for the warehouse, the serving path and the monitor.

## Open it

Published player: [wvlt.github.io/linear-regression-101/#/s00/r0](https://wvlt.github.io/linear-regression-101/#/s00/r0)

Locally, from this directory:

```bash
just site
```

Then open [http://localhost:8000/#/s00/r0](http://localhost:8000/#/s00/r0). `file://` will not work; the player fetches the brief and the CSV.

The first **Run** downloads the kernel. Later cells in the same tab start immediately.

## The stage

| | |
|---|---|
| Stage | `00-the-line` — referred to as stage 0, id `s00` |
| Rungs | `s00-r0` look · `s00-r1` the mean · `s00-r2` the line · `s00-r3` the holdout · `s00-r4` the residual |
| Fixture | [`data/orders.csv`](data/orders.csv) |
| Brief | [`stages/00-the-line/README.md`](stages/00-the-line/README.md) |
| Kernel | [`docs/kernel.md`](docs/kernel.md) |

The player shows one rung at a time. `#/s00/r2` is rung 2. On a phone, **Rungs** opens the list; **Prev** and **Next** sit at the bottom. A note beside each line says what that line does. The note is not part of the program that runs.

## Naming

Same conventions as Predictive Analytics 101, on a single stage.

- Repository slug is kebab-case: `linear-regression-101`.
- The stage directory is `NN-kebab-name`: `stages/00-the-line/`.
- A rung is `sNN-rM`: `s00-r2` is rung 2 of stage 0.
- The target is `monthly_spend`. The feature is `orders_last_90d`. The baseline is the mean. The metric is MAE. The rows held back are the holdout, not a "test set".

## License

Code is MIT. The brief is CC BY 4.0. The fixture is CC0. See [LICENSE](LICENSE).
