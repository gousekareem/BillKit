"""Image transforms for the bill/non-bill classifier (torchvision). Imported lazily so that
dataset tooling works without torch installed."""
from __future__ import annotations


def build_transforms(cfg: dict, train: bool):
    from torchvision import transforms as T  # noqa: N812

    size = cfg["input"]["size"]
    norm = T.Normalize(cfg["input"]["mean"], cfg["input"]["std"])
    if not train or not cfg.get("augmentation", {}).get("enabled", False):
        return T.Compose([T.Resize((size, size)), T.ToTensor(), norm])
    a = cfg["augmentation"]
    return T.Compose([
        T.RandomRotation(a["rotation_degrees"], fill=245),
        T.RandomPerspective(distortion_scale=a["perspective"], p=0.4, fill=245),
        T.ColorJitter(brightness=a["brightness"], contrast=a["contrast"]),
        T.RandomApply([T.GaussianBlur(5, sigma=tuple(a["blur_sigma"]))], p=0.3),
        T.RandomGrayscale(p=a["grayscale_probability"]),
        T.Resize((size, size)),
        T.ToTensor(),
        norm,
    ])
