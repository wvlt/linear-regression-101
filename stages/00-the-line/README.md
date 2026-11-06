# Stage 0 — The line

*Tier A · about 45 minutes · one CSV · the kernel is in this page*

## Why this stage exists

This is `print("hello world")` for a predictive model. Before pipelines, thresholds or anything with "learning" in its name, you predict a number with the dumbest model you can write — the mean — and you print how wrong it was. Then you change one thing. A straight line beats the mean. The same line, scored on rows it did not fit, is a different number, and that number is the one that counts.

The full course takes these habits into SQL, a temporal split and an interval. This proof of concept stops at the line. If you can say the baseline, the slope in dollars, and why the holdout is the number you report, this stage has done its job.

## Contract

**Assumes:** You can read a Python function and a table. You know what a mean is. Nothing about modelling.

**Provides:**

- You can load the fixture and name the target, the feature and the id (`s00-r0`).
- You can predict every row with the mean and compute the mean absolute error, by hand and with the library (`s00-r1`).
- You can fit a one-feature linear model and put its error next to the baseline on the same rows (`s00-r2`).
- You can hold rows out, fit on the rest, and say why the held-out number is the one that counts (`s00-r3`).
- You can read a residual as "this customer, this many dollars, this direction" (`s00-r4`).

## Ten minutes of concepts

Read this once, then start at rung 0.

- A **predictive model** is a function from a row to a number. The mean is one. A straight line is one.
- The **target** is the column you are trying to predict. Here it is `monthly_spend`, in dollars. The **feature** is a column the model is allowed to read. Here that is `orders_last_90d`. `customer_id` is an id, not a feature.
- A **baseline** is the simplest prediction you can write down. The first baseline is always "predict the mean". A model number without its baseline beside it is not a number.
- **Mean absolute error (MAE)** is the average of |actual − predicted| over the rows. Same units as the target. Lower is better. It is the only metric in this stage.
- **Fitting** chooses the line's intercept and slope from data. Scoring the line on the rows it was fit on measures how well it described them. Scoring it on **held-out** rows measures how well it predicts. You will report the second one.
- A **residual** is actual minus predicted for one row. Positive means the customer spent more than the line expected.

## Part A — The first number

### Rung 0 — Look at the rows

*~8 min · feeds s00-r1*

Forty customers. Press **Run**. The first press downloads Python into the browser; the cell then loads the fixture from this site.

```python
import pandas as pd

df = pd.read_csv("/orders.csv")
print(df.shape)
print(df.dtypes)
print(df.head())
print(df.describe().round(2))
```

Forty rows, three columns. `monthly_spend` runs from about 22 to about 187, with a mean of 112.57. That mean is the context for every error that follows. An error of 10 dollars is small next to it. An error of 40 dollars is not.

**Check**

- **Run:** the cell prints `(40, 3)` and a `describe()` table whose `monthly_spend` mean is `112.57`.
- **See:** which column is the target, which is the feature, and which is only an id?
- **Say:** if you had to guess one number for every customer, what number would you guess, and what would a typical error look like?

### Rung 1 — Predict the mean

*~8 min · feeds s00-r2*

The first model is one number. Every customer is predicted to spend the mean.

```python
import pandas as pd
from sklearn.metrics import mean_absolute_error

df = pd.read_csv("/orders.csv")
y = df["monthly_spend"]

prediction = y.mean()
errors = (y - prediction).abs()
print(f"prediction for every row: {prediction:.2f}")
print(f"first row actual {y.iloc[0]:.2f}, error {errors.iloc[0]:.2f}")
print(f"mean absolute error: {errors.mean():.2f}")
print(f"library MAE: {mean_absolute_error(y, [prediction] * len(y)):.2f}")
```

Both MAE lines say 37.48. The arithmetic and the library agree. That agreement is the habit: compute it once yourself before you trust the function. Customer `c00` spent 138.85, so the mean is wrong by 26.28 on that row — better than the average miss, which does not make the mean a good model. It makes 37.48 the number the line has to beat.

**Check**

- **Run:** the cell prints `prediction for every row: 112.57` and two MAE lines, both `37.48`.
- **See:** is the first row's error above or below the mean absolute error?
- **Say:** why is 37.48 the number every later model on these forty rows has to beat?

## Part B — The line

### Rung 2 — A line beats the mean

*~10 min · feeds s00-r3*

A linear model is the mean plus a slope on one feature. Ordinary least squares chooses the intercept and the slope that minimise squared error on the rows you hand it.

```python
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]
y = df["monthly_spend"]

baseline = mean_absolute_error(y, [y.mean()] * len(y))
model = LinearRegression().fit(X, y)
mae = mean_absolute_error(y, model.predict(X))

print(f"intercept {model.intercept_:.2f}, slope {model.coef_[0]:.2f}")
print(f"baseline MAE {baseline:.2f}  model MAE {mae:.2f}")
```

The slope says each extra order in the last 90 days is associated with about 15.18 dollars of monthly spend. The error falls from 37.48 to 13.03, on the same forty rows, in the same metric. That is the only form of "the model beats the baseline" you should accept: two numbers, same rows, same metric.

`X` is `df[["orders_last_90d"]]` with two brackets: a table with one column. `df["orders_last_90d"]` is a single series. Every scikit-learn estimator takes a 2-D `X`. The error when you pass the series says `Expected 2D array`.

The intercept, 18.04, is the line's prediction at zero orders. No row in the fixture has zero orders, so that number is an extrapolation. Use the slope. Leave the intercept alone until you have a customer at zero.

**Check**

- **Run:** the cell prints `slope 15.18` and `baseline MAE 37.48  model MAE 13.03`.
- **See:** the slope is in dollars per order. What does 15.18 mean for a customer who placed one more order?
- **Say:** these two MAE numbers were computed on the rows the line was fit on. What do they tell you, and what do they not?

### Rung 3 — Rows it has never seen

*~10 min · feeds s00-r4*

Scoring on the fitting rows rewards a line that described those rows. Hold out a quarter of them. Fit on the rest. Score both, and score the mean on the holdout as well. The mean has to be the training mean: a baseline that peeks at the holdout is not a baseline.

```python
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]
y = df["monthly_spend"]

X_train, X_hold, y_train, y_hold = train_test_split(
    X, y, test_size=0.25, random_state=0
)
print(f"fit on {len(X_train)} rows, score on {len(X_hold)} held out")

model = LinearRegression().fit(X_train, y_train)
train_mae = mean_absolute_error(y_train, model.predict(X_train))
hold_mae = mean_absolute_error(y_hold, model.predict(X_hold))
baseline_hold = mean_absolute_error(y_hold, [y_train.mean()] * len(y_hold))

print(f"line: train MAE {train_mae:.2f}  held-out MAE {hold_mae:.2f}")
print(f"holdout baseline MAE {baseline_hold:.2f}")
```

The line's training MAE is 11.91. Its holdout MAE is 16.77. The gap is small, and it is the honest one: ten rows the fit never saw. The mean, denied those same ten rows, misses by 45.25. The line still beats the baseline. The number you would put in a sentence to someone else is 16.77, not 11.91.

Ten rows is a small holdout. Change `random_state` from 0 to 1 and the holdout MAE moves. The full course puts an interval on that movement. Here, notice that it can move, and that the training number does not tell you by how much.

**Check**

- **Run:** the cell prints `line: train MAE 11.91  held-out MAE 16.77` and `holdout baseline MAE 45.25`.
- **See:** which of the three numbers is the one you would quote, and which baseline is it being compared with?
- **Say:** why must the holdout baseline be computed from the training mean, not the mean of the ten held-out rows?

## Part C — Where it is wrong

### Rung 4 — The residual

*~10 min*

MAE is an average. A residual is one customer. Fit on the same thirty rows as rung 3, score the ten held out, and read the misses from largest to smallest. Then draw the line on every row it was fit on, so you can see the scatter the average is hiding.

```python
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split

df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]
y = df["monthly_spend"]
X_train, X_hold, y_train, y_hold = train_test_split(
    X, y, test_size=0.25, random_state=0
)
model = LinearRegression().fit(X_train, y_train)

pred = model.predict(X_hold)
frame = X_hold.copy()
frame["actual"] = y_hold.to_numpy()
frame["predicted"] = pred.round(2)
frame["residual"] = (y_hold.to_numpy() - pred).round(2)
worst = frame.reindex(frame["residual"].abs().sort_values(ascending=False).index)
print(worst.head(5).to_string(index=False))

import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(7.2, 4.2))
ax.scatter(df["orders_last_90d"], y, color="#8b2d1f", s=36, zorder=3)
ax.plot([1, 10], model.predict(pd.DataFrame({"orders_last_90d": [1, 10]})), color="#1b1814", lw=1.6)
ax.set_xlabel("orders in the last 90 days")
ax.set_ylabel("monthly spend ($)")
ax.set_title("Fit on 30 rows. Every dot is a customer.")
show(fig)
```

The largest held-out miss is a customer with 6 orders who spent 148.01. The line expected 111.29. The residual is +36.72: thirty-seven dollars the model did not see coming, in a table whose typical holdout miss is 16.77. The line is a summary of forty people. It is not a promise about one of them.

**Check**

- **Run:** the table's first residual is `36.72`, and a scatter plot with the line appears under the cell.
- **See:** is that customer above the line or below it, and by about how many dollars?
- **Say:** in one sentence, what the slope is worth, and what it is not worth, for the next customer who walks in with 6 orders.

## What this stage does not do

It does not use a second feature. It does not split by time. It does not put an interval on the holdout MAE. It does not ask whether a model was the right tool. Those are later stages of [Predictive Analytics 101](https://github.com/wvlt/predictive-analytics-101), and they need a kernel with a warehouse and a run directory, not the one in this page.
