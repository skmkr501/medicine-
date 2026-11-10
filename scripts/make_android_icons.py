#!/usr/bin/env python3
"""
public/logo.svg থেকে Android অ্যাপ আইকন (লঞ্চার আইকন) তৈরি করে।
ব্যবহার: python3 scripts/make_android_icons.py [logo.svg] [res-dir]
প্রয়োজন: rsvg-convert (Ubuntu: sudo apt-get install librsvg2-bin)
"""
import os
import re
import subprocess
import sys
import tempfile

LOGO = sys.argv[1] if len(sys.argv) > 1 else "public/logo.svg"
RES = sys.argv[2] if len(sys.argv) > 2 else "android/app/src/main/res"

# dpi -> (পুরনো ফোনের আইকন px, অ্যাডাপ্টিভ ফোরগ্রাউন্ড px = 108dp)
DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

svg = open(LOGO, encoding="utf-8").read()

# ফোরগ্রাউন্ড: ব্যাকগ্রাউন্ড চতুর্ভুজ বাদ, বাকিটা ৭৮% মাপে মাঝখানে (নিরাপদ অঞ্চলের ভিতরে)
bg_rect = re.compile(r'<rect[^>]*fill="url\(#bgGrad512\)"[^>]*/>', re.S)
if not bg_rect.search(svg):
    sys.exit("logo.svg-তে ব্যাকগ্রাউন্ড rect পাওয়া যায়নি, স্ক্রিপ্ট আপডেট দরকার")
fg_body = bg_rect.sub("", svg)
open_tag = re.search(r"<svg[^>]*>", fg_body).group(0)
fg_body = fg_body.replace(open_tag, open_tag + '<g transform="translate(256 256) scale(0.78) translate(-256 -256)">', 1)
fg_body = fg_body.replace("</svg>", "</g></svg>")


def render(svg_text, size, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False, encoding="utf-8") as f:
        f.write(svg_text)
        tmp = f.name
    try:
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), tmp, "-o", out_path], check=True)
    finally:
        os.unlink(tmp)


for dpi, (legacy_px, fg_px) in DENSITIES.items():
    d = os.path.join(RES, f"mipmap-{dpi}")
    render(svg, legacy_px, os.path.join(d, "ic_launcher.png"))
    render(fg_body, fg_px, os.path.join(d, "ic_launcher_foreground.png"))

os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), "w", encoding="utf-8").write(adaptive)

os.makedirs(os.path.join(RES, "values"), exist_ok=True)
open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F766E</color>\n</resources>\n'
)
print("Android আইকন তৈরি হয়েছে:", RES)
