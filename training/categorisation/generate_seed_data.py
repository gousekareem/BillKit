"""Generate the SYNTHETIC seed dataset for the categorisation baseline.

Author-written templates (merchant-name patterns x typical item words) are expanded
deterministically. This is NOT real bill data. It exists so the training -> export ->
registry -> inference path can be exercised and compared against keyword rules.
Models trained on it must be re-trained on reviewed real corrections before relying on them.

(c) 2026 Shaik Gouse Kareem. All rights reserved.
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

TEMPLATES: dict[str, list[tuple[list[str], list[str]]]] = {
    "Food": [
        (["{n} Restaurant", "Hotel {n} Bhavan", "{n} Dhaba", "{n} Biryani House", "{n} Kitchen"], ["chicken biryani", "paneer tikka", "butter naan", "veg thali", "masala dosa", "sweet lassi", "fried rice", "gobi manchurian"]),
        (["{n} Cafe", "{n} Coffee House", "{n} Bakers", "{n} Sweets", "{n} Juice Point"], ["cappuccino", "cold coffee", "veg puff", "plum cake", "samosa", "masala chai", "fresh lime soda", "sandwich"]),
    ],
    "Groceries": [
        (["{n} Supermarket", "{n} Fresh Mart", "{n} General Stores", "{n} Kirana", "{n} Hypermarket"], ["basmati rice 5kg", "toor dal 1kg", "sunflower oil 1l", "milk 500ml", "atta 10kg", "sugar 1kg", "onion 2kg", "detergent powder", "tea powder 250g"]),
    ],
    "Utilities": [
        (["{n} Power Distribution", "{n} Electricity Board", "{n} Water Supply Board", "{n} Gas Agency", "{n} Broadband"], ["energy charges units consumed kwh", "fixed charges meter reading", "water charges consumer no", "lpg cylinder refill", "fiber internet monthly plan", "postpaid mobile bill"]),
    ],
    "Fuel": [
        (["{n} Petroleum", "{n} Filling Station", "{n} Fuels", "{n} Service Station"], ["petrol ms litres", "diesel hsd litres", "nozzle density rate", "cng kg"]),
    ],
    "Healthcare": [
        (["{n} Pharmacy", "{n} Medicals", "{n} Hospital", "{n} Diagnostics", "{n} Clinic"], ["paracetamol tab 500mg", "cough syrup 100ml", "consultation fee", "blood test cbc", "vitamin c tablets", "x-ray chest"]),
    ],
    "Shopping": [
        (["{n} Fashions", "{n} Electronics", "{n} Footwear", "{n} Textiles", "{n} Stationery"], ["cotton shirt", "denim jeans", "usb charger", "earphones", "running shoes", "notebook a4", "ball pen pack"]),
    ],
    "Transportation": [
        (["{n} Cabs", "{n} Travels Taxi", "{n} Auto Service", "{n} Parking"], ["trip fare", "toll charges", "parking fee", "ride distance km"]),
    ],
    "Travel": [
        (["Hotel {n} Residency", "{n} Inn", "{n} Resort", "{n} Airlines", "{n} Tours"], ["room tariff 2 nights", "check in check out", "air fare pnr", "boarding pass", "sleeper berth ticket"]),
    ],
    "Entertainment": [
        (["{n} Cinemas", "{n} Multiplex", "{n} Gaming Zone"], ["movie ticket screen 2", "popcorn combo", "bowling game", "event pass"]),
    ],
    "Education": [
        (["{n} Academy", "{n} Coaching Centre", "{n} Book Depot", "{n} College"], ["tuition fee", "exam fee", "course material", "textbook"]),
    ],
    "Personal care": [
        (["{n} Salon", "{n} Beauty Parlour", "{n} Spa", "{n} Fitness"], ["haircut", "facial", "manicure", "monthly gym membership"]),
    ],
}
NAMES = ["Sri Lakshmi", "Green Valley", "Royal", "City", "Sunrise", "Star", "Annapurna", "Metro", "Blue Lotus", "Krishna", "Coastal", "New India", "Golden", "Om Sai", "Prime"]


def main(out: Path = Path(__file__).parent / "data" / "seed_examples.csv", seed: int = 20261106) -> int:
    rng = random.Random(seed)
    rows = []
    for cat, groups in TEMPLATES.items():
        for gi, (merchants, items) in enumerate(groups):
            for mi, m in enumerate(merchants):
                template_id = f"{cat}-{gi}-{mi}"
                for _ in range(6):
                    name = m.format(n=rng.choice(NAMES))
                    picked = rng.sample(items, k=min(len(items), rng.randint(1, 3)))
                    rows.append({"text": f"{name} {' '.join(picked)}", "category": cat, "template_id": template_id, "source": "synthetic-template"})
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["text", "category", "template_id", "source"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} synthetic seed examples to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
