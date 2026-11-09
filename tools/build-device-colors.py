# Tạo biến thể màu từ cùng một mặt máy vector, giữ nguyên hình phím và tọa độ.
from pathlib import Path
import xml.etree.ElementTree as E
ROOT = Path(__file__).resolve().parents[1]
E.register_namespace('', 'http://www.w3.org/2000/svg')
NS = {'s':'http://www.w3.org/2000/svg'}
palettes = {
 'blue': {
  'case-metal':['#d4e5f6','#688eb9','#a6c3e8','#5279a8','#adc8ed'],
  'case-dark':['#a1bce4','#91addb','#7c9ed3','#668bbe'],
  'bezel':['#7699c6','#5279ab','#31588a','#a3bbdb'],
  'key-dark':['#b0c7ea','#6c95ca','#4c7ab5','#35639c','#234a7d'],
  'key-white':['#9cbce5','#638bc5','#426ca9','#294f89','#203b64'],
  'key-metal':['#b7cfed','#739aca','#486da3','#335789','#a9c5e6']},
 'pink': {
  'case-metal':['#f7e1e7','#be7f90','#edbcc9','#ac6f83','#edbac9'],
  'case-dark':['#edc4cf','#e6b3c3','#dda2b5','#d092a8'],
  'bezel':['#cd92a5','#b87690','#904c68','#f1c3d0'],
  'key-dark':['#f0c6d2','#d796ad','#c17d98','#ac6682','#874861'],
  'key-white':['#edbbc9','#cf8ca5','#ba7791','#a5617e','#87445f'],
  'key-metal':['#f2ccd5','#dfacbd','#c687a1','#ad6c88','#edc0cf']}
}
for name, palette in palettes.items():
 tree=E.parse(ROOT/'assets/device-face.svg'); root=tree.getroot()
 palette['key-blue']=['#fff4d5','#f5e3be','#e4cda6','#b69a76']
 for gid, colors in palette.items():
  stops=root.findall('.//s:linearGradient[@id="'+gid+'"]/s:stop',NS)
  assert len(stops)==len(colors),gid
  for stop,color in zip(stops,colors):stop.set('stop-color',color)
 for el in root.iter():
  fill=el.get('fill')
  if fill=='#191919':el.set('fill','#fffaf7')
  elif fill=='#FFD766':el.set('fill','#745013' if name=='pink' else '#6b4910')
  elif fill=='#FF7878':el.set('fill','#a82a59' if name=='pink' else '#9b2853')
  elif fill=='#5CAEFF':el.set('fill','#174977')
  elif fill=='#9B7BFF':el.set('fill','#613c8a')
  elif fill=='#070c10':el.set('fill','#43334b' if name=='pink' else '#213751');el.set('opacity','.35')
  elif fill=='#101618':el.set('fill','#995b77' if name=='pink' else '#315384')
  elif fill=='#d6d9d6':el.set('fill','#453b48' if name=='pink' else '#283f61')
 # Hai hình chữ DEL / AC (vẽ bằng path) trên phím màu kem.
 keys=list(root)[-1]
 for prefix in ['M239.95 438.07','M307.51 438.063']:
  found=[el for el in keys if el.get('d','').startswith(prefix)]
  assert len(found)==1
  found[0].set('fill','#493e35')
 tree.write(ROOT/('assets/device-face-'+name+'.svg'),encoding='unicode')
