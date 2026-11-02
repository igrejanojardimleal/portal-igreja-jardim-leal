#!/usr/bin/env python3
"""Sincroniza vídeo públicos do YouTube em assets/videos.json sem chave de API.
Usa o feed Atom que lista os últimos ~15 uploads por consulta e acumula os
vídeos ao longo do tempo. Não promete backfill de todo histórico do canal.
"""
import datetime as dt
import json
import os
import re
import sys
import subprocess
import shutil
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'videos.json'
OUT_JS = ROOT / 'assets' / 'videos.js'
HANDLE = os.getenv('YOUTUBE_HANDLE', 'igrejanojardimlealobradare8130').strip().lstrip('@')
CHANNEL = os.getenv('YOUTUBE_CHANNEL_ID', 'UCvLSuAW-QkwyTYiU7ilvoRw').strip()
UA = 'Mozilla/5.0 (compatible; IGJALVideoFeed/1.0; GitHubActions)'

def read_url(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language':'pt-BR,pt;q=0.9'})
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read().decode('utf-8', 'replace')

def find_channel_id():
    if re.fullmatch(r'UC[a-zA-Z0-9_-]{22}', CHANNEL):
        return CHANNEL
    text = read_url('https://www.youtube.com/@' + urllib.parse.quote(HANDLE))
    patterns = [
        r'<meta[^>]+itemprop=["\']channelId["\'][^>]+content=["\'](UC[a-zA-Z0-9_-]{22})',
        r'"(?:channelId|externalId|browseId)"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"',
        r'channel_id=(UC[a-zA-Z0-9_-]{22})',
        r'\/channel\/(UC[a-zA-Z0-9_-]{22})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    raise ValueError('Não foi possível descobrir o channel ID. Configure a variável YOUTUBE_CHANNEL_ID no repositório (ID UC...).')

def categoria(titulo, origem=''):
    titulo = str(titulo or '').casefold()
    normal = __import__('unicodedata').normalize('NFD',titulo)
    normal = ''.join(ch for ch in normal if __import__('unicodedata').category(ch) != 'Mn')
    if origem == 'streams' or re.search(r'ao vivo|transmissao|live|stream|vigilia', normal):
        return 'lives'
    if re.search(r'playback|medley|musica|hino|louvor|coral|cantico|canto|adoracao|instrumental|banda|solo', normal):
        return 'musicas'
    return 'outros'

def buscar_historico(channel):
    """Tentativa gratuita de importar históricos públicos. Pode falhar por limites do YouTube."""
    if os.getenv('YOUTUBE_BACKFILL', '0') != '1':
        return []
    if not shutil.which('yt-dlp'):
        print('yt-dlp indisponível: sincronização continua pelo feed RSS.')
        return []
    achados = {}
    for aba in ('videos','streams','shorts'):
        url = f'https://www.youtube.com/channel/{channel}/{aba}'
        cmd = ['yt-dlp','--flat-playlist','--skip-download','--ignore-errors',
               '--no-warnings','--no-progress','--dump-single-json','--socket-timeout','15',url]
        try:
            proc = subprocess.run(cmd,capture_output=True,text=True,timeout=110,check=False)
            if proc.returncode != 0:
                print(f'Histórico da aba {aba} indisponível: {proc.stderr[-300:]}',file=sys.stderr)
                continue
            data = json.loads(proc.stdout)
            for video in (data.get('entries') or []):
                if not isinstance(video,dict):
                    continue
                ident = str(video.get('id') or '')
                if not re.fullmatch(r'[a-zA-Z0-9_-]{11}',ident):
                    continue
                titulo = str(video.get('title') or 'Vídeo da igreja').strip()
                data_upload = str(video.get('upload_date') or video.get('release_date') or '')
                data_iso = data_upload[:4]+'-'+data_upload[4:6]+'-'+data_upload[6:8] if re.fullmatch(r'\d{8}',data_upload) else ''
                achados[ident] = {
                    'id': ident, 'title': titulo,
                    'published': data_iso,
                    'category': categoria(titulo,aba)
                }
        except (subprocess.TimeoutExpired,ValueError,OSError) as exc:
            print(f'Histórico da aba {aba} não carregado: {exc}',file=sys.stderr)
    print(f'Histórico encontrado: {len(achados)} vídeos únicos via listas do canal.')
    return list(achados.values())

def main():
    channel = find_channel_id()
    xml = read_url('https://www.youtube.com/feeds/videos.xml?channel_id=' + channel)
    root = ET.fromstring(xml)
    ns = {'atom':'http://www.w3.org/2005/Atom','yt':'http://www.youtube.com/xml/schemas/2015'}
    items = []
    for entry in root.findall('atom:entry', ns):
        video_id = (entry.findtext('yt:videoId', default='', namespaces=ns) or '').strip()
        if not re.fullmatch(r'[a-zA-Z0-9_-]{11}', video_id):
            continue
        title = (entry.findtext('atom:title', default='Vídeo da igreja', namespaces=ns) or 'Vídeo da igreja').strip()
        published = (entry.findtext('atom:published', default='', namespaces=ns) or '').strip()
        items.append({'id':video_id, 'title':title, 'published':published})
    if not items:
        raise ValueError('Feed vazio; não vou apagar o catálogo atual.')
    try:
        old = json.loads(OUT.read_text(encoding='utf-8'))
    except (OSError,ValueError):
        old = {'videos':[]}
    catalog = {v['id']:v for v in old.get('videos',[]) if re.fullmatch(r'[a-zA-Z0-9_-]{11}',str(v.get('id','')))}
    for v in buscar_historico(channel):
        anterior = catalog.get(v['id'],{})
        # Não perde datas e títulos completos previamente conferidos no RSS.
        catalog[v['id']] = {**v, **{k:val for k,val in anterior.items() if val}, 'category': v['category'] if v['category']=='lives' else anterior.get('category') or v['category']}
    for v in items:
        anterior = catalog.get(v['id'],{})
        catalog[v['id']] = {**anterior, **v, 'category': categoria(v['title']) if anterior.get('category')!='lives' else 'lives'}
    for v in catalog.values():
        v['category'] = v.get('category') if v.get('category') in ('lives','musicas','outros') else categoria(v.get('title',''))
    videos = sorted(catalog.values(),key=lambda v:v.get('published',''),reverse=True)
    # Só altera o arquivo quando novos vídeos ou metadados mudarem; evita commits inúteis.
    if videos == old.get('videos', []):
        print(f'Sem vídeos novos ({len(videos)} no catálogo).')
        return
    payload = {
        'channel': 'https://www.youtube.com/@' + HANDLE,
        'channel_id': channel,
        'updated_at': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z'),
        'videos': videos,
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    OUT_JS.write_text('window.IGREJA_PREVIEW_VIDEOS = '+json.dumps(payload,ensure_ascii=False)+';\n',encoding='utf-8')
    print(f'Atualizado: {len(items)} no feed, {len(videos)} no catálogo total.')

if __name__=='__main__':
    try: main()
    except Exception as ex:
        print(f'ATENÇÃO: atualização do YouTube não concluída: {ex}',file=sys.stderr)
        sys.exit(1)