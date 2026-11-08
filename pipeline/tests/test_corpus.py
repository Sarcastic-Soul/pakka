import json
from collections import Counter
from pathlib import Path

from shor.normalize import Entity, entity_match

CORPUS = Path(__file__).resolve().parents[2] / "data" / "corpus.json"


def load():
    return json.loads(CORPUS.read_text(encoding="utf-8"))


def test_corpus_is_valid():
    clips = load()
    ids = [c["id"] for c in clips]
    assert len(ids) == len(set(ids)) == 40
    assert Counter(c["category"] for c in clips) == {
        "amount": 10,
        "digits": 10,
        "name": 10,
        "mixed": 5,
        "plain": 5,
    }
    assert sum(c["featured"] for c in clips) == 8


def test_every_entity_matches_its_own_text():
    for clip in load():
        for e in clip["entities"]:
            entity = Entity(e["type"], e["value"], list(e.get("aliases", [])))
            assert entity_match(entity, clip["text"]), (clip["id"], e)
