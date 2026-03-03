# scripts/tests/test_sync_leetcode.py
import pytest
import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sync_leetcode import parse_ratings_tsv, map_difficulty, CONTENT_FIELDS, has_content, build_metadata, merge_problem_file, generate_sync_report


class TestParseRatingsTsv:
    def test_parses_valid_tsv(self):
        tsv = (
            "Rating\tID\tTitle\tTitle ZH\tTitle Slug\tContest Slug\tProblem Index\n"
            "1116.1234\t1\tTwo Sum\t两数之和\ttwo-sum\tweekly-contest-1\tQ1\n"
            "2045.9876\t42\tTrapping Rain Water\t接雨水\ttrapping-rain-water\tweekly-contest-5\tQ3\n"
        )
        result = parse_ratings_tsv(tsv)
        assert result == {1: 1116, 42: 2046}

    def test_skips_header_only(self):
        tsv = "Rating\tID\tTitle\tTitle ZH\tTitle Slug\tContest Slug\tProblem Index\n"
        result = parse_ratings_tsv(tsv)
        assert result == {}

    def test_handles_empty_string(self):
        assert parse_ratings_tsv("") == {}


class TestMapDifficulty:
    def test_easy(self):
        assert map_difficulty("EASY") == "Easy"

    def test_medium(self):
        assert map_difficulty("MEDIUM") == "Medium"

    def test_hard(self):
        assert map_difficulty("HARD") == "Hard"

    def test_unknown_passes_through(self):
        assert map_difficulty("UNKNOWN") == "Unknown"


class TestHasContent:
    def test_with_all_content(self):
        problem = {
            "leetcode_id": 1, "title": "Two Sum", "slug": "two-sum",
            "difficulty": "Easy", "rating": 1116, "topics": ["array"],
            "explanation": "some explanation",
            "solution_code": "class Solution {};",
            "complexity_analysis": "O(n)",
            "pseudocode": "step 1",
            "alternative_approaches": "brute force",
            "follow_up": "3sum?"
        }
        assert has_content(problem) is True

    def test_metadata_only(self):
        problem = {
            "leetcode_id": 1, "title": "Two Sum", "slug": "two-sum",
            "difficulty": "Easy", "rating": 1116, "topics": ["array"],
        }
        assert has_content(problem) is False

    def test_empty_content_fields(self):
        problem = {
            "leetcode_id": 1, "title": "Two Sum", "slug": "two-sum",
            "difficulty": "Easy", "rating": 1116, "topics": ["array"],
            "explanation": "", "solution_code": "",
        }
        assert has_content(problem) is False


class TestBuildMetadata:
    def test_builds_from_api_response(self):
        question = {
            "questionFrontendId": "1",
            "title": "Two Sum",
            "titleSlug": "two-sum",
            "difficulty": "EASY",
            "paidOnly": False,
            "topicTags": [
                {"slug": "array"},
                {"slug": "hash-table"},
            ],
        }
        ratings = {1: 1116}
        result = build_metadata(question, ratings)
        assert result == {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table"],
        }

    def test_no_rating_available(self):
        question = {
            "questionFrontendId": "9999",
            "title": "New Problem",
            "titleSlug": "new-problem",
            "difficulty": "HARD",
            "paidOnly": False,
            "topicTags": [{"slug": "math"}],
        }
        result = build_metadata(question, {})
        assert result["rating"] is None
        assert result["leetcode_id"] == 9999

    def test_skips_paid_only(self):
        question = {
            "questionFrontendId": "100",
            "title": "Paid Problem",
            "titleSlug": "paid-problem",
            "difficulty": "MEDIUM",
            "paidOnly": True,
            "topicTags": [],
        }
        result = build_metadata(question, {})
        assert result is None


class TestMergeProblemFile:
    def test_creates_new_file(self, tmp_path):
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        metadata = {
            "leetcode_id": 9999,
            "title": "New Problem",
            "slug": "new-problem",
            "difficulty": "Hard",
            "rating": 2500,
            "topics": ["math"],
        }
        action = merge_problem_file(metadata, problems_dir)
        assert action == "created"

        f = problems_dir / "9999-new-problem.json"
        assert f.exists()
        data = json.loads(f.read_text())
        assert data["leetcode_id"] == 9999
        assert data["title"] == "New Problem"
        # No content fields
        assert "explanation" not in data

    def test_updates_metadata_preserves_content(self, tmp_path):
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # Write existing file with content
        existing = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1100,
            "topics": ["array"],
            "explanation": "My detailed explanation",
            "solution_code": "class Solution {};",
            "complexity_analysis": "O(n)",
            "pseudocode": "step 1",
            "alternative_approaches": "brute force",
            "follow_up": "3sum?",
        }
        f = problems_dir / "0001-two-sum.json"
        f.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

        # Merge with updated metadata
        metadata = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,  # updated rating
            "topics": ["array", "hash-table"],  # updated topics
        }
        action = merge_problem_file(metadata, problems_dir)
        assert action == "updated"

        data = json.loads(f.read_text())
        assert data["rating"] == 1116
        assert data["topics"] == ["array", "hash-table"]
        assert data["explanation"] == "My detailed explanation"  # preserved
        assert data["solution_code"] == "class Solution {};"  # preserved

    def test_no_change_returns_unchanged(self, tmp_path):
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        existing = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table"],
        }
        f = problems_dir / "0001-two-sum.json"
        f.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

        action = merge_problem_file(existing.copy(), problems_dir)
        assert action == "unchanged"

    def test_preserves_existing_rating_when_new_is_none(self, tmp_path):
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        existing = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table"],
        }
        f = problems_dir / "0001-two-sum.json"
        f.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

        # Sync with None rating (non-contest problem)
        metadata = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": None,
            "topics": ["array", "hash-table"],
        }
        action = merge_problem_file(metadata, problems_dir)
        assert action == "unchanged"  # None rating doesn't count as change

        data = json.loads(f.read_text())
        assert data["rating"] == 1116  # preserved


class TestBuildDatabaseContentFilter:
    """Verify the has_content check matches build_database.py CONTENT_FIELDS."""

    def test_content_fields_match(self):
        """Ensure sync_leetcode and build_database define same content fields."""
        expected = [
            "explanation", "solution_code", "complexity_analysis",
            "pseudocode", "alternative_approaches", "follow_up",
        ]
        assert CONTENT_FIELDS == expected

    def test_partial_content_counts_as_having_content(self):
        """A problem with at least one content field should pass."""
        problem = {
            "leetcode_id": 1, "slug": "two-sum",
            "explanation": "some text",
        }
        assert has_content(problem) is True


class TestGenerateSyncReport:
    def test_generates_report(self, tmp_path):
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # File with content
        with_content = {
            "leetcode_id": 1, "title": "Two Sum", "slug": "two-sum",
            "difficulty": "Easy", "rating": 1116, "topics": ["array"],
            "explanation": "text", "solution_code": "code",
            "complexity_analysis": "O(n)",
        }
        (problems_dir / "0001-two-sum.json").write_text(json.dumps(with_content))

        # File without content
        without = {
            "leetcode_id": 9, "title": "Palindrome", "slug": "palindrome-number",
            "difficulty": "Easy", "rating": None, "topics": ["math"],
        }
        (problems_dir / "0009-palindrome-number.json").write_text(json.dumps(without))

        report = generate_sync_report(problems_dir)
        assert report["with_content"] == 1
        assert report["metadata_only"] == 1
        assert report["metadata_only_ids"] == [9]
        assert "synced_at" in report
