#!/usr/bin/env python3
"""
Builds src/styles/fonts/material-symbols-outlined.subset.woff2 from node_modules/material-symbols.

Keeps only the ligatures named in the MATERIAL lists of src/views/arsenal/IconsTab.tsx and
src/fx/effects/hud-icon-matrix/index.tsx (prunes the GSUB rlig lookup), plus the glyphs they need. The
variable axes stay, so font-variation-settings still works. Re-run after changing those lists:

    pip install fonttools brotli
    python3 scripts/subset-material-symbols.py

Licence: Material Symbols is Apache-2.0 (Google); the subset is a derivative with the same licence.
"""
import os
import re

from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.ttLib.tables import otTables

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = f'{ROOT}/node_modules/material-symbols/material-symbols-outlined.woff2'
OUT = f'{ROOT}/src/styles/fonts/material-symbols-outlined.subset.woff2'

names = set()
for rel in ['src/views/arsenal/IconsTab.tsx', 'src/fx/effects/hud-icon-matrix/index.tsx']:
    src = open(f'{ROOT}/{rel}', encoding='utf8').read()
    m = re.search(r"const MATERIAL = \[(.*?)\]", src, re.S)
    names |= set(re.findall(r"'([a-z_0-9]+)'", m.group(1)))
print('names', len(names), sorted(names))

font = TTFont(SRC)
cmap = font.getBestCmap()
DIGITS = {'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'}
def ch(g):
    # ligature components are glyph names: a..z, 'underscore', 'digit_four' …
    if len(g) == 1: return g
    if g == 'underscore': return '_'
    if g.startswith('digit_'): return DIGITS.get(g[6:], '?')
    return '?'
class _Rev(dict):
    def get(self, g, default=None):
        return ch(g) if g else default
rev = _Rev()
gsub = font['GSUB'].table
keep_outputs, keep_glyphs = set(), set()
kept = 0
for lk in gsub.LookupList.Lookup:
    subtables = lk.SubTable
    for st in subtables:
        if lk.LookupType == 7:
            st = st.ExtSubTable
        if getattr(st, 'LookupType', None) != 4 and st.__class__.__name__ != 'LigatureSubst':
            continue
        for first, ligs in list(st.ligatures.items()):
            keep = []
            for lig in ligs:
                text = (rev.get(first, '?') + ''.join(rev.get(c, '?') for c in lig.Component))
                if text in names:
                    keep.append(lig)
                    keep_outputs.add(lig.LigGlyph)
                    keep_glyphs.update(lig.Component)
                    keep_glyphs.add(first)
                    kept += 1
            st.ligatures[first] = keep
        st.ligatures = {k: v for k, v in st.ligatures.items() if v}
print('ligatures kept', kept, 'outputs', len(keep_outputs))

opts = subset.Options()
opts.layout_features = ['rlig', 'rclt', 'liga']
opts.flavor = 'woff2'
opts.notdef_outline = True
opts.name_IDs = ['*']
opts.glyph_names = False
opts.hinting = False
sub = subset.Subsetter(opts)
sub.populate(glyphs=list(keep_glyphs | keep_outputs | {'.notdef'}))
sub.subset(font)
font.flavor = 'woff2'
font.save(OUT)
print('wrote', OUT, os.path.getsize(OUT), 'bytes')
