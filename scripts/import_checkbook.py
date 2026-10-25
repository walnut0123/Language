"""One-off, reproducible PDF table import. Requires pdfplumber and pypdfium2."""
import json
import re
import sys
from pathlib import Path
import pdfplumber

source = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
words, report = [], []
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 30
    for day, page in enumerate(pdf.pages, 1):
        text = page.extract_text()
        header = re.search(r'(\d+)일차.*?\|\s*(\d+)개', text)
        assert header and int(header[1]) == day, (day, 'header')
        entries = []
        tables = page.extract_tables()
        assert len(tables) == 1, (day, 'tables')
        for row in tables[0][1:]:
            assert len(row) == 4
            for col in [0, 2]:
                raw, definition = row[col:col + 2]
                if not raw:
                    assert not definition
                    continue
                lines = raw.splitlines()
                match = re.fullmatch(r'(\d+)\s+(.+?)(\s*★)?', lines[0])
                assert match and len(lines) >= 2, (day, raw)
                pos, meaning = definition.replace('\n', ' ').split(' ', 1)
                assert pos in ['명', '동', '형', '부', '관', '접', '연'], (day, pos)
                number = int(match[1])
                entries.append(dict(id=f'yuhadayo-n3-check-d{day:02}-{number:03}', book='check', unit=f'day-{day:02}',
                    japanese=match[2].strip(), reading=''.join(lines[1:]).strip(), meaning=meaning.strip(),
                    partOfSpeech=pos, starred=bool(match[3]), order=number, sourcePage=day))
        entries.sort(key=lambda w: w['order'])
        assert len(entries) == int(header[2]), (day, len(entries), header[2])
        assert [w['order'] for w in entries] == list(range(1, len(entries) + 1)), day
        assert all(w['japanese'] and w['reading'] and w['meaning'] for w in entries)
        words.extend(entries)
        report.append(dict(day=day, expected=int(header[2]), extracted=len(entries), first=entries[0]['japanese'], last=entries[-1]['japanese']))
assert len(set(w['id'] for w in words)) == len(words)
units = [dict(id=f'day-{day:02}', name=f'DAY {day:02}') for day in range(1, 31)]
vocab = dict(books=[dict(id='check', name='체크북', units=units, ready=True), dict(id='main', name='메인북', units=units, ready=False)], words=words)
(root / 'data/source-words.js').write_text('// PDF 원문 단원·번호 기반 영구 ID. 기존 ID를 변경하거나 재사용하지 마세요.\nwindow.VOCABULARY = ' + json.dumps(vocab, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
import subprocess
subprocess.run(['node', str(root / 'scripts/build_vocabulary.cjs')], check=True)
(root / 'data/import-report.json').write_text(json.dumps(dict(source=source.name, total=len(words), days=report), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(total=len(words), days=report), ensure_ascii=False))
