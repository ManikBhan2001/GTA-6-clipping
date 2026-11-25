import numpy as np, sys, json
sys.path.insert(0,'.')
from geo import i2t, W, L
from math import erf, atan, sqrt, degrees, radians, cos, acos, hypot
R=26.25
POCKETS={'bottom-left':(0,L),'bottom-right':(W,L),'top-left':(0,0),'top-right':(W,0),'left middle':(-15,L/2),'right middle':(W+15,L/2)}
SIG_CUE=0.00106  # rad, calibrated: 1m straight pot, 1m to pocket ~97%
def pot_chance(cue,obj,pocket,balls=(),on_cushion=False):
    cue,obj,pk=map(np.array,(cue,obj,POCKETS[pocket]))
    d2v=pk-obj; d2=np.linalg.norm(d2v); u=d2v/d2
    ghost=obj-u*2*R
    d1v=ghost-cue; d1=np.linalg.norm(d1v)
    cosT=np.dot(d1v/d1,u); 
    if cosT<=0.17: return 0.0,None
    th=degrees(acos(min(1,cosT)))
    # pocket acceptance: corners ~22mm, middles narrower and angle dependent
    if 'middle' in pocket:
        ang=abs(u[0]); w=22*max(0,(ang-0.35)/0.65)
    else:
        diag=np.array([np.sign(pk[0]-W/2) or 1, np.sign(pk[1]-L/2)])/sqrt(2)
        w=22*max(0.25,np.dot(u,diag))**0.5
    if w<=0: return 0.0,None
    tol=atan(w/d2)
    sig_ob=SIG_CUE*d1/(2*R*cosT)*(1.25 if on_cushion else 1.0)
    p=erf(tol/(sqrt(2)*sig_ob))
    # blockers on either path
    def blocked(a,b):
        for q in balls:
            q=np.array(q); ab=b-a; s=np.clip(np.dot(q-a,ab)/np.dot(ab,ab),0,1)
            if 0.02<s<0.98 and np.linalg.norm(a+s*ab-q)<2*R+2: return True
        return False
    if blocked(cue,ghost) or blocked(obj,pk): return 0.0,None
    return p,dict(cut=round(th),d1=round(d1),d2=round(d2))
if __name__=='__main__':
    print('calib',pot_chance((W/2,L/2-1000),(W/2,L/2),'bottom-left') )
