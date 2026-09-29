import math, itertools, sys
def hex2rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def delin(c): c=max(0,min(1,c)); return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def lum(h): r,g,b=[lin(c) for c in hex2rgb(h)]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b): la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
M={'protan':[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
   'deutan':[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
   'tritan':[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]}
def sim(h,k):
    l=[lin(c) for c in hex2rgb(h)]
    if k=='normal': return [delin(c) for c in l]
    m=M[k]; return [delin(sum(m[i][j]*l[j] for j in range(3))) for i in range(3)]
def lab(rgb):
    r,g,b=[lin(c) for c in rgb]
    x=(0.4124*r+0.3576*g+0.1805*b)/0.95047; y=(0.2126*r+0.7152*g+0.0722*b); z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*f(y)-16, 500*(f(x)-f(y)), 200*(f(y)-f(z)))
def de2000(l1,l2):
    L1,a1,b1=l1;L2,a2,b2=l2
    C1=math.hypot(a1,b1);C2=math.hypot(a2,b2);Cb=(C1+C2)/2
    G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7)))
    a1p=(1+G)*a1;a2p=(1+G)*a2;C1p=math.hypot(a1p,b1);C2p=math.hypot(a2p,b2)
    h1p=math.degrees(math.atan2(b1,a1p))%360;h2p=math.degrees(math.atan2(b2,a2p))%360
    dL=L2-L1;dC=C2p-C1p
    dh=h2p-h1p
    if C1p*C2p==0: dh=0
    elif dh>180: dh-=360
    elif dh<-180: dh+=360
    dH=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh/2))
    Lb=(L1+L2)/2;Cbp=(C1p+C2p)/2
    if C1p*C2p==0: hb=h1p+h2p
    elif abs(h1p-h2p)<=180: hb=(h1p+h2p)/2
    elif h1p+h2p<360: hb=(h1p+h2p+360)/2
    else: hb=(h1p+h2p-360)/2
    T=1-0.17*math.cos(math.radians(hb-30))+0.24*math.cos(math.radians(2*hb))+0.32*math.cos(math.radians(3*hb+6))-0.20*math.cos(math.radians(4*hb-63))
    dth=30*math.exp(-((hb-275)/25)**2);RC=2*math.sqrt(Cbp**7/(Cbp**7+25**7))
    SL=1+0.015*(Lb-50)**2/math.sqrt(20+(Lb-50)**2);SC=1+0.045*Cbp;SH=1+0.015*Cbp*T
    RT=-math.sin(math.radians(2*dth))*RC
    return math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH))
def cats(name,pal,bg):
    print(f'\n== {name} categorical, bg {bg}')
    for k,v in pal.items(): print(f'  {k:12s} {v}  vs bg {cr(v,bg):.2f}:1  L*={lab(hex2rgb(v))[0]:.0f}')
    for mode in ['normal','protan','deutan','tritan']:
        worst=min(((de2000(lab(sim(pal[a],mode)),lab(sim(pal[b],mode))),a,b) for a,b in itertools.combinations(pal,2)))
        print(f'  {mode:7s} min dE2000 = {worst[0]:.1f} ({worst[1]} / {worst[2]})')
def text(name,pairs):
    print(f'\n== {name} text contrast')
    for fg,bg,label in pairs: r=cr(fg,bg); print(f'  {label:34s} {fg} on {bg}: {r:.2f}:1 {"AA" if r>=4.5 else ("AA-large/UI" if r>=3 else "FAIL")}')


if __name__=='__main__':
    exec(open(sys.argv[1]).read())
