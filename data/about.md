# About the Food Additives Catalogue

The Food Additives Catalogue demystifies the long names and **E‑numbers** on food labels.  It brings together open‑source data, authoritative classifications and search interest metrics in a single, easy‑to‑use interface so that consumers, researchers and food professionals can quickly see what each additive does and how widely it is used.

## Data sources and methodology

We started by extracting all additives from **Open Food Facts** (OFF) that are present in products sold in the United States.  For each additive we compiled a list of relevant search keywords.  Using these keywords we fetched **search volume**, **historical interest** and **popular questions** from Ahrefs’ Keywords Explorer.  We then enriched the additive records with product counts from OFF and functional class labels from the **Codex Alimentarius**.  Finally, we assigned one or more origin tags (plant‑derived, animal‑derived, microbiological or synthetic) based on encyclopaedic and Codex information.

### Open Food Facts (OFF)

OFF is a non‑profit project that runs the world’s largest open database of food products.  It contains **over three million products** and more than **seven million images**:contentReference[oaicite:0]{index=0} and is released under an **Open Database Licence**:contentReference[oaicite:1]{index=1}.  We used OFF to identify the list of additives used in U.S. products and to count how many products contain each additive.  Because the OFF database is constantly evolving, these counts should be viewed as approximations rather than exact figures.

### Codex functional classes

The **Codex Alimentarius Commission** maintains the *International Numbering System* and groups additives into 23 functional classes, including **acids**, **acidity regulators**, **anti‑caking agents**, **antioxidants**, **colours**, **emulsifiers**, **preservatives** and **sweeteners**:contentReference[oaicite:2]{index=2}.  We use these classes to tag each additive and, where applicable, assign multiple functions.

### Ahrefs search‑interest metrics

To reflect public curiosity, we draw on Ahrefs’ Keywords Explorer.  Ahrefs defines **search volume** as the average number of times people search for a query in a target country each month:contentReference[oaicite:3]{index=3} and bases its estimates on Google Keyword Planner data:contentReference[oaicite:4]{index=4}.  After compiling keywords for each additive, we aggregate their U.S. search volumes to report a single monthly volume and ranking.  Small spark‑line charts on additive cards show how interest has changed over time.

### Linking to official sources

Individual additive pages link to authoritative documents—such as U.S. **CFR** entries, the **USDA** list of safe ingredients, **EU** regulations and **EFSA** safety evaluations—to support statements about manufacturing, permitted uses and safety.  The catalogue is informational and not a substitute for professional advice.

## Navigating the interface

- **Browse & filter:** Use the search bar to look up an additive by name or **E‑number**.  Filters allow you to narrow results by **origin** or **function**, and a sort option lets you order cards by product count or search interest.  A *“parent E”* toggle groups sub‑classes under their parent E‑number.

- **Additive cards:** Every card shows the additive’s E‑number, name, functional tags, origin icons, search‑interest trend and monthly volume.  It also reports how many OFF products contain the additive.  Clicking a card opens its detail page.

- **Detail pages & comparison:** Each detail page offers an at‑a‑glance summary along with sections on uses, alternatives, manufacturing, safety evaluations and common myths.  A **Compare** mode lets you view several additives side by side.

## Project goals

The catalogue has three main aims:

1. **Educate & empower.** By unifying product counts, functions and search‑interest metrics, it gives people a clear picture of what each additive does and how common it is.
2. **Encourage transparency.** Links to regulations and safety assessments foster evidence‑based discussions about food additives.
3. **Champion open data.** Built on openly licensed data:contentReference[oaicite:5]{index=5}:contentReference[oaicite:6]{index=6}, it demonstrates the value of combining OFF, Codex and Ahrefs datasets to create practical, reusable tools.

## Limitations & acknowledgements

• **Approximate counts.** OFF entries are crowd‑sourced, so product counts are indicative and search volumes are modelled estimates:contentReference[oaicite:7]{index=7}.

• **Informational use only.** The catalogue is a reference tool; it does not provide legal or medical advice.  Regulatory rules vary between jurisdictions and may change.

• **Open collaboration.** Feedback is welcome.  Because the data is openly licensed:contentReference[oaicite:8]{index=8}, anyone can improve and build upon it.

Together, these elements create a concise, data‑driven resource to help you make more informed choices about the food you consume.
