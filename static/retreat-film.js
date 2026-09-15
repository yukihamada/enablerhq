(() => {
  'use strict';
  const roots = [...document.querySelectorAll('[data-retreat-film]')];
  if (!roots.length) return;
  const media = '/strategy/media/retreat-intro';
  const copy = {
    ja: {
      title: '昼はAI。夜は、いい食卓。',
      lead: '経営者・チームのAI実践合宿に、古今の焼き師がつくる食卓を。',
      body: '仕事のことを考えて、手を動かして、誰かと話す。いつもの場所を離れ、ちゃんと向き合う時間を。BLANKの合宿と、西麻布の焼肉古今の出張BBQを組み合わせる相談プランです。',
      note: '15秒 / 日本語音声・日英字幕。濱田優貴の登録声によるKOE合成ナレーション。実写の開催記録ではなく、絵コンテによる紹介動画です。',
      terms: '研修・宿泊・食事は個別見積もり。会場条件と講師・焼き師の日程を確認してご提案します。',
      enquiry: '合宿のお問い合わせフォームへ ↗', stays: 'StayFlowで宿を探す ↗',
      dinner: '合宿と出張BBQのプランを見る ↗', transcript: '動画の内容をテキストで読む',
      words: 'ちゃんと向き合う、二日間。そんな余白を、つくりたい。昼はAI。夜は、みんなで囲む食卓。BLANK。次の合宿を、一緒に。',
      save: '動画をダウンロード ↓', error: '動画を読み込めませんでした。ダウンロードリンク、または下のテキストをご利用ください。',
      label: 'BLANKと古今の紹介動画（15秒）'
    },
    en: {
      title: 'AI by day. A good table by night.',
      lead: 'An AI retreat for leaders and teams, with a table prepared by KOKON’s grill chef.',
      body: 'Think about your work. Try something. Talk with someone. A change of setting makes room to engage. Explore a proposed combination of a BLANK retreat and offsite BBQ from KOKON in Nishi-Azabu.',
      note: '15 seconds / Japanese audio with Japanese and English subtitles. KOE-generated narration using Yuki Hamada’s registered voice. An illustrated introduction, not documentary footage of a completed retreat.',
      terms: 'Training, accommodation and food are quoted separately. Venue conditions and instructor/chef availability are confirmed in your proposal.',
      enquiry: 'Send a retreat enquiry ↗', stays: 'Find a stay on StayFlow ↗',
      dinner: 'Explore retreats & offsite BBQ ↗', transcript: 'Read the film transcript',
      words: 'Two days to really engage. I want to make room for that. AI by day. A table to gather around by night. BLANK. Let’s plan the next retreat together.',
      save: 'Download the film ↓', error: 'The film could not load. Use the download link or read the transcript below.',
      label: 'BLANK and KOKON introduction (15 seconds)'
    }
  };
  const node = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const instances=roots.map(root=>{
    root.replaceChildren();
    const text=node('div','retreat-film-copy'), view=node('div','retreat-film-view');
    const eyebrow=node('p','retreat-film-eyebrow','BLANK_ × KOKON');
    const title=node('h2'),lead=node('p','retreat-film-lead'),body=node('p'),terms=node('p','retreat-film-note');
    const enquiry=node('a','retreat-film-primary'),stays=node('a'),dinner=node('a');
    stays.href='https://stayflowapp.com/stays';
    const actions=node('div','retreat-film-actions');actions.append(enquiry,stays,dinner);
    text.append(eyebrow,title,lead,body,terms,actions);
    const video=node('video');video.controls=true;video.playsInline=true;video.preload='none';
    video.poster='/strategy/media/retreat-poster.png';video.src=media+'.mp4';
    for(const [lang,label]of [['ja','日本語'],['en','English']]){const track=node('track');track.kind='subtitles';track.srclang=lang;track.label=label;track.src=media+'.'+lang+'.vtt';video.append(track);}
    const note=node('p','retreat-film-note'),error=node('p','retreat-film-error');error.hidden=true;error.setAttribute('role','status');
    const details=node('details'),summary=node('summary'),words=node('p');details.append(summary,words);
    const save=node('a');save.href=media+'.mp4';save.download='blank-kokon-15s.mp4';
    view.append(video,note,error,details,save);root.append(text,view);
    const update=()=>{
      const lang=document.documentElement.lang==='en'?'en':'ja',c=copy[lang];
      for(const [n,key]of [[title,'title'],[lead,'lead'],[body,'body'],[terms,'terms'],[enquiry,'enquiry'],[stays,'stays'],[dinner,'dinner'],[note,'note'],[summary,'transcript'],[words,'words'],[save,'save'],[error,'error']])n.textContent=c[key];
      enquiry.href='https://solun.art/blank/retreat/?lang='+lang+'#consult';
      dinner.href='/strategy/?lang='+lang+'#experiences';video.setAttribute('aria-label',c.label);
      for(const track of video.textTracks)track.mode=track.language===lang?'showing':'disabled';
    };
    video.addEventListener('loadedmetadata',update);
    video.addEventListener('error',()=>{error.hidden=false;});
    video.addEventListener('play',()=>{for(const other of document.querySelectorAll('video,audio'))if(other!==video)other.pause();});
    update();return {update};
  });
  new MutationObserver(()=>instances.forEach(i=>i.update())).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
