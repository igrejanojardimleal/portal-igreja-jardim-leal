#!/usr/bin/env python3
"""Consulta a live EM ANDAMENTO da igreja (não gravações antigas chamadas 'ao vivo').
Preferência: API oficial com secret YOUTUBE_API_KEY; fallback gratuito: yt-dlp.
"""
import datetime as dt
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"live.json"
CHANNEL=os.getenv("YOUTUBE_CHANNEL_ID","UCvLSuAW-QkwyTYiU7ilvoRw")
def api_live():
 key=os.getenv("YOUTUBE_API_KEY","").strip()
 if not key:return None
 query=urllib.parse.urlencode({"part":"snippet","channelId":CHANNEL,"eventType":"live","type":"video","maxResults":1,"key":key})
 req=urllib.request.Request("https://www.googleapis.com/youtube/v3/search?"+query,headers={"User-Agent":"IGJAL-Portal/1.0"})
 with urllib.request.urlopen(req,timeout=25) as f:data=json.load(f)
 for v in data.get("items",[]):
  ident=v.get("id",{}).get("videoId","")
  if re.fullmatch(r"[a-zA-Z0-9_-]{11}",ident):
   return {"id":ident,"title":str(v.get("snippet",{}).get("title") or "Culto ao vivo")[:180]}
 return {}
def yt_live():
 import yt_dlp
 with yt_dlp.YoutubeDL({"quiet":True,"no_warnings":True,"skip_download":True,"noplaylist":True,
     "socket_timeout":18,"retries":1,"extractor_retries":1,"cachedir":False}) as dl:
  video=dl.extract_info("https://www.youtube.com/channel/"+CHANNEL+"/live",download=False)
 if not isinstance(video,dict) or video.get("live_status")!="is_live":return {}
 ident=video.get("id","")
 if not re.fullmatch(r"[a-zA-Z0-9_-]{11}",ident):return {}
 return {"id":ident,"title":str(video.get("title") or "Culto ao vivo")[:180]}
def main():
 try:old=json.loads(OUT.read_text(encoding="utf-8"))
 except (OSError,ValueError):old={}
 source="YouTube Data API" if os.getenv("YOUTUBE_API_KEY","").strip() else "yt-dlp"
 try:
  current=api_live()
  if current is None:current=yt_live()
 except Exception as e:
  error=str(e)
  if "not currently live" in error.lower():
   print("Canal offline: não há transmissão ativa.")
  else:
   print("Falha no detector:",error[:180])
   source="falha-na-consulta"
  current={}
 now=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
 payload={"checked_at":now,"channel_id":CHANNEL,"live":current or None,"source":source}
 if old.get("live") and not current:
  payload["last_ended"]={"id":old["live"].get("id"),"title":old["live"].get("title","Gravação da igreja"),
                         "published":now,"category":"lives"}
  # Inclui o vídeo encerrado no catálogo comum, mesmo que o RSS ainda não tenha atualizado.
  catalog=ROOT/"assets"/"videos.json"
  try:
   body=json.loads(catalog.read_text(encoding="utf-8"))
   videos=body.get("videos",[])
   if isinstance(videos,list) and not any(v.get("id")==payload["last_ended"]["id"] for v in videos):
    videos.append(payload["last_ended"])
    videos.sort(key=lambda v:v.get("published",""),reverse=True)
    body["videos"]=videos
    body["updated_at"]=now
    catalog.write_text(json.dumps(body,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (ROOT/"assets"/"videos.js").write_text("window.IGREJA_PREVIEW_VIDEOS = "+json.dumps(body,ensure_ascii=False)+";\n",encoding="utf-8")
    print("Gravação adicionada ao catálogo de vídeos.")
  except (OSError,ValueError,TypeError) as e:
   print("Catálogo não pôde ser atualizado:",str(e)[:150])
 elif old.get("last_ended"):payload["last_ended"]=old["last_ended"]
 # Enquanto offline evita commits em toda verificação; ao vivo renova checked_at.
 if not current and not old.get("live") and OUT.exists():
  print("Nenhuma transmissão ao vivo confirmada.")
  return
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("AO VIVO" if current else "ENCERRADA")
if __name__=="__main__":main()
