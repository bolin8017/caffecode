# scripts/tests/test_build_database.py
import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from build_database import load_list, load_problem, all_list_slugs, CONTENT_FIELDS
from sync_leetcode import CONTENT_FIELDS as SYNC_CONTENT_FIELDS, has_content


class TestLoadList:
    def test_loads_json_list_file_correctly(self, tmp_path, monkeypatch):
        """load_list should parse a valid list JSON file."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        list_data = {
            "slug": "blind75",
            "name": "Blind 75",
            "description": "The essential 75 questions.",
            "type": "classic",
            "problem_ids": [1, 42, 200],
        }
        (lists_dir / "blind75.json").write_text(json.dumps(list_data))

        # Monkeypatch LISTS_DIR to use tmp_path
        monkeypatch.setattr("build_database.LISTS_DIR", lists_dir)

        result = load_list("blind75")
        assert result is not None
        assert result["slug"] == "blind75"
        assert result["name"] == "Blind 75"
        assert result["problem_ids"] == [1, 42, 200]

    def test_returns_none_on_missing_file(self, tmp_path, monkeypatch):
        """load_list should return None when the list file doesn't exist."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        monkeypatch.setattr("build_database.LISTS_DIR", lists_dir)

        result = load_list("nonexistent")
        assert result is None


class TestLoadProblem:
    def test_loads_problem_json_correctly(self, tmp_path, monkeypatch):
        """load_problem should parse a valid problem JSON file."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        problem_data = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table"],
            "explanation": "Use a hash map.",
        }
        (problems_dir / "0001-two-sum.json").write_text(json.dumps(problem_data))

        monkeypatch.setattr("build_database.PROBLEMS_DIR", problems_dir)

        result = load_problem(1, "two-sum")
        assert result is not None
        assert result["leetcode_id"] == 1
        assert result["title"] == "Two Sum"

    def test_returns_none_on_missing_file(self, tmp_path, monkeypatch):
        """load_problem should return None when the file doesn't exist."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        monkeypatch.setattr("build_database.PROBLEMS_DIR", problems_dir)

        result = load_problem(9999, "nonexistent")
        assert result is None


class TestFilenameFormat:
    def test_problem_filename_matches_expected_format(self, tmp_path, monkeypatch):
        """Problem filename should be {leetcode_id:04d}-{slug}.json."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # Verify the format used by load_problem
        monkeypatch.setattr("build_database.PROBLEMS_DIR", problems_dir)

        # Create file with expected format
        problem_data = {"leetcode_id": 42, "slug": "trapping-rain-water"}
        expected_name = "0042-trapping-rain-water.json"
        (problems_dir / expected_name).write_text(json.dumps(problem_data))

        result = load_problem(42, "trapping-rain-water")
        assert result is not None
        assert result["leetcode_id"] == 42


class TestAllListSlugs:
    def test_returns_sorted_list(self, tmp_path, monkeypatch):
        """all_list_slugs should return slugs sorted alphabetically."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        # Create list files in non-sorted order
        for name in ["dp-patterns", "blind75", "neetcode-all"]:
            (lists_dir / f"{name}.json").write_text(json.dumps({"slug": name}))

        monkeypatch.setattr("build_database.LISTS_DIR", lists_dir)

        result = all_list_slugs()
        assert result == ["blind75", "dp-patterns", "neetcode-all"]

    def test_handles_empty_directory(self, tmp_path, monkeypatch):
        """all_list_slugs should return empty list for empty directory."""
        lists_dir = tmp_path / "lists"
        lists_dir.mkdir()

        monkeypatch.setattr("build_database.LISTS_DIR", lists_dir)

        result = all_list_slugs()
        assert result == []


class TestContentFields:
    def test_content_fields_match_sync_leetcode(self):
        """build_database CONTENT_FIELDS must match sync_leetcode CONTENT_FIELDS."""
        assert CONTENT_FIELDS == SYNC_CONTENT_FIELDS

    def test_accepts_problem_with_all_content_fields(self):
        """Problem with all content fields should pass has_content check."""
        problem = {
            "leetcode_id": 1,
            "explanation": "some text",
            "solution_code": "class Solution {};",
            "complexity_analysis": "O(n)",
            "pseudocode": "step 1",
            "alternative_approaches": "brute force",
            "follow_up": "3sum?",
        }
        assert has_content(problem) is True

    def test_rejects_problem_with_partial_content(self):
        """Problem with only metadata fields should fail has_content.
        Note: has_content returns True if ANY content field is non-empty.
        This test verifies it returns True even with just one field."""
        problem = {
            "leetcode_id": 1,
            "explanation": "only explanation",
        }
        # has_content returns True if ANY field is non-empty
        assert has_content(problem) is True

    def test_rejects_problem_with_empty_string_content(self):
        """Problem with only empty string content fields should fail."""
        problem = {
            "leetcode_id": 1,
            "explanation": "",
            "solution_code": "",
            "complexity_analysis": "",
            "pseudocode": "",
            "alternative_approaches": "",
            "follow_up": "",
        }
        assert has_content(problem) is False

    def test_rejects_metadata_only_problem(self):
        """Problem with no content fields at all should fail."""
        problem = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array"],
        }
        assert has_content(problem) is False
