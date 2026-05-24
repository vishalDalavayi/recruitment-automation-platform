"""
Golden tests for deterministic matching_integration helpers.

Run from backend/ :
  PYTHONPATH=. python -m unittest tests.test_matching_integration_contracts -v
"""

import json
import unittest
from pathlib import Path

_DOCS_FIXTURES = Path(__file__).resolve().parents[2] / "docs" / "fixtures" / "matching"


class TestMatchingIntegrationGolden(unittest.TestCase):
    def test_render_formatted_resume_matches_fixture(self):
        import services.matching_integration as mi

        sample = json.loads((_DOCS_FIXTURES / "formatted-resume-sample.json").read_text(encoding="utf-8"))
        golden = (_DOCS_FIXTURES / "formatted-resume-rendered.expected.txt").read_text(encoding="utf-8").rstrip(
            "\n"
        ).rstrip("\r")

        self.assertEqual(mi.render_formatted_resume_content(sample), golden)

    def test_map_jobs_fixture_row(self):
        import services.matching_integration as mi

        row = json.loads((_DOCS_FIXTURES / "scraped-job-row.sample.json").read_text(encoding="utf-8"))
        expected = json.loads((_DOCS_FIXTURES / "job-mapped-for-matcher.expected.json").read_text(encoding="utf-8"))
        self.assertEqual(mi._map_jobs_for_matcher([row]), expected)


if __name__ == "__main__":
    unittest.main()
