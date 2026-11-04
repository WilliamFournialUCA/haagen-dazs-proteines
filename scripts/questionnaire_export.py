"""Publish a lightweight common snapshot and a verified aggregate-only supplement."""
import hashlib
import json
from pathlib import Path


def encode(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'


def write_snapshot(data,output):
    output=Path(output)
    explorer=data.get('analysis',{}).get('explorer')
    supplement=None
    if explorer and 'pool' in explorer:
        supplement=encode(explorer)
        digest=hashlib.sha256(supplement.encode('utf-8')).hexdigest()
        data['analysis']['explorer']={'version':explorer['version'],'url':'data/questionnaire-crossings.json',
                                     'sha256':digest,'min_segment_n':explorer['min_segment_n']}
    previous=json.loads(output.read_text()) if output.exists() else None
    extra=output.with_name('questionnaire-crossings.json')
    same_data=lambda d:{k:v for k,v in d.items() if k!='updated_at'}
    if previous and same_data(previous)==same_data(data):
        if supplement is None or (extra.exists() and extra.read_text()==supplement):
            return False
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix('.tmp')
    temporary.write_text(encode(data),encoding='utf-8')
    if supplement is not None:
        extra_temporary=extra.with_suffix('.tmp')
        extra_temporary.write_text(supplement,encoding='utf-8')
        extra_temporary.replace(extra)
    temporary.replace(output)
    return True
