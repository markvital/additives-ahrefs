# About the Food Additives Catalogue

The Food Additives Catalogue demystifies the long names and **E‑numbers** on food labels. It brings together open‑source data, authoritative classifications and search interest metrics in a single, easy‑to‑use interface so that consumers, researchers and food professionals can quickly see what each additive does and how widely it is used. We refresh the underlying dataset once a month to capture new [Open Food Facts](https://world.openfoodfacts.org/) entries and updated [Ahrefs](https://ahrefs.com/) search metrics.

## Data sources and methodology

We started by extracting all additives from [Open Food Facts](https://world.openfoodfacts.org/) (OFF) that are present in products sold in the United States. For each additive we compiled a list of relevant search keywords. Using these keywords we fetched **search volume**, **historical interest** and **popular questions** from [Ahrefs](https://ahrefs.com/)’ Keywords Explorer. We then enriched the additive records with product counts from OFF and functional class labels from the **Codex Alimentarius**. Finally, we assigned one or more origin tags (plant‑derived, animal‑derived, microbiological or synthetic) based on encyclopaedic and Codex information. This pipeline updates each month so the catalogue reflects the latest OFF submissions and Ahrefs demand trends.

### Ahrefs search‑interest metrics

To reflect public curiosity, we draw on [Ahrefs](https://ahrefs.com/)’ Keywords Explorer. Ahrefs defines **search volume** as the average number of times people search for a query in a target country each month and bases its estimates on Google Keyword Planner data. After compiling keywords for each additive, we aggregate their U.S. search volumes to report a single monthly volume and ranking. Small spark‑line charts on additive cards show how interest has changed over time.

### Open Food Facts (OFF)

[Open Food Facts](https://world.openfoodfacts.org/) is a non‑profit project that runs the world’s largest open database of food products. It contains **over three million products** and more than **seven million images** and is released under an **Open Database Licence**. We used OFF to identify the list of additives used in U.S. products and to count how many products contain each additive. Because the OFF database is constantly evolving, these counts should be viewed as approximations rather than exact figures.

### Codex functional classes

The **Codex Alimentarius Commission** maintains the *International Numbering System* and groups additives into 23 functional classes, including **acids**, **acidity regulators**, **anti‑caking agents**, **antioxidants**, **colours**, **emulsifiers**, **preservatives** and **sweeteners**. We use these classes to tag each additive and, where applicable, assign multiple functions.

### Linking to official sources

Individual additive pages link to authoritative documents—such as U.S. **CFR** entries, the **USDA** list of safe ingredients, **EU** regulations and **EFSA** safety evaluations—to support statements about manufacturing, permitted uses and safety. The catalogue is informational and not a substitute for professional advice.

### Awareness Score

Awareness Score compares how often people search for an additive with how frequently it appears in products. Scores near ×1.00 mean search interest and product usage are aligned. When the index rises above roughly ×1.25 the additive is searched far more often than expected (an “over-aware” signal), while values below ×0.80 reveal additives that are widely used but under‑searched.

To keep rare additives from producing extreme values we apply Laplace smoothing with a weight of α = 5 before computing the search-per-product ratio, and we map the logarithm of the score to colour intensity so the chip stays readable across large ranges. The optional log scaling only affects visual sorting and colour, not the numeric label.

**How to read it**

- ×1.00 ≈ typical awareness (searches track usage).
- ×1.25 and above → searched much more than it appears (over-aware or buzzy).
- ×0.80 and below → used widely but searched less than expected (under-aware).

**Calculation**

Overall Awareness Score formula:

$$
R_i = \frac{S_i + \alpha \cdot r_{\text{base}}}{(P_i + \alpha) \cdot r_{\text{base}}}
$$

Where:

- $S_i$ — monthly search volume for additive *i*.
- $P_i$ — product count for additive *i*.
- $\alpha$ — the Laplace smoothing constant (set to 5).
- $r_{\text{base}}$ — the baseline searches-per-product rate for the full dataset.

Step-by-step:

1. Compute the baseline searches per product across all qualifying additives:

   $$
   r_{\text{base}} = \frac{\sum_i S_i}{\sum_i P_i}
   $$

2. Smooth each additive’s observed counts with the baseline expectation:

   $$
   S'_i = S_i + \alpha \cdot r_{\text{base}}, \quad P'_i = P_i + \alpha, \quad r_i = \frac{S'_i}{P'_i}
   $$

3. Divide the smoothed searches-per-product ratio by the baseline to obtain the Awareness Score:

   $$
   R_i = \frac{r_i}{r_{\text{base}}}
   $$

When we need a log-scaled view for colour or sorting we take the base-10 logarithm of the index:

$$
L_i = \log_{10}(R_i)
$$

## Navigating the interface

- **Browse & filter:** Use the search bar to look up an additive by name or **E‑number**. Filters allow you to narrow results by [origin](/origin) or [function](/function), and a sort option lets you order cards by product count or search interest. A *“parent E”* toggle groups sub‑classes under their parent E‑number.

- **Additive cards:** Every card shows the additive’s E‑number, name, functional tags, origin icons, search‑interest trend and monthly volume. It also reports how many OFF products contain the additive. Clicking a card opens its detail page.

- **Detail pages & comparison:** Each detail page offers an at‑a‑glance summary along with sections on uses, alternatives, manufacturing, safety evaluations and common myths. A [comparison](/compare) mode lets you view several additives side by side.

## Project goals

The catalogue has three main aims:

1. **Educate & empower.** By unifying product counts, functions and search‑interest metrics, it gives people a clear picture of what each additive does and how common it is.
2. **Encourage transparency.** Links to regulations and safety assessments foster evidence‑based discussions about food additives.
3. **Champion open data.** Built on openly licensed data, it demonstrates the value of combining [Open Food Facts](https://world.openfoodfacts.org/), Codex and [Ahrefs](https://ahrefs.com/) datasets to create practical, reusable tools.

## Limitations & acknowledgements

• **Approximate counts.** OFF entries are crowd‑sourced, so product counts are indicative and search volumes are modelled estimates.

• **Informational use only.** The catalogue is a reference tool; it does not provide legal or medical advice. Regulatory rules vary between jurisdictions and may change.

• **Open collaboration.** Feedback is welcome. Because the data is openly licensed, anyone can improve and build upon it.

Together, these elements create a concise, data‑driven resource to help you make more informed choices about the food you consume.

## Credits

Designed and developed by [Mark Vital](http://linktr.ee/markvital). Journalism and art curation by [Anna Vital](http://linktr.ee/annavitals).
