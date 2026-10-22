"""Build public aggregate statistics from a local CSV/TSV export. Never copy raw responses."""
import argparse,bisect,csv,json,math,re,unicodedata
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
SOURCE='https://docs.google.com/spreadsheets/d/1OYrRl9a1m4ecisvPufCnD8QVC_Vc8PwsiJupL_eqD7Y/edit?usp=sharing'
LABELS={
 'variant':('Version présentée',['16 g','48 g','36 g']),
 'genre':('Genre',['Un homme','Une femme','Autre']),
 'age_band':('Tranche d’âge',['Moins de 18 ans','18–24 ans','25–34 ans','35–44 ans','45–54 ans','55–64 ans','65 ans et plus']),
 'csp':('Catégorie socioprofessionnelle',['Agriculteur / Agricultrice exploitant(e)','Artisan(e), commerçant(e) ou chef(fe) d’entreprise','Cadre ou profession intellectuelle supérieure','Profession intermédiaire','Employé(e)','Ouvrier / Ouvrière','Retraité(e)','Étudiant(e) ou élève','Sans activité professionnelle','Autre situation']),
 'sport':('Pratique sportive',['Plusieurs fois par semaine','Environ une fois par semaine','Moins d’une fois par semaine','Rarement ou jamais']),
 'culpabilite':('Culpabilité après un produit gourmand',['1','2','3','4','5']),
 'frequence_glaces':('Consommation de glaces',['Plusieurs fois par semaine','Environ une fois par semaine','2 à 3 fois par mois','Moins d’une fois par mois','Jamais ou presque jamais']),
 'proteines_habitude':('Consommation de produits protéinés',['Oui, régulièrement','Oui, occasionnellement','Rarement','Jamais']),
 'achat_499':('Achat à 4,99 €',['Très faible','Faible','Moyenne','Élevée','Très élevée']),
 'achat_549':('Achat à 5,49 €',['Très faible','Faible','Moyenne','Élevée','Très élevée']),
 'achat_599':('Achat à 5,99 €',['Très faible','Faible','Moyenne','Élevée','Très élevée']),
 'retenu_proteines':('Déclare avoir retenu les protéines',['oui','non']),
 'perception_proteines':('Perception : glace riche en protéines',['1','2','3','4','5']),
 'intention_achat':('Intention générale d’achat',['1','2','3','4','5'])}
PERCEPTION_TEXT={
 '1 - Pas du tout d’accord':'1',
 '2 - Pas d’accord':'2',
 '3 - Ni d’accord ni en désaccord (ou Sans opinion)':'3',
 '4 - D’accord':'4',
 '5 - Tout à fait d’accord':'5'}
PRICE_KEYS=['prix_trop_bas','prix_bonne_affaire','prix_cher','prix_trop_cher']
LEGACY_COLUMNS = ['submitted_at','variant_grams','genre','age','csp','sport',
 'culpabilite','frequence_glaces','proteines_habitude','prix_trop_bas',
 'prix_bonne_affaire','prix_cher','prix_trop_cher','achat_499','achat_549',
 'achat_599','retenu_proteines','protein_grams','intention_achat']
CURRENT_COLUMNS = LEGACY_COLUMNS[:2]+['variant_condition']+LEGACY_COLUMNS[2:-1]+['perception_proteines','intention_achat']
REQUIRED = set(LEGACY_COLUMNS)-{'submitted_at'}
OPTIONAL = {'perception_proteines'}

def header_key(value):
 text=unicodedata.normalize('NFKD',str(value).strip())
 text=''.join(c for c in text if not unicodedata.combining(c))
 return re.sub(r'[^a-z0-9]','',text.lower())

HEADER_NAMES={header_key(key):key for key in CURRENT_COLUMNS}
HEADER_NAMES.update({header_key(label):key for label,key in {
 'Date et Heure':'submitted_at',
 'Variante':'variant_grams',
 'Variante du grammage':'variant_condition',
 'Activité physique':'sport',
 'Fréquence consommation glaces':'frequence_glaces',
 'Consommation produits protéinés':'proteines_habitude',
 'Prix_doute':'prix_trop_bas',
 'Prix_cher_envisageable':'prix_cher',
 'Protéines retenues':'retenu_proteines',
 'Nombre de protéines saisi':'protein_grams',
 'Valeur protéinée forte':'perception_proteines',
 'Achat_produit':'intention_achat',
}.items()})

def canonical_header(value):
 # Explicit aliases only: accents, spaces, punctuation and case are harmless.
 # Unknown names stay unknown; duplicate aliases must never overwrite values.
 return HEADER_NAMES.get(header_key(value),str(value).strip())

def rows_from_values(values):
 """Allow aligned exports and the verified new payload under old headers only."""
 if not isinstance(values,list) or not values or not isinstance(values[0],list):
  raise ValueError('En-têtes absents : aucune donnée publiée.')
 headers=[canonical_header(v) for v in values[0]]
 named=[h for h in headers if h]
 if len(named)!=len(set(named)):
  raise ValueError('Colonnes dupliquées après correspondance des en-têtes : aucune donnée publiée.')
 if not REQUIRED<=set(named):
  raise ValueError('Colonnes manquantes : '+', '.join(sorted(REQUIRED-set(named)))+'. Aucune donnée publiée.')
 legacy=headers[:len(LEGACY_COLUMNS)]==LEGACY_COLUMNS and not any(headers[len(LEGACY_COLUMNS):])
 rows=[]
 for cells in values[1:]:
  if not isinstance(cells,list):raise ValueError('Structure de ligne invalide : aucune donnée publiée.')
  if not any(str(v).strip() for v in cells):continue
  # The new form inserts variant_condition at C and perception_proteines at T.
  # The verified Apps Script export still uses the 19 old headers. Recognize
  # exactly this layout by its length and its explicit matching condition.
  condition=str(cells[2]).strip() if len(cells)>2 else ''
  grams=number(cells[1]) if len(cells)>1 else None
  matching_condition=grams in (16,48) and condition==str(int(grams))+' g de protéines et réduit en sucre'
  recovered=legacy and matching_condition
  if recovered:
   if len(cells)!=len(CURRENT_COLUMNS):
    raise ValueError('Structure de ligne invalide : nouveau format incomplet.')
   layout=CURRENT_COLUMNS
  else:
   if len(cells)>len(headers) or any(not h and i<len(cells) and str(cells[i]).strip() for i,h in enumerate(headers)):
    raise ValueError('Structure de ligne invalide : cellules sans en-tête reconnu.')
   layout=headers
  row={key:cells[i] if i<len(cells) else '' for i,key in enumerate(layout) if key in REQUIRED|OPTIONAL}
  if recovered:row['_recovered_layout']=True
  rows.append(row)
 return rows

def number(x):
 try:
  v=float(str(x).strip().replace(',','.'));return v if math.isfinite(v) else None
 except (ValueError,TypeError):return None
def median(values):
 v=sorted(values);return (v[(len(v)-1)//2]+v[len(v)//2])/2 if v else None
def age_band(x):
 v=number(x)
 if v is None or v<1 or v>120:return None
 return LABELS['age_band'][1][0 if v<18 else 1 if v<25 else 2 if v<35 else 3 if v<45 else 4 if v<55 else 5 if v<65 else 6]
def clean(row):
 g=number(row.get('variant_grams'))
 if g not in (16,36,48):return None
 out={'variant':str(int(g))+' g','age_band':age_band(row.get('age'))}
 for k,(_,options) in LABELS.items():
  if k not in out:
   v=str(row.get(k,'')).strip().replace("'",'’')
   if k=='perception_proteines':v=PERCEPTION_TEXT.get(v,v)
   out[k]=v if v in options else None
 out['prices']=[number(row.get(k)) for k in PRICE_KEYS]
 out['protein_grams']=number(row.get('protein_grams'))
 return out
def group_stats(rows):
 n=len(rows);distributions={}
 for k,(label,options) in LABELS.items():
  c=Counter(r[k] for r in rows if r[k] is not None)
  distributions[k]={'n':sum(c.values()),'missing':n-sum(c.values()),'counts':[{'label':v,'count':c[v]} for v in options]}
 valid=[];missing=unordered=0
 for r in rows:
  p=r['prices']
  if any(v is None or v<0 for v in p):missing+=1
  elif p!=sorted(p):unordered+=1
  else:valid.append(p)
 curves=[];opp=None
 if valid:
  arrays=[sorted(round(p[k]*100) for p in valid) for k in range(4)]
  grid=sorted({0,arrays[3][-1]+1,*[v for arr in arrays for v in arr]})
  for p in grid:
   curves.append({'price':p/100,'too_cheap':100*(len(valid)-bisect.bisect_left(arrays[0],p))/len(valid),'bargain':100*(len(valid)-bisect.bisect_left(arrays[1],p))/len(valid),'expensive':100*bisect.bisect_right(arrays[2],p)/len(valid),'too_expensive':100*bisect.bisect_right(arrays[3],p)/len(valid)})
  # Equal-rejection crossing, linear interpolation between observed thresholds.
  if len(valid)>=30:
   zeros=[p['price'] for p in curves if abs(p['too_cheap']-p['too_expensive'])<1e-10]
   if zeros:opp={'low':min(zeros),'high':max(zeros)}
   else:
    for a,b in zip(curves,curves[1:]):
     da=a['too_cheap']-a['too_expensive'];db=b['too_cheap']-b['too_expensive']
     if da*db<0:
      v=a['price']+(b['price']-a['price'])*da/(da-db);opp={'low':v,'high':v};break
 price={'n':len(valid),'missing_or_negative':missing,'unordered':unordered,'medians':[median([p[k] for p in valid]) for k in range(4)],'curves':curves,'equal_rejection':opp}
 purchase=[]
 for k,p in [('achat_499',4.99),('achat_549',5.49),('achat_599',5.99)]:
  d=distributions[k];purchase.append({'price':p,'key':k,'n':d['n'],'top2':sum(x['count'] for x in d['counts'][-2:])})
 stated=[r for r in rows if r['retenu_proteines']=='oui'];numeric=[r for r in stated if r['protein_grams'] is not None and r['protein_grams']>=0]
 memory={'n':n,'said_yes':len(stated),'numeric':len(numeric),'correct':sum(r['protein_grams']==int(r['variant'].split()[0]) for r in numeric)}
 cross={}
 for x,(_,xo) in LABELS.items():
  for y,(_,yo) in LABELS.items():
   if x==y:continue
   count=Counter((r[x],r[y]) for r in rows if r[x] is not None and r[y] is not None)
   xs=[v for v in xo if any(a==v for a,_ in count)];ys=[v for v in yo if any(z==v for _,z in count)]
   cross[x+'|'+y]={'n':sum(count.values()),'rows':xs,'columns':ys,'counts':[[count[a,z] for z in ys] for a in xs]}
 return {'n':n,'distributions':distributions,'prices':price,'purchase':purchase,'memory':memory,'cross':cross}
def build(raw,source_columns=None):
 if source_columns is not None:source_columns=[canonical_header(v) for v in source_columns]
 rows=[clean(r) for r in raw];invalid=sum(r is None for r in rows);rows=[r for r in rows if r is not None]
 return {'schema_version':2,'updated_at':datetime.now(timezone.utc).isoformat(),'source_url':SOURCE,'manual_update':True,'quality':{'ignored_invalid_variant':invalid,'uniqueness_checked':False,'perception_column_present':'perception_proteines' in (source_columns if source_columns is not None else {k for r in raw for k in r}),'perception_data_available':'perception_proteines' in (source_columns or []) or any('perception_proteines' in r for r in raw),'recovered_layout_rows':sum(bool(r.get('_recovered_layout')) for r in raw)},'variables':{k:{'label':v[0],'options':v[1]} for k,v in LABELS.items()},'groups':{'all':group_stats(rows),**{str(v):group_stats([r for r in rows if r['variant']==str(v)+' g']) for v in (16,48,36)}}}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('input',type=Path);p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data/questionnaire.json');a=p.parse_args()
 s=a.input.read_text(encoding='utf-8-sig');delimiter='\t' if '\t' in s.splitlines()[0] else ';' if ';' in s.splitlines()[0] else ','
 values=list(csv.reader(s.splitlines(),delimiter=delimiter));raw=rows_from_values(values);data=build(raw,values[0]);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(f"Statistiques agrégées générées : {data['groups']['all']['n']} réponses. Aucun enregistrement individuel exporté.")
if __name__=='__main__':main()
