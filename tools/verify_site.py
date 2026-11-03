#!/usr/bin/env python3
"""Checagens de integridade do portal público IGJAL (não exigem Supabase)."""
from __future__ import annotations
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    'index.html','louvores.html','agenda.html','canal.html','mural.html',
    'enviar-cifra.html','contribuir.html','historia.html',
    'estudos-biblicos.html','administracao.html'
]

class CheckHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.references = []
        self.images_missing_alt = 0
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'h1':
            self.h1 += 1
        if tag == 'img' and 'alt' not in d:
            self.images_missing_alt += 1
        if tag in ('a','link','script','img'):
            attr = 'href' if tag in ('a','link') else 'src'
            if d.get(attr):
                self.references.append(d[attr])

def verify():
    errors = []
    allowed = {'lives','musicas','orquestra','quarteto','coral','outros'}
    for name in PAGES:
        path = ROOT/name
        if not path.is_file():
            errors.append(f'Página ausente: {name}')
            continue
        markup = path.read_text(encoding='utf-8')
        parser = CheckHTML()
        parser.feed(markup)
        if parser.h1 != 1:
            errors.append(f'{name}: esperado exatamente um H1; encontrado {parser.h1}')
        if parser.images_missing_alt:
            errors.append(f'{name}: {parser.images_missing_alt} imagens sem alt')
        if 'Castro Rebelo' in markup or '25036-110' in markup:
            errors.append(f'{name}: endereço antigo presente')
        for ref in parser.references:
            parsed = urlsplit(ref)
            if parsed.scheme or parsed.netloc or ref.startswith(('#','mailto:','tel:','javascript:','//')):
                continue
            link = parsed.path.lstrip('/')
            if not link or link.endswith('/'):
                continue
            if not (ROOT/link).is_file():
                errors.append(f'{name}: arquivo local não encontrado: {ref}')
    canal = (ROOT/'canal.html').read_text(encoding='utf-8')
    for cat in ['todos','lives','musicas','orquestra','quarteto','coral','outros']:
        if f'data-youtube-filter="{cat}"' not in canal:
            errors.append(f'Filtro do canal ausente: {cat}')
    home = (ROOT/'index.html').read_text(encoding='utf-8')
    donation = (ROOT/'contribuir.html').read_text(encoding='utf-8')
    config = (ROOT/'config.js').read_text(encoding='utf-8')
    if 'Atos 3:21' not in home:
        errors.append('Versículo Atos 3:21 ausente da home')
    if '2 Coríntios 9:7' not in donation:
        errors.append('Versículo 2 Coríntios 9:7 ausente do Pix')
    if 'Rua João Clementino, 831' not in config:
        errors.append('Endereço oficial incompleto em config.js')
    if 'service_role' in config.lower() and re.search(r'service_role\s*[:=]\s*["\'](?!["\'])',config,re.I):
        errors.append('Possível credencial privada em config.js')
    videos = json.loads((ROOT/'assets/videos.json').read_text(encoding='utf-8'))
    for v in videos.get('videos',[]):
        if v.get('category') not in allowed:
            errors.append(f'Categoria YouTube inválida: {v.get("category")}')
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}',str(v.get('id',''))):
            errors.append(f'ID de vídeo inválido: {v.get("id")}')
    if errors:
        print('\n'.join('ERRO: '+err for err in errors))
        raise SystemExit(1)
    print(f'OK: {len(PAGES)} páginas, {len(videos.get("videos",[]))} vídeos e referências locais consistentes.')

if __name__ == '__main__':
    verify()
