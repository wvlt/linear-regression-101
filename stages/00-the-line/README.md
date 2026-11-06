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

Forty customers. The first **Run** downloads Python into this phone or laptop. Later cells in the same tab reuse it. Run a rung from the top: a cell can see the names the cell above created.

#### Open the file

```python
import pandas as pd                 :: pandas reads tables
df = pd.read_csv("/orders.csv")     :: forty customers, one per row
print(df.shape)                     :: (rows, columns)
print(df.head(3))                   :: the first three rows, so the column names are visible
```

`(40, 3)`. `customer_id` is only an id. `orders_last_90d` is the feature, the column a model may read. `monthly_spend` is the target, in dollars.

#### Where the target sits

```python
y = df["monthly_spend"]                       :: the column we want to predict
print(round(y.min(), 2), "to", round(y.max(), 2))  :: smallest spend, then largest
print("mean", round(y.mean(), 2))            :: one number for all forty customers
```

The mean is 112.57. An error of 10 dollars is small beside it. An error of 40 dollars is not.

**Check**

- **Run:** the first cell prints `(40, 3)`. The second prints `mean 112.57`.
- **See:** which column is the target, which is the feature, and which is only an id?
- **Say:** if you had to guess one number for every customer, what number would you guess?

### Rung 1 — Predict the mean

*~8 min · feeds s00-r2*

The first model is one number. Every customer is predicted to spend the mean.

#### Predict every row with the mean

```python
import pandas as pd                              :: the table library, again
df = pd.read_csv("/orders.csv")                  :: the same forty customers
y = df["monthly_spend"]                          :: the target
prediction = y.mean()                            :: the model: one number
errors = (y - prediction).abs()                  :: how far each customer is from it, in dollars
print(f"prediction for every row: {prediction:.2f}")
print(f"first row actual {y.iloc[0]:.2f}, error {errors.iloc[0]:.2f}")
print(f"mean absolute error: {errors.mean():.2f}")  :: the average of those distances
```

#### Ask the library the same question

```python
from sklearn.metrics import mean_absolute_error          :: scikit-learn's version of the average
library = mean_absolute_error(y, [prediction] * len(y))  :: the one number, repeated for every row
print(f"library MAE: {library:.2f}")                     :: it should match your own arithmetic
```

Both say 37.48. Customer `c00` spent 138.85, so the mean misses that row by 26.28 — better than the average miss. That does not make the mean a good model. It makes 37.48 the number the line has to beat.

**Check**

- **Run:** the first cell prints `prediction for every row: 112.57` and `mean absolute error: 37.48`. The second prints `library MAE: 37.48`.
- **See:** is the first row's error above or below 37.48?
- **Say:** why does every later model on these forty rows have to beat 37.48?

## Part B — The line

### Rung 2 — A line beats the mean

*~10 min · feeds s00-r3*

A linear model is the mean plus a slope on one feature. This cell fits that line and puts its error next to the mean, on the same rows.

#### Fit the line and compare

```python
import pandas as pd
from sklearn.linear_model import LinearRegression          :: the straight-line model
from sklearn.metrics import mean_absolute_error            :: average miss, in dollars
df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]                                :: two brackets: a one-column table
y = df["monthly_spend"]                                    :: the target
baseline = mean_absolute_error(y, [y.mean()] * len(y))     :: miss if we predict the mean
model = LinearRegression().fit(X, y)                       :: choose intercept and slope
mae = mean_absolute_error(y, model.predict(X))            :: miss of the line, same rows
print(f"intercept {model.intercept_:.2f}, slope {model.coef_[0]:.2f}")
print(f"baseline MAE {baseline:.2f}  model MAE {mae:.2f}")
```

The slope is about 15.18 dollars of monthly spend per extra order in the last 90 days. The error falls from 37.48 to 13.03. Same rows, same metric. That is the only form of "the model beats the baseline" worth saying.

The two brackets matter. `df["orders_last_90d"]` is one series. scikit-learn wants a table, so it is `df[["orders_last_90d"]]`. One bracket raises `Expected 2D array`.

The intercept, 18.04, is the line's guess at zero orders. Nobody in the file has zero orders, so leave that number alone. Use the slope.

**Check**

- **Run:** the cell prints `slope 15.18` and `baseline MAE 37.48  model MAE 13.03`.
- **See:** the slope is in dollars per order. What does 15.18 mean for a customer who placed one more order?
- **Say:** these two MAE numbers were computed on the rows the line was fit on. What do they tell you, and what do they not?

### Rung 3 — Rows it has never seen

*~10 min · feeds s00-r4*

Scoring on the fitting rows rewards a line that described those rows. Hold a quarter of them out, then score.

#### Set aside ten customers

```python
import pandas as pd
from sklearn.model_selection import train_test_split
df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]                                         :: the one feature
y = df["monthly_spend"]                                             :: the target
X_train, X_hold, y_train, y_hold = train_test_split(
    X, y, test_size=0.25, random_state=0)                           :: 25% held out, the rest used to fit
print(f"fit on {len(X_train)} rows, score on {len(X_hold)} held out")
```

#### Score the line on the rows it did not see

```python
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
model = LinearRegression().fit(X_train, y_train)                    :: the ten held-out rows take no part
train_mae = mean_absolute_error(y_train, model.predict(X_train))    :: miss on the rows it did see
hold_mae = mean_absolute_error(y_hold, model.predict(X_hold))       :: miss on the rows it did not
baseline_hold = mean_absolute_error(y_hold, [y_train.mean()] * len(y_hold))  :: the mean, banned from peeking
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

MAE is an average. A residual is one customer. These cells refit the same thirty rows as rung 3, then look at one miss, then draw the line.

#### Fit on the same thirty rows

```python
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
df = pd.read_csv("/orders.csv")
X = df[["orders_last_90d"]]
y = df["monthly_spend"]
X_train, X_hold, y_train, y_hold = train_test_split(
    X, y, test_size=0.25, random_state=0)          :: same split as the previous rung
model = LinearRegression().fit(X_train, y_train)   :: slope and intercept from the thirty
print(f"fit on {len(X_train)}, hold out {len(X_hold)}")
```

#### The five largest misses

```python
pred = model.predict(X_hold)                       :: the line's guess for each held-out customer
out = X_hold.copy()
out["actual"] = y_hold.to_numpy()                  :: what they spent
out["predicted"] = pred.round(2)                   :: what the line expected
out["residual"] = (out["actual"] - out["predicted"]).round(2)  :: actual minus predicted
worst = out.reindex(out["residual"].abs().sort_values(ascending=False).index)
print(worst.head(5).to_string(index=False))        :: largest miss first
```

#### Draw the line

```python
import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(6.2, 3.6))
ax.scatter(df["orders_last_90d"], y, color="#8b2d1f", s=28, zorder=3)  :: one dot per customer
xs = [1, 10]
ax.plot(xs, model.predict(pd.DataFrame({"orders_last_90d": xs})), color="#1b1814")  :: the fitted line
ax.set_xlabel("orders in the last 90 days")
ax.set_ylabel("monthly spend ($)")
show(fig)                                          :: draw it under this cell
```

The largest held-out miss is a customer with 6 orders who spent 148.01. The line expected 111.29. The residual is +36.72: thirty-seven dollars the model did not see coming, in a table whose typical holdout miss is 16.77. The line is a summary of forty people. It is not a promise about one of them.

**Check**

- **Run:** the table's first residual is `36.72`, and a scatter plot with the line appears under the cell.
- **See:** is that customer above the line or below it, and by about how many dollars?
- **Say:** in one sentence, what the slope is worth, and what it is not worth, for the next customer who walks in with 6 orders.

## What this stage does not do

It does not use a second feature. It does not split by time. It does not put an interval on the holdout MAE. It does not ask whether a model was the right tool. Those are later stages of [Predictive Analytics 101](https://github.com/wvlt/predictive-analytics-101), and they need a kernel with a warehouse and a run directory, not the one in this page.
