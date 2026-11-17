import os
import unittest

from app import image_forensics, text_forensics, url_forensics, video_forensics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE = os.path.join(ROOT, "..", "src", "assets", "hero-shield.jpg")


class AnalyzerTests(unittest.TestCase):
    def test_image(self):
        with open(IMAGE, "rb") as f:
            data = f.read()
        r = image_forensics.analyze_image(data, "hero-shield.jpg", "jpeg")
        self.assertIsInstance(r["truthScore"], int)
        self.assertTrue(0 <= r["truthScore"] <= 100)
        self.assertIn(r["authenticityStatus"], ("authentic", "uncertain", "manipulated"))
        self.assertTrue(r["suspiciousIndicators"])
        self.assertTrue(r["explanation"])

    def test_url(self):
        r = url_forensics.analyze_url(
            "http://paypa1-secure-login.tk/verify",
            "http://paypa1-secure-login.tk/verify",
        )
        self.assertLess(r["trustScore"], 50)
        self.assertEqual(r["risk"], "high")
        self.assertTrue(any("lookalike" in i["label"].lower() for i in r["phishingIndicators"]))
        self.assertEqual(r["domain"]["name"], "paypa1-secure-login.tk")

    def test_text(self):
        r = text_forensics.analyze_text(
            "BREAKING!!! You won't believe this SHOCKING secret that EVERYONE must see right now!!!"
        )
        self.assertEqual(r["verdict"], "high_risk")
        self.assertLess(r["credibilityScore"], 50)
        self.assertTrue(any("Clickbait" in s["label"] for s in r["signals"]))

    def test_video(self):
        path = os.environ.get("TRUTHGUARD_TEST_VIDEO", "")
        if not path or not os.path.exists(path):
            self.skipTest("set TRUTHGUARD_TEST_VIDEO to a sample .mp4 to run this test")
        with open(path, "rb") as f:
            r = video_forensics.analyze_video(f.read(), "test-video.mp4")
        self.assertIn(r["verdict"], ("authentic", "manipulated"))
        self.assertGreaterEqual(r["framesAnalyzed"], 5)
        self.assertEqual(len(r["timeline"]), r["framesAnalyzed"])


if __name__ == "__main__":
    unittest.main()
