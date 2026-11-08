import json
from dataclasses import dataclass
from pathlib import Path

from .normalize import Entity


@dataclass
class Clip:
    id: str
    category: str
    text: str
    entities: list[Entity]
    wav: Path
    featured: bool
    field: bool


def load_corpus(path: Path, clips_dir: Path | None = None) -> list[Clip]:
    path = Path(path)
    clips_dir = Path(clips_dir) if clips_dir is not None else path.parent / "clips"
    items = json.loads(path.read_text(encoding="utf-8"))
    return [
        Clip(
            id=item["id"],
            category=item["category"],
            text=item["text"],
            entities=[
                Entity(e["type"], e["value"], list(e.get("aliases", [])))
                for e in item.get("entities", [])
            ],
            wav=clips_dir / f"{item['id']}.wav",
            featured=bool(item.get("featured", False)),
            field=bool(item.get("field", False)),
        )
        for item in items
    ]
