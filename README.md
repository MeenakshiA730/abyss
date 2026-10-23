NVDA X-Sentiment & Price Forecasting
A walk-forward forecasting study of NVIDIA (NVDA) closing prices at n+0 … n+5 trading days, using price and X (Twitter) sentiment only, with recent news from Tavily as supporting context.
Built for the CrowdWisdomTrading Quantitative Data Scientist internship assessment.
Headline finding (read this first): The model's price forecasts do not beat a naive persistence baseline (MAE 4.75 vs 4.03 at n+1). Used as a directional signal it was profitable in out-of-sample simulation (Sharpe 3.97 over 100 days), but the edge looks like short-term mean reversion in a range-bound market, and X sentiment coverage was too thin to show that sentiment contributes. See Results and Limitations.
________________________________________
1. Pipeline overview
Apify (X posts)  ─┐
                  ├─► clean + VADER sentiment ─► daily features ─┐
Tavily (news)    ─┘                                              ├─► Random Forest ─► walk-forward ─► metrics + charts
yfinance (OHLCV) ──────────────────► price features ─────────────┘
Stage	Tool	Output
Price data	yfinance (daily OHLCV, ~6 months, split/dividend adjusted)	price table
X posts	Apify actor (see Reproducing)
raw tweet CSVs
News	Tavily search API (topic="news")	dated articles
Text sentiment	VADER compound score (≥0.05 positive, ≤-0.05 negative)	per-post / per-article score
Model	scikit-learn RandomForestRegressor	one model per horizon
Validation	TimeSeriesSplit(n_splits=5) expanding window	out-of-sample predictions
2. Features
All features use information available at the close of day t.
Price: open/high/low/close, volume, 1-day and 5-day return, 5-day volatility, volume change, close lags (1, 2, 3, 5).
X sentiment (daily, UTC date): mean and median VADER score, post count, and a sentiment_available flag. Days with no posts are filled with 0 and flagged so the model can tell "neutral" from "no data".
Targets: close(t+h) for h = 1…5. The n+0 value is the observed close on the forecast origin date.
3. Reproducing the run
Requirements
pip install -r requirements.txt   # apify-client, tavily-python, yfinance, vaderSentiment, scikit-learn, pandas, numpy, matplotlib
Credentials
Set tokens as environment variables. Never commit them.
export APIFY_TOKEN="..."
export TAVILY_API_KEY="..."
(The notebook prompts for them with getpass instead.)
Apify configuration
Item	Value
Actor ID	<FILL IN: e.g. username/actor-name>
Search terms	$NVDA, NVDA, NVIDIA
Date window	<FILL IN: start date> to <FILL IN: end date>
Fields kept	id, text, createdAt, likeCount, retweetCount, replyCount, bookmarkCount
Tavily configuration
tavily.search(
    query="NVIDIA NVDA stock earnings data center AI business news",
    topic="news", days=30, max_results=20, include_answer=True,
)
Run order
1.	Run the Apify actor and download the resulting CSV(s) into data/raw/.
2.	Open Copy_of_CrowdWisdom_Sentiment_Price_Prediction.ipynb and run all cells top to bottom (Google Colab).
3.	Outputs: nvda_forecast.csv and nvda_walk_forward_results.csv.
4. Validation method
•	Expanding-window walk-forward using TimeSeriesSplit(n_splits=5): each fold trains only on data before its test block.
•	Baseline: persistence (predict tomorrow's close = today's close).
•	Strategy simulation (n+1 model): go long for one day if the predicted next close exceeds today's close, otherwise hold cash. Returns are close-to-close; no costs in the headline numbers.
•	Risk metrics: annualized Sharpe and Sortino (252 days, risk-free rate 0), maximum drawdown from the equity curve.
5. Results
Forecast (as of the Oct 16, 2026 close)
Horizon	Date	Predicted close (USD)
n+0	2026-10-16	214.13 (observed)
n+1	2026-10-19	213.93
n+2	2026-10-20	213.31
n+3	2026-10-21	215.24
n+4	2026-10-22	217.81
n+5	2026-10-23	222.61
Not investment advice. Sentiment inputs for the most recent days were sparse, so this forecast is effectively price-driven.
Price-forecast accuracy (n+1)
Model	MAE (USD)
Persistence baseline	4.035
Random Forest, price only	4.757
Random Forest, price + sentiment	4.752
Sentiment improved MAE by about 0.006, which is negligible. Neither model beats persistence.
Trading simulation (100 out-of-sample days, 2026-05-26 → 2026-10-15)
Metric	Strategy	Buy & hold
Cumulative return	56.1%	-0.1%
Sharpe ratio	3.97	0.18
Sortino ratio	8.17	n/a
Max drawdown	-8.14%	n/a
Days long / total	48 / 100	100 / 100
Directional hit rate	66%	n/a
Robustness checks (computed from nvda_walk_forward_results.csv):
•	Bootstrap 5th–95th percentile Sharpe: 1.4 – 6.5 (wide, given 100 observations).
•	The 5 best days account for about 58% of the log return; excluding them the cumulative return is about 20%.
•	With 0.05%–0.2% per-trade costs, Sharpe stays around 3.4–3.8 (turnover is low).
•	A trivial benchmark, "long when close is below its 20-day mean", returns about 21% (Sharpe ≈ 2.6) over the same window.
•	By fold, strategy return was +18.4%, +11.3%, +4.4%, +13.5% and 0.0%. The final fold (Sep 18 – Oct 15) held no long positions.
6. Interpretation
•	The model is a better directional signal than a price forecaster: it loses to persistence on MAE but picks the correct direction about two-thirds of the time.
•	Its predictions are shrunk toward the average price, so the strategy behaves like mean reversion. NVDA was range-bound over the test window (daily return autocorrelation ≈ -0.17), which favors this behavior. It may not hold in a trending market.
•	Because sentiment coverage was sparse (see below), this study cannot say whether X sentiment has predictive value. It only shows that, with the data collected, sentiment added no measurable accuracy.

7. Limitations
•	X coverage: posts were collected on only a few dates rather than across the full 180-day window, so sentiment is 0 on most days.
•	Small sample: ~100 out-of-sample days in one market regime; the first fold trains on only ~20 rows.
•	No gap between train and test in TimeSeriesSplit; for horizons above n+1 the last training targets overlap the test window.
•	Price-level targets: tree models cannot extrapolate beyond the training range. Predicting returns would be more robust.
•	Sentiment model: VADER is a general-purpose lexicon and misses financial context and sarcasm.
•	News is not used as a model feature; it is collected and scored as context only, and covers only the last 30 days.
•	Post engagement and author follower counts are not yet used for weighting; timestamps are aggregated by UTC calendar date, not aligned to market hours.
•	Simulation ignores slippage, taxes and position sizing; Sharpe uses a 0% risk-free rate.





8. Repository contents
File	Description
Copy_of_CrowdWisdom_Sentiment_Price_Prediction.ipynb	Main notebook: data collection, sentiment, features, models, evaluation
nvda_forecast.csv	n+0 … n+5 forecast table
nvda_walk_forward_results.csv	Out-of-sample predictions, strategy returns, equity and drawdown

