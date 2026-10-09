"""Build two-page visual handouts from published lesson content, without client data."""
import json,hashlib,pathlib,html
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'client-app-v3/playbook/guides'; OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('LE','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('LEB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LES','/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
NAVY='#102537';GOLD='#b6985d';INK='#253b4d';MUTED='#526477';WHITE='#ffffff'
W,H=595.28,841.89
rows=json.loads((ROOT/'content/legal-edge-playbook.json').read_text())
def plain(s):return s.replace('–','-').replace('—','-').replace('’',"'").replace('·',' / ')
def para(c,s,x,y,w,size=11,color=INK,font='LE',leading=None):
 style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.45,textColor=HexColor(color))
 p=Paragraph(html.escape(plain(s)),style);_,h=p.wrap(w,1000);p.drawOn(c,x,y-h);return y-h

def rect(c,x,y,w,h,color):c.setFillColor(HexColor(color));c.rect(x,y,w,h,fill=1,stroke=0)
def tag(c,s,x,y,color=GOLD):return para(c,s.upper(),x,y,480,8,color,'LEB',11)
def footer(c,n):
 c.setStrokeColor(HexColor('#d9dfdf'));c.line(40,35,555,35)
 para(c,'THE LEGAL EDGE / COACHING PLAYBOOK',40,26,440,7,MUTED)
 para(c,f'{n} / 2',518,26,40,7,MUTED)
def diagram(c,v,y):
 rect(c,0,y-235,W,235,NAVY);tag(c,'The idea, at a glance',40,y-22,'#d3b780')
 para(c,v['title'],40,y-43,500,18,WHITE,'LES',25)
 # Diagram marks have no numeric scale; the trend is explicitly synthetic.
 if v['type']=='plate':
  c.setLineWidth(13);c.setStrokeColor(HexColor('#304b60'));c.circle(110,y-145,49,stroke=1,fill=0)
  c.setStrokeColor(HexColor(GOLD));c.arc(61,y-194,159,y-96,0,110)
  c.setLineWidth(1);c.setStrokeColor(HexColor('#8299a7'));c.circle(110,y-145,29,stroke=1,fill=0)
 elif v['type']=='priority':
  for i in range(3):
   rect(c,50,y-100-i*40,112-i*25,16,'#304b60')
   rect(c,50,y-95-i*40,112-i*25,3,GOLD)
 elif v['type']=='trend':
  pts=[(48,y-110),(65,y-90),(82,y-145),(100,y-117),(120,y-174),(141,y-152),(161,y-184)]
  c.setStrokeColor(HexColor('#c7d4dd'));c.setLineWidth(1.4)
  for a,b in zip(pts,pts[1:]):c.line(*a,*b)
  c.setStrokeColor(HexColor(GOLD));c.setLineWidth(3);c.line(48,y-111,161,y-180)
  para(c,'Synthetic example',48,y-197,115,7,'#b9c8d2',leading=9)
 else:
  c.setStrokeColor(HexColor('#647e8f'));c.setLineWidth(1);c.line(70,y-95,143,y-186)
  for i in range(3):
   c.setFillColor(HexColor(GOLD if i==0 else NAVY));c.setStrokeColor(HexColor(GOLD));c.setLineWidth(2)
   c.circle(70+i*36,y-95-i*45,15,stroke=1,fill=1)
 for i,n in enumerate(v['nodes']):
  top=y-79-i*43
  para(c,f"{i+1:02d} / "+n['label'],200,top,350,10,WHITE,'LEB',13)
  para(c,n['text'],200,top-16,350,9,'#d9e1e7',leading=12)
 para(c,v['caption'],40,y-213,515,7,'#b9c8d2',leading=10)
 return y-260

def build(r):
 d=r['learning_design'];d.pop('pdf_file',None)
 digest=hashlib.sha256(json.dumps({'lesson':d,'evidence':r['evidence']},sort_keys=True).encode()).hexdigest()[:12]
 fname=r['slug']+'-'+digest+'.pdf';c=canvas.Canvas(str(OUT/fname),pagesize=(W,H))
 c.setTitle(r['title']+' | Legal Edge');c.setAuthor('Legal Edge')
 rect(c,0,H-225,W,225,'#f7f5ef');tag(c,'Legal Edge / '+r['category']+' / 3-minute lesson',40,H-33)
 y=para(c,d['headline'],40,H-61,515,29,INK,'LES',35)
 y=para(c,d['deck'],40,y-15,515,11,MUTED)
 assert y>H-211,(r['slug'],'hero overflow',y)
 y=diagram(c,d['visual'],H-225)
 tag(c,'01 / Why this works',40,y)
 y=para(c,d['science'],40,y-22,515,11,leading=16)
 tag(c,'The limit of the evidence',40,y-18)
 y=para(c,d['limitation'],40,y-37,515,11,MUTED,leading=16)
 assert y>155,(r['slug'],'science overflow',y)
 rect(c,0,49,W,90,NAVY);tag(c,'The line to remember',40,121,'#d3b780')
 end=para(c,d['takeaway'],40,100,515,15,WHITE,'LES',20)
 assert end>56,(r['slug'],'takeaway overflow')
 footer(c,1);c.showPage()
 tag(c,'02 / Make it fit your day',40,H-35)
 y=para(c,d['decision']['question'],40,H-57,515,21,INK,'LES',27)
 for i,q in enumerate(d['decision']['choices']):
  y-=15; y=para(c,f'{i+1:02d} / '+q['label'],40,y,515,11,INK,'LEB',15)
  y=para(c,q['answer'],61,y-5,494,11,MUTED,leading=16)
 y-=25;tag(c,'03 / In a real working week',40,y);y-=20
 y=para(c,'Illustrative scenario - not a client result',40,y,515,8,MUTED)
 y=para(c,d['case']['context'],40,y-9,515,11,INK,leading=16)
 y=para(c,'Useful move: '+d['case']['action'],40,y-9,515,11,MUTED,leading=16)
 y=para(c,'Why: '+d['case']['reason'],40,y-9,515,11,MUTED,leading=16)
 y-=22;tag(c,'04 / Use this today',40,y);y-=19
 for i,s in enumerate(d['steps']):y=para(c,f'{i+1:02d} / '+s,40,y-5,515,11,INK,leading=16)
 y-=21;tag(c,'Evidence / original sources',40,y);y-=17
 for e in r['evidence']:
  top=y; y=para(c,e['title'],40,y-4,515,7.5,MUTED,leading=10)
  c.linkURL(e['url'],(40,y,555,top),relative=0)
 y=para(c,'Open the linked original sources. Research findings and coaching applications are distinguished on page 1. Your assigned plan remains individual.',40,y-9,515,7.5,MUTED,leading=10)
 assert y>50,(r['slug'],'page 2 overflow',y)
 footer(c,2);c.save();d['pdf_file']=fname
 print(r['slug'],fname,'page 2 bottom',round(y))
for r in rows:
 if r['published'] and r.get('learning_design'):build(r)
(ROOT/'content/legal-edge-playbook.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(ROOT/'client-app-v3/playbook/content.json').write_text(json.dumps([r for r in rows if r['published']],ensure_ascii=False,indent=2)+'\n')
# Persist the same evidence and content as the static demo; RLS and revisions remain unchanged.
p=ROOT/'supabase/migrations/20261009185617_playbook_visual_lessons.sql'
sql=p.read_text().split('update public.coaching_start_resources')[0]
for r in rows:
 if r['published'] and r.get('learning_design'):
  fields={k:r[k] for k in ['learning_design','evidence','description','quick_answer']}
  clauses=[]
  for k,v in fields.items():
   value=json.dumps(v,ensure_ascii=False) if k in ['learning_design','evidence'] else v
   clauses.append(k+'=$lesson$'+value+'$lesson$'+('::jsonb' if k in ['learning_design','evidence'] else ''))
  sql+='update public.coaching_start_resources set '+', '.join(clauses)+" where coach_id='56bd942e-7baa-42d3-a9c3-5eedcb33f1db' and slug='"+r['slug']+"';\n"
p.write_text(sql)
