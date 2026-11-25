import numpy as np
W,L=1778.0,3569.0
# playing-surface corners (cushion noses) in the 640x360 frame; top of image = baulk end
IMG=np.array([(165.5,106.5),(464.0,106.5),(127.5,287.5),(505.5,287.5)],float)
TAB=np.array([(0,0),(W,0),(0,L),(W,L)],float)
def homog(src,dst):
    A=[]
    for (x,y),(u,v) in zip(src,dst):
        A.append([x,y,1,0,0,0,-u*x,-u*y,-u]);A.append([0,0,0,x,y,1,-v*x,-v*y,-v])
    _,_,vt=np.linalg.svd(np.array(A));return vt[-1].reshape(3,3)/vt[-1][-1]
H=homog(IMG,TAB);Hi=np.linalg.inv(H)
def i2t(p): v=H@[p[0],p[1],1];return v[:2]/v[2]
def t2i(p): v=Hi@[p[0],p[1],1];return v[:2]/v[2]
