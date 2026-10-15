(function(){
  'use strict';
  const K='vinhan7_player_v2', Q='vinhan7_events_v2';
  const config=window.MINI_GAME_STATS_CONFIG||{};
  const endpoint=String(config.endpoint||'').trim();
  const configured=/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(endpoint);
  const subject=String(document.documentElement.dataset.subject||'');
  let active=null, sending=false;
  function read(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch(_){return d}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
  function clean(s,n){return String(s||'').trim().replace(/\s+/g,' ').slice(0,n)}
  function person(){let x=read(K,null);return x&&typeof x==='object'&&clean(x.name,45).length>=2?x:null}
  function getId(){try{return crypto.randomUUID()}catch(_){return 'run-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
  function enqueue(event){
    let all=read(Q,[]);if(!Array.isArray(all))all=[];
    if(all.some(x=>x.eventId===event.eventId))return;
    all.push(event);save(Q,all.slice(-150));flush();
  }
  async function flush(){
    if(!configured||sending||!navigator.onLine)return;
    sending=true;let progressed=false;
    try{
      let events=read(Q,[]);if(!Array.isArray(events))events=[];
      let sent=0;
      for(const e of events.slice(0,30)){
        try{
          // Apps Script khác tên miền: no-cors chỉ xác nhận yêu cầu được gửi,
          // không xác nhận Google Sheets đã ghi thành công.
          await fetch(endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(e),keepalive:true,cache:'no-store'});
          sent++;
        }catch(_){break}
      }
      if(sent){let rest=read(Q,[]);save(Q,rest.slice(sent));progressed=true;}
    }finally{sending=false}
    if(progressed && configured && navigator.onLine && read(Q,[]).length) setTimeout(flush,250);
  }
  function allow(){
    if(person())return;
    const outer=document.createElement('div');outer.id='playstats-gate';
    outer.innerHTML=`<div class="playstats-panel" role="dialog" aria-modal="true" aria-labelledby="playstats-title">
      <h2 id="playstats-title">Tên người chơi</h2>
      <p>Nhập tên để ghi nhận lượt chơi và kết quả học tập.</p>
      <form id="playstats-form">
        <label for="playstats-name">Tên hiển thị</label>
        <input id="playstats-name" maxlength="45" minlength="2" autocomplete="off" required placeholder="Ví dụ: Minh Anh" />
        <label for="playstats-class">Lớp (không bắt buộc)</label>
        <input id="playstats-class" maxlength="20" autocomplete="off" placeholder="Ví dụ: 7A1" />
        <p class="playstats-privacy">Tên và kết quả sẽ được gửi cho người quản lý lớp khi hệ thống thống kê đã kết nối. Không nhập số điện thoại, địa chỉ hoặc thông tin nhạy cảm.</p>
        <button type="submit">Bắt đầu học</button>
      </form></div>`;
    document.body.appendChild(outer);
    const form=outer.querySelector('form'),name=outer.querySelector('#playstats-name');
    form.addEventListener('submit',ev=>{
      ev.preventDefault();const n=clean(name.value,45),cl=clean(outer.querySelector('#playstats-class').value,20);
      if(n.length<2){name.setCustomValidity('Nhập tên có ít nhất 2 ký tự');name.reportValidity();return}
      name.setCustomValidity('');save(K,{name:n,group:cl});outer.remove();updateBadge();flush();
    });
    name.addEventListener('input',()=>name.setCustomValidity(''));
    setTimeout(()=>name.focus(),40);
  }
  function updateBadge(){
    const el=document.getElementById('player-label');if(!el)return;
    const p=person();el.textContent=p?'Người chơi: '+p.name+(p.group?' · '+p.group:''):'';
  }
  function begin(mode){
    const p=person();
    if(!p){allow();return false}
    active={id:getId(),subject,mode:clean(mode,70),name:clean(p.name,45),group:clean(p.group,20),started:Date.now()};
    enqueue({action:'start',eventId:getId(),sessionId:active.id,name:active.name,group:active.group,subject:active.subject,mode:active.mode,schoolYear:config.schoolYear||'',term:config.term||''});
    return true;
  }
  function finish(data){
    if(!active)return;
    const r=active;active=null;
    let raw=data||{};let score=Number(raw.score),correct=Number(raw.correct),total=Number(raw.total),maxScore=Number(raw.maxScore),pct=Number(raw.percent);
    if(!Number.isFinite(score))score=0;if(!Number.isFinite(correct))correct=0;if(!Number.isFinite(total))total=0;
    let graded=raw.graded!==false && total>0;
    // Cho phép % theo thang điểm riêng (Sử–Địa) hoặc số câu đúng (hai môn còn lại).
    let percent= graded ? (Number.isFinite(pct)?pct:Math.round(100*correct/Math.max(1,total))) : null;
    enqueue({action:'finish',eventId:getId(),sessionId:r.id,name:r.name,group:r.group,subject:r.subject,mode:r.mode,
      score,correct,total,maxScore:Number.isFinite(maxScore)?maxScore:null,percent,graded,
      seconds:Math.max(0,Math.floor((Date.now()-r.started)/1000)),note:clean(raw.note,120),schoolYear:config.schoolYear||'',term:config.term||''});
  }
  window.PlayStats={begin,finish,person,configured,showGate:allow,flush};
  window.addEventListener('online',flush);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush()});
  document.addEventListener('DOMContentLoaded',()=>{allow();updateBadge();flush();
    const change=document.getElementById('change-player');if(change)change.addEventListener('click',()=>{try{localStorage.removeItem(K)}catch(_){ }allow()});
  });
})();