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


class TestParseRatingsTsvEdgeCases:
    """Edge cases for ratings TSV parsing."""

    def test_handles_malformed_lines_missing_columns(self):
        """Lines with fewer than 2 columns should be skipped."""
        tsv = (
            "Rating\tID\tTitle\n"
            "1116.5\n"  # Only one column
            "2045.0\t42\tTrapping Rain Water\n"
        )
        result = parse_ratings_tsv(tsv)
        assert result == {42: 2045}

    def test_handles_non_numeric_rating_values(self):
        """Non-numeric rating and ID values should be skipped."""
        tsv = (
            "Rating\tID\tTitle\n"
            "abc\t1\tTwo Sum\n"  # Non-numeric rating
            "1500.0\txyz\tOther\n"  # Non-numeric ID
            "2000.0\t42\tValid\n"
        )
        result = parse_ratings_tsv(tsv)
        assert result == {42: 2000}

    def test_rounds_ratings_correctly(self):
        """Ratings should be rounded to nearest integer."""
        tsv = (
            "Rating\tID\tTitle\n"
            "1499.4\t1\tRound Down\n"
            "1499.5\t2\tRound Up\n"
            "1500.9\t3\tRound Up High\n"
        )
        result = parse_ratings_tsv(tsv)
        assert result[1] == 1499  # .4 rounds down
        assert result[2] == 1500  # .5 rounds up (Python banker's rounding: 1500)
        assert result[3] == 1501  # .9 rounds up


class TestBuildMetadataEdgeCases:
    """Edge cases for build_metadata."""

    def test_handles_none_topic_tags(self):
        """topicTags field set to None should produce empty topics list."""
        question = {
            "questionFrontendId": "100",
            "title": "Test Problem",
            "titleSlug": "test-problem",
            "difficulty": "EASY",
            "paidOnly": False,
            "topicTags": None,
        }
        result = build_metadata(question, {})
        assert result is not None
        assert result["topics"] == []

    def test_handles_empty_topic_tags_list(self):
        """Empty topicTags list should produce empty topics list."""
        question = {
            "questionFrontendId": "101",
            "title": "No Topics",
            "titleSlug": "no-topics",
            "difficulty": "MEDIUM",
            "paidOnly": False,
            "topicTags": [],
        }
        result = build_metadata(question, {})
        assert result is not None
        assert result["topics"] == []


class TestMergeProblemFileEdgeCases:
    """Edge cases for merge_problem_file."""

    def test_partial_update_preserves_existing_fields(self, tmp_path):
        """Updating one metadata field should preserve all others."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        existing = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table"],
            "explanation": "Use a hash map for O(n).",
            "solution_code": "class Solution { ... }",
            "custom_field": "preserved",
        }
        f = problems_dir / "0001-two-sum.json"
        f.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

        # Only change topics
        metadata = {
            "leetcode_id": 1,
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": "Easy",
            "rating": 1116,
            "topics": ["array", "hash-table", "two-pointers"],
        }
        action = merge_problem_file(metadata, problems_dir)
        assert action == "updated"

        data = json.loads(f.read_text())
        assert data["explanation"] == "Use a hash map for O(n)."  # content preserved
        assert data["custom_field"] == "preserved"  # extra field preserved
        assert data["topics"] == ["array", "hash-table", "two-pointers"]

    def test_generates_correct_filename_format(self, tmp_path):
        """Filename should be {id:04d}-{slug}.json (zero-padded to 4 digits)."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        metadata = {
            "leetcode_id": 42,
            "title": "Trapping Rain Water",
            "slug": "trapping-rain-water",
            "difficulty": "Hard",
            "rating": 2046,
            "topics": ["two-pointers"],
        }
        merge_problem_file(metadata, problems_dir)

        expected_file = problems_dir / "0042-trapping-rain-water.json"
        assert expected_file.exists()


class TestGenerateSyncReportEdgeCases:
    """Edge cases for generate_sync_report."""

    def test_calculates_total_correctly(self, tmp_path):
        """Total should equal with_content + metadata_only."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        # 2 with content
        for i in [1, 2]:
            data = {
                "leetcode_id": i, "title": f"P{i}", "slug": f"p{i}",
                "difficulty": "Easy", "rating": 1000, "topics": [],
                "explanation": "content here",
            }
            (problems_dir / f"{i:04d}-p{i}.json").write_text(json.dumps(data))

        # 3 metadata only
        for i in [3, 4, 5]:
            data = {
                "leetcode_id": i, "title": f"P{i}", "slug": f"p{i}",
                "difficulty": "Easy", "rating": 1000, "topics": [],
            }
            (problems_dir / f"{i:04d}-p{i}.json").write_text(json.dumps(data))

        report = generate_sync_report(problems_dir)
        assert report["total"] == 5
        assert report["with_content"] == 2
        assert report["metadata_only"] == 3
        assert report["total"] == report["with_content"] + report["metadata_only"]

    def test_handles_empty_directory(self, tmp_path):
        """Empty problems directory should return all zeros."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        report = generate_sync_report(problems_dir)
        assert report["total"] == 0
        assert report["with_content"] == 0
        assert report["metadata_only"] == 0
        assert report["metadata_only_ids"] == []

    def test_uses_iso_utc_timestamp_format(self, tmp_path):
        """synced_at should be an ISO 8601 UTC timestamp."""
        problems_dir = tmp_path / "problems"
        problems_dir.mkdir()

        report = generate_sync_report(problems_dir)
        synced_at = report["synced_at"]
        # Should be a valid ISO 8601 string with timezone info
        assert "T" in synced_at
        assert "+" in synced_at or "Z" in synced_at or synced_at.endswith("+00:00")
