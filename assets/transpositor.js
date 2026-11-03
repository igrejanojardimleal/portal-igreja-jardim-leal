/*
 * Transposição de cifras — IGJAL v5
 * Fonte: cifra textual previamente revisada pelo departamento de música.
 * NÃO lê, extrai nem reescreve PDFs. Sem dependências externas.
 * Formatos reconhecidos: acordes em linhas exclusivas ou [C] entre palavras.
 */
window.IGREJA_TRANSPOSE = (() => {
  'use strict';
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const LABELS = ['Dó','Dó#','Ré','Ré#','Mi','Fá','Fá#','Sol','Sol#','Lá','Lá#','Si'];
  const PITCH = {C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
  const SOLFEGE = {'do':'C','re':'D','mi':'E','fa':'F','sol':'G','la':'A','si':'B'};
  function noteIndex(note){return Object.prototype.hasOwnProperty.call(PITCH,note)?PITCH[note]:null;}
  function keyInfo(raw){
    const s=String(raw||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/♯/g,'#').replace(/♭/g,'b');
    if(!s)return null;
    // Aceita Do, Do#, Ré, Lá menor e notação internacional C#, Bb, Am.
    const sol=s.match(/^(do|re|mi|fa|sol|la|si)([#b]?)(?:\s*(m|menor|minor))?$/i);
    const eng=s.match(/^([A-Ga-g])([#b]?)(?:\s*(m|menor|minor))?$/i);
    let symbol,minor=false;
    if(sol){symbol=SOLFEGE[sol[1].toLowerCase()]+sol[2];minor=!!sol[3];}
    else if(eng){symbol=eng[1].toUpperCase()+eng[2];minor=!!eng[3];}
    else return null;
    const index=noteIndex(symbol);
    return index===null?null:{index,minor,symbol,raw:String(raw||'').trim()};
  }
  function chordInfo(raw){
    const s=String(raw||'').replace(/♯/g,'#').replace(/♭/g,'b');
    const m=s.match(/^([A-G](?:#|b)?)([^\s/]*?)(?:\/([A-G](?:#|b)?))?$/);
    if(!m)return null;
    if(!/^(?:(?:maj|min|sus|dim|aug|add|omit|no|m|M)|[0-9]|[#b()+\-°ºøΔ])*$/i.test(m[2]))return null;
    const root=noteIndex(m[1]),bass=m[3]?noteIndex(m[3]):null;
    if(root===null||(m[3]&&bass===null))return null;
    return {root,suffix:m[2],bass,hasBass:!!m[3]};
  }
  function transposedChord(token,steps){
    const c=chordInfo(token);if(!c)return token;
    const next=idx=>NOTES[((idx+steps)%12+12)%12];
    return next(c.root)+c.suffix+(c.hasBass?'/'+next(c.bass):'');
  }
  function chordLine(line){
    if(!line.trim())return false;
    const tokens=line.trim().split(/[\s|]+/).filter(Boolean);
    if(!tokens.length || !tokens.every(t=>!!chordInfo(t)))return false;
    // Linhas só com 'A' ou 'E' podem ser palavras da letra: exija [A] ou [E].
    if(tokens.length===1){return !['A','E'].includes(tokens[0]) || /^\s{2,}/.test(line);}
    return true;
  }
  function transposeLine(line,steps){
    // Nunca modificar a cifra original nem um único espaço.
    if(!steps)return line;
    // Marcadores inline permanecem imediatamente antes da mesma sílaba.
    if(/\[[A-G][#b]?/.test(line))
      return line.replace(/\[([^\]\n]+)\]/g,(whole,chord)=>
        chordInfo(chord)?'['+transposedChord(chord,steps)+']':whole);
    if(!chordLine(line))return line;
    // No formato textual, a coluna inicial do acorde marca a sílaba exata.
    const matches=[...line.matchAll(/[^\s|]+/g)];
    let output='',endOriginal=0;
    for(let i=0;i<matches.length;i++){
      const match=matches[i],token=match[0],column=match.index;
      const chord=transposedChord(token,steps),following=matches[i+1]?.index??Infinity;
      // Nunca deslocar acordes. Se não houver espaço, bloquear esta transposição.
      if(column<output.length || column+chord.length>following)return null;
      const gap=line.slice(endOriginal,column);
      const bars=[...gap.matchAll(/\|/g)].map(x=>endOriginal+x.index);
      const length=column-output.length;
      if(length<0)return null;
      const chars=Array.from({length},()=> ' ');
      for(const originalColumn of bars){
        const at=originalColumn-output.length;
        if(at<0||at>=chars.length)return null;
        chars[at]='|';
      }
      output+=chars.join('')+chord;
      endOriginal=column+token.length;
    }
    const tail=line.slice(endOriginal);
    const bars=[...tail.matchAll(/\|/g)].map(x=>endOriginal+x.index);
    if(bars.length){
      const len=line.length-output.length;
      if(len<0)return null;
      const chars=Array.from({length:len},()=> ' ');
      for(const column of bars){
        const at=column-output.length;
        if(at<0||at>=chars.length)return null;
        chars[at]='|';
      }
      output+=chars.join('');
    }else output+=tail;
    return output;
  }
  function transpose(text,from,to){
    const orig=keyInfo(from),target=keyInfo(to);
    if(!orig||!target)return null;
    const source=String(text||'');
    const steps=(target.index-orig.index+12)%12;
    if(!steps)return source;
    const rendered=[];
    for(const line of source.split('\n')){
      const changed=transposeLine(line,steps);
      if(changed===null)return null;
      rendered.push(changed);
    }
    return rendered.join('\n');
  }
  function countChords(text){
    const s=String(text||'');let count=0;
    for(const line of s.split('\n')){
      const brackets=[...line.matchAll(/\[([^\]\n]+)\]/g)].filter(x=>chordInfo(x[1]));
      if(brackets.length){count+=brackets.length;continue;}
      if(chordLine(line))count+=line.trim().split(/[\s|]+/).filter(Boolean).length;
    }
    return count;
  }
  // Análise harmônica orientativa. A última resolução e modulações podem mudar a conclusão.
  function suggestKeys(text){
    const found=[];const rows=String(text||'').split('\n');
    for(const line of rows){
      const inline=[...line.matchAll(/\[([^\]\n]+)\]/g)].map(m=>m[1]).filter(chordInfo);
      const tokens=inline.length?inline:(chordLine(line)?line.trim().split(/[\s|]+/).filter(chordInfo):[]);
      for(const tok of tokens){const c=chordInfo(tok);if(c)found.push({index:c.root,minor:/^(m(?!aj)|min)/i.test(c.suffix),raw:tok});}
    }
    if(found.length<3)return {status:'insuficiente',total:found.length,candidates:[],message:'Poucos acordes reconhecidos. Informe o tom manualmente ou cadastre mais trechos da cifra.'};
    const majorIntervals=[0,2,4,5,7,9,11],minorIntervals=[0,2,3,5,7,8,10];
    const options=[];
    for(let root=0;root<12;root++)for(const minor of [false,true]){
      const scale=new Set((minor?minorIntervals:majorIntervals).map(v=>(v+root)%12));
      const tonic=found.filter(c=>c.index===root).length;
      const suitable=found.filter(c=>scale.has(c.index)).length;
      const expectedThird=(root+(minor?3:4))%12;
      const dominant=(root+7)%12;
      let score=0;
      for(let i=0;i<found.length;i++){
        const c=found[i];
        score+=scale.has(c.index)?2:-3;
        if(c.index===root)score+=c.minor===minor?3:0;
        if(c.index===dominant&&!c.minor)score+=1.5;
        if(c.index===expectedThird&&!c.minor)score+=0.5;
        if(i===found.length-1&&c.index===root)score+=3.5;
      }
      options.push({key:NOTES[root]+(minor?'m':''),note:LABELS[root]+(minor?' menor':' maior'),score,fit:Math.round(100*suitable/found.length),tonic});
    }
    options.sort((a,b)=>b.score-a.score);
    const top=options[0], gap=top.score-options[1].score;
    const confidence=(found.length>=6&&top.fit>=80&&gap>=7)?'moderada':'baixa';
    return {status:'sugestao',total:found.length,confidence,candidates:options.slice(0,3),message:`${found.length} acordes identificados. Sugestão ${top.note}, confiança ${confidence}. Confirme cantando/tocando e considere possíveis modulações.`};
  }
  return Object.freeze({NOTES,LABELS,keyInfo,chordInfo,transpose,transposedChord,countChords,suggestKeys});
})();