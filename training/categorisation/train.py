"""Train and compare categorisation baselines; export the best linear model for the app.

Compares (grouped k-fold CV, groups = template_id so near-duplicates never span folds):
  - keyword rules baseline (same idea as ai/src/lexicon.ts, simplified)
  - TF-IDF + Logistic Regression
  - TF-IDF + Multinomial Naive Bayes
Exports TF-IDF + LR as JSON (format billkit-tfidf-logreg/1) and, with --register, makes it the
active categoriser in ai/models/registry.json. Records the run in experiments/experiment_log.csv.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import platform
import re
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import GroupKFold
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from training.categorisation.feature_extraction import make_vectorizer  # noqa: E402
from training.common import REPO, load_yaml, read_csv, save_json  # noqa: E402

RULES = {
    "Food": r"restaurant|cafe|coffee|biryani|dosa|naan|bakers|sweets|thali|chai|samosa|dhaba|kitchen|juice",
    "Groceries": r"supermarket|mart|kirana|general stores|rice|dal|atta|sugar|oil|milk|onion",
    "Utilities": r"electricity|power|water|gas|broadband|kwh|units|internet|postpaid|lpg",
    "Fuel": r"petrol|diesel|fuel|filling|nozzle|cng|petroleum",
    "Healthcare": r"pharmacy|medicals|hospital|clinic|diagnostics|tab|syrup|consultation",
    "Shopping": r"fashions|electronics|footwear|textiles|shirt|jeans|charger|shoes|stationery",
    "Transportation": r"cabs|taxi|auto|parking|toll|fare",
    "Travel": r"hotel|inn|resort|airlines|tours|room|pnr|berth|boarding",
    "Entertainment": r"cinema|multiplex|movie|gaming|bowling|popcorn",
    "Education": r"academy|coaching|college|tuition|exam|textbook",
    "Personal care": r"salon|parlour|spa|fitness|haircut|facial|gym",
}


def rules_predict(texts: list[str]) -> list[str]:
    out = []
    for t in texts:
        scores = {c: len(re.findall(p, t.lower())) for c, p in RULES.items()}
        best = max(scores, key=scores.get)
        out.append(best if scores[best] > 0 else "Other")
    return out


def export_lr(pipe, version: str, trained_on: str) -> dict:
    vec, lr = pipe.steps[0][1], pipe.steps[1][1]
    return {
        "format": "billkit-tfidf-logreg/1",
        "version": version,
        "classes": [str(c) for c in lr.classes_],
        "vocabulary": {k: int(v) for k, v in vec.vocabulary_.items()},
        "idf": [round(float(x), 6) for x in vec.idf_],
        "coef": [[round(float(x), 6) for x in row] for row in lr.coef_],
        "intercept": [round(float(x), 6) for x in lr.intercept_],
        "ngramRange": list(vec.ngram_range),
        "analyzer": vec.analyzer,
        "lowercase": bool(vec.lowercase),
        "trainedOn": trained_on,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="training/configs/categorisation_config.yaml")
    ap.add_argument("--register", action="store_true", help="make the exported model active in ai/models/registry.json")
    args = ap.parse_args(argv)
    cfg = load_yaml(REPO / args.config)
    rows = read_csv(REPO / cfg["data"]["examples"])
    if not rows:
        print("No training examples. Run training/categorisation/generate_seed_data.py or provide reviewed examples.")
        return 1
    X = [r[cfg["data"]["text_column"]] for r in rows]
    y = np.array([r[cfg["data"]["label_column"]] for r in rows])
    groups = np.array([r.get(cfg["data"].get("group_column", ""), str(i)) for i, r in enumerate(rows)])
    seed = int(cfg.get("seed", 0))
    folds = GroupKFold(n_splits=int(cfg.get("cv_folds", 5)))
    models = {
        "logistic_regression": lambda: make_pipeline(make_vectorizer(cfg), LogisticRegression(max_iter=2000, C=4.0, random_state=seed)),
        "multinomial_nb": lambda: make_pipeline(make_vectorizer(cfg), MultinomialNB(alpha=0.3)),
    }
    results: dict[str, dict] = {"keyword_rules": {"accuracy": [], "macro_f1": []}}
    results.update({m: {"accuracy": [], "macro_f1": []} for m in models})
    t0 = time.time()
    for train_idx, test_idx in folds.split(X, y, groups):
        Xtr, Xte = [X[i] for i in train_idx], [X[i] for i in test_idx]
        pr = rules_predict(Xte)
        results["keyword_rules"]["accuracy"].append(accuracy_score(y[test_idx], pr))
        results["keyword_rules"]["macro_f1"].append(f1_score(y[test_idx], pr, average="macro", zero_division=0))
        for name, factory in models.items():
            p = factory().fit(Xtr, y[train_idx]).predict(Xte)
            results[name]["accuracy"].append(accuracy_score(y[test_idx], p))
            results[name]["macro_f1"].append(f1_score(y[test_idx], p, average="macro", zero_division=0))
    summary = {k: {m: round(float(np.mean(v)), 4) for m, v in d.items()} | {"folds": len(d["accuracy"])} for k, d in results.items()}
    final = models["logistic_regression"]().fit(X, y)
    date = dt.date.today().isoformat()
    version = f"{cfg['export']['version_prefix']}-{date}"
    trained_on = f"{len(rows)} SYNTHETIC template examples ({cfg['data']['examples']}); not real bills"
    model_json = export_lr(final, version, trained_on)
    out_dir = REPO / cfg["export"]["output_dir"]
    out_file = out_dir / f"{version}.json"
    save_json(out_file, model_json)
    report = {
        "model": version, "task": "expense categorisation", "architecture": "TF-IDF (word 1-2 grams, l2) + multinomial logistic regression (C=4)",
        "training_examples": len(rows), "classes": model_json["classes"], "cv": "GroupKFold by template_id", "cv_results": summary,
        "training_time_s": round(time.time() - t0, 2), "hardware": f"{platform.processor() or platform.machine()} / Python {platform.python_version()}",
        "caveat": "Cross-validation on template-generated text overestimates real-world performance. Re-train on reviewed real corrections.",
        "created": date,
    }
    save_json(out_dir / f"{version}.report.json", report)
    log = REPO / "training/experiments/experiment_log.csv"
    with open(log, "a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        for name, s in summary.items():
            w.writerow([f"CAT-{date}", date, "categorisation", cfg["data"]["examples"], args.config, version if name == "logistic_regression" else name, "cv_macro_f1", s["macro_f1"], "synthetic seed data; grouped CV"])
    if args.register:
        reg_path = REPO / "ai/models/registry.json"
        reg = json.loads(reg_path.read_text()) if reg_path.exists() else {"format": "billkit-model-registry/1", "active": {}, "models": []}
        rel = out_file.relative_to(REPO / "ai/models").as_posix()
        reg["models"] = [m for m in reg.get("models", []) if m.get("file") != rel] + [{"task": "categoriser", "version": version, "file": rel, "report": rel.replace(".json", ".report.json"), "created": date, "trained_on": trained_on}]
        reg.setdefault("active", {})["categoriser"] = rel
        save_json(reg_path, reg)
        print(f"Registered {version} as the active categoriser.")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
