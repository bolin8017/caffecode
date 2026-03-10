# scripts/tests/test_generate_topic_lists.py
import pytest
import json
import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from generate_topic_lists import (
    load_all_list_ids,
    load_orphans,
    NEW_LISTS,
    EXISTING_LIST_EXPANSIONS,
    CONTENT_FIELDS,
)


class TestLoadAllListIds:
    def test_loads_from_multiple_json_files(self, tmp_path, monkeypatch):
        """Should collect all problem_ids across multiple list files."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        (lists_dir / "list-a.json").write_text(json.dumps({
            "slug": "list-a", "problem_ids": [1, 2, 3],
        }))
        (lists_dir / "list-b.json").write_text(json.dumps({
            "slug": "list-b", "problem_ids": [3, 4, 5],
        }))

        monkeypatch.setattr("generate_topic_lists.LISTS_DIR", lists_dir)

        result = load_all_list_ids()
        assert result == {1, 2, 3, 4, 5}

    def test_handles_empty_directory(self, tmp_path, monkeypatch):
        """Empty lists directory should return empty set."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        monkeypatch.setattr("generate_topic_lists.LISTS_DIR", lists_dir)

        result = load_all_list_ids()
        assert result == set()

    def test_handles_missing_problem_ids_key(self, tmp_path, monkeypatch):
        """List file without 'problem_ids' key should not crash."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        (lists_dir / "bad-list.json").write_text(json.dumps({
            "slug": "bad-list", "name": "No IDs",
        }))

        monkeypatch.setattr("generate_topic_lists.LISTS_DIR", lists_dir)

        result = load_all_list_ids()
        assert result == set()


class TestLoadOrphans:
    def test_basic_filtering(self, tmp_path, monkeypatch):
        """Should return problems with content that are not in any list."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # Problem with content, NOT in any list
        orphan = {
            "leetcode_id": 42,
            "title": "Trapping Rain Water",
            "slug": "trapping-rain-water",
            "difficulty": "Hard",
            "topics": ["two-pointers"],
            "explanation": "Use two pointers.",
        }
        (problems_dir / "0042-trapping-rain-water.json").write_text(json.dumps(orphan))

        # Problem with content, IN a list
        listed = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "topics": ["array"],
            "explanation": "Hash map.",
        }
        (problems_dir / "0001-two-sum.json").write_text(json.dumps(listed))

        monkeypatch.setattr("generate_topic_lists.PROBLEMS_DIR", problems_dir)

        existing_ids = {1}  # Problem 1 is listed
        result = load_orphans(existing_ids)

        assert len(result) == 1
        assert result[0]["leetcode_id"] == 42

    def test_excludes_problems_without_content(self, tmp_path, monkeypatch):
        """Metadata-only problems should not appear as orphans."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # Problem without content — should NOT be an orphan
        metadata_only = {
            "leetcode_id": 99,
            "title": "No Content",
            "slug": "no-content",
            "difficulty": "Easy",
            "topics": ["array"],
        }
        (problems_dir / "0099-no-content.json").write_text(json.dumps(metadata_only))

        monkeypatch.setattr("generate_topic_lists.PROBLEMS_DIR", problems_dir)

        result = load_orphans(set())
        assert len(result) == 0

    def test_no_orphans_when_all_listed(self, tmp_path, monkeypatch):
        """When all problems are in lists, orphans should be empty."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        p = {
            "leetcode_id": 1, "slug": "two-sum",
            "topics": ["array"], "explanation": "text",
        }
        (problems_dir / "0001-two-sum.json").write_text(json.dumps(p))

        monkeypatch.setattr("generate_topic_lists.PROBLEMS_DIR", problems_dir)

        result = load_orphans({1})  # Problem 1 is listed
        assert len(result) == 0


class TestNewListsStructure:
    def test_each_entry_has_required_keys(self):
        """Each NEW_LISTS entry should be a tuple of (name, description, type, topics)."""
        for slug, entry in NEW_LISTS.items():
            assert isinstance(slug, str), f"Slug {slug} should be a string"
            assert len(entry) == 4, f"Entry for {slug} should have 4 elements"

            name, description, list_type, match_topics = entry
            assert isinstance(name, str), f"{slug}: name should be a string"
            assert isinstance(description, str), f"{slug}: description should be a string"
            assert isinstance(list_type, str), f"{slug}: type should be a string"
            assert isinstance(match_topics, set), f"{slug}: topics should be a set"
            assert len(match_topics) > 0, f"{slug}: topics should not be empty"


class TestExistingListExpansions:
    def test_each_entry_has_slug(self):
        """Each EXISTING_LIST_EXPANSIONS entry should map leetcode_id to slug."""
        for lid, slug in EXISTING_LIST_EXPANSIONS.items():
            assert isinstance(lid, int), f"Key {lid} should be an int"
            assert isinstance(slug, str), f"Value for {lid} should be a string"
            assert len(slug) > 0, f"Slug for {lid} should not be empty"


class TestTopicAssignment:
    def test_problem_with_matching_topic_assigned_to_list(self):
        """Problem whose topics intersect a list's match_topics should be assigned."""
        problem = {"leetcode_id": 100, "topics": ["segment-tree", "array"]}

        assignments = defaultdict(list)
        topics = set(problem.get("topics", []))
        for slug, (_, _, _, match_topics) in NEW_LISTS.items():
            if topics & match_topics:
                assignments[slug].append(problem["leetcode_id"])

        # "segment-tree-bit" has {"segment-tree", "binary-indexed-tree"}
        assert 100 in assignments.get("segment-tree-bit", [])

    def test_problem_with_no_matching_topic_not_assigned(self):
        """Problem whose topics don't match any list should not be assigned."""
        problem = {"leetcode_id": 200, "topics": ["database"]}

        assignments = defaultdict(list)
        topics = set(problem.get("topics", []))
        for slug, (_, _, _, match_topics) in NEW_LISTS.items():
            if topics & match_topics:
                assignments[slug].append(problem["leetcode_id"])

        # Should not appear in any list
        total_assigned = sum(len(v) for v in assignments.values())
        assert total_assigned == 0

    def test_problem_can_appear_in_multiple_lists(self):
        """Cross-listing: a problem matching multiple list topics should appear in all."""
        # A problem with both "graph" and "design" topics
        problem = {"leetcode_id": 300, "topics": ["graph", "design"]}

        assignments = defaultdict(list)
        topics = set(problem.get("topics", []))
        for slug, (_, _, _, match_topics) in NEW_LISTS.items():
            if topics & match_topics:
                assignments[slug].append(problem["leetcode_id"])

        # Should be in both "graph-advanced" and "design-patterns"
        assert 300 in assignments.get("graph-advanced", [])
        assert 300 in assignments.get("design-patterns", [])


class TestListCoverage:
    def test_all_problems_assigned_to_at_least_one_list(self, tmp_path, monkeypatch):
        """Every orphan problem should be assignable to at least one topic list
        or be in EXISTING_LIST_EXPANSIONS."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # Create a problem that matches a known topic
        p = {
            "leetcode_id": 500,
            "slug": "test-graph",
            "topics": ["graph"],
            "explanation": "graph problem",
        }
        (problems_dir / "0500-test-graph.json").write_text(json.dumps(p))

        monkeypatch.setattr("generate_topic_lists.PROBLEMS_DIR", problems_dir)

        orphans = load_orphans(set())
        assert len(orphans) == 1

        # Assign to lists
        covered = set()
        for op in orphans:
            topics = set(op.get("topics", []))
            for slug, (_, _, _, match_topics) in NEW_LISTS.items():
                if topics & match_topics:
                    covered.add(op["leetcode_id"])

        for lid in EXISTING_LIST_EXPANSIONS:
            covered.add(lid)

        for op in orphans:
            assert op["leetcode_id"] in covered, (
                f"Problem #{op['leetcode_id']} ({op.get('topics', [])}) not covered by any list"
            )
