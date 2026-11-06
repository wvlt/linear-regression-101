# data/orders.csv

Forty synthetic Fernhill Coffee customers. No real person appears. CC0.

| Column | What it is |
|---|---|
| `customer_id` | An id. Not a feature. |
| `orders_last_90d` | Orders in the 90 days before the prediction. The one feature in this proof of concept. |
| `monthly_spend` | Dollars spent in the month after. The target. |

Generated with seed 7: `monthly_spend ≈ 22 + 15 × orders_last_90d + noise`, noise drawn from a normal distribution with standard deviation 18, clipped at zero, rounded to cents. The slope the lesson recovers is the planted 15, plus the effect of the noise on forty rows.

This is a public slice for the in-browser player. It is not the 200-row `hello.csv` used by stage 0 of [Predictive Analytics 101](https://github.com/wvlt/predictive-analytics-101).
