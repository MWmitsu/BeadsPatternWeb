# -*- coding: utf-8 -*-
# かわいいOFLフォントを取得し、必要字種だけにサブセットして fonts/ に woff2 を作る。
# 日本語フォントは「かな+ASCII+全角+記号」に絞って軽量化（漢字は端末のまるゴシックへフォールバック）。
# 実行時CDN不使用（このスクリプトはビルド時に手元で1回実行してファイルを同梱するだけ）。
import io, os, sys, json, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(HERE, 'fonts')
os.makedirs(FONTS_DIR, exist_ok=True)

# 日本語: かな・ASCII・全角英数・約物・よく使う記号
JP_UNI = ",".join([
    "U+0020-007E", "U+00A0-00FF", "U+2010-2027", "U+2030-205E",
    "U+3000-303F", "U+3040-309F", "U+30A0-30FF", "U+31F0-31FF",
    "U+FF01-FF60", "U+FFE0-FFEE",
    "U+2605", "U+2606", "U+2661", "U+2665", "U+266A", "U+2764",
])
# ラテン: 基本ラテン+ラテン1+約物
LATIN_UNI = ",".join(["U+0020-007E", "U+00A0-00FF", "U+2010-2027", "U+2030-205E", "U+20AC"])

# (githubのoflディレクトリ名, 出力ファイル名, 種別, @font-faceのfamily名)
FONTS = [
    ("hachimarupop", "hachi",    "jp", "BP Hachi"),
    ("dotgothic16",  "dot",      "jp", "BP Dot"),
    ("yuseimagic",   "yusei",    "jp", "BP Yusei"),
    ("rocknrollone", "rocknroll","jp", "BP RocknRoll"),
    ("reggaeone",    "reggae",   "jp", "BP Reggae"),
    ("mochiypopone", "mochiy",   "jp", "BP Mochiy"),
    ("yomogi",       "yomogi",   "jp", "BP Yomogi"),
    ("stick",        "stick",    "jp", "BP Stick"),
    ("kaiseidecol",  "kaisei",   "jp", "BP Kaisei"),
    ("pacifico",     "pacifico", "latin", "BP Pacifico"),
    ("chewy",        "chewy",    "latin", "BP Chewy"),
    ("pressstart2p", "pixel",    "latin", "BP Pixel"),
    ("bungee",       "bungee",   "latin", "BP Bungee"),
    ("bubblegumsans","bubble",   "latin", "BP Bubble"),
    ("gloriahallelujah","gloria","latin", "BP Gloria"),
]

UA = {"User-Agent": "Mozilla/5.0"}

def http_get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def find_ttf(dirname):
    api = "https://api.github.com/repos/google/fonts/contents/ofl/" + dirname
    data = json.loads(http_get(api).decode("utf-8"))
    ttfs = [f for f in data if f["name"].lower().endswith(".ttf")]
    if not ttfs:
        return None
    # 静的Regularを優先。変数フォント([wght]等)や太字は後回し。
    def score(f):
        n = f["name"].lower()
        s = 0
        if "regular" in n: s -= 4
        if "[" in n: s += 3       # variable font
        if "bold" in n: s += 2
        if "italic" in n: s += 2
        return s
    ttfs.sort(key=score)
    return ttfs[0]["download_url"]

results = []
css_lines = []
for (dirname, out, kind, family) in FONTS:
    try:
        url = find_ttf(dirname)
        if not url:
            results.append((out, "NO_TTF")); continue
        ttf = http_get(url)
        src = os.path.join(FONTS_DIR, "_" + out + ".ttf")
        with open(src, "wb") as f:
            f.write(ttf)
        dst = os.path.join(FONTS_DIR, out + ".woff2")
        uni = JP_UNI if kind == "jp" else LATIN_UNI
        cmd = [sys.executable, "-m", "fontTools.subset", src,
               "--unicodes=" + uni, "--flavor=woff2",
               "--layout-features=*", "--no-hinting",
               "--output-file=" + dst]
        p = subprocess.run(cmd, capture_output=True, text=True)
        os.remove(src)
        if p.returncode != 0 or not os.path.exists(dst):
            results.append((out, "SUBSET_FAIL: " + (p.stderr[-200:] if p.stderr else "?"))); continue
        kb = os.path.getsize(dst) / 1024.0
        results.append((out, "OK %.0fKB" % kb))
        css_lines.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:400;"
            "font-display:swap;src:url('../fonts/%s.woff2') format('woff2');}" % (family, out)
        )
    except Exception as e:
        results.append((out, "ERR: " + str(e)[:160]))

print("=== RESULTS ===")
total = 0
for out, st in results:
    print(f"{out:12} {st}")
print("=== CSS (" + str(len(css_lines)) + " faces) ===")
print("\n".join(css_lines))
