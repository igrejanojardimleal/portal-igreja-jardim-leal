/*
 * IGREJA NO JARDIM LEAL — site estático para GitHub Pages.
 * Sem Supabase: mural demonstrativo armazenado somente no navegador.
 * Com Supabase: mural persistente com moderação e login opcional.
 * As mensagens são sempre exibidas com textContent, nunca como HTML.
 */
(() => {
  'use strict';

  const config = window.IGREJA_CONFIG || {};
  const data = window.IGREJA_DATA || { songs: [], history: { timeline: [] } };
  const $ = (id) => document.getElementById(id);
  const songs = Array.isArray(data.songs) ? data.songs : [];
  let songMode = 'letra';
  let category = 'Todos';
  let readingFont = 16;
  let selectedSong = null;
  let dialogMode = 'letra';
  let db = null;
  let user = null;
  let refreshingComments = false;
  let isAdmin = false;
  let isEventManager = false;
  let isMuralModerator = false;
  let isStudyTeacher = false;
  let isStudyReviewer = false;
  let youtubeVideos = [];
  let youtubeShown = 12;
  let youtubeFilter = 'todos';
  let youtubeSearch = '';
  const LOCAL_KEY = 'igreja-no-jardim-leal-mural-demo-v1';
  const media = window.IGREJA_MEDIA || {};
  let cifrasPublicadas = new Map();
  const cifraBucketPrivate = 'cifras-envios';
  const cifraBucketPublic = 'cifras-publicadas';
  const page = document.body.dataset.page || 'home';
  const transposer = window.IGREJA_TRANSPOSE || null;
  const selectedTones = new Map();
  const TONES_KEY = 'igjal-tons-escolhidos-v1';
  try {
    const saved = JSON.parse(localStorage.getItem(TONES_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [num,tone] of Object.entries(saved)) {
        if (/^\d{1,4}$/.test(num) && transposer?.keyInfo(tone)) selectedTones.set(Number(num),tone);
      }
    }
  } catch (_) { /* armazenamento opcional */ }
  function rememberTone(num,tone) {
    selectedTones.set(Number(num),tone);
    try { localStorage.setItem(TONES_KEY,JSON.stringify(Object.fromEntries(selectedTones))); } catch (_) {}
  }
  function chosenTone(song) {
    const raw=selectedTones.get(song?.number);
    return transposer?.keyInfo(raw) ? raw : (song?.key || '');
  }
  function applyToneToDialog() {
    const box=$('transpose-panel');if(!box||!selectedSong)return;
    const available=dialogMode==='cifra' && Boolean(selectedSong.chords?.trim());
    box.hidden=!available;
    if(!available)return;
    const original=transposer?.keyInfo(selectedSong.key);
    const count=transposer?.countChords(selectedSong.chords)||0;
    const selected=transposer?.keyInfo(chosenTone(selectedSong));
    const canTranspose=Boolean(original && count && selected);
    const select=$('transpose-key');
    if(select){
      select.disabled=!canTranspose;
      select.value=canTranspose?transposer.NOTES[selected.index]:'';
    }
    $('transpose-original').textContent='Tom original: '+(original ? transposer.LABELS[original.index]+(original.minor?' menor':'') : 'a confirmar');
    for(const id of ['transpose-down','transpose-up','transpose-reset']) $(id).disabled=!canTranspose;
    setText('transpose-status',canTranspose
      ? 'Acordes alterados em tempo real. A letra, a qualidade dos acordes e o PDF original são preservados.'
      : 'A cifra digital precisa ter tom original válido e acordes reconhecíveis. Informe a equipe da igreja.');
    if(canTranspose) {
      setText('song-dialog-content',transposer.transpose(selectedSong.chords,selectedSong.key,select.value));
      setText('song-dialog-subtitle',`Tom original: ${transposer.LABELS[original.index]} • Tocando em: ${transposer.LABELS[selected.index]} • ${selectedSong.author}`);
    }
  }
  function initTransposition() {
    const select=$('transpose-key');if(!select||!transposer)return;
    for(let i=0;i<12;i++){
      const op=el('option','',`${transposer.LABELS[i]} (${transposer.NOTES[i]})`);
      op.value=transposer.NOTES[i];select.append(op);
    }
    const demo=$('transpose-demo-key');
    if(demo){
      for(let i=0;i<12;i++){const op=el('option','',`${transposer.LABELS[i]} (${transposer.NOTES[i]})`);op.value=transposer.NOTES[i];demo.append(op);}
      const demoText='C       G/B      Am7     F\nDm7     G7       C';
      demo.value='C';
      demo.addEventListener('change',()=>{setText('transpose-demo-content',transposer.transpose(demoText,'C',demo.value));});
    }
    select.addEventListener('change',()=>{
      if(!selectedSong||!transposer.keyInfo(selectedSong.key))return;
      rememberTone(selectedSong.number,select.value);
      renderSongDialog();
    });
    for(const [id,delta] of [['transpose-down',-1],['transpose-up',1]]){
      $(id)?.addEventListener('click',()=>{
        if(!selectedSong)return;
        const current=transposer.keyInfo(chosenTone(selectedSong));if(!current)return;
        const next=transposer.NOTES[(current.index+delta+12)%12];rememberTone(selectedSong.number,next);renderSongDialog();
      });
    }
    $('transpose-reset')?.addEventListener('click',()=>{
      if(!selectedSong)return;
      const key=transposer.keyInfo(selectedSong.key);if(!key)return;
      rememberTone(selectedSong.number,transposer.NOTES[key.index]);renderSongDialog();
    });
  }

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }
  function setText(id, value) {
    if ($(id)) $(id).textContent = value;
  }
  function normalize(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g,' ');
  }
  function setStatus(id, message, isError = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', isError);
  }
  function initials(text) {
    return String(text || '?').trim().slice(0, 1).toLocaleUpperCase('pt-BR');
  }

  function initOfficialLogo() {
    document.querySelectorAll('.brand-icon .igreja-logo').forEach(img=>{
      const reveal=()=>{if(img.naturalWidth>0){img.hidden=false;img.parentElement?.classList.add('has-official-logo');}};
      if(img.complete)reveal();
      else img.addEventListener('load',reveal,{once:true});
    });
  }
  function initBrand() {
    initOfficialLogo();
    const name = String(config.name || 'Nossa Igreja').trim();
    setText('brand-name', name.toLocaleUpperCase('pt-BR'));
    setText('brand-subtitle', String(config.subtitle || 'FÉ • COMUNIDADE • AMOR'));
    setText('footer-church-name', name);
    setText('copyright-name', name);
    setText('current-year', new Date().getFullYear());
    if (config.contact) setText('footer-contact', config.contact);
    if (page === 'home') document.title = `${name} — Início`; 

    const youtube = String(config.youtube || '').trim();
    if (/^https:\/\/www\.youtube\.com\//i.test(youtube)) {
      for (const id of ['youtube-cta', 'footer-youtube']) {
        if ($(id)) $(id).href = youtube;
      }
    }

    const pixKey = String(config.pix?.key || '').trim();
    setText('pix-key', pixKey || 'Chave Pix não informada');
    setText('pix-bank', config.pix?.bank || 'Nubank');
    setText('pix-beneficiary', config.pix?.beneficiary
      ? `Titular informado: ${config.pix.beneficiary} • Banco: ${config.pix?.bank || 'Nubank'}`
      : 'Confira o nome do recebedor no aplicativo do banco antes de confirmar a transferência.');
    if (!$('copy-pix')) return;
    $('copy-pix').disabled = !pixKey;
    $('copy-pix').addEventListener('click', async () => {
      try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(pixKey);
        } else {
          const tmp = document.createElement('textarea');
          tmp.value = pixKey;
          tmp.style.position = 'fixed';
          tmp.style.opacity = '0';
          document.body.appendChild(tmp);
          tmp.select();
          if (!document.execCommand('copy')) throw new Error('Cópia indisponível');
          tmp.remove();
        }
        setStatus('pix-status', 'Chave Pix copiada! Confira o titular no aplicativo do banco.');
        // Métrica anônima aproximada. Só funciona com Supabase configurado.
        try {
          const supa = db;
          if (supa) await supa.rpc('registrar_copia_pix');
        } catch (_) { /* A cópia da chave não depende da métrica. */ }
      } catch (_) {
        setStatus('pix-status', `Não foi possível copiar automaticamente. Selecione a chave acima: ${pixKey}`, true);
      }
    });
  }

  /* O repositório mantém um arquivo local com vídeos e atualiza via GitHub Actions.
     Navegadores não consultam diretamente o RSS do YouTube (restrições de CORS).
     Vídeos sempre levam ao youtube.com, nunca abrem um player de terceiros. */
  function videoDate(raw) {
    const d = new Date(raw);
    return Number.isNaN(d.valueOf()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }
  function videoCategory(video) {
    const name=String(video.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // Canais musicais têm prioridade mesmo quando o vídeo veio da aba histórica de lives.
    if (/\borquestra\b|\borches[t]?ra\b/.test(name)) return 'orquestra';
    if (/\bquarteto\b|\bquartette\b/.test(name)) return 'quarteto';
    if (/\bcoral\b|\bchoir\b/.test(name)) return 'coral';
    const given=String(video.category||'').toLowerCase();
    if (['lives','musicas','outros'].includes(given)) return given;
    if (/ao vivo|transmissao|\blive\b|\bstream\b|vigilia/.test(name)) return 'lives';
    if (/playback|medley|musica|hino|louvor|cantico|canto|adoracao|instrumental|banda|solo/.test(name)) return 'musicas';
    return 'outros';
  }
  function renderYoutube() {
    const grid = $('youtube-videos');
    if (!grid) return;
    grid.replaceChildren();
    const labels={lives:'Live / transmissão',musicas:'Música e louvor',orquestra:'Orquestra',quarteto:'Quarteto',coral:'Coral',outros:'Outros vídeos'};
    const categories={todos:youtubeVideos.length,lives:0,musicas:0,orquestra:0,quarteto:0,coral:0,outros:0};
    youtubeVideos.forEach(video=>{categories[videoCategory(video)]++;});
    for(const kind of Object.keys(categories)){
      setText('count-'+kind,categories[kind] ? '('+categories[kind]+')' : '(0)');
    }
    document.querySelectorAll('[data-youtube-filter]').forEach(button=>{
      const active=button.dataset.youtubeFilter===youtubeFilter;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('is-active',active);
    });
    const term=normalize(youtubeSearch);
    const filtered=youtubeVideos.filter(video=>{
      if(youtubeFilter!=='todos' && videoCategory(video)!==youtubeFilter)return false;
      if(term && !normalize(video.title).includes(term))return false;
      return true;
    });
    setText('youtube-count',youtubeVideos.length ? youtubeVideos.length+' vídeos no catálogo • '+filtered.length+' nesta seleção' : 'Canal oficial da igreja');
    const more=$('youtube-more');
    if(more)more.hidden=filtered.length<=youtubeShown;
    if(!filtered.length){
      const box=el('div','youtube-empty');
      box.append(el('h3','',youtubeVideos.length?'Nenhum vídeo encontrado nesta categoria.':'Os vídeos estarão disponíveis aqui.'),
                 el('p','',youtubeVideos.length?'Experimente outra categoria ou procure por outra palavra.':'A sincronização do canal será feita automaticamente. Você pode assistir diretamente pelo YouTube.'));
      const link=el('a','btn btn-primary','Abrir o canal no YouTube ↗');
      link.href=config.youtube||'https://www.youtube.com/@igrejanojardimlealobradare8130';
      link.target='_blank';link.rel='noopener noreferrer';box.append(link);grid.append(box);
      return;
    }
    for(const video of filtered.slice(0,youtubeShown)){
      const id=String(video.id||'');
      if(!/^[a-zA-Z0-9_-]{11}$/.test(id))continue;
      const card=el('article','youtube-video-card');
      const cover=el('div','youtube-cover');
      const image=el('img');
      image.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
      image.alt='Miniatura do vídeo '+String(video.title||'da igreja');
      image.loading='lazy'; image.decoding='async';
      const play=el('button','youtube-play','▶');
      play.type='button'; play.setAttribute('aria-label','Assistir aqui: '+String(video.title||'Vídeo'));
      play.addEventListener('click',()=>{
        const frame=document.createElement('iframe');
        frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0';
        frame.title='Vídeo da igreja: '+String(video.title||'');
        frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.referrerPolicy='strict-origin-when-cross-origin';
        frame.setAttribute('allowfullscreen','');
        frame.loading='lazy';
        cover.replaceChildren(frame);cover.classList.add('playing');
      });
      cover.append(image,play);
      const body=el('div','youtube-video-body');
      const kind=el('span','youtube-category-tag',labels[videoCategory(video)]);
      const watch=el('a','youtube-link-label','Assistir no YouTube ↗');
      watch.href='https://www.youtube.com/watch?v='+id;
      watch.target='_blank';watch.rel='noopener noreferrer';
      body.append(kind,el('h3','',video.title||'Vídeo da igreja'),el('p','',videoDate(video.published)),watch);
      card.append(cover,body);grid.append(card);
    }
  }
  async function initYoutube() {
    if (!$('youtube-videos')) return;
    document.querySelectorAll('[data-youtube-filter]').forEach(button=>button.addEventListener('click',()=>{
      youtubeFilter=button.dataset.youtubeFilter||'todos';
      youtubeShown=12;
      renderYoutube();
    }));
    const search=$('youtube-search');
    if(search)search.addEventListener('input',()=>{
      youtubeSearch=search.value||'';
      youtubeShown=12;
      renderYoutube();
    });
    const more=$('youtube-more');
    if(more)more.addEventListener('click',()=>{youtubeShown+=12;renderYoutube();});
    const fallback=window.IGREJA_PREVIEW_VIDEOS||{videos:[]};
    youtubeVideos=(Array.isArray(fallback.videos)?fallback.videos:[]).filter(v=>/^[a-zA-Z0-9_-]{11}$/.test(String(v.id||'')));
    renderYoutube(); // Exibe imediatamente os vídeos já armazenados enquanto verifica atualização.
    let body=fallback;
    if(location.protocol!=='file:'){
      try {
        const response=await fetch('assets/videos.json',{cache:'no-store'});
        if(response.ok){
          const fresh=await response.json();
          if(Array.isArray(fresh.videos)&&fresh.videos.length>=(fallback.videos||[]).length)body=fresh;
        }
      } catch(_) { /* Usa os vídeos embutidos no JS quando a rede falhar. */ }
    }
    youtubeVideos=(Array.isArray(body.videos)?body.videos:[])
      .filter(v=>/^[a-zA-Z0-9_-]{11}$/.test(String(v.id||'')))
      .sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));
    setText('youtube-updated',body.updated_at?'Catálogo atualizado: '+videoDate(body.updated_at):'Atualização automática');
    setText('youtube-status',youtubeVideos.length?'Novos vídeos são incluídos automaticamente. Para ver o histórico anterior, usamos também a importação do canal.':'Acesse nosso canal enquanto preparamos o catálogo.');
    renderYoutube();
  }

  function initNavigation() {
    const menu = $('menu-button');
    const mobile = $('mobile-nav');
    if(!menu||!mobile)return;
    const setOpen=(open)=>{
      menu.setAttribute('aria-expanded',String(open));
      menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
      mobile.hidden=!open;
    };
    setOpen(false);
    menu.addEventListener('click',()=>setOpen(mobile.hidden));
    mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
    const path=location.pathname.split('/').pop()||'index.html';
    document.querySelectorAll('.desktop-nav a, .mobile-nav a').forEach(a=>{
      const active=a.getAttribute('href')===path;
      a.classList.toggle('current',active);
      if(active)a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }

  function initHistory() {
    const history = data.history || {};
    if (history.intro) setText('history-intro', history.intro);
    if (history.detail) setText('history-detail', history.detail);
    const timeline = $('history-timeline');
    if (!timeline) return;
    timeline.replaceChildren();
    for (const item of history.timeline || []) {
      const entry = el('div', 'timeline-entry');
      entry.append(el('span', '', item.period || ''), el('h3', '', item.title || ''), el('p', '', item.text || ''));
      timeline.append(entry);
    }
  }

  function initSongs() {
    if (!$('songs-grid')) return;
    const tabs = document.querySelectorAll('[data-mode]');
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      songMode = tab.dataset.mode;
      tabs.forEach((button) => {
        const active = button.dataset.mode === songMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      renderSongs();
    }));
    $('song-search').addEventListener('input', renderSongs);
    renderFilters();
    renderSongs();
    initTransposition();
    // Link compartilhável: louvores.html?hino=28 abre o hino correspondente.
    const direct=new URLSearchParams(location.search).get('hino');
    if (/^\d{1,3}$/.test(direct||'')){
      selectedSong=songs.find(s=>s.number===Number(direct))||null;
      if(selectedSong){dialogMode='letra';renderSongDialog();showDialog('song-dialog');}
    }

    document.querySelectorAll('[data-dialog-mode]').forEach((tab) => {
      tab.addEventListener('click', () => {
        dialogMode = tab.dataset.dialogMode;
        renderSongDialog();
      });
    });
    $('print-song').addEventListener('click', () => {
      if (!selectedSong) return;
      const sheet=$('print-song-sheet');
      if (!sheet) { window.print(); return; }
      const mode=dialogMode==='cifra'?'CIFRA':'LETRA';
      setText('print-song-kind',mode+' • HINO Nº '+selectedSong.number);
      setText('print-song-title',selectedSong.title||'Louvor');
      setText('print-song-author',selectedSong.author?'Autor / referência: '+selectedSong.author:'');
      const transposed=$('song-dialog-content')?.textContent||'';
      setText('print-song-text',transposed);
      $('print-song-text').classList.toggle('is-chords',dialogMode==='cifra');
      const selected=$('transpose-key')?.value||selectedSong.key||'';
      setText('print-song-tone',dialogMode==='cifra'&&selectedSong.key
        ? 'Tom original: '+selectedSong.key+' • Tom selecionado: '+selected
        : '');
      sheet.classList.add('print-ready');
      window.print();
    });
    window.addEventListener('afterprint',()=>{
      $('print-song-sheet')?.classList.remove('print-ready');
    });
    $('text-bigger').addEventListener('click', () => { readingFont = Math.min(readingFont + 2, 30); renderSongDialog(); });
    $('text-smaller').addEventListener('click', () => { readingFont = Math.max(readingFont - 2, 12); renderSongDialog(); });
  }
  function renderFilters() {
    const filters = $('category-filters');
    filters.replaceChildren();
    const options = ['Todos', 'A–F', 'G–M', 'N–S', 'T–Z'];
    for (const option of options) {
      const button = el('button', `filter-chip${category === option ? ' active' : ''}`, option);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === option));
      button.addEventListener('click', () => {
        category = option;
        renderFilters();
        renderSongs();
      });
      filters.append(button);
    }
  }
  function matchesLetterFilter(title) {
    if (category === 'Todos') return true;
    const initial = normalize(title)[0]?.toUpperCase() || '';
    const [a,b] = category.split('–');
    return initial >= a && initial <= b;
  }
  function queryMatches(song, query) {
    if (!query) return true;
    if (/^\d+$/.test(query)) return song.number === Number(query);
    return [song.title, song.lyrics, song.chords, song.author].some(v => normalize(v).includes(query));
  }
  function songExcerpt(song, query) {
    const lines = String(song.lyrics || '').split('\n').map(v => v.trim()).filter(v => v && !/^(I|II|III|IV|V|CORO)$/i.test(v));
    const match = query && !normalize(song.title).includes(query)
      ? lines.find(line => normalize(line).includes(query)) : null;
    const source = match || lines[0] || 'Hino do repertório';
    return (match ? 'Trecho encontrado: ' : '') + source.slice(0, 145) + (source.length > 145 ? '…' : '');
  }
  function renderSongs() {
    const grid = $('songs-grid');
    grid.replaceChildren();
    const query = normalize($('song-search').value);
    const found = songs.filter((song) => matchesLetterFilter(song.title) && queryMatches(song, query) && (songMode !== 'cifra' || Boolean(song.chords?.trim() || cifrasPublicadas.has(song.number))) && (window.IGREJA_V4?.keepSong?.(song) !== false))
      .sort((a,b) => {
        const rank = (s) => (/^\d+$/.test(query) && s.number === Number(query)) ? 0
          : normalize(s.title) === query ? 1
          : normalize(s.title).startsWith(query) ? 2
          : normalize(s.title).includes(query) ? 3 : 4;
        return rank(a)-rank(b) || a.number-b.number;
      });
    const populated = found.filter(s => s.chords?.trim() || cifrasPublicadas.has(s.number)).length;
    setText('song-results', `${found.length} ${found.length === 1 ? 'hino encontrado' : 'hinos encontrados'} • ${songs.length} no hinário${songMode === 'cifra' ? ` • ${populated} com cifra cadastrada neste resultado` : ''}`);
    if (!found.length) {
      const empty = el('div', 'empty-state');
      empty.append(el('strong', '', 'Nenhum hino encontrado.'), el('p', '', 'Busque por uma palavra da letra, o título ou o número (ex.: 28). Você também pode selecionar “Todos”.'));
      grid.append(empty);
      return;
    }
    for (const song of found) {
      const button = el('button', 'song-card');
      button.type = 'button';
      button.setAttribute('aria-label', `${songMode === 'letra' ? 'Abrir letra' : 'Abrir cifra'} do hino ${song.number}, ${song.title}`);
      const head = el('div', 'song-card-head');
      const icon = el('span', 'song-icon', String(song.number).padStart(2,'0'));
      const info = el('div','song-summary');
      info.append(el('h3', 'song-title', song.title), el('p', 'song-category', `Hino ${song.number} • ${song.author || 'Hinário'}`));
      head.append(icon,info);
      const excerpt = el('p', 'song-excerpt', songExcerpt(song, query));
      const footer = el('div', 'song-card-foot');
      footer.append(el('span', 'song-meta', songMode === 'cifra' ? (song.chords?.trim() ? `Tom ${song.key || 'a confirmar'}` : cifrasPublicadas.has(song.number) ? 'PDF da cifra aprovado' : 'Cifra ainda não cadastrada') : 'Letra disponível'));
      const action = el('span', 'song-action', songMode === 'cifra' ? 'Ver cifras ' : 'Ver letra ');
      action.append(el('span', '', '↗'));
      footer.append(action);
      button.append(head, excerpt, footer);
      button.addEventListener('click', () => {
        selectedSong = song;
        dialogMode = songMode;
        renderSongDialog();
        showDialog('song-dialog');
      });
      grid.append(button);
    }
  }
  function renderSongDialog() {
    if (!selectedSong) return;
    setText('song-dialog-title', `${String(selectedSong.number).padStart(2,'0')} — ${selectedSong.title}`);
    setText('song-dialog-eyebrow', dialogMode === 'cifra' ? 'CIFRA DO LOUVOR' : 'LETRA DO LOUVOR');
    setText('song-dialog-subtitle', dialogMode === 'cifra' ? (selectedSong.chords ? `Tom ${selectedSong.key || 'a confirmar'} • ${selectedSong.author}` : (cifrasPublicadas.has(selectedSong.number) ? 'PDF aprovado pela equipe da igreja' : 'Cifra em preparação • envie a cifra para a equipe')) : `Hinário Pedacinho do Céu • ${selectedSong.author}`);
    setText('song-dialog-content', dialogMode === 'cifra' ? selectedSong.chords || (cifrasPublicadas.has(selectedSong.number) ? 'A cifra aprovada está disponível no PDF original abaixo. Para mudar de tom, a equipe precisa cadastrar a cifra digital revisada.' : 'Ainda não recebemos a cifra deste hino.\n\nA letra está disponível na aba “Letra”.\n\nAs cifras serão adicionadas gradualmente pela equipe da igreja.') : selectedSong.lyrics || 'Letra ainda não cadastrada.');
    applyToneToDialog();
    $('song-dialog-content').classList.toggle('is-chords', dialogMode === 'cifra');
    $('song-dialog-content').style.fontSize = `${window.IGREJA_V4?.isCulto?.() ? Math.min(Math.max(readingFont+10,22),42) : readingFont}px`;
    const hino=selectedSong.number;
    const submit=$('song-submit-chord');
    if (submit) submit.href=`enviar-cifra.html?hino=${encodeURIComponent(hino)}`;
    const published=cifrasPublicadas.get(hino);
    const pdfLink=$('song-pdf-link');
    if(pdfLink){
      pdfLink.hidden=!published;
      if(published)pdfLink.href=published;
      else pdfLink.removeAttribute('href');
    }
    const mediaHost=$('song-media-content');
    if(mediaHost){
      mediaHost.replaceChildren();
      const entry=window.IGREJA_V4?.getMedia?.(hino) || media[String(hino)];
      const validId=/^[A-Za-z0-9_-]{11}$/;
      if (entry?.type==='youtube'&&validId.test(String(entry.youtubeId||''))){
        const play=el('button','btn btn-primary','▶ Reproduzir vídeo aqui');
        play.type='button';
        play.addEventListener('click',()=>{
          const frame=document.createElement('iframe');
          frame.src=`https://www.youtube-nocookie.com/embed/${entry.youtubeId}?autoplay=1`;
          frame.title=`Vídeo do hino ${selectedSong.title}`;
          frame.setAttribute('allow','autoplay; encrypted-media; picture-in-picture');
          frame.setAttribute('allowfullscreen','');
          frame.loading='lazy';
          mediaHost.replaceChildren(frame);
        });
        mediaHost.append(play);
      }else if(entry?.type==='audio'&&(/^assets\/audio\/[\w.-]+\.(mp3|ogg|m4a)$/i.test(String(entry.src||'')) || /^https:\/\/[^\s]+\.(mp3|ogg|m4a)(\?[^\s]*)?$/i.test(String(entry.src||'')))){
        const player=el('audio','song-audio');player.controls=true;player.preload='none';player.src=entry.src;
        player.setAttribute('aria-label',`Ouvir ${selectedSong.title}`);
        mediaHost.append(player);
      }else{
        mediaHost.append(el('p','muted','Áudio ou vídeo oficial em breve.'));
      }
    }
    for (const tab of document.querySelectorAll('[data-dialog-mode]')) {
      const active = tab.dataset.dialogMode === dialogMode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    }
    window.IGREJA_V4?.onSongRendered?.(selectedSong);
    window.IGREJA_COMUNIDADE?.songChanged?.(selectedSong);
  }

  function showDialog(id) {
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
  }
  function initDialogs() {
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
    });
    $('login-button').addEventListener('click', () => showDialog('login-dialog'));
    if ($('song-donate-link')) $('song-donate-link').addEventListener('click',()=> $('song-dialog').close());
  }

  /* O modo offline guarda somente RASCUNHOS PENDENTES neste navegador.
     Não há simulação de administrador: permissões reais exigem o Supabase + RLS. */
  function readLocalComments() {
    try {
      const result = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(result) ? result : [];
    } catch (_) { return []; }
  }
  function writeLocalComments(comments) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(comments.slice(0, 50))); return true; }
    catch (_) { return false; }
  }
  function formatDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Agora';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  function memberDisplayName() {
    return window.IGREJA_MEMBROS?.displayName?.(user) || '';
  }
  function makeReplyForm(parentId) {
    const wrap=el('form','reply-form');
    const title=el('strong','', 'Responder à mensagem');
    const author=el('p','muted','A resposta aparecerá com o nome cadastrado em Minha conta.');
    const messageLabel=el('label','', 'Sua resposta');
    const message=el('textarea');message.required=true;message.minLength=3;message.maxLength=600;message.placeholder='Escreva sua resposta...';
    const actions=el('div','reply-actions');
    const send=el('button','btn btn-primary','Enviar para análise');send.type='submit';
    const cancel=el('button','btn btn-outline','Cancelar');cancel.type='button';cancel.addEventListener('click',()=>wrap.remove());
    actions.append(send,cancel);
    const status=el('p','reply-status');status.setAttribute('role','status');
    wrap.append(title,author,messageLabel,message,actions,status);
    wrap.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!db||!user){status.textContent='Entre na sua conta antes de responder.';return;}
      const n=memberDisplayName(),m=message.value.trim();
      if(!n){status.textContent='Complete seu nome e sobrenome em Minha conta antes de responder.';return;}
      if(m.length<3||m.length>600){status.textContent='Escreva uma resposta entre 3 e 600 caracteres.';return;}
      send.disabled=true;
      try{
        const {error}=await db.from('comentarios').insert({nome:n,mensagem:m,parent_id:parentId,user_id:user.id});
        if(error)throw error;
        status.textContent='Resposta enviada! Será exibida somente após aprovação.';
        message.value='';
      }catch(err){status.textContent='Não foi possível enviar a resposta. Tente novamente.';}
      finally{send.disabled=false;}
    });
    return wrap;
  }
  function buildComment(comment, replies) {
    const card = el('article', 'comment-item');
    const head=el('div','comment-head');
    const person=el('div','comment-person');
    const avatar=el('span','comment-avatar',initials(comment.nome)); avatar.setAttribute('aria-hidden','true');
    const info=el('div'); info.append(el('strong','',comment.nome),el('small','',formatDate(comment.criado_em)));
    person.append(avatar,info); head.append(person);
    card.append(head,el('p','comment-message',comment.mensagem));
    if(replies.length){
      const sub=el('div','comment-replies');
      for(const reply of replies){
        const item=el('div','comment-reply');
        const h=el('div','comment-person');
        const avatar2=el('span','comment-avatar',initials(reply.nome)); avatar2.setAttribute('aria-hidden','true');
        const who=el('div'); who.append(el('strong','',reply.nome),el('small','',formatDate(reply.criado_em)));
        h.append(avatar2,who);item.append(h,el('p','comment-message',reply.mensagem));sub.append(item);
      }
      card.append(sub);
    }
    const replyBtn=el('button','reply-button','↳ Responder'); replyBtn.type='button';
    replyBtn.addEventListener('click',()=>{
      if(!user){setStatus('comment-mode','Entre ou crie sua conta para responder.');showDialog('login-dialog');return;}
      const existing=card.querySelector('.reply-form');
      if(existing){existing.remove();return;}
      const form=makeReplyForm(comment.id);card.append(form);form.querySelector('textarea').focus();
    });
    card.append(replyBtn);
    return card;
  }
  function renderComments(comments) {
    const list = $('comments-list'); if(!list)return; list.replaceChildren();
    const approved=comments.filter(row=>row.status==='aprovado');
    const roots=approved.filter(row=>!row.parent_id);
    setText('comment-count', `${approved.length} ${approved.length===1?'mensagem':'mensagens'}`);
    if (!roots.length) {
      const empty=el('div','comment-empty');
      empty.append(el('span','','♡'),el('strong','','O mural está esperando você.'),el('p','','Deixe uma mensagem: ela aparecerá após a aprovação da igreja.'));
      list.append(empty);return;
    }
    for (const comment of roots){
      list.append(buildComment(comment,approved.filter(reply=>reply.parent_id===comment.id)));
    }
  }

  let faithMessageRows=[],faithLastId=null,faithTimer=null,faithQueue=[],faithKey='';
  function showNextFaithMessage(){
    const host=$('home-faith-message');
    if(!host||!faithMessageRows.length)return;
    if(!faithQueue.length){
      faithQueue=[...faithMessageRows];
      for(let i=faithQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[faithQueue[i],faithQueue[j]]=[faithQueue[j],faithQueue[i]];}
      if(faithQueue.length>1 && faithQueue[0].id===faithLastId){[faithQueue[0],faithQueue[1]]=[faithQueue[1],faithQueue[0]];}
    }
    const chosen=faithQueue.shift();
    $('home-faith-text').textContent='“'+chosen.mensagem+'”';
    $('home-faith-author').textContent=chosen.nome ? '— '+chosen.nome : '— Comunidade';
    host.hidden=false;
    faithLastId=chosen.id;
    try{sessionStorage.setItem('igjal-ultima-palavra',String(chosen.id));}catch(_){}
  }
  function updateFaithMessages(rows){
    const host=$('home-faith-message');if(!host)return;
    const valid=(rows||[]).filter(x=>!x.parent_id && x.status==='aprovado' && typeof x.mensagem==='string' && x.mensagem.trim());
    const key=valid.map(x=>x.id).join(',');
    if(key===faithKey && faithTimer)return;
    faithKey=key;faithMessageRows=valid;faithQueue=[];
    if(faithTimer){clearInterval(faithTimer);faithTimer=null;}
    if(!valid.length){host.hidden=true;return;}
    try{faithLastId=Number(sessionStorage.getItem('igjal-ultima-palavra'))||null;}catch(_){faithLastId=null;}
    showNextFaithMessage();
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && valid.length>1){
      faithTimer=window.setInterval(()=>{if(!document.hidden)showNextFaithMessage();},14000);
    }
  }
  async function loadComments() {
    if(!$('comments-list') && !$('home-faith-message'))return;
    if (!db) { if($('comments-list'))renderComments([]); return; }
    if (refreshingComments) return;
    refreshingComments=true;
    try {
      const { data: rows, error }=await db.from('comentarios')
        .select('id,nome,mensagem,criado_em,parent_id,status')
        .eq('status','aprovado').order('criado_em',{ascending:false}).limit(250);
      if(error)throw error;
      renderComments(rows||[]);
      updateFaithMessages(rows||[]);
      setText('comment-mode','Compartilhe mensagens, testemunhos e palavras de carinho com a comunidade.');
    } catch(err){
      setText('comment-mode','Não foi possível carregar o mural. Confira a conexão e as regras de acesso.');
      console.warn('Falha no mural:',err.message);
    } finally {refreshingComments=false;}
  }
  function initComments() {
    if(!$('comment-form'))return;
    $('mural-open-login')?.addEventListener('click',()=>showDialog('login-dialog'));
    renderComments([]);
    $('comment-message').addEventListener('input',()=>setText('comment-counter',$('comment-message').value.length));
    $('comment-form').addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(!db||!user){setStatus('comment-status','Entre ou crie sua conta para publicar uma mensagem no mural.',true);return;}
      const name=memberDisplayName();
      const message=$('comment-message').value.trim();
      if(!name){setStatus('comment-status','Complete nome e sobrenome em Minha conta antes de publicar.',true);return;}
      if(message.length<3||message.length>600){setStatus('comment-status','Escreva uma mensagem entre 3 e 600 caracteres.',true);return;}
      const button=$('send-comment');button.disabled=true;setStatus('comment-status','Enviando para análise...');
      try{
        const payload={nome:name,mensagem:message,user_id:user.id};
        const {error}=await db.from('comentarios').insert(payload);
        if(error)throw error;
        setStatus('comment-status','Mensagem recebida! A publicação depende da aprovação dos moderadores.');
        $('comment-message').value='';setText('comment-counter',0);
      }catch(err){console.warn('Falha ao enviar:',err.message);setStatus('comment-status','Não foi possível enviar. Verifique sua conexão e tente novamente.',true);}
      finally{button.disabled=false;}
    });
  }
  function refreshAdminLinks() {
    // O link da administração fica exclusivamente em Minha Conta, sob autorização do servidor.
    document.querySelectorAll('[data-administracao-link]').forEach(link=>link.remove());
    window.IGREJA_MEMBROS?.refresh?.();
    window.IGREJA_ACESSOS?.show?.();
    window.IGREJA_COMUNIDADE?.onAuthChange?.();
    window.IGREJA_ESTUDOS?.onAuthChange?.();
  }
  async function updateAdminAccess() {
    isAdmin=false;
    isEventManager=false;
    isMuralModerator=false;
    isStudyTeacher=false;
    isStudyReviewer=false;
    $('open-moderation').hidden=true;
    if(!db||!user){
      window.IGREJA_V4?.onAuthChange?.();
      window.IGREJA_CELEBRACOES?.onAuthChange?.();
      updateAdminPanelAccess();
      refreshAdminLinks();
      if($('moderation-list'))$('moderation-list').replaceChildren();
      if($('cifra-admin-list'))$('cifra-admin-list').replaceChildren();
      return;
    }
    try{
      const [adminResult,eventResult,muralResult,studyResult,reviewResult]=await Promise.all([db.rpc('is_site_admin'),db.rpc('can_manage_events'),db.rpc('can_moderate_mural'),db.rpc('can_submit_studies'),db.rpc('can_review_studies')]);
      if(adminResult.error)throw adminResult.error;
      isAdmin=adminResult.data===true;
      isEventManager=isAdmin || (!eventResult.error && eventResult.data===true);
      isMuralModerator=isAdmin || (!muralResult.error && muralResult.data===true);
      isStudyTeacher=isAdmin || (!studyResult.error && studyResult.data===true);
      isStudyReviewer=isAdmin || (!reviewResult.error && reviewResult.data===true);
      window.IGREJA_V4?.onAuthChange?.();
      window.IGREJA_CELEBRACOES?.onAuthChange?.();
      $('open-moderation').hidden=true;
      if($('open-moderation'))$('open-moderation').textContent=isAdmin?'🛡️ Administração geral':isEventManager?'📅 Gerenciar eventos':'💬 Moderar mural';
      updateAdminPanelAccess();
      refreshAdminLinks();
    }catch(err){console.warn('Não foi possível conferir acesso da moderação:',err.message);}
  }
  async function loadModeration() {
    if(!db||!user||!isMuralModerator||!$('moderation-list'))return;
    const list=$('moderation-list');list.replaceChildren();
    setStatus('moderation-status','Carregando mensagens pendentes...');
    try {
      const {data:rows,error}=await db.from('comentarios')
        .select('id,nome,mensagem,criado_em,parent_id,status').eq('status','pendente')
        .order('criado_em',{ascending:true}).limit(200);
      if(error)throw error;
      const parentIds=[...new Set(rows.filter(v=>v.parent_id).map(v=>v.parent_id))];
      const parentMap=new Map();
      if(parentIds.length){
        const {data:parents,error:parentError}=await db.from('comentarios').select('id,nome,mensagem').in('id',parentIds);
        if(parentError)throw parentError;
        for(const parent of parents||[])parentMap.set(parent.id,parent);
      }
      setText('moderation-total',`${rows.length} ${rows.length===1?'mensagem pendente':'mensagens pendentes'}`);
      setStatus('moderation-status', rows.length?'Analise o conteúdo antes de escolher uma ação.':'Nenhuma mensagem aguardando análise.');
      for(const item of rows){
        const box=el('article','moderation-item');
        box.append(el('h3','',`${item.parent_id?'↳ Resposta':'Comentário'} de ${item.nome}`), el('small','',formatDate(item.criado_em)),el('p','',item.mensagem));
        if(item.parent_id){
          const p=parentMap.get(item.parent_id);
          box.append(el('small','',p ? `Em resposta a ${p.nome}: ${p.mensagem.slice(0,120)}${p.mensagem.length>120?'…':''}` : `Resposta ao comentário nº ${item.parent_id}`));
        }
        const acts=el('div','moderation-actions');
        const approve=el('button','btn btn-primary','Aprovar e publicar');approve.type='button';
        const reject=el('button','btn moderation-reject','Rejeitar');reject.type='button';
        const decide=async (status)=>{
          approve.disabled=reject.disabled=true;
          try{
            const {error:err}=await db.from('comentarios').update({status}).eq('id',item.id);
            if(err)throw err;
            box.remove();
            setStatus('moderation-status',status==='aprovado'?'Mensagem aprovada.':'Mensagem rejeitada.');
            await Promise.all([loadComments(),loadModeration()]);
          }catch(err){setStatus('moderation-status','Não foi possível moderar: verifique as permissões.',true);approve.disabled=reject.disabled=false;}
        };
        approve.addEventListener('click',()=>decide('aprovado'));
        reject.addEventListener('click',()=>decide('rejeitado'));
        acts.append(approve,reject);box.append(acts);list.append(box);
      }
    }catch(err){setStatus('moderation-status','Falha ao carregar a fila. Acesse com uma conta administradora.',true);}
  }
  function initModeration() {
    const open=$('open-moderation');
    if(open)open.addEventListener('click',()=>{if(isAdmin||isEventManager||isMuralModerator)location.href='administracao.html';});
    $('reload-moderation')?.addEventListener('click',loadModeration);
    $('reload-cifras')?.addEventListener('click',loadCifraModeration);
    $('admin-login-action')?.addEventListener('click',()=>showDialog('login-dialog'));
  }

  function updateAdminPanelAccess() {
    if(!$('admin-locked'))return;
    $('admin-locked').hidden=Boolean(isAdmin||isEventManager||isMuralModerator||isStudyReviewer);
    $('admin-content').hidden=!(isAdmin||isEventManager||isMuralModerator||isStudyReviewer);
    if(isMuralModerator)loadModeration();
    if(isAdmin)loadCifraModeration();
  }

  function updateAuthUI() {
    $('logged-in-panel').hidden = !user;
    $('logged-out-panel').hidden = Boolean(user);
    setText('login-button-text', user ? 'Minha conta' : 'Entrar');
    if (user) {
      setText('logged-in-user', `Conectado como ${memberDisplayName() || user.email || 'membro da igreja'}. Você pode participar do mural, enviar cifras e comentar nos hinos.`);
    }
    const send=$('send-comment');if(send)send.disabled=!user;
    if($('mural-member-notice'))$('mural-member-notice').hidden=Boolean(user);
    window.IGREJA_MEMBROS?.refresh?.();
    window.IGREJA_COMUNIDADE?.onAuthChange?.();
    window.IGREJA_ESTUDOS?.onAuthChange?.();
  }
  async function initBackend() {
    const url = String(config.supabase?.url || '').trim();
    const anonKey = String(config.supabase?.anonKey || '').trim();
    if (!url || !anonKey) {
      $('google-login').disabled = true;
      $('email-login-form').querySelector('button').disabled = true;
      setText('login-mode-note', 'O login será habilitado quando a igreja conectar o site ao banco de dados. Por enquanto, você pode testar o mural sem cadastro.');
      return;
    }
    if (!window.supabase?.createClient) {
      setText('login-mode-note', 'Não foi possível carregar o serviço de login. Verifique sua conexão com a internet.');
      setText('comment-mode', 'Serviço de comentários indisponível. A versão local está funcionando apenas neste navegador.');
      return;
    }
    try {
      db = window.supabase.createClient(url, anonKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      });
      setText('login-mode-note', 'Para comentar no mural ou nos hinos, entre ou crie sua conta com e-mail confirmado.');
      const { data: sessionData } = await db.auth.getSession();
      user = sessionData.session?.user || null;
      updateAuthUI();
      await updateAdminAccess();
      db.auth.onAuthStateChange((_event, session) => {
        user = session?.user || null;
        updateAuthUI();
        // Atualização fora do callback de autenticação para evitar reentrância.
        window.setTimeout(updateAdminAccess, 0);
      });
      await loadComments();
      await loadPublishedCifras();
      updateAdminPanelAccess();
      // Mantém o mural atualizado enquanto a aba estiver visível.
      window.setInterval(() => { if (!document.hidden) loadComments(); }, 45000);
    } catch (error) {
      console.warn('Erro ao inicializar Supabase:', error.message);
      db = null;
      setText('login-mode-note', 'Conexão não configurada corretamente. Confira as informações do Supabase.');
    }
  }
  function initLogin() {
    updateAuthUI();
    $('google-login').addEventListener('click', async () => {
      if (!db) return;
      setStatus('login-status', 'Conectando ao Google...');
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) setStatus('login-status', `Não foi possível entrar com Google: ${error.message}`, true);
    });
    $('email-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!db) return;
      const email = $('login-email').value.trim();
      if (!$('login-email').checkValidity()) {
        setStatus('login-status', 'Informe um e-mail válido.', true);
        return;
      }
      setStatus('login-status', 'Enviando link...');
      const { error } = await db.auth.signInWithOtp({
        email, options: { emailRedirectTo: new URL('index.html',location.href).href }
      });
      if (error) setStatus('login-status', `Não foi possível enviar o link: ${error.message}`, true);
      else setStatus('login-status', 'Confira seu e-mail para acessar sua conta.');
    });
    $('logout-button').addEventListener('click', async () => {
      if (!db) return;
      const { error } = await db.auth.signOut();
      if (error) setStatus('login-status', `Não foi possível sair: ${error.message}`, true);
    });
  }

  // Cifras oficiais publicadas: somente as aprovadas constam nesta tabela pública.
  async function loadPublishedCifras() {
    if(!db)return;
    try{
      const {data:rows,error}=await db.from('cifras_publicadas').select('hino_numero,storage_path');
      if(error)throw error;
      cifrasPublicadas=new Map();
      for(const row of rows||[]){
        if(!Number.isInteger(row.hino_numero)||!/^hino-\d+-[a-zA-Z0-9_-]+\.pdf$/.test(row.storage_path))continue;
        const {data:published}=db.storage.from(cifraBucketPublic).getPublicUrl(row.storage_path);
        if(published?.publicUrl)cifrasPublicadas.set(row.hino_numero,published.publicUrl);
      }
      if($('songs-grid'))renderSongs();
      if(selectedSong&&$('song-dialog')?.open)renderSongDialog();
    }catch(error){console.warn('Não foi possível consultar cifras oficiais:',error.message);}
  }

  // Validação de PDF no cliente é conveniência: produção exige verificação no servidor.
  async function validPdf(file) {
    if(!file||!file.name.toLowerCase().endsWith('.pdf'))return false;
    if(file.size<16||file.size>5*1024*1024)return false;
    const magic=new Uint8Array(await file.slice(0,5).arrayBuffer());
    return String.fromCharCode(...magic)==='%PDF-';
  }
  function initCifraSubmission() {
    const form=$('cifra-form');if(!form)return;
    const sel=$('cifra-hino');
    for(const song of songs){
      const opt=document.createElement('option');
      opt.value=String(song.number);
      opt.textContent=`${String(song.number).padStart(2,'0')} — ${song.title}`;
      sel.append(opt);
    }
    const p=new URLSearchParams(location.search).get('hino');
    if(/^\d{1,3}$/.test(p||'')&&songs.some(s=>s.number===Number(p)))sel.value=p;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const file=$('cifra-arquivo').files[0];
      const n=$('cifra-nome').value.trim().replace(/\s+/g,' ');
      const num=Number(sel.value);
      const tom=$('cifra-tom').value.trim();
      const obs=$('cifra-obs').value.trim();
      if(!songs.some(s=>s.number===num)){setStatus('cifra-status','Escolha um hino do hinário.',true);return;}
      if(n.length<2||n.length>60||tom.length>20||obs.length>400){setStatus('cifra-status','Revise nome e observações.',true);return;}
      if(!$('cifra-consent').checked){setStatus('cifra-status','Confirme a autorização para compartilhar a cifra.',true);return;}
      if(!(await validPdf(file))){setStatus('cifra-status','Selecione um PDF válido, com até 5 MB.',true);return;}
      if(!db){setStatus('cifra-status','Envio de demonstração: a igreja ainda não conectou o armazenamento privado. Nenhum arquivo foi enviado.',true);return;}
      if(!user){setStatus('cifra-status','Para enviar PDF, entre em sua conta no botão “Entrar” e tente novamente.',true);return;}
      const button=$('cifra-enviar');button.disabled=true;
      setStatus('cifra-status','Enviando arquivo para análise...');
      const fileName=`${user.id}/${crypto.randomUUID()}.pdf`;
      let uploaded=false;
      try{
        const up=await db.storage.from(cifraBucketPrivate).upload(fileName,file,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
        if(up.error)throw up.error;
        uploaded=true;
        const {error}=await db.from('cifra_envios').insert({hino_numero:num,nome:n,tom:tom||null,observacoes:obs||null,storage_path:fileName});
        if(error)throw error;
        setStatus('cifra-status','PDF recebido! A cifra está pendente de análise e não aparece no site público.');
        form.reset();
      }catch(error){
        if(uploaded)await db.storage.from(cifraBucketPrivate).remove([fileName]);
        console.warn('Falha no envio de cifra:',error.message);
        setStatus('cifra-status','Não foi possível enviar o PDF. Verifique login, conexão e permissões.',true);
      }finally{button.disabled=false;}
    });
  }
  // Somente administradores: analisar PDF privado antes de publicá-lo no bucket público.
  async function loadCifraModeration() {
    if(!db||!isAdmin||!user||!$('cifra-admin-list'))return;
    const list=$('cifra-admin-list');list.replaceChildren();
    setStatus('cifra-admin-status','Carregando cifras pendentes...');
    try{
      const {data:rows,error}=await db.from('cifra_envios')
        .select('id,hino_numero,nome,tom,observacoes,storage_path,status,criado_em')
        .eq('status','pendente').order('criado_em',{ascending:true}).limit(150);
      if(error)throw error;
      setText('cifra-admin-total',`${rows.length} ${rows.length===1?'cifra pendente':'cifras pendentes'}`);
      setStatus('cifra-admin-status',rows.length?'Confira o conteúdo do PDF antes de aprovar.':'Nenhuma cifra aguardando análise.');
      for(const row of rows){
        const sng=songs.find(s=>s.number===row.hino_numero);
        const card=el('article','moderation-item');
        card.append(el('h3','',`Hino ${row.hino_numero}: ${sng?.title||'Não encontrado'}`),el('small','',`${row.nome} • ${formatDate(row.criado_em)}`));
        if(row.tom)card.append(el('p','','Tom informado: '+row.tom));
        if(row.observacoes)card.append(el('p','',row.observacoes));
        const actions=el('div','moderation-actions');
        const view=el('button','btn btn-outline','Abrir PDF para conferir');view.type='button';
        view.addEventListener('click',async()=>{
          // Abrir uma aba como consequência do clique evita bloqueio de pop-up após o await.
          const popup=window.open('about:blank','_blank');
          if(popup)popup.opener=null;
          const {data,error}=await db.storage.from(cifraBucketPrivate).createSignedUrl(row.storage_path,120);
          if(error||!data?.signedUrl){
            if(popup)popup.close();
            setStatus('cifra-admin-status','Não foi possível abrir o PDF privado.',true);
            return;
          }
          if(popup)popup.location.replace(data.signedUrl);
          else{
            const link=el('a','','Abrir PDF privado (link temporário)');
            link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';
            card.append(link);
          }
        });
        const approve=el('button','btn btn-primary','Aprovar e publicar');approve.type='button';
        const reject=el('button','btn moderation-reject','Rejeitar');reject.type='button';
        const decision=async (accept)=>{
          if(accept&&!window.confirm('Você conferiu o PDF, a autoria e autoriza sua publicação pública neste hino?'))return;
          view.disabled=approve.disabled=reject.disabled=true;
          try{
            if(accept){
              const {data:download,error:downErr}=await db.storage.from(cifraBucketPrivate).download(row.storage_path);
              if(downErr||!download)throw downErr||new Error('Falha download');
              if(!(await validPdf(new File([download], 'cifra.pdf',{type:'application/pdf'}))))throw new Error('PDF inválido');
              const path=`hino-${row.hino_numero}-${row.id}.pdf`;
              const {error:upErr}=await db.storage.from(cifraBucketPublic).upload(path,download,{contentType:'application/pdf',upsert:false});
              if(upErr)throw upErr;
              const {error:pubErr}=await db.from('cifras_publicadas').upsert({hino_numero:row.hino_numero,storage_path:path,origem_envio:row.id},{onConflict:'hino_numero'});
              if(pubErr)throw pubErr;
            }
            const {error:statusErr}=await db.from('cifra_envios').update({status:accept?'aprovado':'rejeitado'}).eq('id',row.id);
            if(statusErr)throw statusErr;
            card.remove();
            setStatus('cifra-admin-status',accept?'Cifra aprovada e publicada no hino.':'Cifra rejeitada; permanece privada.');
            await Promise.all([loadCifraModeration(),loadPublishedCifras()]);
          }catch(error){
            console.warn('Falha revisão PDF:',error.message);
            setStatus('cifra-admin-status','Não foi possível concluir. Confira permissões e conexão.',true);
          }finally{view.disabled=approve.disabled=reject.disabled=false;}
        };
        approve.addEventListener('click',()=>decision(true));
        reject.addEventListener('click',()=>decision(false));
        actions.append(view,approve,reject);card.append(actions);list.append(card);
      }
    }catch(error){setStatus('cifra-admin-status','Falha ao carregar cifras pendentes. Verifique acesso de administrador.',true);}
  }

  async function start() {
    initBrand();
    initYoutube();
    initNavigation();
    initHistory();
    initSongs();
    initDialogs();
    initComments();
    initLogin();
    window.IGREJA_MEMBROS?.init?.({db:()=>db,user:()=>user,isAdmin:()=>isAdmin,isEventManager:()=>isEventManager,isMuralModerator:()=>isMuralModerator,isStudyTeacher:()=>isStudyTeacher,isStudyReviewer:()=>isStudyReviewer});
    initModeration();
    initCifraSubmission();
    await initBackend();
    window.IGREJA_COMUNIDADE?.init?.({db:()=>db,user:()=>user,canModerate:()=>isAdmin||isMuralModerator,selectedSong:()=>selectedSong});
    window.IGREJA_ACESSOS?.init?.({db:()=>db,isAdmin:()=>isAdmin});
    if (window.IGREJA_V4?.init) await window.IGREJA_V4.init({
      db:()=>db,
      isAdmin:()=>isAdmin,
      isEventsAdmin:()=>isEventManager,
      isMuralModerator:()=>isMuralModerator,
      isStudyReviewer:()=>isStudyReviewer,
      songs,
      getSelectedSong:()=>selectedSong,
      refreshSongs:()=>{if($('songs-grid'))renderSongs();},
      refreshDialog:()=>{if(selectedSong && $('song-dialog'))renderSongDialog();},
      openSong:(song,mode='letra')=>{selectedSong=song;dialogMode=mode;renderSongDialog();showDialog('song-dialog');},
      loadModeration,
      loadCifras:loadCifraModeration
    });
    if (window.IGREJA_CELEBRACOES?.init) await window.IGREJA_CELEBRACOES.init({db:()=>db,isAdmin:()=>isAdmin,isEventsAdmin:()=>isEventManager});
    if (window.IGREJA_ESTUDOS?.init) await window.IGREJA_ESTUDOS.init({db:()=>db,isAdmin:()=>isAdmin,isStudyTeacher:()=>isStudyTeacher,isStudyReviewer:()=>isStudyReviewer,user:()=>user});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();