"""Create static font faces for consistent Android 7+/iOS rendering.

Run from repo root with fonttools installed. Sources and OFL licenses are in
artifacts/mobile-redesign/assets/fonts (Google Fonts upstream).
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import shutil

root = Path(__file__).resolve().parents[2]
source = root / "artifacts/mobile-redesign/assets/fonts"
target = root / "mobile/assets/fonts"
target.mkdir(parents=True, exist_ok=True)
for family, output, weight in [
    ("bricolagegrotesque", "BricolageSemiBold", 600),
    ("sourcesans3", "SourceSansRegular", 400),
    ("sourcesans3", "SourceSansSemiBold", 600),
]:
    font = TTFont(source / f"{family}.ttf")
    axes = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
    axes["wght"] = weight
    font = instantiateVariableFont(font, axes, inplace=True)
    # Give every static file a unique family, including its PostScript name.
    for entry in font["name"].names:
        if entry.nameID in (1, 4, 6, 16):
            entry.string = output.encode(entry.getEncoding())
        elif entry.nameID in (2, 17):
            entry.string = "Regular".encode(entry.getEncoding())
    font.save(target / f"{output}.ttf")
    assert "fvar" not in font
    assert all(ord(c) in font.getBestCmap() for c in "₡áéíóúñÁÉÍÓÚÑ")
    shutil.copyfile(source / f"{family}-OFL.txt", target / f"{family}-OFL.txt")
    print(output, "OK: static face, Spanish and CRC glyphs")
