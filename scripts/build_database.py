#!/usr/bin/env python3
"""
scripts/build_database.py

Import pre-generated problem data and content into Supabase.

This script is a pure importer — no LLM calls. Content is generated
separately by Claude Code interactively (or via admin UI for open-source users).

Data layout (problem-centric):
  data/problems/{id:04d}-{slug}.json   — per-problem file: metadata + content (merged)
  data/lists/{slug}.json               — list definition: {slug, name, description, type, problem_ids: [...]}

Usage:
  python3 scripts/build_database.py --list blind75                   # import problems + content
  python3 scripts/build_database.py --list blind75 --problems-only   # import problems/list only
  python3 scripts/build_database.py --list blind75 --content-only    # import content only
  python3 scripts/build_database.py --list all                       # import all lists

Resumable: existing rows are upserted (safe to re-run).
Content import is insert-only (ignore_duplicates=True) — never overwrites existing content.
"""

import asyncio
import json
import os
import sys
import argparse
import logging
from pathlib import Path

from supabase import acreate_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "apps" / "web" / ".env.local")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

DATA_DIR      = Path(__file__).parent.parent / "data"
PROBLEMS_DIR  = DATA_DIR / "problems"
LISTS_DIR     = DATA_DIR / "lists"

CONTENT_FIELDS = ["explanation", "solution_code", "complexity_analysis",
                  "pseudocode", "alternative_approaches", "follow_up"]
METADATA_FIELDS = {"leetcode_id", "title", "slug", "difficulty", "rating", "topics"}


def load_list(slug: str) -> dict | None:
    """Load data/lists/{slug}.json. Returns None if not found."""
    f = LISTS_DIR / f"{slug}.json"
    if not f.exists():
        log.error(f"List file not found: {f}")
        return None
    return json.loads(f.read_text(encoding="utf-8"))


def load_problem(lid: int, slug: str) -> dict | None:
    """Load data/problems/{id:04d}-{slug}.json. Returns None if not found."""
    f = PROBLEMS_DIR / f"{lid:04d}-{slug}.json"
    if not f.exists():
        return None
    return json.loads(f.read_text(encoding="utf-8"))


def all_list_slugs() -> list[str]:
    """Return all slugs from data/lists/."""
    return sorted(f.stem for f in LISTS_DIR.glob("*.json"))


# ── Import problems + curated list ────────────────────────────────────────────

async def import_problems(
    db,
    list_obj: dict,
    problems: list[dict],
) -> dict[str, int]:
    """Upsert problems, create curated list, link via list_problems.
    Returns slug → problem_id mapping."""

    slug        = list_obj["slug"]
    list_name   = list_obj["name"]
    list_desc   = list_obj["description"]
    list_type   = list_obj.get("type", "classic")

    metadata_rows = [
        {k: v for k, v in p.items() if k in METADATA_FIELDS}
        for p in problems
    ]

    log.info(f"Upserting {len(metadata_rows)} problems...")
    result = await db.table("problems").upsert(
        metadata_rows, on_conflict="leetcode_id"
    ).execute()
    slug_to_id = {r["slug"]: r["id"] for r in (result.data or [])}
    log.info(f"  ✓ {len(slug_to_id)} problems upserted")

    # Create or fetch the curated list
    existing = await db.table("curated_lists") \
        .select("id").eq("slug", slug).maybe_single().execute()
    if existing and existing.data:
        list_id = existing.data["id"]
        log.info(f"  ✓ List '{slug}' already exists (id={list_id})")
    else:
        r = await db.table("curated_lists").insert({
            "slug":          slug,
            "name":          list_name,
            "description":   list_desc,
            "problem_count": len(problems),
            "type":          list_type,
        }).execute()
        list_id = r.data[0]["id"]
        log.info(f"  ✓ Created list '{slug}' (id={list_id})")

    # Link problems to list (sequence = position in problem_ids array)
    list_rows = [
        {
            "list_id":         list_id,
            "problem_id":      slug_to_id[p["slug"]],
            "sequence_number": i + 1,
        }
        for i, p in enumerate(problems)
        if p["slug"] in slug_to_id
    ]
    # Delete existing entries first to avoid (list_id, sequence_number) unique constraint
    # conflicts when a list is expanded (new problems shift sequence numbers)
    await db.table("list_problems").delete().eq("list_id", list_id).execute()
    await db.table("list_problems").insert(list_rows).execute()

    # Sync problem_count
    count = await db.table("list_problems").select("id", count="exact").eq("list_id", list_id).execute()
    await db.table("curated_lists").update(
        {"problem_count": count.count or len(list_rows)}
    ).eq("id", list_id).execute()
    log.info(f"  ✓ Linked {len(list_rows)} problems (problem_count updated)")

    return slug_to_id


# ── Import content ─────────────────────────────────────────────────────────────

async def import_content(db, problems: list[dict], slug_to_id: dict[str, int]) -> None:
    """Import content fields from problem files.

    Only inserts NEW records — problems already in DB are skipped
    (upsert with ignore_duplicates=True).
    """
    ok = skipped = failed = 0

    for p in problems:
        pslug = p["slug"]

        # Skip if this problem has no content fields in its file
        if not any(p.get(f) for f in CONTENT_FIELDS):
            skipped += 1
            continue

        pid = slug_to_id.get(pslug)
        if not pid:
            log.warning(f"  Skipping '{pslug}' — not found in DB")
            skipped += 1
            continue

        row = {
            "problem_id":             pid,
            "updated_at":             "now()",
            "explanation":            p.get("explanation", ""),
            "solution_code":          p.get("solution_code", ""),
            "complexity_analysis":    p.get("complexity_analysis", ""),
            "pseudocode":             p.get("pseudocode"),
            "alternative_approaches": p.get("alternative_approaches"),
            "follow_up":              p.get("follow_up"),
        }
        try:
            await db.table("problem_content").upsert(
                row, on_conflict="problem_id", ignore_duplicates=True
            ).execute()
            log.info(f"  ✓ {pslug}")
            ok += 1
        except Exception as e:
            log.error(f"  ✗ {pslug}: {e}")
            failed += 1

    log.info(f"Content import complete — ok={ok}, skipped={skipped}, failed={failed}")


# ── Per-list import orchestration ─────────────────────────────────────────────

async def import_list(db, slug: str, args: argparse.Namespace) -> bool:
    """Import a single list by slug. Returns True on success."""

    list_obj = load_list(slug)
    if not list_obj:
        return False

    log.info(f"=== Importing list: {slug} ({list_obj['name']}) ===")

    # Load problem data for all IDs in the list
    problems: list[dict] = []
    missing_files: list[int] = []
    for lid in list_obj["problem_ids"]:
        # Find the problem file — we need the slug to build the filename
        # Since we only have the ID here, glob for it
        matches = list(PROBLEMS_DIR.glob(f"{lid:04d}-*.json"))
        if not matches:
            missing_files.append(lid)
            continue
        p = json.loads(matches[0].read_text(encoding="utf-8"))
        problems.append(p)

    if missing_files:
        log.warning(f"  {len(missing_files)} problem files not found: {missing_files[:10]}...")

    slug_to_id: dict[str, int] = {}

    if not args.content_only:
        slug_to_id = await import_problems(db, list_obj, problems)
    else:
        # Fetch existing IDs from DB
        result = await db.table("problems").select("id, slug").execute()
        slug_to_id = {r["slug"]: r["id"] for r in (result.data or [])}

    if not args.problems_only:
        await import_content(db, problems, slug_to_id)

    return True


# ── Entry point ────────────────────────────────────────────────────────────────

async def main(args: argparse.Namespace) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local")
        sys.exit(1)

    db = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    log.info("Connected to Supabase")

    if args.list == "all":
        slugs_to_import = all_list_slugs()
        log.info(f"--list all: {len(slugs_to_import)} lists found in data/lists/")
        succeeded: list[str] = []
        failed: list[str] = []

        for slug in slugs_to_import:
            ok = await import_list(db, slug, args)
            (succeeded if ok else failed).append(slug)

        log.info(
            f"All done. Imported: {len(succeeded)} ({', '.join(succeeded) or 'none'}). "
            f"Failed: {len(failed)} ({', '.join(failed) or 'none'})."
        )
    else:
        ok = await import_list(db, args.list, args)
        if not ok:
            sys.exit(1)
        log.info("All done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import pre-generated data into Supabase")
    parser.add_argument(
        "--list",
        required=True,
        metavar="SLUG",
        help="List slug (e.g. blind75) or 'all'",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--problems-only", action="store_true", help="Import problems/list only, skip content")
    mode.add_argument("--content-only",  action="store_true", help="Import content only, skip problems/list")
    asyncio.run(main(parser.parse_args()))
