# -*- coding: utf-8 -*-
# 追加のかわいい/個性的なOFLフォントを取得・サブセットして fonts/ に追加する。
# 既存ファイルがあればスキップ。CSSとJSプリセット行も出力して貼り付けやすくする。
import os, sys, json, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(HERE, 'fonts')
os.makedirs(FONTS_DIR, exist_ok=True)

JP_UNI = ",".join([
    "U+0020-007E", "U+00A0-00FF", "U+2010-2027", "U+2030-205E",
    "U+3000-303F", "U+3040-309F", "U+30A0-30FF", "U+31F0-31FF",
    "U+FF01-FF60", "U+FFE0-FFEE",
    "U+2605", "U+2606", "U+2661", "U+2665", "U+266A", "U+2764",
])
LATIN_UNI = ",".join(["U+0020-007E", "U+00A0-00FF", "U+2010-2027", "U+2030-205E", "U+20AC"])

# (oflディレクトリ名, 出力名, 種別, family, ラベル, 見本)
FONTS = [
    # --- 日本語 ---
    ("kleeone",          "klee",      "jp", "BP Klee",      "クレー", "あ"),
    ("mplusrounded1c",   "mplusround","jp", "BP MplusRound","まるM",  "あ"),
    ("kosugimaru",       "kosugimaru","jp", "BP KosugiMaru","こすぎ", "あ"),
    ("delagothicone",    "dela",      "jp", "BP Dela",      "ふとめ", "あ"),
    ("rampartone",       "rampart",   "jp", "BP Rampart",   "むくむく","あ"),
    ("trainone",         "train",     "jp", "BP Train",     "ふちどり","あ"),
    ("pottaone",         "potta",     "jp", "BP Potta",     "ぷっくり","あ"),
    ("darumadropone",    "daruma",    "jp", "BP Daruma",    "だるま", "あ"),
    ("mochiypopponee",   "mochiyp",   "jp", "BP MochiyP",   "もちまる","あ"),
    ("otomanopeeone",    "otoman",    "jp", "BP Otoman",    "おとまる","あ"),
    ("monomaniacone",    "monoman",   "jp", "BP Monoman",   "がっしり","あ"),
    ("slacksideone",     "slack",     "jp", "BP Slack",     "すらすら","あ"),
    ("yujiboku",         "yujiboku",  "jp", "BP Yuji",      "ふで",   "あ"),
    ("shizuru",          "shizuru",   "jp", "BP Shizuru",   "かざり", "あ"),
    ("zenkurenaido",     "kurenaido", "jp", "BP Kurenaido", "くれない","あ"),
    ("zenkakugothicnew", "zenkaku",   "jp", "BP ZenKaku",   "ゼンかく","あ"),
    ("zenmarugothic",    "zenmaru",   "jp", "BP ZenMaru",   "ゼンまる","あ"),
    ("sawarabimincho",   "sawarabi",  "jp", "BP Sawarabi",  "さわらび","あ"),
    ("hinamincho",       "hina",      "jp", "BP Hina",      "ひな",   "あ"),
    ("newtegomin",       "tegomin",   "jp", "BP Tegomin",   "てごみん","あ"),
    ("shipporimincho",   "shippori",  "jp", "BP Shippori",  "しっぽり","あ"),
    ("kaiseiopti",       "kaiseiopti","jp", "BP KaiseiOpti","かいせい","あ"),
    ("bizudgothic",      "bizgo",     "jp", "BP BizGo",     "UDかく", "あ"),
    ("pottaone",         "potta2",    "jp", "BP Potta2",    "まる2",  "あ"),  # dup guard (skip if same)
    # --- 英字・ローマ字 ---
    ("fredokaone",       "fredoka",   "latin", "BP Fredoka",  "まるまる(英)", "Ab"),
    ("modak",            "modak",     "latin", "BP Modak",    "ぷくぷく(英)", "Ab"),
    ("luckiestguy",      "luckiest",  "latin", "BP Luckiest", "コミック(英)", "Ab"),
    ("bangers",          "bangers",   "latin", "BP Bangers",  "アメコミ(英)", "Ab"),
    ("titanone",         "titan",     "latin", "BP Titan",    "ずんぐり(英)", "Ab"),
    ("shrikhand",        "shrikhand", "latin", "BP Shrikhand","デコ(英)",    "Ab"),
    ("lobster",          "lobster",   "latin", "BP Lobster",  "すじ(英)",    "Ab"),
    ("caveat",           "caveat",    "latin", "BP Caveat",   "はやがき(英)", "Ab"),
    ("indieflower",      "indie",     "latin", "BP Indie",    "のんびり(英)", "Ab"),
    ("patrickhand",      "patrick",   "latin", "BP Patrick",  "メモ(英)",    "Ab"),
    ("comicneue",        "comicneue", "latin", "BP Comic",    "まんが(英)",  "Ab"),
    ("vt323",            "vt323",     "latin", "BP VT323",    "たーみなる(英)","Ab"),
    ("silkscreen",       "silkscreen","latin", "BP Silk",     "ドット小(英)", "Ab"),
    ("shadowsintolight", "shadows",   "latin", "BP Shadows",  "うすて(英)",  "Ab"),
    ("chewy",            "chewy",     "latin", "BP Chewy",    "ガム(英)",    "Ab"),
    ("sniglet",          "sniglet",   "latin", "BP Sniglet",  "まるごし(英)", "Ab"),
    ("paytoneone",       "paytone",   "latin", "BP Paytone",  "おおもじ(英)", "Ab"),
]

UA = {"User-Agent": "Mozilla/5.0"}
def http_get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()

def find_ttf(dirname):
    api = "https://api.github.com/repos/google/fonts/contents/ofl/" + dirname
    data = json.loads(http_get(api).decode("utf-8"))
    ttfs = [f for f in data if f["name"].lower().endswith(".ttf")]
    if not ttfs:
        return None
    def score(f):
        n = f["name"].lower(); s = 0
        if "regular" in n: s -= 4
        if "[" in n: s += 3
        if "bold" in n: s += 2
        if "italic" in n: s += 2
        return s
    ttfs.sort(key=score)
    return ttfs[0]["download_url"]

JP_FB = "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ',sans-serif"
JP_FB_MIN = "'YuMincho','游明朝','Hiragino Mincho ProN',serif"
LATIN_FB = "'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"

results, css, presets = [], [], []
for (dirname, out, kind, family, label, sample) in FONTS:
    dst = os.path.join(FONTS_DIR, out + ".woff2")
    if os.path.exists(dst):
        results.append((out, "EXISTS")); continue
    try:
        url = find_ttf(dirname)
        if not url:
            results.append((out, "NO_TTF")); continue
        src = os.path.join(FONTS_DIR, "_" + out + ".ttf")
        with open(src, "wb") as f: f.write(http_get(url))
        uni = JP_UNI if kind == "jp" else LATIN_UNI
        cmd = [sys.executable, "-m", "fontTools.subset", src, "--unicodes=" + uni,
               "--flavor=woff2", "--layout-features=*", "--no-hinting", "--output-file=" + dst]
        p = subprocess.run(cmd, capture_output=True, text=True)
        os.remove(src)
        if p.returncode != 0 or not os.path.exists(dst):
            results.append((out, "SUBSET_FAIL " + (p.stderr[-160:] if p.stderr else ""))); continue
        kb = os.path.getsize(dst) / 1024.0
        results.append((out, "OK %.0fKB" % kb))
        css.append("@font-face{font-family:'%s';font-style:normal;font-weight:400;font-display:swap;src:url('../fonts/%s.woff2') format('woff2');}" % (family, out))
        # stack: 明朝系っぽい名前は明朝フォールバック、それ以外はまるゴ/ラテン
        if kind == "jp":
            fb = JP_FB_MIN if any(k in dirname for k in ("mincho", "kaisei", "hina", "tegomin", "shippori")) else JP_FB
            stack = "\"'%s',%s\"" % (family, fb.replace('"', "'"))
        else:
            stack = "\"'%s',%s\"" % (family, LATIN_FB.replace('"', "'"))
        key = out
        presets.append("  { key: '%s', label: '%s', sample: '%s', fixedWeight: true, family: '%s', stack: %s }," % (key, label, sample, family, stack))
    except Exception as e:
        results.append((out, "ERR " + str(e)[:140]))

print("=== RESULTS ===")
for out, st in results: print(f"{out:12} {st}")
print("\n=== CSS ===")
print("\n".join(css))
print("\n=== PRESETS ===")
print("\n".join(presets))
