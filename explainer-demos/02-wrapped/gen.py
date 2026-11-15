#!/usr/bin/env python3
"""gen.py — data rows -> data.js, per-user script.js (VO text from data) + index.html wrappers."""
import json, os
USERS = {
 "pimpek": dict(id="pimpek", name="Pimpek", handle="@pimpek", role="Zbieracz", accent="#ffc94d", year=2026,
   ctx=dict(value=212, kick="NOCE NA WARCIE", label="nocy na warcie", say="nocy na warcie. Dzięki Tobie las spał spokojnie"),
   mid=dict(value=1840, kick="JAGODY W KOSZYKU", label="jagód w koszyku", say="jagód w koszyku",
            months=[60,70,95,120,150,170,180,260,190,120,70,50], peak="sierpień"),
   hero=dict(value=3475, kick="TWÓJ HIT ROKU", label="żołędzi", say="żołędzi", icon="acorn"),
   friends=[dict(name="Iskra", species="świetlik", nights=86), dict(name="Kolec", species="jeż", nights=61), dict(name="Hugo", species="sowa", nights=44)],
   percentile=94, persona="Nocny Zbieracz", traits=["Sowie oczy","Szybkie łapki","Cichy krok"]),
 "szyszka": dict(id="szyszka", name="Szyszka", handle="@szyszka", role="Budowniczy", accent="#ff8a4c", year=2026,
   ctx=dict(value=187, kick="DESZCZOWE NOCE", label="deszczowych nocy na dachu", say="deszczowych nocy na dachu. Dzięki Tobie las spał sucho"),
   mid=dict(value=1275, kick="MCH W WIADRACH", label="wiader mchu", say="wiader mchu na ścianach",
            months=[40,55,90,110,130,100,80,90,170,250,210,120], peak="październik"),
   hero=dict(value=4965, kick="TWÓJ HIT ROKU", label="łat na kopcu", say="łat na kopcu", icon="patch"),
   friends=[dict(name="Stuk", species="dzięcioł", nights=92), dict(name="Nitka", species="pająk", nights=70), dict(name="Lotek", species="ślimak", nights=39)],
   percentile=97, persona="Dachowa Mistrzyni", traits=["Złote ręce","Oko do detali","Nerwy z mchu"]),
 "jagoda": dict(id="jagoda", name="Jagoda", handle="@jagoda", role="Latarnik", accent="#b78cff", year=2026,
   ctx=dict(value=306, kick="NOCE ZE ŚWIATŁEM", label="nocy ze świecącą lampką", say="nocy ze świecącą lampką. Dzięki Tobie las nie bał się ciemności"),
   mid=dict(value=1415, kick="ŚWIETLIKI NA STRAŻY", label="świetlików w lampkach", say="świetlików w lampkach",
            months=[150,130,100,90,80,70,60,75,110,150,200,260], peak="grudzień"),
   hero=dict(value=6120, kick="TWÓJ HIT ROKU", label="godzin światła", say="godzin światła", icon="lamp"),
   friends=[dict(name="Cień", species="nietoperz", nights=104), dict(name="Pyłek", species="ćma", nights=77), dict(name="Rudy", species="lis", nights=52)],
   percentile=91, persona="Strażniczka Światła", traits=["Cierpliwość","Ciepłe serce","Czujne oko"]),
}
def script(u):
    f = u["friends"]; avg = round(u["hero"]["value"] / u["ctx"]["value"])
    lines = [
     (0.5,  f"{u['name']}, oto Twój rok 2026 w Elfikopkach."),
     (6.5,  f"{u['ctx']['value']} {u['ctx']['say']}."),
     (13.5, f"{u['mid']['value']} {u['mid']['say']}. Najlepszy miesiąc: {u['mid']['peak']}."),
     (21.6, f"Twoja trójka z lasu: {f[2]['species']} {f[2]['name']}, {f[1]['species']} {f[1]['name']} i na szczycie {f[0]['species']} {f[0]['name']}."),
     (31.6, f"W tym roku: {u['hero']['value']} {u['hero']['say']}. To średnio {avg} na noc."),
     (41.6, f"To więcej niż {u['percentile']} procent wszystkich elfikopków!"),
     (48.6, f"Twój typ: {u['persona']}."),
     (53.9, "Mały elf. Wielki las. Do zobaczenia!"),
    ]
    st = [0,6,13,21,31,41,48,53.4]
    sfx = [dict(t=round(s-.05,2), type="whoosh", gain=.5) for s in st[1:]]
    sfx += [dict(t=.45,type="pop"),dict(t=.6,type="pop",gain=.5),dict(t=.75,type="sparkle",gain=.4)]
    sfx += [dict(t=round(6.9+i*.25,2),type="tick",gain=.6) for i in range(10)]
    sfx += [dict(t=round(14+i*.2,2),type="tick",gain=.6) for i in range(10)] + [dict(t=16.4,type="pop")]
    sfx += [dict(t=22.6,type="ding",gain=.5),dict(t=24.6,type="ding",gain=.6),dict(t=26.9,type="ding",gain=.8),dict(t=27.0,type="sparkle")]
    sfx += [dict(t=round(32.4+i*.28,2),type="tick",gain=.6) for i in range(14)] + [dict(t=36.5,type="boom",gain=.8),dict(t=36.5,type="sparkle")]
    sfx += [dict(t=43.0,type="swoosh_up",gain=.5),dict(t=45.2,type="ding",gain=.9),dict(t=45.2,type="sparkle")]
    sfx += [dict(t=49.0,type="pop"),dict(t=49.6,type="sparkle"),dict(t=54.0,type="ding",gain=.7),dict(t=54.1,type="sparkle")]
    return {"user":u["id"],"duration":60,"music":{"style":"bouncy","bpm":108,"root":57,"gain":.8},
            "lines":[dict(t=t,text=x,speed=160) for t,x in lines],"sfx":sfx}
os.makedirs(".",exist_ok=True)
open("data.js","w",encoding="utf8").write("window.USERS="+json.dumps(USERS,ensure_ascii=False,indent=1)+";")
HTML = """<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elfikopki Wrapped 2026 — {name}</title>
<link rel="stylesheet" href="{up}../tools/base.css"><link rel="stylesheet" href="{up}wrapped.css">
<body><div id="stage"></div>
<script src="script.js"></script><script src="timing.js"></script><script src="{up}../tools/engine.js"></script><script src="{up}data.js"></script><script src="{up}wrapped.js"></script>"""
for k,u in USERS.items():
    os.makedirs(k,exist_ok=True)
    open(f"{k}/script.js","w",encoding="utf8").write("window.SCRIPT="+json.dumps(script(u),ensure_ascii=False)+";")
    open(f"{k}/index.html","w",encoding="utf8").write(HTML.format(name=u["name"],up="../"))
open("index.html","w",encoding="utf8").write("""<!doctype html><meta charset="utf-8"><title>Elfikopki Wrapped 2026</title>
<script>var u=new URLSearchParams(location.search).get('user')||'pimpek';var q=location.search;
document.write('<meta http-equiv="refresh" content="0;url='+u+'/index.html'+q+'">');</script>""")
print("gen ok")
