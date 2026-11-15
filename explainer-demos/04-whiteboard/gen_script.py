#!/usr/bin/env python3
# Source of truth for timing: writes script.js (lines, draw windows, wipes, sfx, music).
import json
DRAW = {  # item id: [t0, t1]
 "t1":[0.5,2.1],"t2":[2.1,3.4],"uline":[3.4,3.8],"elf":[3.8,7.4],"lblelf":[7.4,8.4],"ruler":[8.4,9.4],"ground1":[9.4,9.9],
 "h2":[11.4,12.4],"dome":[12.4,13.6],"floors":[13.6,14.4],"roof":[14.4,16.3],"dach":[16.5,18.8],"strych":[18.8,21.2],
 "izby":[21.2,22.4],"spiz":[22.4,24.0],"piw":[24.0,25.9],
 "h3":[27.6,28.4],"r1e":[30.4,32.0],"r1l":[32.0,33.0],"r1i":[33.0,33.6],"r2e":[33.6,35.0],"r2l":[35.0,35.8],"r2i":[35.8,36.3],
 "r3e":[36.3,37.4],"r3l":[37.4,38.1],"r3i":[38.1,38.5],"r4e":[38.5,39.6],"r4l":[39.6,40.2],"r4i":[40.2,40.8],
 "h4":[42.8,43.9],"n1":[44.4,46.2],"a1":[46.2,46.7],"n2":[46.7,48.2],"a2":[48.2,48.7],"n3":[48.7,49.9],"a3":[49.9,50.4],
 "n4":[50.4,51.7],"a4":[51.7,52.2],"hub":[52.2,52.9],
 "e1":[54.6,55.7],"e2":[55.7,56.9],"fin":[57.0,58.8]}
WIPES=[[10.0,11.2],[26.2,27.4],[41.4,42.6],[53.2,54.4]]
LINES=[
 {"t":0.4,"text":"Jak elfikopki budują swój dom? Zaczynamy od jednego małego elfa."},
 {"t":14.2,"text":"Ich kopiec ma pięć pięter. Na górze dach z mchu, niżej strych z latarniami, potem izby, spiżarnia i piwnica z korzeni."},
 {"t":28.6,"text":"Każdy elf ma swoją rolę. Zbieracz niesie żołędzie. Budowniczy łata ściany. Latarnik pilnuje światła. Posłaniec roznosi wieści."},
 {"t":43.6,"text":"Zapasy krążą w kółko: zbierz, posortuj, schowaj i podziel się z całym lasem."},
 {"t":54.8,"text":"Mały elf. Wielki las."}]
sfx=[]
for k,(a,b) in DRAW.items():
    t=a
    while t<b-0.15: sfx.append({"t":round(t,2),"type":"scribble","gain":0.28}); t+=0.3
for a,b in WIPES: sfx.append({"t":a,"type":"whoosh","gain":0.55})
for t in (3.8,11.3,27.5,42.7,54.5): sfx.append({"t":t,"type":"pop","gain":0.5})
sfx += [{"t":58.85,"type":"sparkle","gain":0.7},{"t":59.0,"type":"ding","gain":0.5}]
S={"duration":60,"music":{"style":"chill","bpm":96,"root":57,"gain":0.9},"lines":LINES,"draw":DRAW,"wipes":WIPES,"sfx":sfx}
open("script.js","w",encoding="utf8").write("window.SCRIPT="+json.dumps(S,ensure_ascii=False)+";")
