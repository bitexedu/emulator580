#!/usr/bin/env python3
"""Vector LCD tiles measured on official CASIO UI, 2026-11-03; no dependencies."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'assets/menu-pixels.json').read_text())
def path(rows):
    # One compound path of horizontal runs. crispEdges keeps the measured grid.
    parts=[]
    for y,row in enumerate(rows):
        x=0
        while x<len(row):
            if row[x]=='0': x+=1; continue
            start=x
            while x<len(row) and row[x]=='1': x+=1
            parts.append(f'M{start} {y}h{x-start}v1H{start}z')
    return ''.join(parts)
out=['<svg xmlns="http://www.w3.org/2000/svg">','<!-- Observed CASIO menu pixels, 2026-11-03. UI artwork only. -->']
for i,rows in enumerate(data['tiles']):
    selected=[''.join(str(int(a)^int(b)) for a,b in zip(row,mask)) for row,mask in zip(rows,data['selectionMask'])]
    for name,pixels in [('normal',rows),('selected',selected)]:
        out.append(f'<symbol id="mode-{i}-{name}" viewBox="0 0 47 23"><path fill="currentColor" shape-rendering="crispEdges" d="{path(pixels)}"/></symbol>')
out.append('</svg>')
(ROOT/'assets/menu-tiles.svg').write_text('\n'.join(out)+'\n')
print('Built 12 normal + 12 selected CASIO menu tiles.')
