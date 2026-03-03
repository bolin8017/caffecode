#!/usr/bin/env python3
"""
scripts/sync_leetcode.py

Fetch LeetCode problem metadata and merge into data/problems/*.json.

Usage:
  python3 scripts/sync_leetcode.py                 # sync all problems
  python3 scripts/sync_leetcode.py --dry-run        # preview without writing
  python3 scripts/sync_leetcode.py --ids 1,42,200   # sync specific problems only
"""

import asyncio
import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
PROBLEMS_DIR = DATA_DIR / "problems"

CONTENT_FIELDS = [
    "explanation", "solution_code", "complexity_analysis",
    "pseudocode", "alternative_approaches", "follow_up",
]
METADATA_FIELDS = ["leetcode_id", "title", "slug", "difficulty", "rating", "topics"]

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/"
ZEROTRAC_RATINGS_URL = (
    "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/ratings.txt"
)

PAGE_SIZE = 50
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2.0


def parse_ratings_tsv(tsv_text: str) -> dict[int, int]:
    """Parse zerotrac ratings.txt TSV into {leetcode_id: rounded_rating}."""
    ratings: dict[int, int] = {}
    for line in tsv_text.strip().splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        try:
            rating = round(float(parts[0]))
            problem_id = int(parts[1])
            ratings[problem_id] = rating
        except (ValueError, IndexError):
            continue
    return ratings


def map_difficulty(api_difficulty: str) -> str:
    """Map LeetCode API difficulty (EASY/MEDIUM/HARD) to title case."""
    return api_difficulty.capitalize()


def has_content(problem: dict) -> bool:
    """Check if a problem dict has any non-empty content fields."""
    return any(problem.get(f) for f in CONTENT_FIELDS)


def build_metadata(question: dict, ratings: dict[int, int]) -> dict | None:
    """Convert a GraphQL question response to our metadata format.
    Returns None for paid-only problems."""
    if question.get("paidOnly"):
        return None

    lid = int(question["questionFrontendId"])
    return {
        "leetcode_id": lid,
        "title": question["title"],
        "slug": question["titleSlug"],
        "difficulty": map_difficulty(question["difficulty"]),
        "rating": ratings.get(lid),
        "topics": [t["slug"] for t in (question.get("topicTags") or [])],
    }


def merge_problem_file(metadata: dict, problems_dir: Path) -> str:
    """Merge metadata into a problem JSON file, preserving content fields.

    Returns: "created", "updated", or "unchanged"
    """
    lid = metadata["leetcode_id"]
    slug = metadata["slug"]
    filename = f"{lid:04d}-{slug}.json"
    filepath = problems_dir / filename

    if filepath.exists():
        existing = json.loads(filepath.read_text(encoding="utf-8"))

        # Check if metadata actually changed
        changed = False
        for key in METADATA_FIELDS:
            new_val = metadata.get(key)
            old_val = existing.get(key)
            # Null rating doesn't count as a change (non-contest problems)
            if key == "rating" and new_val is None and old_val is not None:
                continue
            if old_val != new_val:
                changed = True
                break

        if not changed:
            return "unchanged"

        # Update metadata fields, preserve everything else (content)
        for key in METADATA_FIELDS:
            # Keep existing rating if new value is None (non-contest problems)
            if key == "rating" and metadata[key] is None and existing.get(key) is not None:
                continue
            existing[key] = metadata[key]

        filepath.write_text(
            json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return "updated"
    else:
        # New file — metadata only
        filepath.write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return "created"


GRAPHQL_QUERY = """
query problemsetQuestionListV2($limit: Int, $skip: Int) {
  problemsetQuestionListV2(categorySlug: "", limit: $limit, skip: $skip) {
    totalLength
    hasMore
    questions {
      questionFrontendId
      title
      titleSlug
      difficulty
      paidOnly
      topicTags { slug }
    }
  }
}
"""


async def fetch_ratings(client: httpx.AsyncClient) -> dict[int, int]:
    """Download zerotrac ratings.txt and parse into {id: rating}."""
    log.info("Fetching zerotrac ratings...")
    resp = await client.get(ZEROTRAC_RATINGS_URL, timeout=30)
    resp.raise_for_status()
    ratings = parse_ratings_tsv(resp.text)
    log.info(f"  ✓ {len(ratings)} ratings loaded")
    return ratings


MAX_PAGES = 200  # Safety limit (~10,000 problems)


async def fetch_all_problems(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all problems from LeetCode GraphQL API with pagination and retry."""
    all_questions: list[dict] = []
    skip = 0

    for _page in range(MAX_PAGES):
        payload = {
            "query": GRAPHQL_QUERY,
            "variables": {"limit": PAGE_SIZE, "skip": skip},
        }

        for attempt in range(MAX_RETRIES):
            try:
                resp = await client.post(
                    LEETCODE_GRAPHQL_URL,
                    json=payload,
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()
                break
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                log.warning(f"  Retry {attempt + 1}/{MAX_RETRIES} after {delay}s: {e}")
                await asyncio.sleep(delay)

        result = data["data"]["problemsetQuestionListV2"]
        questions = result["questions"]
        all_questions.extend(questions)

        log.info(f"  Fetched {len(all_questions)}/{result['totalLength']} problems...")

        if not result["hasMore"]:
            break
        skip += PAGE_SIZE
    else:
        log.warning(f"Hit safety limit of {MAX_PAGES} pages")

    return all_questions


def generate_sync_report(problems_dir: Path) -> dict:
    """Scan all problem files and generate a content coverage report."""
    with_content_count = 0
    metadata_only_ids: list[int] = []

    for f in sorted(problems_dir.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        lid = data.get("leetcode_id", 0)
        if has_content(data):
            with_content_count += 1
        else:
            metadata_only_ids.append(lid)

    return {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "total": with_content_count + len(metadata_only_ids),
        "with_content": with_content_count,
        "metadata_only": len(metadata_only_ids),
        "metadata_only_ids": metadata_only_ids,
    }


async def run_sync(args: argparse.Namespace) -> None:
    """Main sync orchestration."""
    PROBLEMS_DIR.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient() as client:
        # 1. Fetch ratings
        ratings = await fetch_ratings(client)

        # 2. Fetch all problems
        log.info("Fetching problems from LeetCode GraphQL API...")
        questions = await fetch_all_problems(client)
        log.info(f"  ✓ {len(questions)} total questions fetched")

    # 3. Filter by --ids if specified
    id_filter: set[int] | None = None
    if args.ids:
        id_filter = {int(x.strip()) for x in args.ids.split(",")}
        log.info(f"Filtering to {len(id_filter)} problem IDs")

    # 4. Build metadata and merge
    created = updated = unchanged = skipped = 0

    for q in questions:
        meta = build_metadata(q, ratings)
        if meta is None:
            skipped += 1  # paid-only
            continue
        if id_filter and meta["leetcode_id"] not in id_filter:
            continue

        if args.dry_run:
            lid = meta["leetcode_id"]
            filepath = PROBLEMS_DIR / f"{lid:04d}-{meta['slug']}.json"
            status = "exists" if filepath.exists() else "new"
            log.info(f"  [DRY RUN] {lid:04d} {meta['title']} ({status})")
            continue

        action = merge_problem_file(meta, PROBLEMS_DIR)
        if action == "created":
            created += 1
        elif action == "updated":
            updated += 1
        else:
            unchanged += 1

    log.info(f"Sync complete: created={created}, updated={updated}, unchanged={unchanged}, skipped_paid={skipped}")

    # 5. Generate sync report
    if not args.dry_run:
        report = generate_sync_report(PROBLEMS_DIR)
        report_path = DATA_DIR / "sync-report.json"
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        log.info(
            f"Sync report: {report['with_content']} with content, "
            f"{report['metadata_only']} metadata-only → {report_path}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync LeetCode problem metadata into data/problems/"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing files",
    )
    parser.add_argument(
        "--ids",
        metavar="1,2,3",
        help="Sync specific problem IDs only (comma-separated)",
    )
    asyncio.run(run_sync(parser.parse_args()))


if __name__ == "__main__":
    main()
