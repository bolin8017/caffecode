#!/usr/bin/env python3
"""
Generate topic-based curated list JSON files for orphan problems.

Reads all problem files and existing lists, finds problems not in any list,
and assigns them to topic-based lists. Problems can appear in multiple lists
(cross-listing by topic match).

Also appends specific orphans to existing lists.

Usage:
  python3 scripts/generate_topic_lists.py [--dry-run]
"""

import json
import argparse
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "data"
PROBLEMS_DIR = DATA_DIR / "problems"
LISTS_DIR = DATA_DIR / "lists"

CONTENT_FIELDS = [
    "explanation", "solution_code", "complexity_analysis",
    "pseudocode", "alternative_approaches", "follow_up",
]

# New lists: slug → (name, description, type, matching topics)
NEW_LISTS = {
    "segment-tree-bit": (
        "Segment Tree & BIT",
        "Master segment trees and binary indexed trees for range queries and updates.",
        "algorithm",
        {"segment-tree", "binary-indexed-tree"},
    ),
    "design-patterns": (
        "System Design Patterns",
        "Practice data structure design problems commonly asked in interviews.",
        "topic",
        {"design"},
    ),
    "graph-advanced": (
        "Graph Advanced",
        "Advanced graph algorithms including topological sort, shortest paths, and network flow.",
        "topic",
        {"graph", "topological-sort"},
    ),
    "number-theory": (
        "Number Theory & Combinatorics",
        "Number theory, counting, combinatorics, and probability problems.",
        "topic",
        {"number-theory", "counting", "combinatorics"},
    ),
    "string-advanced": (
        "String Advanced",
        "Advanced string manipulation, matching, and parsing problems.",
        "topic",
        {"string"},
    ),
    "queue-deque": (
        "Queue & Deque Patterns",
        "Queue, deque, and monotonic queue pattern problems.",
        "algorithm",
        {"queue", "monotonic-queue"},
    ),
    "sorting-patterns": (
        "Sorting & Ordered Set",
        "Sorting algorithms, ordered sets, and related data structure problems.",
        "algorithm",
        {"sorting", "ordered-set"},
    ),
    "simulation": (
        "Simulation & Implementation",
        "Simulation and step-by-step implementation problems.",
        "topic",
        {"simulation"},
    ),
    "divide-conquer": (
        "Divide & Conquer",
        "Divide and conquer algorithm problems.",
        "algorithm",
        {"divide-and-conquer"},
    ),
    "tree-bst": (
        "BST Patterns",
        "Binary search tree construction, traversal, and manipulation patterns.",
        "topic",
        {"binary-search-tree", "binary-tree"},
    ),
    "game-theory": (
        "Game Theory",
        "Game theory and minimax strategy problems.",
        "topic",
        {"game-theory"},
    ),
    "geometry": (
        "Geometry & Math",
        "Computational geometry and spatial math problems.",
        "topic",
        {"geometry"},
    ),
}

# Orphans to append to existing lists: leetcode_id → list slug
EXISTING_LIST_EXPANSIONS = {
    256: "dp-patterns",
    2487: "linked-list-patterns",
    1863: "bit-manipulation",
    2334: "union-find",
}


def load_all_list_ids() -> set[int]:
    """Return all problem IDs already in any list."""
    ids = set()
    for f in LISTS_DIR.glob("*.json"):
        with open(f) as fh:
            for pid in json.load(fh).get("problem_ids", []):
                ids.add(pid)
    return ids


def load_orphans(existing_ids: set[int]) -> list[dict]:
    """Load problems with content that aren't in any list."""
    orphans = []
    for f in PROBLEMS_DIR.glob("*.json"):
        with open(f) as fh:
            p = json.load(fh)
            if (
                any(p.get(field) for field in CONTENT_FIELDS)
                and p["leetcode_id"] not in existing_ids
            ):
                orphans.append(p)
    return orphans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print assignments without writing files")
    args = parser.parse_args()

    existing_ids = load_all_list_ids()
    orphans = load_orphans(existing_ids)
    print(f"Found {len(orphans)} orphan problems")

    # Assign orphans to new lists (cross-listing allowed)
    assignments: dict[str, list[int]] = defaultdict(list)
    covered = set()

    for p in orphans:
        topics = set(p.get("topics", []))
        for slug, (_, _, _, match_topics) in NEW_LISTS.items():
            if topics & match_topics:
                assignments[slug].append(p["leetcode_id"])
                covered.add(p["leetcode_id"])

    # Handle specific expansions
    for lid, list_slug in EXISTING_LIST_EXPANSIONS.items():
        if lid not in covered:
            covered.add(lid)

    uncovered = [p for p in orphans if p["leetcode_id"] not in covered]
    if uncovered:
        print(f"WARNING: {len(uncovered)} problems still uncovered:")
        for p in uncovered:
            print(f"  #{p['leetcode_id']} {p['title']} topics={p['topics']}")
        return

    print(f"\nAll {len(orphans)} orphans covered.")

    # Write new list files
    for slug, (name, description, list_type, _) in NEW_LISTS.items():
        ids = sorted(assignments.get(slug, []))
        if not ids:
            print(f"  SKIP {slug}: 0 problems")
            continue

        list_obj = {
            "slug": slug,
            "name": name,
            "description": description,
            "type": list_type,
            "problem_ids": ids,
        }

        out = LISTS_DIR / f"{slug}.json"
        print(f"  {slug}: {len(ids)} problems → {out}")
        if not args.dry_run:
            out.write_text(json.dumps(list_obj, indent=2, ensure_ascii=False) + "\n")

    # Expand existing lists
    for lid, list_slug in EXISTING_LIST_EXPANSIONS.items():
        list_file = LISTS_DIR / f"{list_slug}.json"
        with open(list_file) as fh:
            lst = json.load(fh)
        if lid not in lst["problem_ids"]:
            lst["problem_ids"].append(lid)
            print(f"  +#{lid} → {list_slug} (now {len(lst['problem_ids'])} problems)")
            if not args.dry_run:
                list_file.write_text(json.dumps(lst, indent=2, ensure_ascii=False) + "\n")

    if args.dry_run:
        print("\n(dry-run — no files written)")
    else:
        print("\nDone. Run: python3 scripts/build_database.py --list all")


if __name__ == "__main__":
    main()
