#!/usr/bin/env python3
"""Font số LCD từ các điểm ảnh UI CASIO đã quan sát; không dependency.
Mẫu số và chữ từ Calculate/SETUP đã tự bấm. Giữ mẫu dấu Việt đã đo; glyph chưa đo dùng font fallback ở CSS.
"""
from pathlib import Path
import struct, json, math
ROOT=Path(__file__).resolve().parents[1]
def pack(fmt,*values): return struct.pack('>'+fmt,*values)
def checksum(data):
    data+=b'\0'*((-len(data))%4)
    return sum(struct.unpack('>'+str(len(data)//4)+'I',data))&0xffffffff

def outlines(rows):
    # Union of the observed pixel cells: remove shared edges before tracing.
    # Internal row seams are not separate TrueType contours.
    edges=set()
    for y,row in enumerate(rows):
        for x,value in enumerate(row):
            if value!='1': continue
            points=[(x,11-y),(x,12-y),(x+1,12-y),(x+1,11-y)]
            for start,end in zip(points,points[1:]+points[:1]):
                if (end,start) in edges: edges.remove((end,start))
                else: edges.add((start,end))
    contours=[]
    while edges:
        start,end=min(edges);edges.remove((start,end));points=[start,end]
        while points[-1]!=points[0]:
            previous,current=points[-2:]
            candidates=[b for a,b in edges if a==current]
            if not candidates: raise ValueError('Open glyph contour')
            dx,dy=current[0]-previous[0],current[1]-previous[1]
            def turn(point):
                ux,uy=point[0]-current[0],point[1]-current[1]
                angle=math.atan2(dx*uy-dy*ux,dx*ux+dy*uy)
                return angle if angle < math.pi else -math.pi
            following=min(candidates,key=turn)
            edges.remove((current,following));points.append(following)
        points.pop()
        corners=[]
        for i,point in enumerate(points):
            previous,following=points[i-1],points[(i+1)%len(points)]
            if (point[0]-previous[0])*(following[1]-point[1]) != (point[1]-previous[1])*(following[0]-point[0]): corners.append((point[0]*64,point[1]*64))
        contours.append(corners)
    return contours

def build(data, family="Simulator LCD Numerals"):
    chars=sorted(int(c) for c in data)
    matrices=[[]]+[data[str(c)] for c in chars]
    glyphs=[];loca=[0];metrics=[];max_points=max_contours=0
    for rows in matrices:
        contours=outlines(rows)
        if not contours:
            glyph=b'';left=0
        else:
            pts=[pt for contour in contours for pt in contour]
            left=min(x for x,y in pts)
            glyph=pack('hhhhh',len(contours),left,min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts))
            count=0
            for contour in contours:
                count+=len(contour);glyph+=pack('H',count-1)
            glyph+=pack('H',0)+bytes([1])*len(pts)
            for axis in [0,1]:
                previous=0
                for pt in pts:glyph+=pack('h',pt[axis]-previous);previous=pt[axis]
            max_points=max(max_points,len(pts));max_contours=max(max_contours,len(contours))
        # head.flags bit1 requires lsb=xMin; zeroing lsb moved ink into gaps.
        metrics.append(pack('Hh',704,left))
        glyph+=b'\0'*((-len(glyph))%4);glyphs.append(glyph);loca.append(loca[-1]+len(glyph))
    count=len(glyphs)
    head=pack('IIIIHHqqhhhhHHhhh',0x10000,0x10000,0,0x5f0f3cf5,3,1024,0,0,0,-256,704,768,0,8,2,1,0)
    hhea=pack('IhhhH',0x10000,768,-256,0,704)+pack('11hH',0,0,704,1,0,0,0,0,0,0,0,count)
    maxp=pack('IH13H',0x10000,count,max_points,max_contours,0,0,2,0,0,0,0,0,0,0,0)
    segments=chars+[0xffff];n=len(segments);power=2**int(math.log2(n))
    cmap4=pack('7H',4,16+8*n,0,n*2,power*2,int(math.log2(power)),n*2-power*2)
    cmap4+=b''.join(pack('H',x) for x in segments)+pack('H',0)+b''.join(pack('H',x) for x in segments)
    cmap4+=b''.join(pack('H',(i+1-c)&0xffff) for i,c in enumerate(chars))+pack('H',1)+pack('H',0)*n
    names=[];strings=b''
    for ident,text in [(1,family),(2,'Regular'),(4,family+' Regular'),(6,family.replace(' ','')+'-Regular')]:
        raw=text.encode('utf-16-be');names.append(pack('6H',3,1,0x409,ident,len(raw),len(strings)));strings+=raw
    name=pack('3H',0,len(names),6+12*len(names))+b''.join(names)+strings
    os2=bytearray(78)
    struct.pack_into('>HhHHH',os2,0,0,704,400,5,0)
    struct.pack_into('>4sHHHhhhHH',os2,58,b'BXSM',0x40,chars[0],chars[-1],768,-256,0,768,256)
    tables={'head':head,'hhea':hhea,'maxp':maxp,'hmtx':b''.join(metrics),'loca':b''.join(pack('I',v) for v in loca),'glyf':b''.join(glyphs),'cmap':pack('HHHHI',0,1,3,1,12)+cmap4,'name':name,'post':pack('I',0x30000)+b'\0'*28,'OS/2':bytes(os2)}
    tags=sorted(tables);n=len(tags);power=2**int(math.log2(n));font=pack('I4H',0x10000,n,power*16,int(math.log2(power)),n*16-power*16)
    offset=12+16*n;directory=b'';body=b'';head_offset=0
    for tag in tags:
        value=tables[tag];directory+=pack('4sIII',tag.encode(),checksum(value),offset,len(value))
        if tag=='head':head_offset=offset
        padded=value+b'\0'*((-len(value))%4);body+=padded;offset+=len(padded)
    font=bytearray(font+directory+body)
    struct.pack_into('>I',font,head_offset+8,(0xb1b0afba-checksum(font))&0xffffffff)
    return font
if __name__=='__main__':
    data=json.loads((ROOT/'assets/lcd-glyphs.json').read_text())
    overrides=json.loads((ROOT/'assets/lcd-math-overrides.json').read_text())
    for name,family,glyphs in [('lcd-numerals.ttf','Simulator LCD Numerals',data|overrides),('lcd-text.ttf','Simulator LCD Text',data)]:
        output=ROOT/'assets'/name
        output.write_bytes(build(glyphs,family))
        print(output)
