#!/usr/bin/env python3
"""audio.py <dir>  — reads <dir>/script.js (window.SCRIPT = {...}), synthesizes VO (espeak-ng pl),
music + SFX (numpy), mixes with ducking, writes <dir>/audio.wav and <dir>/timing.js (measured VO timing).
SCRIPT: {duration, music:{style,bpm,root,gain}, lines:[{t,text,speed?}], sfx:[{t,type,gain?}]}"""
import sys, json, re, subprocess, wave, os, tempfile
import numpy as np
SR = 44100
d = sys.argv[1]
src = open(f"{d}/script.js", encoding="utf8").read()
S = json.loads(re.sub(r"^\s*window\.SCRIPT\s*=\s*", "", src).strip().rstrip(";"))
DUR = S.get("duration", 60)
N = int(SR * (DUR + 1))
rng = np.random.default_rng(7)

def tone(f, n, harm=(1,), amps=None):
    t = np.arange(n) / SR
    amps = amps or [1 / (i + 1) for i in range(len(harm))]
    return sum(a * np.sin(2 * np.pi * f * h * t) for h, a in zip(harm, amps))
def env(n, a=0.005, r=0.2, curve=3.0):
    t = np.arange(n) / SR
    e = np.exp(-t / max(r, 1e-3) * curve / 3)
    att = np.minimum(1, t / max(a, 1e-4))
    return e * att
def add(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1]: return
    x = x[: buf.shape[1] - i]
    buf[0, i:i+len(x)] += x * gain * (1 - max(0, pan))
    buf[1, i:i+len(x)] += x * gain * (1 + min(0, pan))
def lp(x, k):  # simple one-pole lowpass
    a = np.exp(-2*np.pi*k/SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1-a)*x[i] + a*s; y[i] = s
    return y
def midi(m): return 440 * 2 ** ((m - 69) / 12)

# ---------- SFX ----------
def sfx(kind):
    if kind == "pop":
        n = int(.18*SR); t = np.arange(n)/SR; f = 900*np.exp(-t*18)+200
        return np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,.002,.12)
    if kind == "whoosh":
        n = int(.7*SR); x = rng.standard_normal(n); t=np.arange(n)/SR
        y = lp(x, 1500)*np.sin(np.pi*t/.7)**2
        return y*1.4
    if kind == "ding":
        n = int(1.4*SR); return (tone(1318.5, n, (1,2.76,5.4), (1,.35,.15))*env(n,.002,.9))*.6
    if kind == "tick":
        n = int(.05*SR); return rng.standard_normal(n)*env(n,.0005,.03)*.5
    if kind == "thud":
        n = int(.4*SR); t=np.arange(n)/SR; f=90*np.exp(-t*8)+40
        return np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,.002,.3)*1.2
    if kind == "sparkle":
        out = np.zeros(int(1.0*SR))
        for k in range(7):
            n = int(.35*SR); x = tone(midi(88+ (k*3)%12), n, (1,2),(1,.3))*env(n,.002,.25)*.35
            i = int(k*.06*SR); out[i:i+n] += x
        return out
    if kind == "swoosh_up":
        n = int(.5*SR); t=np.arange(n)/SR; f=300+1800*(t/.5)**2
        return np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*t/.5)*.5
    if kind == "boom":
        n = int(1.2*SR); t=np.arange(n)/SR; f=70*np.exp(-t*3)+30
        return (np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,.005,.9)+lp(rng.standard_normal(n),400)*env(n,.001,.5)*.6)
    if kind == "scribble":
        n = int(.35*SR); x = lp(rng.standard_normal(n), 3500)*(0.6+0.4*np.sin(np.arange(n)/SR*90))
        return x*np.sin(np.pi*np.arange(n)/n)*.35
    if kind == "click":
        n=int(.03*SR); return tone(2200,n)*env(n,.0003,.02)*.5
    raise SystemExit("unknown sfx "+kind)

# ---------- Music ----------
STYLES = {  # prog = scale-degree chords in semitones above root (triads), arp pattern, drums
 "warm":   dict(prog=[[0,4,7],[9,12,16],[5,9,12],[7,11,14]], arp=[0,1,2,1], drums="soft", oct=0),
 "bouncy": dict(prog=[[0,4,7],[7,11,14],[9,12,16],[5,9,12]], arp=[0,2,1,2], drums="four", oct=0),
 "wonder": dict(prog=[[0,3,7],[8,12,15],[5,8,12],[10,14,17]], arp=[0,1,2,1,2,1], drums="none", oct=1),
 "epic":   dict(prog=[[0,3,7],[8,12,15],[3,7,10],[10,14,17]], arp=[0,1,2,1], drums="four", oct=0),
 "chill":  dict(prog=[[0,4,7,11],[9,12,16,19],[5,9,12,16],[7,11,14,17]], arp=[0,2,1,3], drums="soft", oct=0),
}
def music(m):
    st = STYLES[m.get("style","warm")]; bpm = m.get("bpm",100); root = m.get("root",60)
    buf = np.zeros((2,N)); beat = 60/bpm; bar = beat*4; nb = int(DUR/bar)+2
    for b in range(nb):
        t0 = b*bar; ch = st["prog"][b % len(st["prog"])]
        # pad
        n = int(bar*SR*1.05); pad = np.zeros(n)
        for k in ch: pad += tone(midi(root-12+k), n, (1,2,3), (1,.4,.15))
        e = np.minimum(1, np.arange(n)/SR/.5)*np.minimum(1,(n-np.arange(n))/SR/.6)
        add(buf, pad*e*.07, t0, 1, -.3)
        # bass
        for q in (0,2):
            nn = int(beat*2*SR); add(buf, tone(midi(root-24+ch[0]), nn,(1,2),(1,.3))*env(nn,.01,beat*1.6)*.22, t0+q*beat)
        # arp
        pat = st["arp"]; steps = 8
        for s in range(steps):
            k = ch[pat[s%len(pat)] % len(ch)] + 12*st["oct"] + (12 if s%4 else 0)
            nn = int(beat*SR); add(buf, tone(midi(root+k), nn,(1,2,3),(1,.25,.1))*env(nn,.003,beat*.9)*.12, t0+s*beat/2, 1, (-.5 if s%2 else .5))
        # drums
        if st["drums"] != "none":
            for q in range(4):
                if st["drums"]=="four" or q in (0,2):
                    add(buf, sfx("thud")[:int(.25*SR)]*(.5 if st["drums"]=="four" else .3), t0+q*beat)
            for s in range(8):
                nn=int(.06*SR); hat = rng.standard_normal(nn)*env(nn,.0005,.04)
                add(buf, np.diff(hat, prepend=0)*.12, t0+s*beat/2+ (beat/4 if st["drums"]=="four" else 0))
    # fade in/out
    t = np.arange(N)/SR; fade = np.minimum(1, t/1.5)*np.minimum(1, np.maximum(0,(DUR-t))/2.0)
    return buf*fade*m.get("gain",1.0)

# ---------- VO ----------
def vo_line(text, speed):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: p = f.name
    subprocess.run(["espeak-ng","-v","pl","-s",str(speed),"-p","55","-a","170","-g","2","-w",p,text],check=True)
    w = wave.open(p); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768; w.close(); os.unlink(p)
    if sr != SR:
        x = np.interp(np.arange(int(len(x)*SR/sr))/SR*sr, np.arange(len(x)), x)
    return x

mix = music(S.get("music",{}))
vo = np.zeros((2,N)); timing = []
for L in S["lines"]:
    x = vo_line(L["text"], L.get("speed",150))
    x = lp(x, 7000)  # soften espeak harshness
    add(vo, x, L["t"], 1.4)
    end = L["t"] + len(x)/SR
    timing.append(dict(t=L["t"], end=round(end,3), text=L["text"]))
    if end > DUR: print("WARN line overruns video:", L["text"][:40], end)
for a, b in zip(timing, timing[1:]):
    if a["end"] > b["t"] - 0.05: print(f"WARN overlap: line@{a['t']} ends {a['end']:.2f} > next {b['t']}")
# duck music under VO
amp = np.abs(vo[0]) + np.abs(vo[1]); k = int(.15*SR)
envl = np.convolve(amp, np.ones(k)/k, mode="same"); duck = 1 - 0.6*np.clip(envl*18, 0, 1)
mix *= duck
fx = np.zeros((2,N))
for e in S.get("sfx", []): add(fx, sfx(e["type"]), e["t"], e.get("gain",0.7), e.get("pan",0))
out = mix + vo + fx
out = np.tanh(out*0.9)
pcm = (np.clip(out,-1,1).T*32767).astype(np.int16)
w = wave.open(f"{d}/audio_raw.wav","wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"{d}/audio_raw.wav","-t",str(DUR),"-af","loudnorm=I=-14:TP=-1.5:LRA=11",f"{d}/audio.wav"],check=True)
os.unlink(f"{d}/audio_raw.wav")
open(f"{d}/timing.js","w",encoding="utf8").write("window.TIMING="+json.dumps(timing,ensure_ascii=False)+";")
print("ok", d, [(round(t['t'],1),round(t['end'],1)) for t in timing])
