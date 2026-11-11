(function(){'use strict';
if(!window.htmPreact||!window.nacl){document.getElementById('root').innerHTML='<main class="wrap"><div class="boot"><h1 class="h1">Hollowmere</h1><p class="lead">Das Kampagnenbuch konnte seine Bausteine nicht laden. Prüf deine Verbindung und lade die Seite neu.</p></div></main>';return}
/* ================= basics ================= */
const {html,render,useState,useEffect,useRef,useReducer}=window.htmPreact;
const nacl=window.nacl;
const rid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const clone=o=>JSON.parse(JSON.stringify(o));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=v=>{const n=+v;return isFinite(n)?n:0};
const sg=n=>(n<0?'−':'+')+Math.abs(n);
const LS={get(k,d){try{const v=localStorage.getItem('hm-'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('hm-'+k,JSON.stringify(v))}catch(e){}}};
const fmtDate=ts=>{try{return new Date(ts).toLocaleString('de-DE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
const fmtDay=ts=>{try{return new Date(ts).toLocaleDateString('de-DE',{day:'numeric',month:'short'})}catch(e){return ''}};

/* ================= passwords: one key per password, content sealed with it ================= */
const te=new TextEncoder(),td=new TextDecoder();
function b64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
function ub64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
const normPw=p=>String(p||'').trim().toLowerCase().replace(/\s+/g,' ');
function pwKey(salt,pw){
  const tail=te.encode('|'+salt+'|'+normPw(pw)),buf=new Uint8Array(64+tail.length);
  buf.set(tail,64);let h=nacl.hash(tail);
  for(let i=0;i<1500;i++){buf.set(h,0);h=nacl.hash(buf)}
  return h.slice(0,32)}
function seal(obj,key){const n=nacl.randomBytes(24),c=nacl.secretbox(te.encode(JSON.stringify(obj)),n,key),o=new Uint8Array(24+c.length);o.set(n);o.set(c,24);return b64(o)}
function unseal(box,key){try{const u=ub64(box);if(key.length!==32||u.length<41)return null;const m=nacl.secretbox.open(u.subarray(24),u.subarray(0,24),key);return m?JSON.parse(td.decode(m)):null}catch(e){return null}}
const openCache=new Map();
function opened(box,kb){ // box + base64 key -> content or null, remembered
  if(!box||!kb)return null;const ck=kb+'|'+box.length+'|'+box.slice(0,48);
  if(openCache.has(ck))return openCache.get(ck);
  let v=null;try{v=unseal(box,ub64(kb))}catch(e){}
  openCache.set(ck,v);return v}

/* ================= images ================= */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Bild konnte nicht gelesen werden'));i.src=src})}
async function fileToImg(file){const u=URL.createObjectURL(file);try{return await loadImg(u)}finally{setTimeout(()=>URL.revokeObjectURL(u),8000)}}
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c}
function fitCanvas(img,maxW,maxH){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,r=Math.min(1,maxW/iw,maxH/ih),c=mkCanvas(iw*r,ih*r),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c}
function coverCanvas(img,w,h){const iw=img.naturalWidth,ih=img.naturalHeight,r=Math.max(w/iw,h/ih),sw=w/r,sh=h/r,c=mkCanvas(w,h);c.getContext('2d').drawImage(img,(iw-sw)/2,Math.max(0,(ih-sh)*0.3),sw,sh,0,0,w,h);return c}
function jpegUnder(c,maxChars,q0){ // -> {d, scale}; lowers quality, then size, until the data URL fits
  let cur=c,scale=1,q=q0||0.85,d=cur.toDataURL('image/jpeg',q);
  for(let i=0;i<24&&d.length>maxChars;i++){
    if(q>0.5)q-=0.08;else{scale*=0.82;cur=mkCanvas(c.width*scale,c.height*scale);cur.getContext('2d').drawImage(c,0,0,cur.width,cur.height);q=0.72}
    d=cur.toDataURL('image/jpeg',q)}
  return {d,scale:cur.width/c.width}}
async function pickImage(file,maxW,maxH,maxChars){const img=await fileToImg(file);return jpegUnder(fitCanvas(img,maxW,maxH),maxChars,0.85).d}
async function pickPortrait(file){const img=await fileToImg(file);return jpegUnder(coverCanvas(img,400,500),90000,0.84).d}

/* ================= rules data (5e) ================= */
const AB=['str','dex','con','int','wis','cha'];
const ABN={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
const ABS={str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};
const SK=[['Acrobatics','dex'],['Animal Handling','wis'],['Arcana','int'],['Athletics','str'],['Deception','cha'],['History','int'],['Insight','wis'],['Intimidation','cha'],['Investigation','int'],['Medicine','wis'],['Nature','int'],['Perception','wis'],['Performance','cha'],['Persuasion','cha'],['Religion','int'],['Sleight of Hand','dex'],['Stealth','dex'],['Survival','wis']];
const CLASSES={Artificer:{hd:8,sv:['con','int'],ct:'halfup',ca:'int'},Barbarian:{hd:12,sv:['str','con']},Bard:{hd:8,sv:['dex','cha'],ct:'full',ca:'cha'},Cleric:{hd:8,sv:['wis','cha'],ct:'full',ca:'wis'},Druid:{hd:8,sv:['int','wis'],ct:'full',ca:'wis'},Fighter:{hd:10,sv:['str','con']},Monk:{hd:8,sv:['str','dex']},Paladin:{hd:10,sv:['wis','cha'],ct:'half',ca:'cha'},Ranger:{hd:10,sv:['str','dex'],ct:'half',ca:'wis'},Rogue:{hd:8,sv:['dex','int']},Sorcerer:{hd:6,sv:['con','cha'],ct:'full',ca:'cha'},Warlock:{hd:8,sv:['wis','cha'],ct:'pact',ca:'cha'},Wizard:{hd:6,sv:['int','wis'],ct:'full',ca:'int'}};
const FULL=[[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const CASTER={'':'Kein Caster / von Hand','full':'Full Caster','half':'Half Caster (Paladin, Ranger)','halfup':'Half Caster (Artificer)','pact':'Pact Magic (Warlock)'};
function slotsFor(type,lvl){
  lvl=clamp(Math.round(num(lvl))||1,1,20);let a=[];
  if(type==='full')a=FULL[lvl-1];
  else if(type==='half')a=lvl<2?[]:FULL[Math.ceil(lvl/2)-1];
  else if(type==='halfup')a=FULL[Math.ceil(lvl/2)-1];
  else if(type==='pact'){const n=lvl<2?1:lvl<11?2:lvl<17?3:4,sl=lvl<3?1:lvl<5?2:lvl<7?3:lvl<9?4:5;a=[];a[sl-1]=n}
  const out=[];for(let i=0;i<9;i++)out.push(a[i]||0);return out}
const CONDS=[['Blinded','Du siehst nichts. Deine Angriffe haben Disadvantage, Angriffe gegen dich Advantage.'],['Charmed','Du kannst den Bezauberer nicht angreifen. Er hat Advantage auf soziale Checks gegen dich.'],['Deafened','Du hörst nichts.'],['Frightened','Disadvantage auf Checks und Angriffe, solange du die Quelle siehst. Du kannst dich ihr nicht nähern.'],['Grappled','Deine Speed ist 0.'],['Incapacitated','Keine Actions und keine Reactions.'],['Invisible','Du bist ohne Magie nicht zu sehen. Deine Angriffe haben Advantage, Angriffe gegen dich Disadvantage.'],['Paralyzed','Incapacitated, keine Bewegung. STR und DEX Saves misslingen. Treffer aus 5 ft sind Critical Hits.'],['Petrified','Zu Stein verwandelt, incapacitated, Resistance gegen jeden Schaden.'],['Poisoned','Disadvantage auf Attack Rolls und Ability Checks.'],['Prone','Du liegst. Aufstehen kostet die halbe Bewegung. Nahkampf gegen dich hat Advantage, Fernkampf Disadvantage.'],['Restrained','Speed 0. Deine Angriffe haben Disadvantage, Angriffe gegen dich Advantage. Disadvantage auf DEX Saves.'],['Stunned','Incapacitated, keine Bewegung. STR und DEX Saves misslingen. Angriffe gegen dich haben Advantage.'],['Unconscious','Bewusstlos und prone. Treffer aus 5 ft sind Critical Hits.'],['Exhaustion','Stufen 1 bis 6, jede Stufe macht alles schwerer. Eine Long Rest nimmt eine Stufe.'],['Concentrating','Du hältst einen Konzentrations-Spell. Bei Schaden: CON Save.']];

/* ================= character model ================= */
function blankSheet(){return {v:1,name:'',cls:'',sub:'',lvl:1,race:'',bg:'',align:'',xp:0,size:'',age:'',look:'',traits:'',ideals:'',bonds:'',flaws:'',story:'',
  ab:{str:10,dex:10,con:10,int:10,wis:10,cha:10},saves:[],skills:{},joat:false,pbO:'',ac:10,acNote:'',initMisc:0,speed:'30 ft',
  hpMax:8,hp:8,tmp:0,hd:8,hdUsed:0,ds:[0,0],insp:false,cond:[],senses:'',langs:'',profs:'',
  atk:[],cast:{type:'',ab:'',slots:[0,0,0,0,0,0,0,0,0],used:[0,0,0,0,0,0,0,0,0]},spells:[],feats:[],items:[],coins:{cp:0,sp:0,gp:0,pp:0},shareHp:true}}
function normSheet(d){ // fill gaps so every field the sheet reads exists
  const b=blankSheet(),s=Object.assign(b,d||{});
  s.ab=Object.assign({str:10,dex:10,con:10,int:10,wis:10,cha:10},s.ab||{});
  s.cast=Object.assign({type:'',ab:'',slots:[],used:[]},s.cast||{});
  for(let i=0;i<9;i++){s.cast.slots[i]=num(s.cast.slots[i]);s.cast.used[i]=num(s.cast.used[i])}
  s.coins=Object.assign({cp:0,sp:0,gp:0,pp:0},s.coins||{});
  ['saves','cond','atk','spells','feats','items'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[]});
  if(!s.skills||typeof s.skills!=='object')s.skills={};
  if(!Array.isArray(s.ds)||s.ds.length!==2)s.ds=[0,0];
  return s}
const lvlOf=s=>clamp(Math.round(num(s.lvl))||1,1,20);
const mod=v=>Math.floor(((v===''||v==null?10:num(v))-10)/2);
const pb=s=>(s.pbO!==''&&s.pbO!=null&&isFinite(+s.pbO))?+s.pbO:2+Math.floor((lvlOf(s)-1)/4);
const saveB=(s,a)=>mod(s.ab[a])+(s.saves.includes(a)?pb(s):0);
const skillB=(s,n,a)=>{const l=s.skills[n]||0;return mod(s.ab[a])+(l?pb(s)*l:(s.joat?Math.floor(pb(s)/2):0))};
const initB=s=>mod(s.ab.dex)+num(s.initMisc)+(s.joat?Math.floor(pb(s)/2):0);
const passive=s=>10+skillB(s,'Perception','wis');
function atkHit(s,a){if(a.ab==='none')return null;if(!a.ab)return num(a.bonus);return mod(s.ab[a.ab])+(a.prof!==false?pb(s):0)+num(a.bonus)}
function atkDmg(s,a){let d=String(a.dmg||'').trim();if(a.ab&&a.ab!=='none'&&a.dab!==false){const m=mod(s.ab[a.ab]);if(m)d+=(m<0?' − ':' + ')+Math.abs(m)}return d}
const spellDC=s=>s.cast.ab?8+pb(s)+mod(s.ab[s.cast.ab]):null;
const spellAtk=s=>s.cast.ab?pb(s)+mod(s.ab[s.cast.ab]):null;
const clsLine=s=>[[s.cls,s.sub?'('+s.sub+')':''].filter(Boolean).join(' '),s.cls||s.lvl?'Level '+lvlOf(s):'',s.race].filter(Boolean).join(' · ');
function cardOf(s,x){ // what the rest of the group sees
  const c={name:s.name||'',cls:s.cls||'',sub:s.sub||'',lvl:lvlOf(s),race:s.race||'',size:s.size||'',look:String(s.look||'').slice(0,600),cond:(s.cond||[]).slice(0,16),shareHp:s.shareHp!==false,pv:x.pv||0,joined:x.joined||Date.now(),init:x.init||null,at:Date.now()};
  if(c.shareHp){c.hp=num(s.hp);c.hpMax=num(s.hpMax);c.tmp=num(s.tmp)}
  return c}
function fromClass(s){const c=CLASSES[s.cls];if(!c)return;s.hd=c.hd;s.saves=c.sv.slice();s.cast.type=c.ct||'';s.cast.ab=c.ca||'';s.cast.slots=slotsFor(s.cast.type,s.lvl)}
function restShort(s){s.feats.forEach(f=>{if(f.rest==='short')f.used=0});if(s.cast.type==='pact')s.cast.used=[0,0,0,0,0,0,0,0,0]}
function restLong(s){s.hp=num(s.hpMax);s.tmp=0;s.ds=[0,0];s.feats.forEach(f=>{f.used=0});s.cast.used=[0,0,0,0,0,0,0,0,0];s.hdUsed=Math.max(0,num(s.hdUsed)-Math.max(1,Math.floor(lvlOf(s)/2)))}
function hpChange(s,kind,n){
  n=Math.max(0,Math.floor(num(n)));if(!n)return '';
  if(kind==='heal'){if(num(s.hp)===0)s.ds=[0,0];s.hp=Math.min(num(s.hpMax),num(s.hp)+n);return ''}
  if(kind==='temp'){s.tmp=Math.max(num(s.tmp),n);return ''}
  const was=num(s.hp),a=Math.min(num(s.tmp),n);s.tmp=num(s.tmp)-a;n-=a;s.hp=Math.max(0,was-n);
  if(was===0&&n>0){s.ds[1]=Math.min(3,s.ds[1]+1);return 'Treffer bei 0 HP: ein Death Save Fehlschlag.'}
  if(s.hp===0&&was>0)return 'Du bist bei 0 HP. Würfle Death Saves zu Beginn deines Zugs.';
  return ''}

/* ================= Firebase: sign-in, shared store, who is here =================
   The rest of the app talks to three small objects (db, user, room). Here they are built on Firebase:
   db is Firestore itself, user answers who is signed in and who the others are, room shows who is
   online and carries the short "look here" pings on the map. */
const FB={auth:null,fs:null,err:'',lastErr:''};
function fbInit(){
  const cfg=window.HM_CONFIG;
  if(!window.firebase||!firebase.initializeApp){FB.err='lib';return false}
  if(!cfg||!cfg.apiKey||!cfg.projectId||/DEIN|YOUR/i.test(cfg.apiKey)){FB.err='config';return false}
  try{
    firebase.initializeApp(cfg);
    FB.auth=firebase.auth();FB.fs=firebase.firestore();
    try{FB.fs.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
    try{FB.fs.enablePersistence({synchronizeTabs:true}).catch(()=>{})}catch(e){}
    try{FB.auth.languageCode='de'}catch(e){}
    return true}
  catch(e){FB.err='config';return false}}

/* people: everyone writes their own display name and photo; the app reads them all */
const People={map:{}};
const TINTS=['#F5B955','#6FE0C5','#FF8C7A','#B7A3FF','#7CC4FF'];
function avatarFor(name,seed){
  let h=0;const s=String(seed||name||'?');for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  const t=String(name||'?').trim().split(/\s+/).map(w=>w.charAt(0)).slice(0,2).join('').toUpperCase().replace(/[<>&"']/g,'')||'?';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#1A303B"/><text x="32" y="41" font-size="26" font-family="sans-serif" text-anchor="middle" fill="'+TINTS[h%TINTS.length]+'">'+t+'</text></svg>';
  return 'data:image/svg+xml,'+encodeURIComponent(svg)}
const fbUser={
  profiles:async ids=>{const o={};(Array.isArray(ids)?ids:[ids]).forEach(id=>{const p=People.map[id]||{},name=String(p.name||'');o[id]={id,name,avatarUrl:p.photo||avatarFor(name,id),color:'',email:null,isMe:id===S.uid}});return o}};
async function fbIsGM(){ // the security rules let only the game master read under gm/
  const ref=FB.fs.doc('gm/probe');
  try{await ref.get({source:'server'});return true}
  catch(e){if(e&&e.code==='permission-denied')return false;try{await ref.get();return true}catch(e2){return false}}}

/* room: online lights and map pings, kept small to stay well inside the free daily limits */
function fbRoom(){
  const fs=FB.fs,uid=S.uid;let hb=0,tick=0,cb=null,seen={};
  const mine=()=>fs.doc('presence/'+uid);
  const beat=()=>{if(document.visibilityState!=='hidden')mine().set({uid,at:Date.now()}).catch(()=>{})};
  const away=()=>{mine().set({uid,at:0}).catch(()=>{})};
  const deliver=()=>{if(!cb)return;const now=Date.now(),peers=Object.keys(seen).filter(k=>now-seen[k]<180000).map(k=>({presence:{uid:k}}));cb({peers,joined:[],left:[],updated:[]})};
  return {
    presence:async()=>{beat();clearInterval(hb);hb=setInterval(beat,60000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')beat();else away()});
      window.addEventListener('pagehide',away)},
    onPeers:(fn,err)=>{cb=fn;const un=fs.collection('presence').onSnapshot(q=>{seen={};q.docs.forEach(d=>{seen[d.id]=num(d.data().at)});deliver()},err||(()=>{}));
      clearInterval(tick);tick=setInterval(deliver,30000);return()=>{un();clearInterval(tick)}},
    on:(topic,fn,err)=>{let first=true;return fs.collection('pings').onSnapshot(q=>{
      if(first){first=false;return}
      q.docChanges().forEach(c=>{if(c.type!=='added')return;const d=c.doc.data();if(Math.abs(Date.now()-num(d.at))>90000)return;fn({topic,data:d})})},err||(()=>{}))},
    emit:async(topic,data)=>{const ref=fs.collection('pings').doc();await ref.set(Object.assign({},data,{uid,at:Date.now()}));setTimeout(()=>{ref.delete().catch(()=>{})},20000)}}}

/* signing in and out */
const AUTHMSG={'auth/popup-blocked':'Der Browser hat das Anmeldefenster blockiert. Erlaube Pop-ups für diese Seite und versuch es noch einmal.','auth/popup-closed-by-user':'','auth/cancelled-popup-request':'',
  'auth/unauthorized-domain':'Diese Adresse ist in Firebase noch nicht freigegeben. Die Spielleitung trägt sie unter Authentication → Einstellungen → Autorisierte Domains ein.',
  'auth/operation-not-allowed':'Diese Anmeldeart ist in Firebase noch nicht eingeschaltet (Authentication → Anmeldemethode).',
  'auth/invalid-credential':'E-Mail oder Passwort stimmt nicht.','auth/wrong-password':'E-Mail oder Passwort stimmt nicht.','auth/user-not-found':'E-Mail oder Passwort stimmt nicht.','auth/invalid-login-credentials':'E-Mail oder Passwort stimmt nicht.',
  'auth/email-already-in-use':'Mit dieser E-Mail gibt es schon ein Konto. Melde dich stattdessen an.','auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.','auth/invalid-email':'Diese E-Mail-Adresse sieht nicht richtig aus.',
  'auth/missing-password':'Gib ein Passwort ein.','auth/too-many-requests':'Zu viele Versuche. Warte kurz und versuch es dann noch einmal.','auth/network-request-failed':'Keine Verbindung. Prüf dein Internet.'};
const authMsg=e=>{const c=(e&&e.code)||'';return c in AUTHMSG?AUTHMSG[c]:'Die Anmeldung hat nicht geklappt.'+(c?' ('+c+')':'')};
function signInGoogle(){const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return FB.auth.signInWithPopup(p)}
async function signUpMail(name,mail,pw){const cr=await FB.auth.createUserWithEmailAndPassword(mail.trim(),pw);try{await cr.user.updateProfile({displayName:name.trim()})}catch(e){}S.pendingName=name.trim();return cr}
function signInMail(mail,pw){return FB.auth.signInWithEmailAndPassword(mail.trim(),pw)}
function resetMail(mail){return FB.auth.sendPasswordResetEmail(mail.trim())}
async function signOut(){try{flushSheet();flushNotes()}catch(e){}try{if(S.uid)await FB.fs.doc('presence/'+S.uid).set({uid:S.uid,at:0})}catch(e){}await FB.auth.signOut()}
async function setMyName(name){
  const n=String(name||'').trim().slice(0,60);if(!n||!S.uid)return;
  try{await FB.auth.currentUser.updateProfile({displayName:n})}catch(e){}
  await FB.fs.doc('people/'+S.uid).set({name:n,photo:(People.map[S.uid]||{}).photo||'',at:Date.now()});
  S.me=Object.assign({},S.me,{name:n});emit()}

/* ================= store ================= */
const S={phase:'boot',err:'',db:null,user:null,room:null,me:null,uid:null,isGM:false,
  camp:null,combat:null,chars:{},items:[],maps:[],unlocks:{},inbox:[],board:[],
  sheet:null,cardX:{pv:0,joined:0,init:null},notes:null,
  gmItems:[],gmMaps:[],sheets:{},online:{},profiles:{},portraits:{},media:{},pings:[],toasts:[],
  saving:false,saveErr:'',
  ui:Object.assign({tab:'sheet',sub:'kampf',chron:'journal',note:'mine',gm:'session',edit:false,map:'',mapEdit:false,gmSheet:''},LS.get('ui',{}))};
const subs=new Set();let queued=false;
function emit(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;subs.forEach(f=>f())})}
function ui(patch){Object.assign(S.ui,patch);LS.set('ui',S.ui);emit()}
function toast(msg,kind){const t={id:rid(),msg,kind:kind||''};S.toasts=S.toasts.concat(t).slice(-4);emit();setTimeout(()=>{S.toasts=S.toasts.filter(x=>x!==t);emit()},kind==='err'?7500:4200)}
function why(e){const c=(e&&e.code)||'';return c==='permission-denied'?' Dafür fehlt dir das Recht.':c==='resource-exhausted'?' Das Tageslimit der Datenbank ist erreicht. Ab Mitternacht (US-Westküstenzeit) geht es weiter.':c==='unavailable'||c==='deadline-exceeded'?' Keine Verbindung zur Datenbank. Prüf dein Internet.':c==='invalid-argument'?' Der Inhalt ist zu groß.':c==='not-found'?' Den Eintrag gibt es nicht mehr.':''}
const oops=what=>e=>{toast(what+' hat nicht geklappt.'+why(e),'err')};
const campOf=()=>S.camp||{title:'Hollowmere',sub:'Kampagnenbuch'};
const nameOf=uid=>{const p=S.profiles[uid];return (p&&p.name)||'Jemand'};
const charName=uid=>{const c=S.chars[uid];return (c&&c.name)||nameOf(uid)};

/* ================= reading ================= */
const rows=q=>q.docs.map(d=>Object.assign({id:d.id},d.data()));
const byId=q=>{const o={};q.docs.forEach(d=>{o[d.id]=d.data()});return o};
let deniedOnce=false;
function listen(ref,fn){try{return ref.onSnapshot(fn,e=>{console.error('listener',ref.path,e&&e.code);if(e&&e.code==='permission-denied'&&!deniedOnce){deniedOnce=true;toast('Ein Teil der Daten ist gesperrt. Prüf die Sicherheitsregeln in Firebase.','err')}})}catch(e){return ()=>{}}}
function getSure(ref){ // first answer that really comes from the server; null when that cannot be had
  return new Promise(res=>{
    let done=false,un=null;
    const fin=s=>{if(done)return;done=true;clearTimeout(t);if(un){try{un()}catch(e){}}res(s)};
    const viaGet=e=>{if(e&&e.code)FB.lastErr=e.code;ref.get().then(fin,x=>{FB.lastErr=(x&&x.code)||FB.lastErr;fin(null)})};
    const t=setTimeout(viaGet,4500);
    try{un=ref.onSnapshot(s=>{if(!s.metadata||!s.metadata.fromCache)fin(s)},viaGet)}catch(e){viaGet()}
    if(done&&un){try{un()}catch(e){}}})}
function resolvePeople(){
  if(!S.user)return;
  const ids=new Set(Object.keys(S.chars));ids.add(S.uid);S.board.forEach(b=>{if(b.by)ids.add(b.by)});
  S.user.profiles(Array.from(ids)).then(p=>{S.profiles=p||{};emit()}).catch(()=>{})}
function afterChars(){
  resolvePeople();
  Object.keys(S.chars).forEach(id=>{
    const pv=S.chars[id].pv||0,have=S.portraits[id];
    if(pv&&(!have||have.v!==pv)){
      S.portraits[id]={v:pv,d:have?have.d:''};
      S.db.doc('chars/'+id+'/media/portrait').get().then(s=>{if(s.exists){S.portraits[id]={v:pv,d:s.data().d||''};emit()}}).catch(()=>{})}})}
function startSubs(){
  const db=S.db,u=S.uid;
  listen(db.doc('camp/main'),s=>{S.camp=s.exists?s.data():null;emit()});
  listen(db.doc('camp/combat'),s=>{S.combat=s.exists?s.data():null;emit()});
  listen(db.collection('chars'),q=>{S.chars=byId(q);afterChars();emit()});
  listen(db.collection('items'),q=>{S.items=rows(q);emit()});
  listen(db.collection('maps'),q=>{S.maps=rows(q);emit()});
  listen(db.collection('unlocks'),q=>{S.unlocks=byId(q);emit()});
  listen(db.collection('inbox/'+u+'/items'),q=>{S.inbox=rows(q);emit()});
  listen(db.collection('board'),q=>{S.board=rows(q);resolvePeople();emit()});
  if(S.isGM){
    listen(db.collection('gm/store/items'),q=>{S.gmItems=rows(q);emit()});
    listen(db.collection('gm/store/maps'),q=>{S.gmMaps=rows(q);emit()});
    listen(db.collection('sheets'),q=>{S.sheets=byId(q);emit()})}}
function media(path,v,kb){ // picture stored beside an entry: data URL, '' while loading, null when there is none
  const ck=path+'@'+v+(kb?'k':'');const m=S.media[ck];if(m!==undefined)return m;
  S.media[ck]='';
  S.db.doc(path).get().then(s=>{let d=null;if(s.exists){const x=s.data();d=x.box?((opened(x.box,kb)||{}).d||null):(x.d||null)}S.media[ck]=d;emit()}).catch(()=>{delete S.media[ck]});
  return ''}

/* big images are stored as several documents */
const CHUNK=900000;
async function putChunks(col,data,v){const n=Math.ceil(data.length/CHUNK);for(let i=0;i<n;i++)await col.doc('c'+i).set({v,d:data.slice(i*CHUNK,(i+1)*CHUNK)});return n}
async function getChunks(col,n,v){const ss=await Promise.all(Array.from({length:n},(_,i)=>col.doc('c'+i).get()));if(ss.some(s=>!s.exists||s.data().v!==v))return null;return ss.map(s=>s.data().d).join('')}
async function dropChunks(col,n){for(let i=0;i<n;i++)await col.doc('c'+i).delete().catch(()=>{})}
const imgCache=new Map();
function cachedImg(key,load){if(imgCache.has(key))return imgCache.get(key);const p=load();imgCache.set(key,p);p.catch(()=>imgCache.delete(key));return p}
function loadMapImage(m){return cachedImg('m:'+m.id+'@'+m.v,async()=>{
  for(let i=0;i<4;i++){const d=await getChunks(S.db.collection('maps/'+m.id+'/img'),m.n,m.v);if(d)return loadImg(d);await new Promise(r=>setTimeout(r,1500))}
  throw new Error('Karte unvollständig')})}
function loadLockCrop(m,l,kb){return cachedImg('l:'+l.id+'@'+l.v,async()=>{
  const s=await S.db.doc('maps/'+m.id+'/lockimg/'+l.id).get();if(!s.exists)throw new Error('fehlt');
  const o=opened(s.data().box,kb);if(!o||!o.d)throw new Error('zu');return {img:await loadImg(o.d),pins:Array.isArray(o.pins)?o.pins:[]}})}

/* ================= my own things ================= */
let sheetT=0,sheetDirty=false,notesT=0,notesDirty=false;
function touchSheet(fn){if(!S.sheet)return;if(fn)fn(S.sheet);sheetDirty=true;clearTimeout(sheetT);sheetT=setTimeout(flushSheet,800);emit()}
function flushSheet(){
  clearTimeout(sheetT);if(!sheetDirty||!S.sheet||!S.db)return;
  sheetDirty=false;S.saving=true;emit();const s=clone(S.sheet);
  Promise.all([S.db.doc('sheets/'+S.uid).set(s),S.db.doc('chars/'+S.uid).set(cardOf(s,S.cardX))]).then(()=>{S.saving=false;S.saveErr='';emit()},e=>{
    S.saving=false;sheetDirty=true;const c=(e&&e.code)||'unavailable';console.error('sheet save',c);
    if(S.saveErr!==c)toast('Dein Charakter konnte nicht gespeichert werden.'+why(e),'err');
    S.saveErr=c;emit();
    if(c==='unavailable'||c==='deadline-exceeded'||c==='aborted'){clearTimeout(sheetT);sheetT=setTimeout(flushSheet,6000)}})}
function touchNotes(fn){if(!S.notes)return;if(fn)fn(S.notes);notesDirty=true;clearTimeout(notesT);notesT=setTimeout(flushNotes,900);emit()}
function flushNotes(){clearTimeout(notesT);if(!notesDirty||!S.notes||!S.db)return;notesDirty=false;S.db.doc('data/users/'+S.uid+'/notes').set(clone(S.notes)).catch(e=>{notesDirty=true;toast('Dein Notizzettel konnte nicht gespeichert werden.'+why(e),'err')})}
function createSheet(s){S.sheet=normSheet(clone(s));delete S.sheet.tpl;delete S.sheet.plays;sheetDirty=true;flushSheet();ui({tab:'sheet',edit:true,sub:'kampf'});window.scrollTo(0,0)}
async function deleteSheet(){
  clearTimeout(sheetT);sheetDirty=false;
  try{await S.db.doc('sheets/'+S.uid).delete();await S.db.doc('chars/'+S.uid+'/media/portrait').delete();S.cardX.pv=0;S.cardX.init=null;await S.db.doc('chars/'+S.uid).set({joined:S.cardX.joined||Date.now()});S.sheet=null;delete S.portraits[S.uid];ui({edit:false})}catch(e){oops('Das Löschen')(e)}}
async function setPortrait(file){
  try{const d=await pickPortrait(file),v=Date.now();await S.db.doc('chars/'+S.uid+'/media/portrait').set({d,v});S.cardX.pv=v;S.portraits[S.uid]={v,d};sheetDirty=true;flushSheet();emit()}
  catch(e){toast('Das Bild konnte nicht übernommen werden.'+why(e),'err')}}
function sendInit(v){if(!S.combat||!S.combat.call)return;S.cardX.init={v:Math.round(num(v)),c:S.combat.call};S.db.doc('chars/'+S.uid).update({init:S.cardX.init}).catch(oops('Die Initiative'));emit()}
function tryPw(pw){ // -> names of everything this password opened, for the whole group
  if(!S.camp||!S.camp.salt||!normPw(pw))return [];
  const key=pwKey(S.camp.salt,pw),kb=b64(key),hit=[];
  const isOpen=(id,box)=>S.unlocks[id]&&opened(box,S.unlocks[id].k);
  S.items.forEach(it=>{if(it.lock&&!isOpen(it.id,it.lock)&&unseal(it.lock,key))hit.push({id:it.id,name:it.title||'ein versiegelter Eintrag'})});
  S.maps.forEach(m=>(m.locks||[]).forEach(l=>{if(!isOpen(l.id,l.chk)&&unseal(l.chk,key))hit.push({id:l.id,name:l.name?'Karte: '+l.name:'ein Gebiet auf der Karte'})}));
  hit.forEach(h=>{const u={k:kb,by:S.uid,at:Date.now()};S.unlocks=Object.assign({},S.unlocks,{[h.id]:u});S.db.doc('unlocks/'+h.id).set(u).catch(oops('Das Freischalten'))});
  if(hit.length)emit();return hit.map(h=>h.name)}
const lockKey=(id,box)=>{const u=S.unlocks[id];return u&&opened(box,u.k)?u.k:''};

/* ================= who is here right now ================= */
function startRoom(){
  const r=S.room;if(!r)return;
  try{
    r.presence({uid:S.uid}).catch(()=>{});
    r.onPeers(ch=>{const o={};(ch.peers||[]).forEach(p=>{const u=p.presence&&p.presence.uid;if(typeof u==='string')o[u]=1});S.online=o;emit()},()=>{});
    r.on('ping',m=>{const d=m.data||{};if(typeof d.x!=='number'||typeof d.y!=='number')return;
      const p={id:rid(),m:String(d.m||''),x:clamp(d.x,0,1),y:clamp(d.y,0,1),uid:typeof d.uid==='string'?d.uid:''};
      S.pings=S.pings.concat(p);emit();setTimeout(()=>{S.pings=S.pings.filter(q=>q!==p);emit()},4500)},()=>{})}catch(e){}}
function sendPing(mapId,x,y){if(S.room)S.room.emit('ping',{m:mapId,x,y,uid:S.uid}).catch(()=>{})}

/* ================= start ================= */
async function boot(){
  if(!fbInit()){S.phase='ready';S.err=FB.err||'config';emit();return}
  FB.auth.onAuthStateChanged(u=>{
    if(!u){if(S.uid){location.reload();return}S.phase='login';emit();return}
    if(S.uid===u.uid)return;
    startSession(u).catch(e=>{console.error(e);S.phase='ready';S.err='load';emit()})});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){flushSheet();flushNotes()}});
  window.addEventListener('pagehide',()=>{flushSheet();flushNotes()})}
async function startSession(u){
  S.phase='boot';S.err='';emit();
  const db=FB.fs;S.db=db;S.uid=u.uid;S.user=fbUser;
  const name=String(S.pendingName||u.displayName||'').trim();
  const pdoc=db.doc('people/'+u.uid);let shown=name;
  try{const old=await getSure(pdoc);const was=old&&old.exists?old.data():{};shown=name||String(was.name||'');
    await pdoc.set({name:shown,photo:u.photoURL||was.photo||'',at:Date.now()})}
  catch(e){FB.lastErr=(e&&e.code)||FB.lastErr}
  if(FB.lastErr==='permission-denied'){S.phase='ready';S.err='rules';emit();return}
  db.collection('people').onSnapshot(q=>{People.map=byId(q);resolvePeople();emit()},()=>{});
  S.isGM=await fbIsGM();
  S.me={id:u.uid,name:shown,email:u.email||'',canEdit:S.isGM,isOwner:S.isGM};
  S.room=fbRoom();
  try{
    const id=S.uid;
    const [sh,card,notes,camp]=await Promise.all([getSure(db.doc('sheets/'+id)),getSure(db.doc('chars/'+id)),getSure(db.doc('data/users/'+id+'/notes')),S.isGM?getSure(db.doc('camp/main')):Promise.resolve(null)]);
    if(!sh){S.phase='ready';S.err=FB.lastErr==='permission-denied'?'rules':'load';emit();return}
    S.sheet=sh.exists?normSheet(clone(sh.data())):null;
    if(card&&card.exists){const c=card.data();S.cardX={pv:c.pv||0,joined:c.joined||Date.now(),init:c.init||null}}
    else if(card){S.cardX={pv:0,joined:Date.now(),init:null};if(!S.isGM||S.sheet)db.doc('chars/'+id).set(S.sheet?cardOf(S.sheet,S.cardX):{joined:S.cardX.joined}).catch(()=>{})}
    S.notes=notes&&notes.exists?clone(notes.data()):{pages:[]};
    if(!Array.isArray(S.notes.pages)||!S.notes.pages.length)S.notes.pages=[{id:rid(),t:'Notizen',b:''}];
    if(S.isGM&&camp&&!camp.exists)await db.doc('camp/main').set({title:'Hollowmere',sub:'Kampagnenbuch',salt:b64(nacl.randomBytes(16)),at:Date.now()}).catch(()=>{});
  }catch(e){S.phase='ready';S.err='load';emit();return}
  if(!S.isGM&&S.ui.tab==='gm')S.ui.tab='sheet';
  if(S.isGM&&!LS.get('ui',null))S.ui.tab='gm';
  if(!S.isGM)S.ui.mapEdit=false;
  startSubs();startRoom();
  S.phase='ready';emit()}

/* ================= small parts ================= */
const ICONS={
  sheet:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 11h6M9 14h6M9 17h4"/>',
  party:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c.8-4 3.5-5.5 6-5.5s5.2 1.5 6 5.5M15.5 14.6c2.6 0 4.6 1.3 5.5 5.4"/>',
  map:'<path d="M3 6l5-2 8 2 5-2v14l-5 2-8-2-5 2z"/><path d="M8 4v14M16 6v14"/>',
  book:'<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
  note:'<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8 9h8M8 12h5"/>',
  lantern:'<path d="M9 11h6v10H9z"/><path d="M12 11V8"/><path d="M12 2.5c2.2 2 2.2 3.6 0 5-2.2-1.4-2.2-3 0-5z"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock:'<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  edit:'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cam:'<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
  swords:'<path d="M5 4l10 10M4 8l2-4M15 14l-2 2 4 4 2-2zM19 4L9 14M20 8l-2-4M9 14l2 2-4 4-2-2z"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pin:'<path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
  back:'<path d="M14 6l-6 6 6 6"/>'};
function Ic({n}){return html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML=${{__html:ICONS[n]||''}}></svg>`}
function Lantern(){return html`<svg viewBox="0 0 20 26" aria-hidden="true"><path d="M6 10h8v12H6z" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="1.4"/><path d="M4.5 22h11M10 10V7.6" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round"/><path d="M10 1.2c2.3 2.2 2.3 4.2 0 6-2.3-1.8-2.3-3.8 0-6z" fill="var(--flame)"/><circle cx="10" cy="16" r="2.2" fill="var(--flame)"/></svg>`}
function F({l,wide,children}){return html`<label class=${'fl'+(wide?' wide':'')}><span>${l}</span>${children}</label>`}
function In({v,on,type,ph,cls,lbl,id,min,max,dis}){
  return html`<input class=${'in '+(cls||'')} id=${id} type=${type||'text'} inputmode=${type==='number'?'numeric':null} value=${v==null?'':v} placeholder=${ph||''} aria-label=${lbl} min=${min} max=${max} disabled=${dis}
    onInput=${e=>on(type==='number'?(e.target.value===''?'':+e.target.value):e.target.value)}/>`}
function Area({v,on,ph,lbl,rows,id}){return html`<textarea class="in" id=${id} rows=${rows||3} value=${v==null?'':v} placeholder=${ph||''} aria-label=${lbl} onInput=${e=>on(e.target.value)}/>`}
function Late({v,on,type,ph,area,lbl,id}){ // saves when you leave the field
  const base=v==null?'':v,[x,setX]=useState(base);
  useEffect(()=>{setX(base)},[base]);
  const commit=()=>{if(x!==base)on(x)};
  return area?html`<textarea class="in" id=${id} rows="3" aria-label=${lbl} value=${x} placeholder=${ph||''} onInput=${e=>setX(e.target.value)} onBlur=${commit}/>`
    :html`<input class="in" id=${id} type=${type||'text'} aria-label=${lbl} value=${x} placeholder=${ph||''} onInput=${e=>setX(e.target.value)} onBlur=${commit} onKeyDown=${e=>{if(e.key==='Enter')e.target.blur()}}/>`}
function Confirm({label,ask,yes,onYes,cls}){
  const [on,set]=useState(false);
  return on?html`<span class="rowf"><span class="sm">${ask||'Sicher?'}</span><button class="btn s warn" onClick=${()=>{set(false);onYes()}}>${yes||'Ja, löschen'}</button><button class="btn s quiet" onClick=${()=>set(false)}>Abbrechen</button></span>`
    :html`<button class=${cls||'btn s warn'} onClick=${()=>set(true)}>${label}</button>`}
function Modal({title,onClose,children}){
  useEffect(()=>{const k=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',k);return()=>document.removeEventListener('keydown',k)},[]);
  return html`<div class="modal" onClick=${e=>{if(e.target===e.currentTarget)onClose()}}><div role="dialog" aria-modal="true" aria-label=${title}>
    <div class="rowf"><h2 class="h2" style="margin:0">${title}</h2><button class="xbtn right" aria-label="Schließen" onClick=${onClose}>×</button></div>${children}</div></div>`}
function Pips({max,used,on,kind,label}){ // a lit light is still available; for death saves (ok, bad) a lit light is a mark
  const out=[];for(let i=0;i<max;i++)out.push(html`<button key=${i} class=${'pip '+(kind||'')+(i<used?' used':'')} disabled=${!on} aria-label=${(label||'Einsatz')+' '+(i+1)+(kind==='ok'||kind==='bad'?(i<used?', markiert':', offen'):(i<used?', verbraucht':', frei'))} onClick=${()=>on(i<used?i:i+1)}></button>`);
  return html`<span class="pips">${out}</span>`}
function Counter({v,on,min,max,label}){
  const n=num(v);
  return html`<span class="ctr"><button class="btn s quiet" aria-label=${(label||'Wert')+' verringern'} disabled=${!on||(min!=null&&n<=min)} onClick=${()=>on(n-1)}>−</button><b>${n}</b><button class="btn s quiet" aria-label=${(label||'Wert')+' erhöhen'} disabled=${!on||(max!=null&&n>=max)} onClick=${()=>on(n+1)}>+</button></span>`}
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w.charAt(0)).slice(0,2).join('').toUpperCase()||'?';
function Portrait({uid,name,cls}){
  const p=S.portraits[uid],d=p&&p.d;
  return html`<div class=${'port '+(cls||'')+(d?'':' none')}>${d?html`<img src=${d} alt=${'Bild von '+(name||'einem Charakter')}/>`:html`<span aria-hidden="true">${initials(name)}</span>`}</div>`}
function FileBtn({label,cls,onFile,icon,accept}){
  const ref=useRef(null);
  return html`<button type="button" class=${cls||'btn'} onClick=${()=>ref.current&&ref.current.click()}>${icon?html`<${Ic} n=${icon}/>`:null}${label}</button>
    <input type="file" accept=${accept||'image/*'} hidden ref=${ref} onChange=${e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)onFile(f)}}/>`}
function PortraitPick({uid,name}){
  const ref=useRef(null),p=S.portraits[uid],d=p&&p.d;
  return html`<button type="button" class="port" aria-label="Bild auswählen" title="Bild auswählen" onClick=${()=>ref.current&&ref.current.click()}>
      ${d?html`<img src=${d} alt=""/>`:html`<span aria-hidden="true">${initials(name)}</span>`}<span class="cam"><${Ic} n="cam"/></span></button>
    <input type="file" accept="image/*" hidden ref=${ref} onChange=${e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)setPortrait(f)}}/>`}
function Pic({path,v,kb,alt}){
  if(!v)return null;const d=media(path,v,kb);
  return d?html`<img src=${d} alt=${alt||''}/>`:d===''?html`<p class="soft sm">Bild lädt …</p>`:null}
function PwBox({label}){
  const [v,setV]=useState(''),[msg,setMsg]=useState('');
  const go=e=>{e.preventDefault();if(!v.trim())return;const hit=tryPw(v);if(hit.length){setMsg('');setV('');toast('Freigeschaltet: '+hit.join(', '))}else setMsg('Dieses Passwort öffnet gerade nichts.')};
  return html`<form class="pwbox" onSubmit=${go}>
    <input class="in" type="text" autocomplete="off" autocapitalize="off" spellcheck=${false} placeholder=${label||'Passwort eingeben'} aria-label="Passwort" value=${v} onInput=${e=>{setV(e.target.value);setMsg('')}}/>
    <button class="btn solid" type="submit"><${Ic} n="unlock"/>Öffnen</button>
    ${msg?html`<span class="sm soft" role="status" style="flex-basis:100%">${msg}</span>`:null}</form>`}
function Who({uid}){
  const p=S.profiles[uid];
  return html`<span class="who"><span class=${'lit'+(S.online[uid]?' on':'')} title=${S.online[uid]?'gerade hier':'nicht hier'}></span>${p&&p.avatarUrl?html`<img src=${p.avatarUrl} alt=""/>`:null}<span>${nameOf(uid)}</span></span>`}

/* ================= masthead and strips ================= */
const TABS=[['sheet','Bogen','sheet'],['party','Gruppe','party'],['map','Karte','map'],['chron','Chronik','book'],['notes','Notizen','note'],['gm','Leitung','lantern']];
function chronUnread(){const seen=LS.get('seen',0);return S.inbox.filter(i=>!i.read).length+S.items.filter(i=>(i.pub||0)>seen).length}
function Top(){
  const c=campOf(),unread=S.ui.tab==='chron'?S.inbox.filter(i=>!i.read).length:chronUnread();
  return html`<header class="top"><div class="wrap">
    <div class="top-row"><div class="brand"><${Lantern}/><span>${c.title||'Hollowmere'}<small>${c.sub||''}</small></span></div>
      <span class="right savest" role="status">${S.saving?'Speichert …':S.saveErr?'Nicht gespeichert':''}</span>
      <button class="acct" aria-label="Dein Konto" title="Dein Konto" onClick=${()=>{S.acct=true;emit()}}><img src=${(S.profiles[S.uid]||{}).avatarUrl||avatarFor(S.me&&S.me.name,S.uid)} alt=""/></button></div>
    <nav class="tabs" aria-label="Bereiche">${TABS.filter(t=>t[0]!=='gm'||S.isGM).map(t=>html`<button key=${t[0]} aria-current=${S.ui.tab===t[0]?'page':null} onClick=${()=>{ui({tab:t[0]});window.scrollTo(0,0)}}>
      <${Ic} n=${t[2]}/>${t[1]}${t[0]==='chron'&&unread?html`<span class="badge" aria-label=${unread+' neu'}>${unread}</span>`:null}</button>`)}</nav>
  </div></header>`}
function InitAsk({cb}){
  const mine=S.cardX.init&&S.cardX.init.c===cb.call?S.cardX.init.v:null,[v,setV]=useState('');
  const go=e=>{e.preventDefault();if(v==='')return;sendInit(v);setV('')};
  return html`<form class="cbar mine" onSubmit=${go}><${Ic} n="swords"/><b>Initiative!</b>
    ${mine!=null?html`<span>Dein Wurf: <b>${mine}</b></span><span class="soft sm">Neuer Wert?</span>`:html`<span>Würfle d20 ${sg(initB(S.sheet))} und trag das Ergebnis ein.</span>`}
    <input class="in num" type="number" inputmode="numeric" aria-label="Dein Initiative-Ergebnis" value=${v} onInput=${e=>setV(e.target.value)}/><button class="btn solid" type="submit">Melden</button></form>`}
function Strips(){
  const c=campOf(),cb=S.combat,out=[];
  if(c.banner)out.push(html`<div class="banner" key="b"><b>Von der Spielleitung:</b> ${c.banner}</div>`);
  if(cb&&cb.on&&cb.order&&cb.order.length){
    const cur=cb.order[cb.turn%cb.order.length],nx=cb.order[(cb.turn+1)%cb.order.length],mine=cur.uid===S.uid;
    out.push(html`<div key="c" class=${'cbar'+(mine?' mine':'')} role="status"><${Ic} n="swords"/><span>Runde ${cb.round}</span><b>${mine?'Du bist dran!':'Am Zug: '+cur.n}</b>
      ${cb.order.length>1?html`<span class="soft">danach ${nx.uid===S.uid?'du':nx.n}</span>`:null}
      ${S.isGM?html`<button class="btn s solid right" onClick=${gmNextTurn}>Weiter</button>`:null}</div>`)}
  else if(cb&&cb.call&&S.sheet)out.push(html`<${InitAsk} key="i" cb=${cb}/>`);
  return out}
function Toasts(){return html`<div class="toasts" aria-live="polite">${S.toasts.map(t=>html`<div key=${t.id} class=${'toast '+t.kind} role="status">${t.msg}</div>`)}</div>`}

/* ================= character sheet ================= */
let HEROES=[];try{HEROES=JSON.parse(document.getElementById('heroes').textContent)}catch(e){}
const ORD=['Cantrips','1st Level','2nd Level','3rd Level','4th Level','5th Level','6th Level','7th Level','8th Level','9th Level'];
const REST={'':'kein Auffüllen',short:'Short Rest',long:'Long Rest'};

function NewChar(){
  const [mode,setMode]=useState(''),[d,setD]=useState({name:'',cls:'',lvl:3,race:'',bg:'',ab:{str:10,dex:10,con:10,int:10,wis:10,cha:10}});
  const up=p=>setD(Object.assign({},d,p));
  const make=e=>{e.preventDefault();if(!d.name.trim())return;
    const s=blankSheet();Object.assign(s,{name:d.name.trim(),cls:d.cls.trim(),lvl:clamp(Math.round(num(d.lvl))||1,1,20),race:d.race.trim(),bg:d.bg.trim(),ab:Object.assign({},d.ab)});
    fromClass(s);const con=mod(s.ab.con);s.hpMax=Math.max(1,s.hd+con+(s.lvl-1)*(Math.floor(s.hd/2)+1+con));s.hp=s.hpMax;s.ac=10+mod(s.ab.dex);
    createSheet(s)};
  if(mode==='tpl')return html`<button class="btn quiet" onClick=${()=>setMode('')}><${Ic} n="back"/>Zurück</button>
    <h1 class="h1" style="margin-top:.8rem">Held vom Laternenfest</h1>
    <p class="lead">Die acht Helden aus der Nacht der gestohlenen Schatten, so wie sie auf Level 3 waren. Du übernimmst alle Werte und kannst danach alles ändern.</p>
    <div class="pick-grid">${HEROES.map(h=>html`<button key=${h.tpl} class="pick" onClick=${()=>createSheet(h)}><b>${h.name}</b><span class="soft">${h.race} ${h.cls}, ${h.sub}</span><span class="sm">${h.plays}</span></button>`)}</div>`;
  if(mode==='new')return html`<button class="btn quiet" onClick=${()=>setMode('')}><${Ic} n="back"/>Zurück</button>
    <h1 class="h1" style="margin-top:.8rem">Neuer Charakter</h1>
    <p class="lead">Die Grundlagen reichen für den Anfang. Angriffe, Spells, Features und Ausrüstung trägst du gleich danach im Bogen ein.</p>
    <form class="stack" style="max-width:46rem" onSubmit=${make}>
      <div class="fg">
        <${F} l="Name"><${In} id="nc-name" v=${d.name} on=${v=>up({name:v})}/><//>
        <${F} l="Class"><input class="in" id="nc-cls" list="dl-cls" value=${d.cls} onInput=${e=>up({cls:e.target.value})}/><//>
        <${F} l="Level"><${In} id="nc-lvl" type="number" min="1" max="20" v=${d.lvl} on=${v=>up({lvl:v})}/><//>
        <${F} l="Race / Species"><${In} id="nc-race" v=${d.race} on=${v=>up({race:v})}/><//>
        <${F} l="Background"><${In} id="nc-bg" v=${d.bg} on=${v=>up({bg:v})}/><//>
      </div>
      <datalist id="dl-cls">${Object.keys(CLASSES).map(c=>html`<option value=${c}/>`)}</datalist>
      <div><span class="lbl">Ability Scores</span>
        <div class="abils" style="grid-template-columns:repeat(auto-fit,minmax(92px,1fr))">${AB.map(a=>html`<div class="abil" key=${a}><span class="n">${ABN[a]}</span><span class="m">${sg(mod(d.ab[a]))}</span>
          <${In} id=${'nc-'+a} type="number" cls="tiny" lbl=${ABN[a]} v=${d.ab[a]} on=${v=>up({ab:Object.assign({},d.ab,{[a]:v})})}/></div>`)}</div>
        <p class="sm soft" style="margin-top:.4rem">Standard Array: 15, 14, 13, 12, 10, 8, plus die Boni deiner Herkunft. Oder würfelt, wie eure Spielleitung es vorgibt.</p></div>
      ${CLASSES[d.cls]?html`<p class="hint">Für ${d.cls} trage ich Hit Die (d${CLASSES[d.cls].hd}), Saving Throws${CLASSES[d.cls].ct?' und Spell Slots':''} gleich mit ein.</p>`:null}
      <div><button class="btn solid" type="submit" disabled=${!d.name.trim()}>Charakter anlegen</button></div>
    </form>`;
  return html`<h1 class="h1">Dein Charakter</h1>
    <p class="lead">Hier baust du deinen Helden und führst ihn durch die Kampagne. Gewürfelt wird am Tisch, der Bogen rechnet dir die Boni aus. Was du einträgst, wird automatisch gespeichert.</p>
    <div class="pick-grid" style="max-width:44rem">
      <button class="pick" onClick=${()=>setMode('new')}><b>Neu bauen</b><span class="sm">Name, Class, Level und Ability Scores eintragen, dann den Bogen Stück für Stück füllen.</span></button>
      <button class="pick" onClick=${()=>setMode('tpl')}><b>Held vom Laternenfest</b><span class="sm">Mit Brannoc, Ida, Wren oder einem der anderen fünf weiterspielen. Alle Werte sind schon eingetragen.</span></button>
    </div>`}

function HpCtl({set}){
  const [n,setN]=useState('');
  const go=k=>{let msg='';set(x=>{msg=hpChange(x,k,n)});setN('');if(msg)toast(msg)};
  return html`<div class="rowf"><input class="in num" id="hp-amt" type="number" inputmode="numeric" min="0" aria-label="Betrag" placeholder="0" value=${n} onInput=${e=>setN(e.target.value)}/>
    <button class="btn dmg" onClick=${()=>go('dmg')}>Schaden</button><button class="btn heal" onClick=${()=>go('heal')}>Heilung</button><button class="btn quiet" onClick=${()=>go('temp')}>Temp HP</button></div>`}

function LevelUp({s,set,close}){
  const L=lvlOf(s),n=L+1,con=mod(s.ab.con),avg=Math.max(1,Math.floor(num(s.hd)/2)+1+con);
  const [hp,setHp]=useState(avg),[slots,setSlots]=useState(true);
  const next=slotsFor(s.cast.type,n),slotCh=!!s.cast.type&&next.join()!==s.cast.slots.join();
  const auto=s.pbO===''||s.pbO==null,pbNew=2+Math.floor((n-1)/4);
  if(L>=20)return html`<${Modal} title="Level up" onClose=${close}><p>${s.name||'Dein Charakter'} ist auf Level 20. Höher geht es nicht.</p><//>`;
  const go=()=>{set(x=>{const g=Math.max(1,Math.round(num(hp)));x.lvl=n;x.hpMax=num(x.hpMax)+g;x.hp=num(x.hp)+g;if(slotCh&&slots)x.cast.slots=next});close();ui({edit:true});toast((s.name||'Dein Charakter')+' ist jetzt Level '+n+'.')};
  return html`<${Modal} title=${'Level '+L+' → '+n} onClose=${close}><div class="stack" style="margin-top:.8rem">
    <div><label class="fl" style="max-width:12rem"><span>Hit Points dazu</span><${In} id="lu-hp" type="number" min="1" v=${hp} on=${setHp}/></label>
      <p class="sm soft" style="margin-top:.3rem">Würfle 1d${s.hd} und zähle deinen CON Modifier (${sg(con)}) dazu. Oder nimm den festen Wert ${avg}.</p></div>
    ${auto&&pbNew!==pb(s)?html`<p>Dein Proficiency Bonus steigt auf ${sg(pbNew)}. Alle Boni im Bogen rechnen sich neu.</p>`:null}
    ${slotCh?html`<label class="chk"><input type="checkbox" checked=${slots} onChange=${e=>setSlots(e.target.checked)}/><span>Spell Slots anpassen: ${next.filter(x=>x).length?next.map((x,i)=>x?ORD[i+1].replace(' Level','')+' ×'+x:'').filter(Boolean).join(', '):'keine'}</span></label>`:null}
    ${[4,8,12,16,19].includes(n)?html`<p>Auf Level ${n} bekommen die meisten Klassen ein Ability Score Improvement oder ein Feat.</p>`:null}
    <p class="soft sm">Danach öffnet sich der Bearbeiten-Modus. Trag dort ein, was deine Klasse auf Level ${n} Neues bringt: Features, Spells, Angriffe.</p>
    <div class="rowf"><button class="btn solid" onClick=${go}>Aufsteigen</button><button class="btn quiet" onClick=${close}>Abbrechen</button></div></div><//>`}

function RestDlg({s,set,close}){
  const half=Math.max(1,Math.floor(lvlOf(s)/2));
  return html`<${Modal} title="Rast" onClose=${close}><div class="stack" style="margin-top:.8rem">
    <div class="box plain"><h3 class="h3">Short Rest</h3><p class="sm" style="margin:.3rem 0 .6rem">Etwa eine Stunde. Features mit Short Rest sind wieder da. Hit Dice gibst du selbst aus: würfeln, CON Modifier dazu, als Heilung eintragen.</p>
      <button class="btn" onClick=${()=>{set(restShort);close();toast('Short Rest. Vergiss deine Hit Dice nicht.')}}>Short Rest nehmen</button></div>
    <div class="box plain"><h3 class="h3">Long Rest</h3><p class="sm" style="margin:.3rem 0 .6rem">Acht Stunden. Alle Hit Points, Spell Slots und Features sind wieder da, dazu ${half} ${half>1?'Hit Dice':'Hit Die'}.</p>
      <button class="btn" onClick=${()=>{set(restLong);close();toast('Long Rest. Alles wieder aufgefüllt.')}}>Long Rest nehmen</button></div></div><//>`}

function Sheet({s,uid,edit,ro,set}){
  const e=!!edit&&!ro,[dlg,setDlg]=useState(''),[sub,setSub]=useState(ro?'kampf':(S.ui.sub||'kampf'));
  const pick=v=>{setSub(v);if(!ro)ui({sub:v})};
  const L=lvlOf(s),hp=num(s.hp),hpMax=Math.max(1,num(s.hpMax)),pct=clamp(hp/hpMax*100,0,100);
  const T=e?'button':'div',upd=fn=>set(()=>{fn()});
  const tracked=s.feats.filter(f=>num(f.max)>0);

  const basics=e?html`<div class="box plain" style="margin-top:1rem"><h3 class="h3" style="margin-bottom:.6rem">Grunddaten</h3><div class="fg">
      <${F} l="Name"><${In} id="sh-name" v=${s.name} on=${v=>upd(()=>{s.name=v})}/><//>
      <${F} l="Class"><input class="in" id="sh-cls" list="dl-cls2" value=${s.cls} onInput=${ev=>{const v=ev.target.value;upd(()=>{s.cls=v})}}/><//>
      <${F} l="Subclass"><${In} id="sh-sub" v=${s.sub} on=${v=>upd(()=>{s.sub=v})}/><//>
      <${F} l="Level"><${In} id="sh-lvl" type="number" min="1" max="20" v=${s.lvl} on=${v=>upd(()=>{s.lvl=v})}/><//>
      <${F} l="Race / Species"><${In} id="sh-race" v=${s.race} on=${v=>upd(()=>{s.race=v})}/><//>
      <${F} l="Background"><${In} id="sh-bg" v=${s.bg} on=${v=>upd(()=>{s.bg=v})}/><//>
      <${F} l="Alignment"><${In} id="sh-al" v=${s.align} on=${v=>upd(()=>{s.align=v})}/><//>
      <${F} l="Experience Points"><${In} id="sh-xp" type="number" min="0" v=${s.xp} on=${v=>upd(()=>{s.xp=v})}/><//>
    </div><datalist id="dl-cls2">${Object.keys(CLASSES).map(c=>html`<option value=${c}/>`)}</datalist>
    ${CLASSES[s.cls]?html`<p class="sm" style="margin:.7rem 0 0"><button class="btn s" onClick=${()=>{upd(()=>fromClass(s));toast('Hit Die, Saving Throws und Spell Slots für '+s.cls+' eingetragen.')}}>Werte für ${s.cls} übernehmen</button> <span class="soft">setzt Hit Die, Saving Throws und Spell Slots.</span></p>`:null}
    <h3 class="h3" style="margin:1.1rem 0 .6rem">Kampfwerte</h3><div class="fg">
      <${F} l="Armor Class"><${In} id="sh-ac" type="number" v=${s.ac} on=${v=>upd(()=>{s.ac=v})}/><//>
      <${F} l="AC kommt von"><${In} id="sh-acn" v=${s.acNote} ph="Chain mail, Shield" on=${v=>upd(()=>{s.acNote=v})}/><//>
      <${F} l="Hit Points Maximum"><${In} id="sh-hpm" type="number" min="1" v=${s.hpMax} on=${v=>upd(()=>{s.hpMax=v})}/><//>
      <${F} l="Hit Die"><select class="in" id="sh-hd" value=${s.hd} onChange=${ev=>{const v=+ev.target.value;upd(()=>{s.hd=v})}}>${[6,8,10,12].map(x=>html`<option value=${x}>d${x}</option>`)}</select><//>
      <${F} l="Speed"><${In} id="sh-spd" v=${s.speed} on=${v=>upd(()=>{s.speed=v})}/><//>
      <${F} l="Initiative, Zusatzbonus"><${In} id="sh-ini" type="number" v=${s.initMisc} on=${v=>upd(()=>{s.initMisc=v})}/><//>
      <${F} l="Proficiency Bonus"><${In} id="sh-pb" type="number" v=${s.pbO} ph=${'automatisch '+sg(2+Math.floor((L-1)/4))} on=${v=>upd(()=>{s.pbO=v})}/><//>
      <${F} l="Senses"><${In} id="sh-sen" v=${s.senses} ph="Darkvision 60 ft" on=${v=>upd(()=>{s.senses=v})}/><//>
      <${F} l="Languages" wide=${true}><${In} id="sh-lang" v=${s.langs} on=${v=>upd(()=>{s.langs=v})}/><//>
      <${F} l="Proficiencies (Rüstung, Waffen, Tools)" wide=${true}><${Area} id="sh-prof" rows="2" v=${s.profs} on=${v=>upd(()=>{s.profs=v})}/><//>
    </div>
    <label class="chk" style="margin-top:.7rem"><input type="checkbox" checked=${!!s.joat} onChange=${ev=>{const v=ev.target.checked;upd(()=>{s.joat=v})}}/><span>Jack of All Trades: halber Proficiency Bonus auf ungeübte Checks</span></label></div>`:null;

  const kampf=()=>html`
    <div class="rowf"><h3 class="h3">Angriffe</h3>${e?html`<button class="btn s right" onClick=${()=>upd(()=>{s.atk.push({id:rid(),n:'',ab:'str',prof:true,bonus:0,dmg:'',dab:true,ty:'',note:''})})}><${Ic} n="plus"/>Angriff</button>`:null}</div>
    ${!s.atk.length?html`<p class="empty">${e?'Noch kein Angriff eingetragen.':'Noch keine Angriffe. Trag sie über Bearbeiten ein.'}</p>`:null}
    ${s.atk.map(a=>e?html`<div class="edit-card" key=${a.id}><div class="fg">
        <${F} l="Name"><${In} v=${a.n} ph="Longsword" on=${v=>upd(()=>{a.n=v})}/><//>
        <${F} l="Attack Roll mit"><select class="in" value=${a.ab} onChange=${ev=>{const v=ev.target.value;upd(()=>{a.ab=v})}}>${AB.map(k=>html`<option value=${k}>${ABN[k]}</option>`)}<option value="">fester Bonus</option><option value="none">kein Attack Roll</option></select><//>
        ${a.ab!=='none'?html`<${F} l=${a.ab?'Zusatzbonus':'Bonus'}><${In} type="number" v=${a.bonus} on=${v=>upd(()=>{a.bonus=v})}/><//>`:null}
        <${F} l="Damage (Würfel)"><${In} v=${a.dmg} ph="1d8" on=${v=>upd(()=>{a.dmg=v})}/><//>
        <${F} l="Damage Type"><${In} v=${a.ty} ph="slashing" on=${v=>upd(()=>{a.ty=v})}/><//>
        <${F} l="Notiz" wide=${true}><${In} v=${a.note} ph="Melee, reach 5 ft" on=${v=>upd(()=>{a.note=v})}/><//>
      </div><div class="rowf" style="margin-top:.6rem">
        ${a.ab&&a.ab!=='none'?html`<label class="chk"><input type="checkbox" checked=${a.prof!==false} onChange=${ev=>{const v=ev.target.checked;upd(()=>{a.prof=v})}}/><span>proficient</span></label>
          <label class="chk"><input type="checkbox" checked=${a.dab!==false} onChange=${ev=>{const v=ev.target.checked;upd(()=>{a.dab=v})}}/><span>Modifier zum Damage</span></label>`:null}
        <button class="btn s warn right" onClick=${()=>upd(()=>{s.atk=s.atk.filter(y=>y!==a)})}>Entfernen</button></div></div>`
      :html`<div class="row" key=${a.id}><div><span class="nm">${a.n||'Angriff'}</span>${a.note?html`<div class="meta">${a.note}</div>`:null}</div>
        <span class="hitb">${atkHit(s,a)!=null?html`<span>${sg(atkHit(s,a))}<small>to hit</small></span>`:null}${atkDmg(s,a)?html`<span class="dmg">${atkDmg(s,a)}<small>${a.ty||'damage'}</small></span>`:null}</span></div>`)}
    ${tracked.length?html`<h3 class="h3" style="margin-top:1.4rem">Begrenzte Fähigkeiten</h3>${tracked.map(f=>html`<div class="row" key=${f.id}><div><span class="nm">${f.n}</span> ${f.rest?html`<span class="tag">${REST[f.rest]}</span>`:null}</div>
      ${num(f.max)<=8?html`<${Pips} max=${num(f.max)} used=${num(f.used)} label=${f.n} on=${ro?null:v=>upd(()=>{f.used=v})}/>`:html`<span class="rowf"><${Counter} v=${num(f.max)-num(f.used)} min=${0} max=${num(f.max)} label=${f.n} on=${ro?null:v=>upd(()=>{f.used=num(f.max)-v})}/><span class="soft sm">von ${f.max}</span></span>`}</div>`)}`:null}
    <h3 class="h3" style="margin-top:1.4rem">Conditions</h3>
    <div class="chips" style="margin-top:.5rem">${CONDS.map(c=>html`<button key=${c[0]} class="chip" title=${c[1]} disabled=${ro} aria-pressed=${s.cond.includes(c[0])} onClick=${()=>upd(()=>{s.cond=s.cond.includes(c[0])?s.cond.filter(y=>y!==c[0]):s.cond.concat(c[0])})}>${c[0]}</button>`)}</div>
    ${s.cond.length?html`<ul class="sm" style="margin:.6rem 0 0;padding-left:1.1rem;max-width:66ch">${s.cond.map(n=>{const c=CONDS.find(y=>y[0]===n);return c?html`<li key=${n}><b>${n}:</b> ${c[1]}</li>`:null})}</ul>`:null}
    ${s.senses||s.langs||s.profs?html`<dl class="kv sm" style="margin-top:1.4rem">${s.senses?html`<dt>Senses</dt><dd>${s.senses}</dd>`:null}${s.langs?html`<dt>Languages</dt><dd>${s.langs}</dd>`:null}${s.profs?html`<dt>Proficiencies</dt><dd class="pre">${s.profs}</dd>`:null}</dl>`:null}`;

  const spells=()=>{
    const dc=spellDC(s),lv=[];for(let i=0;i<=9;i++){const l=s.spells.filter(x=>clamp(Math.round(num(x.l)),0,9)===i);if(l.length)lv.push([i,l])}
    return html`
    ${e?html`<div class="edit-card"><div class="fg">
        <${F} l="Spellcasting Ability"><select class="in" id="sp-ab" value=${s.cast.ab} onChange=${ev=>{const v=ev.target.value;upd(()=>{s.cast.ab=v})}}><option value="">keine</option>${AB.map(k=>html`<option value=${k}>${ABN[k]}</option>`)}</select><//>
        <${F} l="Slots nach Tabelle"><select class="in" id="sp-ct" value=${s.cast.type} onChange=${ev=>{const v=ev.target.value;upd(()=>{s.cast.type=v;if(v)s.cast.slots=slotsFor(v,s.lvl)})}}>${Object.keys(CASTER).map(k=>html`<option value=${k}>${CASTER[k]}</option>`)}</select><//>
      </div><span class="lbl" style="margin-top:.8rem">Spell Slots pro Level (1st bis 9th)</span>
      <div class="rowf">${s.cast.slots.map((m,i)=>html`<${In} key=${i} type="number" cls="tiny" min="0" lbl=${ORD[i+1]+' Slots'} v=${m} on=${v=>upd(()=>{s.cast.slots[i]=v===''?0:v})}/>`)}</div></div>`:null}
    ${dc!=null?html`<div class="vit three"><div class="stat"><small>Ability</small><b>${ABS[s.cast.ab]}</b></div><div class="stat"><small>Spell Save DC</small><b>${dc}</b></div><div class="stat"><small>Spell Attack</small><b>${sg(spellAtk(s))}</b></div></div>`:null}
    ${s.cast.slots.some(x=>num(x)>0)?html`<h3 class="h3">Spell Slots</h3>${s.cast.slots.map((m,i)=>num(m)>0?html`<div class="row" key=${i}><span>${ORD[i+1]}</span><${Pips} max=${num(m)} used=${Math.min(num(m),num(s.cast.used[i]))} label=${ORD[i+1]+' Slot'} kind="magic" on=${ro?null:v=>upd(()=>{s.cast.used[i]=v})}/></div>`:null)}<p class="sm soft" style="margin-top:.6rem">Jedes leuchtende Licht ist ein freier Slot.</p>`:null}
    <div class="rowf" style="margin-top:1.2rem"><h3 class="h3">Spells</h3>${e?html`<button class="btn s right" onClick=${()=>upd(()=>{s.spells.push({id:rid(),n:'',l:s.cast.slots.some(x=>num(x)>0)?1:0,prep:true,t:'Action',r:'',c:false,rit:false,d:''})})}><${Ic} n="plus"/>Spell</button>`:null}</div>
    ${!s.spells.length?html`<p class="empty">${e?'Noch kein Spell eingetragen.':'Keine Spells. Wenn dein Charakter zaubert, trag sie über Bearbeiten ein.'}</p>`:null}
    ${e?s.spells.map(x=>html`<div class="edit-card" key=${x.id}><div class="fg">
        <${F} l="Name"><${In} v=${x.n} on=${v=>upd(()=>{x.n=v})}/><//>
        <${F} l="Level (0 = Cantrip)"><${In} type="number" min="0" max="9" v=${x.l} on=${v=>upd(()=>{x.l=v})}/><//>
        <${F} l="Casting Time"><${In} v=${x.t} ph="Action" on=${v=>upd(()=>{x.t=v})}/><//>
        <${F} l="Range"><${In} v=${x.r} ph="60 ft" on=${v=>upd(()=>{x.r=v})}/><//>
        <${F} l="Beschreibung" wide=${true}><${Area} rows="2" v=${x.d} on=${v=>upd(()=>{x.d=v})}/><//>
      </div><div class="rowf" style="margin-top:.6rem">
        <label class="chk"><input type="checkbox" checked=${!!x.c} onChange=${ev=>{const v=ev.target.checked;upd(()=>{x.c=v})}}/><span>Concentration</span></label>
        <label class="chk"><input type="checkbox" checked=${!!x.rit} onChange=${ev=>{const v=ev.target.checked;upd(()=>{x.rit=v})}}/><span>Ritual</span></label>
        <button class="btn s warn right" onClick=${()=>upd(()=>{s.spells=s.spells.filter(y=>y!==x)})}>Entfernen</button></div></div>`)
      :lv.map(([i,l])=>html`<div key=${i}><span class="lbl" style="margin-top:1rem">${ORD[i]}</span>${l.map(x=>html`<div class="row" key=${x.id}><div>
          <span class="nm">${x.n||'Spell'}</span> ${x.t?html`<span class="tag">${x.t}</span>`:null} ${x.r?html`<span class="tag">${x.r}</span>`:null} ${x.c?html`<span class="tag">Concentration</span>`:null} ${x.rit?html`<span class="tag">Ritual</span>`:null}
          ${x.d?html`<div class="meta pre">${x.d}</div>`:null}</div>
        ${i>0?html`<label class="chk sm" title="Prepared"><input type="checkbox" disabled=${ro} checked=${x.prep!==false} onChange=${ev=>{const v=ev.target.checked;upd(()=>{x.prep=v})}}/><span>prepared</span></label>`:html`<span></span>`}</div>`)}</div>`)}`};

  const inv=()=>html`
    <span class="lbl">Münzen</span>
    <div class="rowf">${[['cp','CP'],['sp','SP'],['gp','GP'],['pp','PP']].map(([k,n])=>html`<label class="fl" key=${k} style="width:5.2rem"><span>${n}</span><${In} id=${'coin-'+k} type="number" min="0" dis=${ro} v=${s.coins[k]} on=${v=>upd(()=>{s.coins[k]=v})}/></label>`)}</div>
    <div class="rowf" style="margin-top:1.3rem"><h3 class="h3">Ausrüstung</h3>${ro?null:html`<button class="btn s right" onClick=${()=>upd(()=>{s.items.push({id:rid(),n:'',q:1,note:''})})}><${Ic} n="plus"/>Gegenstand</button>`}</div>
    ${!s.items.length?html`<p class="empty">Der Rucksack ist leer.</p>`:null}
    ${s.items.map(it=>ro?html`<div class="row" key=${it.id}><div><span class="nm">${it.n}</span>${it.note?html`<div class="meta">${it.note}</div>`:null}</div><span>${num(it.q)!==1?'× '+it.q:''}</span></div>`
      :html`<div class="row" key=${it.id}><div class="rowf"><span style="flex:2 1 9rem;min-width:0"><${In} v=${it.n} ph="Gegenstand" lbl="Gegenstand" on=${v=>upd(()=>{it.n=v})}/></span><span style="flex:3 1 9rem;min-width:0"><${In} v=${it.note} ph="Notiz" lbl="Notiz" on=${v=>upd(()=>{it.note=v})}/></span></div>
        <span class="rowf"><${Counter} v=${it.q} min=${0} label="Anzahl" on=${v=>upd(()=>{it.q=v})}/><button class="xbtn" aria-label=${(it.n||'Gegenstand')+' entfernen'} onClick=${()=>upd(()=>{s.items=s.items.filter(y=>y!==it)})}>×</button></span></div>`)}`;

  const feats=()=>html`
    <div class="rowf"><h3 class="h3">Features & Traits</h3>${e?html`<button class="btn s right" onClick=${()=>upd(()=>{s.feats.push({id:rid(),n:'',src:'',d:'',max:0,used:0,rest:''})})}><${Ic} n="plus"/>Feature</button>`:null}</div>
    ${!s.feats.length?html`<p class="empty">${e?'Noch kein Feature eingetragen.':'Noch keine Features. Trag sie über Bearbeiten ein.'}</p>`:null}
    ${s.feats.map(f=>e?html`<div class="edit-card" key=${f.id}><div class="fg">
        <${F} l="Name"><${In} v=${f.n} on=${v=>upd(()=>{f.n=v})}/><//>
        <${F} l="Quelle"><${In} v=${f.src} ph="Class, Race, Feat" on=${v=>upd(()=>{f.src=v})}/><//>
        <${F} l="Einsätze (0 = unbegrenzt)"><${In} type="number" min="0" v=${f.max} on=${v=>upd(()=>{f.max=v;f.used=Math.min(num(f.used),num(v))})}/><//>
        <${F} l="Kommt zurück bei"><select class="in" value=${f.rest||''} onChange=${ev=>{const v=ev.target.value;upd(()=>{f.rest=v})}}>${Object.keys(REST).map(k=>html`<option value=${k}>${REST[k]}</option>`)}</select><//>
        <${F} l="Beschreibung" wide=${true}><${Area} rows="2" v=${f.d} on=${v=>upd(()=>{f.d=v})}/><//>
      </div><div class="rowf" style="margin-top:.6rem"><button class="btn s warn right" onClick=${()=>upd(()=>{s.feats=s.feats.filter(y=>y!==f)})}>Entfernen</button></div></div>`
      :html`<div class="row" key=${f.id} style="grid-template-columns:1fr"><div><span class="nm">${f.n||'Feature'}</span> ${f.src?html`<span class="tag">${f.src}</span>`:null} ${num(f.max)>0?html`<span class="tag">${num(f.max)-num(f.used)} von ${f.max}</span>`:null}
        ${f.d?html`<div class="meta pre" style="max-width:70ch">${f.d}</div>`:null}</div></div>`)}`;

  const profil=()=>html`<div class="stack" style="max-width:46rem">
    ${ro?null:html`<p class="hint">Bild, Größe und Kurzbeschreibung sieht die ganze Gruppe. Persönlichkeit und Hintergrund sehen nur du und die Spielleitung.</p>`}
    <div class="fg">
      <${F} l="Größe"><${In} id="pf-size" dis=${ro} v=${s.size} ph="1,78 m, kräftig" on=${v=>upd(()=>{s.size=v})}/><//>
      <${F} l="Alter"><${In} id="pf-age" dis=${ro} v=${s.age} on=${v=>upd(()=>{s.age=v})}/><//>
      <${F} l="Kurzbeschreibung für die Gruppe" wide=${true}>${ro?html`<p class="pre">${s.look||'–'}</p>`:html`<${Area} id="pf-look" rows="3" v=${s.look} ph="Woran erkennt man deinen Charakter? Zwei, drei Sätze." on=${v=>upd(()=>{s.look=v})}/>`}<//>
    </div>
    ${[['traits','Personality Traits'],['ideals','Ideals'],['bonds','Bonds'],['flaws','Flaws'],['story','Hintergrundgeschichte']].map(([k,n])=>ro?(s[k]?html`<div key=${k}><span class="lbl">${n}</span><p class="pre">${s[k]}</p></div>`:null)
      :html`<${F} key=${k} l=${n}><${Area} id=${'pf-'+k} rows=${k==='story'?6:2} v=${s[k]} on=${v=>upd(()=>{s[k]=v})}/><//>`)}
    ${ro?null:html`<label class="chk"><input type="checkbox" checked=${s.shareHp!==false} onChange=${ev=>{const v=ev.target.checked;upd(()=>{s.shareHp=v})}}/><span>Meine Hit Points in der Gruppenansicht zeigen</span></label>
      <div class="rowf"><${FileBtn} label="Bild auswählen" icon="cam" onFile=${setPortrait}/>
        <${Confirm} label="Charakter löschen" cls="btn warn" ask="Der ganze Bogen wird gelöscht." onYes=${deleteSheet}/></div>`}</div>`;

  return html`
    <div class="sh-head">
      ${ro?html`<${Portrait} uid=${uid} name=${s.name}/>`:html`<${PortraitPick} uid=${uid} name=${s.name}/>`}
      <div class="sh-id"><h1 class="h1">${s.name||'Namenlos'}</h1><div class="idtags">${s.cls?html`<span class="tag big amber">${s.cls}${s.sub?' · '+s.sub:''}</span>`:html`<span class="tag big">Noch ohne Class</span>`}<span class="tag big violet">Level ${L}</span>${s.race?html`<span class="tag big sky">${s.race}</span>`:null}${s.bg?html`<span class="tag big">${s.bg}</span>`:null}</div></div>
      ${ro?null:html`<div class="sh-btns">
        <button class=${'btn'+(e?' solid':' prime')} aria-pressed=${e} onClick=${()=>ui({edit:!e})}><${Ic} n=${e?'check':'edit'}/>${e?'Fertig':'Bearbeiten'}</button>
        <button class="btn" onClick=${()=>setDlg('lvl')}>Level up</button><button class="btn" onClick=${()=>setDlg('rest')}>Rast</button></div>`}
    </div>
    ${basics}
    <div class="vit">
      <div class="stat ac"><small>Armor Class</small><b>${s.ac===''?'–':s.ac}</b><small>${s.acNote}</small></div>
      <div class="stat"><small>Initiative</small><b>${sg(initB(s))}</b></div>
      <div class="stat"><small>Speed</small><b>${s.speed||'–'}</b></div>
      <div class="stat"><small>Prof. Bonus</small><b>${sg(pb(s))}</b></div>
      <div class="stat"><small>Passive Perception</small><b>${passive(s)}</b></div>
      <div class="stat hd"><small>Hit Dice · d${s.hd}</small>${ro?html`<b>${Math.max(0,L-num(s.hdUsed))}</b>`:html`<${Counter} v=${Math.max(0,L-num(s.hdUsed))} min=${0} max=${L} label="Hit Dice" on=${v=>upd(()=>{s.hdUsed=L-v})}/>`}<small>von ${L}</small></div>
      <${ro?'div':'button'} class=${'stat'+(s.insp?' on':'')} aria-pressed=${ro?null:!!s.insp} onClick=${ro?null:()=>upd(()=>{s.insp=!s.insp})}><small>Inspiration</small><b>${s.insp?'Ja':'–'}</b><//>
    </div>
    <div class="cols">
      <div class="stack">
        <div class="box hp"><span class="lbl">Hit Points</span>
          <div class="hp-nums"><span class="hp-cur">${hp}</span><span class="hp-max">/ ${s.hpMax}</span>${num(s.tmp)?html`<span class="hp-temp">+${s.tmp} temp</span>`:null}</div>
          <div class=${'bar'+(hp===0?' out':pct<=50?' low':'')}><i style=${'width:'+pct+'%'}></i></div>
          ${ro?null:html`<${HpCtl} set=${set}/>`}
          ${hp===0?html`<div style="margin-top:.8rem;padding-top:.7rem;border-top:1px solid var(--rule)"><span class="lbl">Death Saves</span>
            <div class="ds-row"><span>Erfolge</span><${Pips} max=${3} used=${s.ds[0]} kind="ok" label="Erfolg" on=${ro?null:v=>upd(()=>{s.ds[0]=v})}/></div>
            <div class="ds-row"><span>Fehlschläge</span><${Pips} max=${3} used=${s.ds[1]} kind="bad" label="Fehlschlag" on=${ro?null:v=>upd(()=>{s.ds[1]=v})}/></div></div>`:null}
        </div>
        <div class="abils">${AB.map(a=>html`<div class=${'abil'+(s.saves.includes(a)?' prof':'')} key=${a}><span class="n">${ABN[a]}</span><span class="m">${sg(mod(s.ab[a]))}</span>
          ${e?html`<${In} id=${'ab-'+a} type="number" cls="tiny" lbl=${ABN[a]+' Score'} v=${s.ab[a]} on=${v=>upd(()=>{s.ab[a]=v})}/>`:html`<span class="s">${s.ab[a]}</span>`}
          <${T} class="sv" title=${e?'Saving Throw Proficiency umschalten':null} onClick=${e?()=>upd(()=>{s.saves=s.saves.includes(a)?s.saves.filter(y=>y!==a):s.saves.concat(a)}):null}><span class=${'dot'+(s.saves.includes(a)?' p':'')}></span>Save ${sg(saveB(s,a))}<//></div>`)}</div>
      </div>
      <div><span class="lbl">Skills</span>
        ${e?html`<p class="sm soft">Antippen: einmal für proficient, zweimal für Expertise.</p>`:null}
        <div class="sklist">${SK.map(([n,a])=>{const l=s.skills[n]||0;return html`<${T} key=${n} class="sk" onClick=${e?()=>upd(()=>{const v=(l+1)%3;if(v)s.skills[n]=v;else delete s.skills[n]}):null}>
          <span class=${'dot'+(l===1?' p':l===2?' e':'')}></span><span>${n}</span><span class="ab">${ABS[a]}</span><b>${sg(skillB(s,n,a))}</b><//>`})}</div>
      </div>
    </div>
    <div class="subtabs" role="tablist">${[['kampf','Kampf'],['spells','Spells'],['inv','Inventar'],['feats','Features'],['profil','Profil']].map(t=>html`<button key=${t[0]} role="tab" aria-selected=${sub===t[0]} aria-current=${sub===t[0]?'true':null} onClick=${()=>pick(t[0])}>${t[1]}</button>`)}</div>
    ${sub==='spells'?spells():sub==='inv'?inv():sub==='feats'?feats():sub==='profil'?profil():kampf()}
    ${dlg==='lvl'?html`<${LevelUp} s=${s} set=${set} close=${()=>setDlg('')}/>`:null}
    ${dlg==='rest'?html`<${RestDlg} s=${s} set=${set} close=${()=>setDlg('')}/>`:null}`}

function SheetTab(){
  if(!S.sheet)return html`<${NewChar}/>`;
  return html`<${Sheet} s=${S.sheet} uid=${S.uid} edit=${S.ui.edit} set=${touchSheet}/>`}

/* ================= group ================= */
function PCard({uid}){
  const c=S.chars[uid],me=uid===S.uid,hpMax=Math.max(1,num(c.hpMax)),pct=clamp(num(c.hp)/hpMax*100,0,100);
  return html`<article class=${'pcard'+(me?' me':'')}>
    <${Portrait} uid=${uid} name=${c.name} cls="lg"/>
    <div class="body">
      <div class="rowf"><h3 class="grow">${c.name}</h3>${me?html`<span class="tag you">Du</span>`:null}</div>
      <div class="soft">${clsLine(c)}</div>
      ${c.size?html`<div class="sm"><span class="soft">Größe:</span> ${c.size}</div>`:null}
      ${c.look?html`<p class="sm pre" style="margin:.2rem 0 0">${c.look}</p>`:null}
      ${c.shareHp&&c.hpMax!=null?html`<div><div class=${'bar'+(num(c.hp)===0?' out':pct<=50?' low':'')}><i style=${'width:'+pct+'%'}></i></div><span class="sm soft">HP ${c.hp} / ${c.hpMax}${num(c.tmp)?' (+'+c.tmp+' temp)':''}</span></div>`:null}
      ${c.cond&&c.cond.length?html`<div class="chips">${c.cond.map(n=>html`<span class="tag bad" key=${n}>${n}</span>`)}</div>`:null}
      <${Who} uid=${uid}/>
    </div></article>`}
function OrderList(){
  const cb=S.combat;if(!cb||!cb.on||!cb.order||!cb.order.length)return null;
  return html`<section style="margin-bottom:1.4rem;max-width:30rem"><h2 class="h2" style="margin-top:0">Kampfreihenfolge · Runde ${cb.round}</h2>
    <ol class="order">${cb.order.map((o,i)=>html`<li key=${o.id} class=${i===cb.turn?'cur':''}><span class="i">${o.i}</span><span class="grow">${o.n}</span>${o.uid===S.uid?html`<span class="tag you">Du</span>`:o.uid?html`<span class="tag">Held</span>`:null}</li>`)}</ol></section>`}
function PartyTab(){
  const c=campOf(),ids=Object.keys(S.chars),have=ids.filter(id=>S.chars[id].name).sort((a,b)=>S.chars[a].name.localeCompare(S.chars[b].name)),none=ids.filter(id=>!S.chars[id].name);
  return html`<h1 class="h1">Die Gruppe</h1>
    <p class="lead">${c.next?html`Nächste Session: <b>${fmtDate(c.next)}</b>${c.nextNote?' · '+c.nextNote:''}`:'Wer mit dir unterwegs ist. Die kleine Laterne leuchtet, wenn jemand gerade im Kampagnenbuch ist.'}</p>
    <${OrderList}/>
    ${have.length?html`<div class="pcards">${have.map(id=>html`<${PCard} key=${id} uid=${id}/>`)}</div>`
      :html`<p class="empty">Noch hat niemand einen Charakter angelegt. Sobald jemand im Bogen seinen Helden baut, erscheint er hier mit Bild, Class, Größe und Kurzbeschreibung.</p>`}
    ${none.length?html`<p class="soft sm" style="margin-top:1.2rem">Schon da, aber noch ohne Charakter: ${none.map(nameOf).join(', ')}</p>`:null}`}

/* ================= notes ================= */
function MyNotes(){
  const n=S.notes,[pid,setPid]=useState(n.pages[0].id),p=n.pages.find(x=>x.id===pid)||n.pages[0];
  return html`<div class="chips">${n.pages.map(x=>html`<button key=${x.id} class="chip" aria-pressed=${x.id===p.id} onClick=${()=>setPid(x.id)}>${x.t||'Ohne Titel'}</button>`)}
      <button class="chip" onClick=${()=>{const id=rid();touchNotes(y=>{y.pages.push({id,t:'Neue Seite',b:''})});setPid(id)}}>+ Seite</button></div>
    <div class="rowf" style="margin:.9rem 0 .5rem;align-items:flex-end"><label class="fl grow" style="max-width:24rem"><span>Titel</span><${In} id="note-title" v=${p.t} on=${v=>touchNotes(()=>{p.t=v})}/></label>
      ${n.pages.length>1?html`<${Confirm} label="Seite löschen" onYes=${()=>{touchNotes(y=>{y.pages=y.pages.filter(x=>x.id!==p.id)});setPid(n.pages[0].id)}}/>`:null}</div>
    <textarea class="in" id="note-body" style="min-height:22rem" aria-label="Notizen" placeholder="Namen, Hinweise, Verdächtigungen, offene Rechnungen …" value=${p.b} onInput=${e=>{const v=e.target.value;touchNotes(()=>{p.b=v})}}/>
    <p class="sm soft" style="margin-top:.5rem">Diesen Zettel siehst nur du, auch die Spielleitung nicht. Er speichert sich von selbst.</p>`}
function Board(){
  const [t,setT]=useState(''),list=S.board.slice().sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,80);
  const add=e=>{e.preventDefault();const v=t.trim();if(!v)return;setT('');S.db.collection('board').add({t:v.slice(0,600),by:S.uid,at:Date.now()}).catch(oops('Das Anheften'))};
  return html`<p class="lead">Für alles, was die ganze Gruppe wissen soll: Pläne, Beute, wer wem noch Gold schuldet. Jeder kann etwas anheften.</p>
    <form class="rowf" style="max-width:46rem;align-items:flex-start" onSubmit=${add}><span class="grow"><${Area} id="board-new" rows="2" v=${t} on=${setT} ph="Neue Notiz für alle" lbl="Neue Notiz für alle"/></span><button class="btn solid" type="submit" disabled=${!t.trim()}>Anheften</button></form>
    <div style="max-width:46rem;margin-top:.6rem">${list.length?list.map(b=>html`<div class="board-item" key=${b.id}><p class="pre" style="margin:0">${b.t}</p>
        ${b.by===S.uid||S.isGM?html`<button class="xbtn" aria-label="Notiz entfernen" onClick=${()=>S.db.doc('board/'+b.id).delete().catch(oops('Das Entfernen'))}>×</button>`:html`<span></span>`}
        <span class="sm soft">${charName(b.by)} · ${fmtDate(b.at)}</span></div>`):html`<p class="empty">Die Pinnwand ist leer.</p>`}</div>`}
function Cheat(){
  return html`<div class="sheetcheat">
    <p class="lead">Das Wichtigste auf einen Blick. Im Zweifel entscheidet die Spielleitung, und nach der Session schlagt ihr nach.</p>
    <h3 class="h3">In deinem Zug</h3><ul>
      <li><b>Movement:</b> bis zu deiner Speed bewegen. Du kannst die Bewegung vor und nach deiner Action aufteilen.</li>
      <li><b>Eine Action:</b> Attack, Cast a Spell, Dash (doppelte Bewegung), Disengage (keine Opportunity Attacks gegen dich), Dodge (Angriffe gegen dich haben Disadvantage), Help (ein Verbündeter bekommt Advantage), Hide, Ready (auf einen Auslöser warten), Search oder Use an Object.</li>
      <li><b>Eine Bonus Action:</b> nur wenn ein Feature oder Spell ausdrücklich eine verlangt.</li>
      <li><b>Eine Reaction pro Runde:</b> zum Beispiel eine Opportunity Attack, wenn ein Gegner deine Reichweite verlässt.</li>
      <li><b>Eine Kleinigkeit nebenbei:</b> Tür öffnen, Waffe ziehen, etwas zurufen.</li></ul>
    <h3 class="h3">Würfeln</h3><ul>
      <li><b>Ability Check, Attack Roll, Saving Throw:</b> d20 plus den Bonus aus deinem Bogen. Du schaffst es, wenn du die DC oder die Armor Class erreichst oder übertriffst.</li>
      <li><b>Advantage:</b> zwei d20, der höhere zählt. <b>Disadvantage:</b> der niedrigere zählt.</li>
      <li><b>Natural 20 beim Angriff:</b> Critical Hit, alle Schadenswürfel doppelt würfeln. <b>Natural 1:</b> daneben.</li>
      <li><b>Inspiration:</b> einmal einsetzen für Advantage auf einen Wurf.</li></ul>
    <h3 class="h3">0 Hit Points</h3><ul>
      <li>Du bist bewusstlos. Zu Beginn deines Zugs würfelst du einen Death Save: 10 oder mehr ist ein Erfolg, weniger ein Fehlschlag.</li>
      <li>Drei Erfolge: stabil. Drei Fehlschläge: tot. Natural 20: du stehst mit 1 HP wieder auf. Natural 1: zwei Fehlschläge.</li>
      <li>Jede Heilung bringt dich sofort zurück.</li>
      <li><b>Temp HP</b> werden zuerst abgezogen und addieren sich nicht: der höhere Wert gilt.</li></ul>
    <h3 class="h3">Rasten</h3><ul>
      <li><b>Short Rest</b> (eine Stunde): Hit Dice ausgeben. Jeder heilt den Wurf plus deinen CON Modifier. Manche Features kommen zurück.</li>
      <li><b>Long Rest</b> (acht Stunden): alle Hit Points und Spell Slots, dazu die Hälfte deiner Hit Dice.</li></ul>
    <h3 class="h3">Zaubern</h3><ul>
      <li><b>Cantrips</b> kosten nichts. Jeder andere Spell verbraucht einen Spell Slot seines Levels oder höher.</li>
      <li><b>Concentration:</b> immer nur ein solcher Spell gleichzeitig. Nimmst du Schaden, würfelst du einen CON Save gegen DC 10 oder den halben Schaden, je nachdem, was höher ist.</li>
      <li><b>Spell Save DC</b> ist 8 + Proficiency Bonus + dein Zauber-Modifier. Steht im Bogen unter Spells.</li></ul>
    <h3 class="h3">Conditions</h3><ul>${CONDS.map(c=>html`<li key=${c[0]}><b>${c[0]}:</b> ${c[1]}</li>`)}</ul></div>`}
function NotesTab(){
  const v=S.ui.note;
  return html`<h1 class="h1">Notizen</h1>
    <div class="subtabs" role="tablist">${[['mine','Mein Zettel'],['board','Pinnwand'],['rules','Spickzettel']].map(t=>html`<button key=${t[0]} role="tab" aria-selected=${v===t[0]} aria-current=${v===t[0]?'true':null} onClick=${()=>ui({note:t[0]})}>${t[1]}</button>`)}</div>
    ${v==='board'?html`<${Board}/>`:v==='rules'?html`<${Cheat}/>`:html`<${MyNotes}/>`}`}

/* ================= chronicle ================= */
const KINDS={journal:'Tagebuch',handout:'Handouts',npc:'Gesichter',quest:'Aufträge'};
const KIND1={journal:'Tagebucheintrag',handout:'Handout',npc:'Gesicht',quest:'Auftrag',note:'Nachricht'};
const QST={open:'offen',done:'erledigt',failed:'gescheitert'};
function resolveItem(it){ // sealed entries open for everyone once somebody has entered the password
  if(!it.lock)return it;
  const kb=lockKey(it.id,it.lock);if(!kb)return Object.assign({},it,{sealed:true});
  return Object.assign({},it,opened(it.lock,kb)||{},{id:it.id,kb,was:true})}
function Sealed({it}){
  return html`<div class="sealed"><h3 class="h3"><${Ic} n="lock"/>${it.title||'Versiegelt'}</h3>
    <p class="soft" style="margin:.3rem 0 .7rem">${it.hint||'Dieser Eintrag öffnet sich mit einem Passwort.'}</p><${PwBox}/></div>`}
function PrivItem({it}){
  const [open,setOpen]=useState(false);
  const tog=()=>{const o=!open;setOpen(o);if(o&&!it.read)S.db.doc('inbox/'+S.uid+'/items/'+it.id).update({read:true}).catch(()=>{})};
  return html`<div class="priv"><button aria-expanded=${open} onClick=${tog}><${Ic} n="eye"/><span class="grow">${it.title||'Nachricht'}</span>${!it.read?html`<span class="tag new">Neu</span>`:null}</button>
    ${open?html`<div class="in-body">${it.sub?html`<p class="soft"><i>${it.sub}</i></p>`:null}<p class="pre">${it.body}</p><${Pic} path=${'inbox/'+S.uid+'/items/'+it.id+'/media/img'} v=${it.img} alt=${it.title}/></div>`:null}</div>`}
function ChronTab(){
  const seen=useRef(null);
  if(seen.current==null)seen.current=LS.get('seen',0);
  useEffect(()=>{LS.set('seen',Date.now());emit()},[S.items.length]);
  const k=KINDS[S.ui.chron]?S.ui.chron:'journal',isNew=it=>(it.pub||0)>seen.current;
  const all=S.items.map(resolveItem),of=x=>all.filter(i=>i.kind===x);
  const anyLock=S.items.some(i=>i.lock&&!lockKey(i.id,i.lock))||S.maps.some(m=>(m.locks||[]).some(l=>!lockKey(l.id,l.chk)));
  const inbox=S.inbox.slice().sort((a,b)=>(b.pub||b.at||0)-(a.pub||a.at||0));
  const list=of(k),tagNew=it=>isNew(it)?html` <span class="tag new">Neu</span>`:null,opn=it=>it.was?html` <span class="tag ok">geöffnet</span>`:null;
  let body;
  if(!list.length)body=html`<p class="empty">${k==='journal'?'Noch kein Eintrag. Nach jeder Session schreibt die Spielleitung hier auf, was geschehen ist.':k==='handout'?'Noch keine Handouts. Briefe, Rätsel und Fundstücke landen hier, sobald ihr sie findet.':k==='npc'?'Noch keine bekannten Gesichter. Wen ihr trefft, den findet ihr hier wieder.':'Noch keine Aufträge. Offene Spuren und Versprechen sammeln sich hier.'}</p>`;
  else if(k==='journal')body=list.sort((a,b)=>(b.at||0)-(a.at||0)).map(it=>it.sealed?html`<${Sealed} key=${it.id} it=${it}/>`:html`<article class="entry" key=${it.id}>
      <h2>${it.title}${tagNew(it)}${opn(it)}</h2>${it.sub?html`<p class="sub">${it.sub}</p>`:null}<${Pic} path=${'items/'+it.id+'/media/img'} v=${it.img} kb=${it.kb} alt=${it.title}/><p class="pre">${it.body}</p></article>`);
  else if(k==='handout')body=html`<div class="handouts">${list.sort((a,b)=>(b.pub||0)-(a.pub||0)).map(it=>it.sealed?html`<${Sealed} key=${it.id} it=${it}/>`:html`<div class="handout" key=${it.id}>
      <h3>${it.title}${tagNew(it)}${opn(it)}</h3><${Pic} path=${'items/'+it.id+'/media/img'} v=${it.img} kb=${it.kb} alt=${it.title}/>${it.body?html`<p class="txt pre">${it.body}</p>`:null}${it.sub?html`<p class="sm soft" style="margin:.5rem 0 0">${it.sub}</p>`:null}</div>`)}</div>`;
  else if(k==='npc')body=html`<div class="npcs">${list.sort((a,b)=>String(a.title).localeCompare(String(b.title))).map(it=>it.sealed?html`<${Sealed} key=${it.id} it=${it}/>`:html`<div class="npc" key=${it.id}>
      <${Pic} path=${'items/'+it.id+'/media/img'} v=${it.img} kb=${it.kb} alt=${it.title}/><h3 class="h3">${it.title}${tagNew(it)}</h3>${it.sub?html`<p class="soft sm" style="margin:.1rem 0 .4rem"><i>${it.sub}</i></p>`:null}<p class="pre sm" style="margin:0">${it.body}</p></div>`)}</div>`;
  else body=list.sort((a,b)=>((a.status||'open')==='open'?0:1)-((b.status||'open')==='open'?0:1)||(b.at||0)-(a.at||0)).map(it=>it.sealed?html`<${Sealed} key=${it.id} it=${it}/>`:html`<article class="entry" key=${it.id}>
      <h2 style="font-size:1.35rem">${it.title} <span class=${'tag'+(it.status==='done'?' ok':it.status==='failed'?' bad':'')}>${QST[it.status]||QST.open}</span>${tagNew(it)}</h2>${it.sub?html`<p class="sub">${it.sub}</p>`:null}<${Pic} path=${'items/'+it.id+'/media/img'} v=${it.img} kb=${it.kb} alt=${it.title}/><p class="pre">${it.body}</p></article>`);
  return html`<h1 class="h1">Chronik</h1>
    <p class="lead">Was geschehen ist, was ihr gefunden habt und wen ihr kennt. Die Spielleitung gibt Einträge frei, manche öffnen sich erst mit einem Passwort.</p>
    ${inbox.length?html`<section style="margin-bottom:1.2rem"><h2 class="h2" style="margin-top:0">Nur für dich</h2>${inbox.map(it=>html`<${PrivItem} key=${it.id} it=${it}/>`)}</section>`:null}
    ${anyLock?html`<div class="box plain" style="max-width:34rem"><span class="lbl">Passwort gefunden?</span><${PwBox}/><p class="sm soft" style="margin:.5rem 0 0">Ein richtiges Passwort öffnet den Eintrag oder das Kartengebiet für die ganze Gruppe.</p></div>`:null}
    <div class="subtabs" role="tablist">${Object.keys(KINDS).map(x=>html`<button key=${x} role="tab" aria-selected=${k===x} aria-current=${k===x?'true':null} onClick=${()=>ui({chron:x})}>${KINDS[x]}${of(x).length?html`<span class="tag">${of(x).length}</span>`:null}</button>`)}</div>
    ${body}`}

/* ================= map: geometry and fog ================= */
const cellRect=(i,g)=>{const c=i%g.cols,r=Math.floor(i/g.cols),x=Math.round(c*g.w/g.cols),y=Math.round(r*g.h/g.rows);return {x,y,w:Math.round((c+1)*g.w/g.cols)-x,h:Math.round((r+1)*g.h/g.rows)-y}};
const cellAt=(px,py,g)=>clamp(Math.floor(py*g.rows),0,g.rows-1)*g.cols+clamp(Math.floor(px*g.cols),0,g.cols-1);
function bbox(cells,g){let x0=1e9,y0=1e9,x1=0,y1=0;cells.forEach(i=>{const q=cellRect(i,g);x0=Math.min(x0,q.x);y0=Math.min(y0,q.y);x1=Math.max(x1,q.x+q.w);y1=Math.max(y1,q.y+q.h)});return {x:x0,y:y0,w:x1-x0,h:y1-y0}}
function centroid(cells,g){let sx=0,sy=0;cells.forEach(i=>{const q=cellRect(i,g);sx+=q.x+q.w/2;sy+=q.y+q.h/2});return {x:sx/cells.length/g.w,y:sy/cells.length/g.h}}
function seeded(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const FOG='#CFC9B8';
function paintFog(x,cells,g){ // soft edges reach a little into open land; hidden cells end up completely covered
  const R=Math.max(g.w/g.cols,g.h/g.rows);
  cells.forEach(i=>{const q=cellRect(i,g),r=seeded(i*7919+13);for(let k=0;k<3;k++){
    const px=q.x+(0.15+r()*0.7)*q.w,py=q.y+(0.15+r()*0.7)*q.h,rad=R*(0.55+r()*0.25),gr=x.createRadialGradient(px,py,rad*0.45,px,py,rad);
    gr.addColorStop(0,'rgba(207,201,184,.95)');gr.addColorStop(1,'rgba(207,201,184,0)');x.fillStyle=gr;x.beginPath();x.arc(px,py,rad,0,Math.PI*2);x.fill()}});
  x.fillStyle=FOG;cells.forEach(i=>{const q=cellRect(i,g);x.fillRect(q.x,q.y,q.w,q.h)});
  x.save();x.beginPath();cells.forEach(i=>{const q=cellRect(i,g);x.rect(q.x,q.y,q.w,q.h)});x.clip();
  cells.forEach(i=>{const q=cellRect(i,g),r=seeded(i*31+3);for(let k=0;k<2;k++){ // mist: broad, soft patches of light and shade
    const px=q.x+r()*q.w,py=q.y+r()*q.h,rad=R*(0.7+r()*0.7),gr=x.createRadialGradient(px,py,0,px,py,rad),c=k?'88,78,98':'255,255,255';
    gr.addColorStop(0,'rgba('+c+','+(k?.15:.3)+')');gr.addColorStop(1,'rgba('+c+',0)');x.fillStyle=gr;x.beginPath();x.arc(px,py,rad,0,Math.PI*2);x.fill()}});
  x.restore()}
function hash(str){let h=5381;for(let i=0;i<str.length;i++)h=(h*33^str.charCodeAt(i))>>>0;return h.toString(36)}
const mapSig=g=>hash(JSON.stringify([g.name,g.iv,g.cols,g.rows,g.hidden.slice().sort((a,b)=>a-b),g.pins,g.regions.map(r=>[r.id,r.name,r.pw,r.hint,r.cells])]));
const STARTER={name:'Hollowmere & Thereabouts',cols:16,open:[[0,2,0,5],[3,3,0,10],[4,4,0,12],[5,5,0,11],[6,6,0,9],[7,7,0,8]],here:{x:0.555,y:0.515}};

/* ================= map: what players see ================= */
function MapStage({m}){
  const cv=useRef(null),lay=useRef(null),[img,setImg]=useState(null),[more,setMore]=useState({}),[zoom,setZoom]=useState(1),[sel,setSel]=useState(''),[lk,setLk]=useState(''),[pingOn,setPingOn]=useState(false);
  const locks=m.locks||[],keys=locks.map(l=>lockKey(l.id,l.chk)),sig=locks.map((l,i)=>l.id+':'+l.v+':'+(keys[i]?1:0)).join('|');
  useEffect(()=>{let live=true;setImg(null);loadMapImage(m).then(i=>{if(live)setImg(i)},()=>{if(live)setImg(false)});return()=>{live=false}},[m.id,m.v]);
  useEffect(()=>{
    if(!img||!cv.current)return;let live=true;const c=cv.current;c.width=m.w;c.height=m.h;const x=c.getContext('2d');x.drawImage(img,0,0,m.w,m.h);
    setMore({});
    locks.forEach((l,i)=>{if(!keys[i])return;loadLockCrop(m,l,keys[i]).then(o=>{if(!live)return;const ci=o.img,s=ci.naturalWidth/l.w;
      l.cells.forEach(k=>{const q=cellRect(k,m);x.drawImage(ci,(q.x-l.x)*s,(q.y-l.y)*s,q.w*s,q.h*s,q.x,q.y,q.w,q.h)});
      if(o.pins.length)setMore(v=>Object.assign({},v,{[l.id]:o.pins}))},()=>{})});
    return()=>{live=false}},[img,sig]);
  const click=e=>{if(!pingOn||!lay.current)return;const r=lay.current.getBoundingClientRect();sendPing(m.id,clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1));setPingOn(false)};
  const pins=(m.pins||[]).concat(...Object.keys(more).map(k=>more[k])),pin=pins.find(p=>p.id===sel),lock=locks.find((l,i)=>l.id===lk&&!keys[i]);
  const pos=p=>'left:'+(p.x*100)+'%;top:'+(p.y*100)+'%';
  return html`<div class="map-layout"><div style="min-width:0">
      <div class="maptools"><span class="seg" role="group" aria-label="Zoom">${[1,1.6,2.4].map(z=>html`<button key=${z} aria-pressed=${zoom===z} onClick=${()=>setZoom(z)}>${Math.round(z*100)} %</button>`)}</span>
        ${S.room?html`<button class=${'btn s'+(pingOn?' flame':'')} aria-pressed=${pingOn} onClick=${()=>setPingOn(!pingOn)}><${Ic} n="pin"/>${pingOn?'Jetzt auf die Stelle tippen':'Auf der Karte zeigen'}</button>`:null}</div>
      <div class="mapscroll"><div ref=${lay} class=${'maplayer'+(img?'':' wait')} style=${'width:'+(zoom*100)+'%'+(pingOn?';cursor:crosshair':'')} onClick=${click}>
        ${img===false?'Die Karte konnte nicht geladen werden. Lade die Seite neu.':!img?'Die Karte wird entrollt …':null}
        <canvas ref=${cv} hidden=${!img} role="img" aria-label=${'Karte: '+(m.name||'')}></canvas>
        ${img?html`${m.here?html`<span class="here" style=${pos(m.here)} title="Hier ist die Gruppe"></span>`:null}
          ${locks.map((l,i)=>keys[i]||!l.cells.length?null:html`<button key=${l.id} class="lockb" style=${pos(centroid(l.cells,m))} onClick=${e=>{e.stopPropagation();setLk(l.id);setSel('')}}><${Ic} n="lock"/><span>${l.name||'Verschlossen'}</span></button>`)}
          ${pins.map((p,i)=>html`<button key=${p.id} class=${'pin'+(sel===p.id?' sel':'')} style=${pos(p)} aria-label=${p.t||'Ort '+(i+1)} onClick=${e=>{if(pingOn)return;e.stopPropagation();setSel(p.id);setLk('')}}>${i+1}</button>`)}
          ${S.pings.filter(p=>p.m===m.id).map(p=>html`<span key=${p.id} class="ping" style=${pos(p)}><span>${p.uid===S.uid?'Du':charName(p.uid)}</span></span>`)}`:null}
      </div></div></div>
    <aside>
      ${lock?html`<div class="sealed" style="margin-top:0"><h3 class="h3"><${Ic} n="lock"/>${lock.name||'Verschlossenes Gebiet'}</h3><p class="soft" style="margin:.3rem 0 .7rem">${lock.hint||'Dieses Gebiet öffnet sich mit einem Passwort.'}</p><${PwBox}/></div>`
        :pin?html`<div class="place"><h2 class="h2" style="margin-top:0">${pin.t||'Ort'}</h2><p class="pre">${pin.d||''}</p></div>`
        :html`<p class="soft">${pins.length?'Tippe auf eine Nummer, um mehr über den Ort zu erfahren.':'Was im Nebel liegt, habt ihr noch nicht entdeckt.'}${m.here?' Der pulsierende Ring zeigt, wo die Gruppe gerade ist.':''}</p>`}
      ${pins.length?html`<div class="chips" style="margin-top:1rem">${pins.map((p,i)=>html`<button key=${p.id} class="chip" aria-pressed=${sel===p.id} onClick=${()=>{setSel(p.id);setLk('')}}>${i+1}. ${p.t||'Ort'}</button>`)}</div>`:null}
    </aside></div>`}
function MapTab(){
  if(S.isGM&&S.ui.mapEdit)return html`<${MapEditor}/>`;
  const maps=S.maps.slice().sort((a,b)=>(a.order||0)-(b.order||0)),cur=maps.find(m=>m.id===S.ui.map)||maps.find(m=>m.id===campOf().map)||maps[0];
  return html`<div class="rowf"><h1 class="h1">Karte</h1>${S.isGM?html`<button class="btn right" onClick=${()=>ui({mapEdit:true})}><${Ic} n="edit"/>Karten bearbeiten</button>`:null}</div>
    ${!cur?html`<p class="empty">${S.isGM?'Du hast noch keine Karte ausgegeben. Über „Karten bearbeiten“ lädst du eine hoch, deckst auf, was die Gruppe kennt, und gibst sie aus.':'Noch hat die Spielleitung keine Karte ausgegeben.'}</p>`:html`
      <p class="lead">Die Karte wächst mit euren Reisen. Was im Nebel liegt, deckt die Spielleitung auf, oder ihr öffnet es mit einem Passwort.</p>
      ${maps.length>1?html`<div class="chips" style="margin-bottom:.4rem">${maps.map(m=>html`<button key=${m.id} class="chip" aria-pressed=${m.id===cur.id} onClick=${()=>ui({map:m.id})}>${m.name||'Karte'}</button>`)}</div>`:null}
      <${MapStage} key=${cur.id} m=${cur}/>`}`}

/* ================= map: game master ================= */
function loadGmMaster(g){return cachedImg('g:'+g.id+'@'+g.iv,async()=>{const d=await getChunks(S.db.collection('gm/store/maps/'+g.id+'/img'),g.n,g.iv);if(!d)throw new Error('Kartenbild fehlt');return loadImg(d)})}
async function gmNewMap(blob,name,preset){
  const img=await fileToImg(blob),j=jpegUnder(fitCanvas(img,2000,2000),1250000,0.86),fin=await loadImg(j.d);
  const id=rid(),iv=Date.now(),w=fin.naturalWidth,h=fin.naturalHeight,cols=(preset&&preset.cols)||(w>=h?16:12),rows=Math.max(1,Math.round(cols*h/w));
  const open=new Set();if(preset)preset.open.forEach(([r0,r1,c0,c1])=>{for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)if(r<rows&&c<cols)open.add(r*cols+c)});
  const hidden=[];for(let i=0;i<cols*rows;i++)if(!open.has(i))hidden.push(i);
  const n=await putChunks(S.db.collection('gm/store/maps/'+id+'/img'),j.d,iv);
  await S.db.doc('gm/store/maps/'+id).set({name:name||'Neue Karte',order:Date.now(),w,h,cols,rows,n,iv,hidden,pins:[],regions:[],here:(preset&&preset.here)||null,pubV:0,pubSig:''});
  imgCache.set('g:'+id+'@'+iv,Promise.resolve(fin));return id}
async function gmPublishMap(g){ // renders the players' copy with the fog painted in, then the sealed pieces for password areas
  const db=S.db,img=await loadGmMaster(g),c=mkCanvas(g.w,g.h),x=c.getContext('2d');
  x.drawImage(img,0,0,g.w,g.h);
  const hid=new Set(g.hidden);g.regions.forEach(r=>r.cells.forEach(i=>hid.add(i)));
  paintFog(x,Array.from(hid),g);
  const v=Date.now(),old=S.maps.find(m=>m.id===g.id),n=await putChunks(db.collection('maps/'+g.id+'/img'),jpegUnder(c,1250000,0.84).d,v),locks=[];
  for(const r of g.regions){
    if(!r.cells.length||!normPw(r.pw))continue;
    const key=pwKey(S.camp.salt,r.pw),bb=bbox(r.cells,g),cc=mkCanvas(bb.w,bb.h),cx=cc.getContext('2d');
    cx.fillStyle=FOG;cx.fillRect(0,0,bb.w,bb.h);
    r.cells.forEach(i=>{const q=cellRect(i,g);cx.drawImage(img,q.x,q.y,q.w,q.h,q.x-bb.x,q.y-bb.y,q.w,q.h)});
    const inside=g.pins.filter(p=>p.on!==false&&r.cells.includes(cellAt(p.x,p.y,g))).map(p=>({id:p.id,x:p.x,y:p.y,t:String(p.t||'').slice(0,200),d:String(p.d||'').slice(0,3000)}));
    await db.doc('maps/'+g.id+'/lockimg/'+r.id).set({box:seal({d:jpegUnder(cc,140000,0.84).d,pins:inside},key)});
    const was=old&&(old.locks||[]).find(l=>l.id===r.id);
    if(was&&!unseal(was.chk,key))await db.doc('unlocks/'+r.id).delete();
    locks.push({id:r.id,name:r.name||'',hint:r.hint||'',cells:r.cells,x:bb.x,y:bb.y,w:bb.w,h:bb.h,v,chk:seal({ok:1},key)})}
  if(old)for(const l of (old.locks||[]))if(!locks.find(k=>k.id===l.id)){await db.doc('maps/'+g.id+'/lockimg/'+l.id).delete();await db.doc('unlocks/'+l.id).delete()}
  const pins=g.pins.filter(p=>p.on!==false&&!hid.has(cellAt(p.x,p.y,g))).map(p=>({id:p.id,x:p.x,y:p.y,t:p.t||'',d:p.d||''}));
  await db.doc('maps/'+g.id).set({name:g.name||'Karte',order:g.order||0,w:g.w,h:g.h,cols:g.cols,rows:g.rows,v,n,pins,locks,here:g.here||null});
  return v}
async function gmUnpublishMap(g){
  const db=S.db,pub=S.maps.find(m=>m.id===g.id);if(!pub)return;
  await db.doc('maps/'+g.id).delete();await dropChunks(db.collection('maps/'+g.id+'/img'),pub.n||0);
  for(const l of (pub.locks||[])){await db.doc('maps/'+g.id+'/lockimg/'+l.id).delete().catch(()=>{});await db.doc('unlocks/'+l.id).delete().catch(()=>{})}}
async function gmDeleteMap(g){await gmUnpublishMap(g);await dropChunks(S.db.collection('gm/store/maps/'+g.id+'/img'),g.n||0);await S.db.doc('gm/store/maps/'+g.id).delete()}

function MapEditor(){
  const list=S.gmMaps.slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const [gid,setGid]=useState(''),src=list.find(m=>m.id===gid)||list[0];
  const [g,setG0]=useState(null),gR=useRef(null),saveT=useRef(0),cv=useRef(null),drag=useRef({on:false,last:-1,mode:''});
  const [img,setImg]=useState(null),[tool,setTool]=useState('show'),[sel,setSel]=useState(new Set()),[pinSel,setPinSel]=useState(''),[busy,setBusy]=useState(''),[area,setArea]=useState({name:'',pw:'',hint:''}),[nm,setNm]=useState('');
  const setG=n=>{gR.current=n;setG0(n)};
  const save=n=>{clearTimeout(saveT.current);saveT.current=setTimeout(()=>{const d=clone(n);delete d.id;S.db.doc('gm/store/maps/'+n.id).set(d).catch(oops('Das Speichern der Karte'))},700)};
  const mut=fn=>{if(!gR.current)return;const n=clone(gR.current);fn(n);setG(n);save(n)};
  useEffect(()=>{if(!src){setG(null);setImg(null);return}if(gR.current&&gR.current.id===src.id)return;
    const n=clone(src);n.hidden=n.hidden||[];n.pins=n.pins||[];n.regions=n.regions||[];setG(n);setSel(new Set());setPinSel('');setImg(null);
    let live=true;loadGmMaster(n).then(i=>{if(live)setImg(i)},()=>{if(live)setImg(false)});return()=>{live=false}},[src&&src.id]);
  const selSig=Array.from(sel).join(',');
  useEffect(()=>{
    if(!img||!cv.current||!g)return;const c=cv.current;if(c.width!==g.w||c.height!==g.h){c.width=g.w;c.height=g.h}
    const x=c.getContext('2d');x.clearRect(0,0,g.w,g.h);x.drawImage(img,0,0,g.w,g.h);
    const reg=new Set();g.regions.forEach(r=>r.cells.forEach(i=>reg.add(i)));
    x.fillStyle='rgba(35,30,43,.62)';g.hidden.forEach(i=>{if(reg.has(i))return;const q=cellRect(i,g);x.fillRect(q.x,q.y,q.w,q.h)});
    x.fillStyle='rgba(93,62,98,.66)';reg.forEach(i=>{const q=cellRect(i,g);x.fillRect(q.x,q.y,q.w,q.h)});
    x.fillStyle='rgba(227,154,45,.5)';x.strokeStyle='#E39A2D';x.lineWidth=Math.max(2,g.w/500);sel.forEach(i=>{const q=cellRect(i,g);x.fillRect(q.x,q.y,q.w,q.h);x.strokeRect(q.x+1,q.y+1,q.w-2,q.h-2)});
    x.strokeStyle='rgba(35,30,43,.3)';x.lineWidth=1;x.beginPath();
    for(let i=1;i<g.cols;i++){const px=Math.round(i*g.w/g.cols)+.5;x.moveTo(px,0);x.lineTo(px,g.h)}
    for(let i=1;i<g.rows;i++){const py=Math.round(i*g.h/g.rows)+.5;x.moveTo(0,py);x.lineTo(g.w,py)}
    x.stroke()},[img,g,selSig]);
  const at=e=>{const r=cv.current.getBoundingClientRect(),px=clamp((e.clientX-r.left)/r.width,0,0.9999),py=clamp((e.clientY-r.top)/r.height,0,0.9999);return {px,py,i:cellAt(px,py,gR.current)}};
  const paint=e=>{const p=at(e),d=drag.current;if(p.i===d.last)return;d.last=p.i;
    if(d.mode==='show')mut(n=>{n.hidden=n.hidden.filter(k=>k!==p.i)});
    else if(d.mode==='hide')mut(n=>{if(!n.hidden.includes(p.i))n.hidden.push(p.i)});
    else setSel(s=>{const t=new Set(s);if(d.mode==='del')t.delete(p.i);else t.add(p.i);return t})};
  const down=e=>{if(!gR.current||busy)return;const p=at(e);
    if(tool==='pin'){const id=rid();mut(n=>{n.pins.push({id,x:p.px,y:p.py,t:'',d:'',on:true})});setPinSel(id);return}
    if(tool==='here'){mut(n=>{n.here={x:p.px,y:p.py}});if(gR.current.pubV)S.db.doc('maps/'+gR.current.id).update({here:{x:p.px,y:p.py}}).catch(()=>{});return}
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch(err){}
    drag.current={on:true,last:-1,mode:tool==='area'?(sel.has(p.i)?'del':'add'):tool};paint(e)};
  const publish=async()=>{const n=gR.current;if(!n||busy)return;if(!S.camp||!S.camp.salt){toast('Die Kampagne ist noch nicht eingerichtet. Lade die Seite neu.','err');return}
    setBusy('pub');clearTimeout(saveT.current);
    try{const v=await gmPublishMap(n);const m=clone(gR.current);m.pubV=v;m.pubSig=mapSig(m);setG(m);const d=clone(m);delete d.id;await S.db.doc('gm/store/maps/'+m.id).set(d);toast('Die Karte ist bei den Spielern.')}
    catch(e){oops('Das Ausgeben der Karte')(e)}setBusy('')};
  const add=async(blob,name,preset)=>{if(busy)return;setBusy('new');try{const id=await gmNewMap(blob,name,preset);setGid(id);setNm('')}catch(e){toast('Die Karte konnte nicht angelegt werden.'+why(e),'err')}setBusy('')};
  const starter=async()=>{if(busy)return;setBusy('new');try{const r=await fetch('starter-map.jpg');if(!r.ok)throw new Error('http');const b=await r.blob();setBusy('');await add(b,STARTER.name,STARTER)}catch(e){setBusy('');toast('Die Regionskarte konnte nicht geladen werden. Lade stattdessen eine eigene Bilddatei hoch.','err')}};
  const pos=p=>'left:'+(p.x*100)+'%;top:'+(p.y*100)+'%';
  const dirty=g&&mapSig(g)!==g.pubSig,pin=g&&g.pins.find(p=>p.id===pinSel);
  const TOOLS=[['show','Aufdecken'],['hide','Verdecken'],['area','Gebiet markieren'],['pin','Ort setzen'],['here','Gruppe hierher']];
  const HELP={show:'Zieh über die Felder, die die Gruppe sehen darf.',hide:'Zieh über Felder, um sie wieder in Nebel zu hüllen.',area:'Markiere Felder. Daraus machst du ein Gebiet, das sich mit einem Passwort öffnet, oder deckst sie in einem Rutsch auf.',pin:'Tippe auf die Karte, um einen Ort mit Beschreibung zu setzen. Spieler sehen ihn, sobald sein Feld aufgedeckt ist.',here:'Tippe dorthin, wo die Gruppe gerade ist. Das sehen die Spieler sofort.'};
  const newBox=html`<div class="box plain"><h3 class="h3">Neue Karte</h3>
      <div class="rowf" style="margin-top:.6rem"><span class="grow" style="max-width:16rem"><${In} id="map-new-name" v=${nm} on=${setNm} ph="Name der Karte" lbl="Name der neuen Karte"/></span>
        <${FileBtn} label=${busy==='new'?'Wird angelegt …':'Bild hochladen'} icon="plus" onFile=${f=>add(f,nm.trim()||f.name.replace(/\.[^.]+$/,''))}/></div>
      ${!list.some(m=>m.name===STARTER.name)?html`<p class="sm" style="margin:.8rem 0 0"><button class="btn s" disabled=${!!busy} onClick=${starter}>Regionskarte „Hollowmere & Thereabouts“ laden</button> <span class="soft">Deine Karte der Lande um den Mere. Bekanntes ist schon aufgedeckt, die sechs neuen Orte liegen im Nebel.</span></p>`:null}</div>`;
  return html`<div class="rowf"><h1 class="h1">Karten bearbeiten</h1><button class="btn right" onClick=${()=>ui({mapEdit:false})}><${Ic} n="eye"/>Ansicht der Spieler</button></div>
    <p class="lead">Nur du siehst diese Seite. Du arbeitest an einem Entwurf. Erst „Für Spieler ausgeben“ zeigt den Stand der Gruppe.</p>
    ${list.length>1?html`<div class="chips" style="margin-bottom:.8rem">${list.map(m=>html`<button key=${m.id} class="chip" aria-pressed=${g&&m.id===g.id} onClick=${()=>setGid(m.id)}>${m.name||'Karte'}</button>`)}</div>`:null}
    ${!g?newBox:html`
      <div class="cbar plainbar" style=${dirty?'border-color:var(--flame)':''}><span class="grow">${busy==='pub'?'Die Karte wird gezeichnet und ausgegeben …':!g.pubV?'Diese Karte haben die Spieler noch nicht.':dirty?'Dein Entwurf ist weiter als das, was die Spieler sehen.':'Die Spieler sehen den aktuellen Stand.'}</span>
        <button class="btn flame" disabled=${!!busy||!img||(!!g.pubV&&!dirty)} onClick=${publish}>Für Spieler ausgeben</button></div>
      <div class="maptools"><span class="seg" role="group" aria-label="Werkzeug">${TOOLS.map(t=>html`<button key=${t[0]} aria-pressed=${tool===t[0]} onClick=${()=>setTool(t[0])}>${t[1]}</button>`)}</span></div>
      <p class="sm soft">${HELP[tool]}</p>
      <div class="map-layout"><div style="min-width:0"><div class="mapscroll"><div class=${'maplayer'+(img?'':' wait')}>
          ${img===false?'Das Kartenbild konnte nicht geladen werden.':!img?'Die Karte wird geladen …':null}
          <canvas ref=${cv} hidden=${!img} class="edcanvas" style="touch-action:none" onPointerDown=${down} onPointerMove=${e=>{if(drag.current.on)paint(e)}} onPointerUp=${()=>{drag.current.on=false}} onPointerCancel=${()=>{drag.current.on=false}}></canvas>
          ${img?html`${g.here?html`<span class="here" style=${pos(g.here)}></span>`:null}
            ${g.pins.map((p,i)=>html`<button key=${p.id} class=${'pin'+(pinSel===p.id?' sel':'')+(p.on===false||g.hidden.includes(cellAt(p.x,p.y,g))?' off':'')} style=${pos(p)} aria-label=${p.t||'Ort '+(i+1)} onClick=${()=>setPinSel(p.id)}>${i+1}</button>`)}
            ${S.pings.filter(p=>p.m===g.id).map(p=>html`<span key=${p.id} class="ping" style=${pos(p)}><span>${p.uid===S.uid?'Du':charName(p.uid)}</span></span>`)}`:null}
        </div></div></div>
        <aside class="stack">
          ${tool==='area'?html`<div class="box plain"><h3 class="h3">Markiert: ${sel.size} ${sel.size===1?'Feld':'Felder'}</h3>
            ${sel.size?html`<div class="rowf" style="margin:.6rem 0"><button class="btn s" onClick=${()=>{mut(n=>{n.hidden=n.hidden.filter(k=>!sel.has(k))});setSel(new Set())}}>Aufdecken</button><button class="btn s" onClick=${()=>{mut(n=>{sel.forEach(k=>{if(!n.hidden.includes(k))n.hidden.push(k)})});setSel(new Set())}}>Verdecken</button><button class="btn s quiet" onClick=${()=>setSel(new Set())}>Auswahl leeren</button></div>
              <div class="stack" style="gap:.5rem"><${F} l="Name des Gebiets (für Spieler sichtbar)"><${In} id="ar-name" v=${area.name} on=${v=>setArea(Object.assign({},area,{name:v}))}/><//>
                <${F} l="Passwort"><${In} id="ar-pw" v=${area.pw} on=${v=>setArea(Object.assign({},area,{pw:v}))}/><//>
                <${F} l="Hinweis für die Spieler"><${In} id="ar-hint" v=${area.hint} ph="Die Antwort auf Barnabys Rätsel" on=${v=>setArea(Object.assign({},area,{hint:v}))}/><//>
                <div><button class="btn solid" disabled=${!normPw(area.pw)} onClick=${()=>{const cells=Array.from(sel);mut(n=>{n.regions.forEach(r=>{r.cells=r.cells.filter(k=>!sel.has(k))});n.regions=n.regions.filter(r=>r.cells.length);n.regions.push({id:rid(),name:area.name.trim(),pw:area.pw.trim(),hint:area.hint.trim(),cells});cells.forEach(k=>{if(!n.hidden.includes(k))n.hidden.push(k)})});setSel(new Set());setArea({name:'',pw:'',hint:''})}}><${Ic} n="lock"/>Als Passwort-Gebiet speichern</button></div></div>`
              :html`<p class="sm soft" style="margin:.4rem 0 0">Zieh über die Karte, um Felder zu markieren.</p>`}</div>`:null}
          ${pin?html`<div class="box plain"><div class="rowf"><h3 class="h3">Ort ${g.pins.indexOf(pin)+1}</h3><button class="xbtn right" aria-label="Schließen" onClick=${()=>setPinSel('')}>×</button></div>
            <div class="stack" style="gap:.5rem;margin-top:.5rem"><${F} l="Name"><${In} id="pin-t" v=${pin.t} on=${v=>mut(n=>{n.pins.find(p=>p.id===pinSel).t=v})}/><//>
              <${F} l="Beschreibung"><${Area} id="pin-d" rows="3" v=${pin.d} on=${v=>mut(n=>{n.pins.find(p=>p.id===pinSel).d=v})}/><//>
              <label class="chk"><input type="checkbox" checked=${pin.on!==false} onChange=${e=>{const v=e.target.checked;mut(n=>{n.pins.find(p=>p.id===pinSel).on=v})}}/><span>Für Spieler sichtbar, sobald das Feld aufgedeckt ist</span></label>
              <div><button class="btn s warn" onClick=${()=>{mut(n=>{n.pins=n.pins.filter(p=>p.id!==pinSel)});setPinSel('')}}>Ort entfernen</button></div></div></div>`:null}
          ${g.regions.length?html`<div><h3 class="h3">Passwort-Gebiete</h3>${g.regions.map(r=>{const u=S.unlocks[r.id];return html`<div class="gm-row" key=${r.id}><span class="grow"><b>${r.name||'Ohne Namen'}</b><br/><span class="sm soft">Passwort: ${r.pw} · ${r.cells.length} Felder${u?' · geöffnet von '+charName(u.by):''}</span></span>
            ${u?html`<button class="btn s" onClick=${()=>S.db.doc('unlocks/'+r.id).delete().catch(oops('Das Verschließen'))}>Wieder verschließen</button>`:null}
            <button class="btn s" title="Das Gebiet bleibt im Nebel, verliert aber sein Passwort" onClick=${()=>mut(n=>{n.regions=n.regions.filter(y=>y.id!==r.id)})}>Auflösen</button></div>`})}</div>`:null}
          <div class="box plain"><h3 class="h3">Diese Karte</h3><div class="stack" style="gap:.6rem;margin-top:.5rem">
            <${F} l="Name"><${In} id="map-name" v=${g.name} on=${v=>mut(n=>{n.name=v})}/><//>
            <div class="rowf">${g.here?html`<button class="btn s" onClick=${()=>{mut(n=>{n.here=null});if(g.pubV)S.db.doc('maps/'+g.id).update({here:null}).catch(()=>{})}}>Gruppen-Marker entfernen</button>`:null}
              ${g.pubV?html`<button class="btn s" disabled=${campOf().map===g.id} onClick=${()=>S.db.doc('camp/main').update({map:g.id}).catch(oops('Das Speichern'))}>${campOf().map===g.id?'Ist die Startkarte':'Als Startkarte zeigen'}</button>`:null}</div>
            <div class="rowf">${g.pubV?html`<${Confirm} label="Bei Spielern ausblenden" cls="btn s" ask="Die Spieler sehen die Karte dann nicht mehr." yes="Ausblenden" onYes=${async()=>{setBusy('pub');try{await gmUnpublishMap(g);mut(n=>{n.pubV=0;n.pubSig=''})}catch(e){oops('Das Ausblenden')(e)}setBusy('')}}/>`:null}
              <${Confirm} label="Karte löschen" ask="Karte, Nebel und Orte werden gelöscht." onYes=${async()=>{setBusy('pub');clearTimeout(saveT.current);const d=g;gR.current=null;try{await gmDeleteMap(d)}catch(e){oops('Das Löschen')(e)}setBusy('');setGid('')}}/></div></div></div>
          ${newBox}
        </aside></div>`}`}

/* ================= game master: entries ================= */
const VIS={hidden:'Entwurf, nur für dich',open:'Für alle sichtbar',pw:'Öffnet sich mit Passwort',private:'Privat für einzelne Spieler'};
const pubDoc=it=>({kind:it.kind,title:it.title||'',sub:it.sub||'',body:it.body||'',status:it.status||'',at:it.at||Date.now(),pub:it.pub||0,img:it.img||0});
async function gmItemImg(id){const s=await S.db.doc('gm/store/items/'+id+'/media/img').get();return s.exists?s.data().d||null:null}
async function gmProject(it,prev,img){ // writes what players may see: the open entry, the sealed entry, or the private copies
  const db=S.db,pub=db.doc('items/'+it.id),pimg=db.doc('items/'+it.id+'/media/img'),doc=pubDoc(it);
  const oldTo=(prev&&prev.vis==='private'&&prev.to)||[],newTo=it.vis==='private'?(it.to||[]):[];
  for(const u of oldTo)if(!newTo.includes(u)){await db.doc('inbox/'+u+'/items/'+it.id+'/media/img').delete();await db.doc('inbox/'+u+'/items/'+it.id).delete()}
  if(it.vis==='open'){await pub.set(doc);if(img)await pimg.set({d:img});else await pimg.delete()}
  else if(it.vis==='pw'){
    const key=pwKey(S.camp.salt,it.pw);
    await pub.set({kind:it.kind,title:it.ltitle||'',hint:it.hint||'',at:doc.at,pub:doc.pub,img:doc.img,lock:seal(doc,key)});
    if(img)await pimg.set({box:seal({d:img},key)});else await pimg.delete();
    if(prev&&prev.vis==='pw'&&normPw(prev.pw)!==normPw(it.pw))await db.doc('unlocks/'+it.id).delete()}
  else{await pimg.delete();await pub.delete()}
  if(it.vis!=='pw'&&prev&&prev.vis==='pw')await db.doc('unlocks/'+it.id).delete();
  for(const u of newTo){await db.doc('inbox/'+u+'/items/'+it.id).set(Object.assign({},doc,{read:false}));const ri=db.doc('inbox/'+u+'/items/'+it.id+'/media/img');if(img)await ri.set({d:img});else await ri.delete()}}
async function gmSaveItem(d,newImg){ // newImg: undefined keeps the picture, null removes it, a data URL replaces it
  if(!S.camp||!S.camp.salt){toast('Die Kampagne ist noch nicht eingerichtet. Lade die Seite neu.','err');return false}
  if(d.vis==='pw'&&!normPw(d.pw)){toast('Trag ein Passwort ein.','err');return false}
  if(d.vis==='private'&&!(d.to||[]).length){toast('Wähle mindestens eine Person aus.','err');return false}
  const db=S.db,prev=S.gmItems.find(x=>x.id===d.id),it=clone(d);delete it.id;
  try{
    const mimg=db.doc('gm/store/items/'+d.id+'/media/img');let img=null;
    if(newImg===undefined)img=it.img?await gmItemImg(d.id):null;
    else if(newImg){await mimg.set({d:newImg});it.img=Date.now();img=newImg}
    else{await mimg.delete();it.img=0}
    if(it.vis==='hidden')it.pub=0;else if(!prev||prev.vis==='hidden'||!prev.pub)it.pub=Date.now();
    it.at=it.at||Date.now();it.upd=Date.now();
    await db.doc('gm/store/items/'+d.id).set(it);
    await gmProject(Object.assign({id:d.id},it),prev,img);return true}
  catch(e){oops('Das Speichern')(e);return false}}
async function gmDeleteItem(it){
  const db=S.db;
  try{for(const u of ((it.vis==='private'&&it.to)||[])){await db.doc('inbox/'+u+'/items/'+it.id+'/media/img').delete();await db.doc('inbox/'+u+'/items/'+it.id).delete()}
    await db.doc('items/'+it.id+'/media/img').delete();await db.doc('items/'+it.id).delete();await db.doc('unlocks/'+it.id).delete();
    await db.doc('gm/store/items/'+it.id+'/media/img').delete();await db.doc('gm/store/items/'+it.id).delete()}
  catch(e){oops('Das Löschen')(e)}}
function players(){return Object.keys(S.chars).filter(u=>u!==S.uid||S.chars[u].name)}
function ItemEditor({init,done}){
  const [d,setD]=useState(()=>clone(init)),[img,setImg]=useState(undefined),[busy,setBusy]=useState(false);
  const up=p=>setD(Object.assign({},d,p)),cur=img===undefined?(d.img?media('gm/store/items/'+d.id+'/media/img',d.img):null):img;
  const save=async()=>{if(busy)return;setBusy(true);const ok=await gmSaveItem(d,img);setBusy(false);if(ok){toast(d.vis==='hidden'?'Als Entwurf gespeichert.':'Gespeichert und ausgegeben.');done()}};
  const pl=players();
  return html`<div class="box" style="margin:1rem 0"><div class="rowf"><h3 class="h3">${init.isNew?'Neu: ':''}${KIND1[d.kind]}</h3><button class="xbtn right" aria-label="Schließen" onClick=${done}>×</button></div>
    <div class="stack" style="margin-top:.7rem">
      <div class="fg"><${F} l=${d.kind==='npc'?'Name':'Titel'}><${In} id="it-title" v=${d.title} on=${v=>up({title:v})}/><//>
        <${F} l=${d.kind==='npc'?'Rolle, Ort':d.kind==='journal'?'Session, Datum':'Unterzeile'}><${In} id="it-sub" v=${d.sub} on=${v=>up({sub:v})}/><//>
        ${d.kind==='quest'?html`<${F} l="Stand"><select class="in" id="it-status" value=${d.status||'open'} onChange=${e=>up({status:e.target.value})}>${Object.keys(QST).map(k=>html`<option value=${k}>${QST[k]}</option>`)}</select><//>`:null}</div>
      <${F} l="Text"><${Area} id="it-body" rows="7" v=${d.body} on=${v=>up({body:v})}/><//>
      <div class="rowf">${cur?html`<img src=${cur} alt="" style="max-height:120px;border-radius:4px;border:1px solid var(--rule)"/>`:null}
        <${FileBtn} label=${cur?'Bild ersetzen':'Bild hinzufügen'} icon="cam" onFile=${async f=>{try{setImg(await pickImage(f,1100,1100,150000))}catch(e){toast('Das Bild konnte nicht gelesen werden.','err')}}}/>
        ${cur?html`<button class="btn quiet" onClick=${()=>setImg(null)}>Bild entfernen</button>`:null}</div>
      <div><span class="lbl">Wer sieht das?</span><div class="chips">${Object.keys(VIS).map(k=>html`<button key=${k} class="chip" aria-pressed=${d.vis===k} onClick=${()=>up({vis:k})}>${VIS[k]}</button>`)}</div></div>
      ${d.vis==='pw'?html`<div class="fg"><${F} l="Passwort"><${In} id="it-pw" v=${d.pw} on=${v=>up({pw:v})}/><//>
        <${F} l="Titel, solange versiegelt"><${In} id="it-lt" v=${d.ltitle} ph="Versiegelter Brief" on=${v=>up({ltitle:v})}/><//>
        <${F} l="Hinweis für die Spieler" wide=${true}><${In} id="it-hint" v=${d.hint} ph="Das Passwort steht auf dem Grabstein" on=${v=>up({hint:v})}/><//></div>
        <p class="sm soft">Groß- und Kleinschreibung spielt keine Rolle. Gibt ein Spieler das Passwort ein, öffnet sich der Eintrag für die ganze Gruppe.</p>`:null}
      ${d.vis==='private'?html`<div><span class="lbl">Für wen?</span>${pl.length?html`<div class="chips">${pl.map(u=>html`<button key=${u} class="chip" aria-pressed=${(d.to||[]).includes(u)} onClick=${()=>up({to:(d.to||[]).includes(u)?d.to.filter(x=>x!==u):(d.to||[]).concat(u)})}>${charName(u)}${S.chars[u].name?' ('+nameOf(u)+')':''}</button>`)}</div>`
        :html`<p class="soft sm">Noch hat kein Spieler das Kampagnenbuch geöffnet. Sobald jemand da war, kannst du ihn hier auswählen.</p>`}</div>`:null}
      <div class="rowf"><button class="btn solid" disabled=${busy||!String(d.title||'').trim()} onClick=${save}>${busy?'Speichert …':d.vis==='hidden'?'Entwurf speichern':'Speichern und ausgeben'}</button>
        ${init.isNew?null:html`<${Confirm} label="Löschen" cls="btn warn" onYes=${async()=>{await gmDeleteItem(init);done()}}/>`}</div>
    </div></div>`}
function GmItems(){
  const [ed,setEd]=useState(null);
  const blank=k=>({id:rid(),isNew:true,kind:k,title:'',sub:'',body:'',status:k==='quest'?'open':'',vis:k==='note'?'private':'hidden',pw:'',hint:'',ltitle:'',to:[],img:0,at:Date.now(),pub:0});
  const visTag=it=>it.vis==='open'?html`<span class="tag ok">offen</span>`:it.vis==='pw'?html`<span class="tag">Passwort: ${it.pw}${S.unlocks[it.id]?' · geöffnet':''}</span>`:it.vis==='private'?html`<span class="tag you">privat: ${(it.to||[]).map(charName).join(', ')}</span>`:html`<span class="tag">Entwurf</span>`;
  return html`<p class="lead">Schreib vor, was die Gruppe finden kann. Ein Entwurf bleibt bei dir, bis du ihn freigibst: für alle, hinter einem Passwort oder nur für einzelne Spieler.</p>
    <div class="rowf"><span class="soft">Neu:</span>${Object.keys(KIND1).map(k=>html`<button key=${k} class="btn s" onClick=${()=>setEd(blank(k))}><${Ic} n="plus"/>${KIND1[k]}</button>`)}</div>
    ${ed?html`<${ItemEditor} key=${ed.id} init=${ed} done=${()=>setEd(null)}/>`:null}
    ${!S.gmItems.length?html`<p class="empty">Noch nichts angelegt. Ein guter Anfang: ein Tagebucheintrag „Was bisher geschah“ zur Nacht der gestohlenen Schatten.</p>`:null}
    ${Object.keys(KIND1).map(k=>{const l=S.gmItems.filter(i=>i.kind===k).sort((a,b)=>(b.at||0)-(a.at||0));return l.length?html`<section key=${k}><h2 class="h2">${k==='note'?'Nachrichten':KINDS[k]}</h2>
      ${l.map(it=>html`<div class="gm-row" key=${it.id}><button class="t" onClick=${()=>{setEd(Object.assign({},clone(it),{isNew:false}));window.scrollTo(0,0)}}>${it.title||'Ohne Titel'}</button>${visTag(it)}
        ${it.vis==='hidden'||it.vis==='pw'?html`<button class="btn s" onClick=${async()=>{if(await gmSaveItem(Object.assign({},clone(it),{vis:'open'})))toast('„'+(it.title||'Eintrag')+'“ ist jetzt für alle sichtbar.')}}>Für alle freigeben</button>`:null}</div>`)}</section>`:null})}`}

/* ================= game master: combat ================= */
const setCombat=d=>S.db.doc('camp/combat').set(d).catch(oops('Der Kampf'));
function gmNextTurn(){const cb=S.combat;if(!cb||!cb.on||!cb.order.length)return;let t=cb.turn+1,r=cb.round;if(t>=cb.order.length){t=0;r++}setCombat(Object.assign({},cb,{turn:t,round:r}))}
function GmCombat(){
  const cb=S.combat||{},pcs=Object.keys(S.chars).filter(u=>S.chars[u].name);
  const [foes,setF]=useState(()=>LS.get('foes',[])),[man,setMan]=useState({}),[late,setLate]=useState({n:'',i:''});
  const saveF=f=>{setF(f);LS.set('foes',f)};
  const val=u=>{if(man[u]!==undefined&&man[u]!=='')return num(man[u]);const i=S.chars[u].init;return i&&cb.call&&i.c===cb.call?i.v:null};
  if(cb.on){
    const o=cb.order||[];
    const drop=id=>{const ix=o.findIndex(x=>x.id===id),n=o.filter(x=>x.id!==id);if(!n.length){setCombat({on:false,call:0,round:0,turn:0,order:[]});return}let t=cb.turn;if(ix<t)t--;if(t>=n.length)t=0;setCombat(Object.assign({},cb,{order:n,turn:t}))};
    const join=e=>{e.preventDefault();if(!late.n.trim())return;const cur=o[cb.turn],n=o.concat({id:rid(),n:late.n.trim(),i:num(late.i)}).sort((a,b)=>b.i-a.i);setCombat(Object.assign({},cb,{order:n,turn:Math.max(0,n.indexOf(cur))}));setLate({n:'',i:''})};
    const back=()=>{let t=cb.turn-1,r=cb.round;if(t<0){t=o.length-1;r=Math.max(1,r-1)}setCombat(Object.assign({},cb,{turn:t,round:r}))};
    return html`<p class="lead">Runde ${cb.round}. Alle sehen oben im Kampagnenbuch, wer am Zug ist und wer danach kommt.</p>
      <div class="rowf"><button class="btn quiet" onClick=${back}>Zurück</button><button class="btn solid" onClick=${gmNextTurn}>Weiter zum nächsten Zug</button>
        <${Confirm} label="Kampf beenden" cls="btn warn right" ask="Die Reihenfolge wird geleert." yes="Beenden" onYes=${()=>setCombat({on:false,call:0,round:0,turn:0,order:[]})}/></div>
      <ol class="order" style="max-width:32rem;margin-top:.8rem">${o.map((x,i)=>html`<li key=${x.id} class=${i===cb.turn?'cur':''}><span class="i">${x.i}</span><span class="grow">${x.n}</span>${x.uid?html`<span class="tag">Held</span>`:null}<button class="xbtn" aria-label=${x.n+' aus dem Kampf nehmen'} onClick=${()=>drop(x.id)}>×</button></li>`)}</ol>
      <form class="rowf" style="margin-top:1rem;max-width:32rem" onSubmit=${join}><span class="grow"><${In} id="late-n" v=${late.n} ph="Kommt dazu: Name" lbl="Name" on=${v=>setLate(Object.assign({},late,{n:v}))}/></span>
        <${In} id="late-i" type="number" cls="num" v=${late.i} ph="Init" lbl="Initiative" on=${v=>setLate(Object.assign({},late,{i:v}))}/><button class="btn" type="submit">Einreihen</button></form>`}
  const start=()=>{const order=pcs.filter(u=>val(u)!=null).map(u=>({id:u,uid:u,n:S.chars[u].name,i:val(u)})).concat(foes.filter(f=>String(f.n||'').trim()).map(f=>({id:f.id,n:f.n.trim(),i:num(f.i)}))).sort((a,b)=>b.i-a.i);
    if(!order.length){toast('Trag mindestens einen Teilnehmer mit Initiative ein.','err');return}setCombat({on:true,call:cb.call||Date.now(),round:1,turn:0,order});setMan({})};
  return html`<p class="lead">Ihr würfelt am Tisch. Hier entsteht nur die Reihenfolge, die dann alle sehen.</p>
    <ol class="steps">
      <li><div><b>Initiative abfragen.</b> Jeder Spieler bekommt oben ein Feld für seinen Wurf.<div class="rowf" style="margin-top:.5rem"><button class="btn" onClick=${()=>setCombat({on:false,call:Date.now(),round:0,turn:0,order:[]})}>${cb.call?'Neu abfragen':'Initiative abfragen'}</button>
        ${cb.call?html`<button class="btn quiet" onClick=${()=>setCombat({on:false,call:0,round:0,turn:0,order:[]})}>Abfrage beenden</button>`:null}</div></div></li>
      <li><div><b>Die Helden.</b> Gemeldete Würfe erscheinen von selbst. Du kannst jeden Wert auch selbst eintragen.
        ${pcs.length?pcs.map(u=>html`<div class="gm-row" key=${u}><span class="grow">${S.chars[u].name} <span class="soft sm">${nameOf(u)}</span></span>${val(u)!=null&&(man[u]===undefined||man[u]==='')?html`<span class="tag ok">gemeldet: ${val(u)}</span>`:null}
          <${In} type="number" cls="num" lbl=${'Initiative von '+S.chars[u].name} v=${man[u]===undefined?'':man[u]} ph="Init" on=${v=>setMan(Object.assign({},man,{[u]:v}))}/></div>`):html`<p class="soft sm" style="margin:.4rem 0 0">Noch hat niemand einen Charakter angelegt.</p>`}</div></li>
      <li><div><b>Die Gegenseite.</b> Der Name steht so in der Reihenfolge, wie du ihn hier schreibst.
        ${foes.map(f=>html`<div class="gm-row" key=${f.id}><span class="grow"><${In} v=${f.n} ph="Gloam Hound 1" lbl="Name" on=${v=>saveF(foes.map(x=>x.id===f.id?Object.assign({},x,{n:v}):x))}/></span>
          <${In} type="number" cls="num" v=${f.i} ph="Init" lbl="Initiative" on=${v=>saveF(foes.map(x=>x.id===f.id?Object.assign({},x,{i:v}):x))}/><button class="xbtn" aria-label="Entfernen" onClick=${()=>saveF(foes.filter(x=>x.id!==f.id))}>×</button></div>`)}
        <div class="rowf" style="margin-top:.5rem"><button class="btn s" onClick=${()=>saveF(foes.concat({id:rid(),n:'',i:''}))}><${Ic} n="plus"/>Gegner</button>${foes.length?html`<button class="btn s quiet" onClick=${()=>saveF([])}>Liste leeren</button>`:null}</div></div></li>
      <li><div><b>Los.</b> Die Reihenfolge wird sortiert und für alle angezeigt.<div style="margin-top:.5rem"><button class="btn solid" onClick=${start}><${Ic} n="swords"/>Kampf starten</button></div></div></li>
    </ol>`}

/* ================= game master: session and players ================= */
const toLocal=ts=>{if(!ts)return '';const d=new Date(ts),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
function GmSession(){
  const c=campOf(),up=p=>S.db.doc('camp/main').update(p).catch(oops('Das Speichern')),np=players().length;
  return html`<p class="lead">Nur du siehst den Bereich Leitung. Alles hier wirkt sofort bei allen, die das Kampagnenbuch offen haben.</p>
    <ol class="steps">
      <li><div><b>Karte ausgeben.</b> ${S.maps.length?'Erledigt: '+S.maps.length+(S.maps.length>1?' Karten sind':' Karte ist')+' bei den Spielern.':'Lade eine Karte, deck auf, was die Gruppe kennt, und gib sie aus.'}<div style="margin-top:.4rem"><button class="btn s" onClick=${()=>{ui({tab:'map',mapEdit:true});window.scrollTo(0,0)}}>Zu den Karten</button></div></div></li>
      <li><div><b>Spieler einladen.</b> Schick deinen Spielern diese Adresse. Sie melden sich mit Google oder E-Mail an und bauen ihren Charakter. ${np?'Bisher da: '+np+'.':'Bisher war noch niemand da.'}<${CopyLink}/></div></li>
      <li><div><b>Inhalte vorbereiten.</b> ${S.gmItems.length?S.gmItems.length+' Einträge angelegt, davon '+S.gmItems.filter(i=>i.vis==='hidden').length+' als Entwurf.':'Tagebuch, Handouts, Gesichter, Aufträge und private Nachrichten.'}<div style="margin-top:.4rem"><button class="btn s" onClick=${()=>ui({gm:'items'})}>Zu den Inhalten</button></div></div></li>
    </ol>
    <h2 class="h2">Kampagne</h2>
    <div class="fg" style="max-width:46rem"><${F} l="Titel"><${Late} id="cp-title" v=${c.title} on=${v=>up({title:v})}/><//><${F} l="Unterzeile"><${Late} id="cp-sub" v=${c.sub} on=${v=>up({sub:v})}/><//></div>
    <h2 class="h2">Nachricht an alle</h2>
    <div class="rowf" style="max-width:46rem"><span class="grow"><${Late} id="cp-banner" v=${c.banner} ph="Roll initiative!" lbl="Nachricht an alle" on=${v=>up({banner:v})}/></span>${c.banner?html`<button class="btn quiet" onClick=${()=>up({banner:''})}>Leeren</button>`:null}</div>
    <p class="sm soft" style="margin-top:.4rem">Steht bei allen ganz oben, bis du sie leerst. Mit Enter abschicken.</p>
    <h2 class="h2">Nächste Session</h2>
    <div class="fg" style="max-width:46rem"><${F} l="Datum und Uhrzeit"><input class="in" id="cp-next" type="datetime-local" value=${toLocal(c.next)} onChange=${e=>{const t=e.target.value?new Date(e.target.value).getTime():0;up({next:isFinite(t)?t:0})}}/><//>
      <${F} l="Notiz dazu"><${Late} id="cp-nextnote" v=${c.nextNote} ph="Wir treffen uns im Voice-Channel" on=${v=>up({nextNote:v})}/><//></div>`}
function GmPlayers(){
  const ids=Array.from(new Set(Object.keys(S.chars).concat(Object.keys(S.sheets)))),cur=S.ui.gmSheet&&S.sheets[S.ui.gmSheet]?S.ui.gmSheet:'';
  const kick=async u=>{try{await S.db.doc('sheets/'+u).delete();await S.db.doc('chars/'+u+'/media/portrait').delete();await S.db.doc('chars/'+u).delete();if(S.ui.gmSheet===u)ui({gmSheet:''})}catch(e){oops('Das Entfernen')(e)}};
  if(cur){const s=normSheet(clone(S.sheets[cur]));return html`<button class="btn quiet" onClick=${()=>ui({gmSheet:''})}><${Ic} n="back"/>Alle Spieler</button>
    <p class="sm soft" style="margin:.8rem 0">Bogen von ${nameOf(cur)}, nur zum Lesen. Änderungen macht der Spieler selbst.</p><${Sheet} key=${cur} s=${s} uid=${cur} ro=${true} set=${()=>{}}/>`}
  return html`<p class="lead">Alle, die das Kampagnenbuch geöffnet haben, mit den Werten, die du am häufigsten brauchst.</p>
    ${!ids.length?html`<p class="empty">Noch war niemand da. Schick deinen Spielern die Adresse der App (unter Session).</p>`:html`<div class="scrollx"><table class="roster">
      <thead><tr><th>Spieler</th><th>Charakter</th><th>AC</th><th>HP</th><th>Passive Perc.</th><th>Init</th><th></th></tr></thead>
      <tbody>${ids.map(u=>{const raw=S.sheets[u],s=raw?normSheet(clone(raw)):null,c=S.chars[u]||{};return html`<tr key=${u}><td><${Who} uid=${u}/></td>
        <td>${s?html`<b>${s.name||'Namenlos'}</b><br/><span class="sm soft">${clsLine(s)}</span>`:html`<span class="soft">noch keiner</span>`}</td>
        <td>${s?s.ac:''}</td><td>${s?s.hp+' / '+s.hpMax+(num(s.tmp)?' +'+s.tmp:''):''}</td><td>${s?passive(s):''}</td><td>${s?sg(initB(s)):''}</td>
        <td><span class="rowf">${s?html`<button class="btn s" onClick=${()=>{ui({gmSheet:u});window.scrollTo(0,0)}}>Bogen</button>`:null}${u!==S.uid&&(s||c.joined)?html`<${Confirm} label="Entfernen" ask=${s?'Charakter und Bogen löschen?':'Aus der Liste nehmen?'} yes="Entfernen" onYes=${()=>kick(u)}/>`:null}</span></td></tr>`})}</tbody></table></div>`}`}
function GmTab(){
  const v=S.ui.gm;
  return html`<h1 class="h1">Spielleitung</h1>
    <div class="subtabs" role="tablist">${[['session','Session'],['combat','Kampf'],['items','Inhalte'],['players','Spieler']].map(t=>html`<button key=${t[0]} role="tab" aria-selected=${v===t[0]} aria-current=${v===t[0]?'true':null} onClick=${()=>ui({gm:t[0]})}>${t[1]}</button>`)}</div>
    ${v==='combat'?html`<${GmCombat}/>`:v==='items'?html`<${GmItems}/>`:v==='players'?html`<${GmPlayers}/>`:html`<${GmSession}/>`}`}

/* ================= account, sign-in ================= */
const appUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
function CopyLink(){
  const [ok,setOk]=useState(false),u=appUrl(),ref=useRef(null);
  const copy=()=>{const done=()=>{setOk(true);setTimeout(()=>setOk(false),2500)};
    try{navigator.clipboard.writeText(u).then(done,()=>{sel()})}catch(e){sel()}};
  const sel=()=>{try{const r=document.createRange();r.selectNodeContents(ref.current);const w=getSelection();w.removeAllRanges();w.addRange(r)}catch(e){}};
  return html`<div class="copyrow"><code ref=${ref}>${u}</code><button class="btn s" onClick=${copy}>${ok?'Kopiert':'Kopieren'}</button></div>`}
const isMac=/Mac/.test(navigator.platform||navigator.userAgent),isSafari=/^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
const standalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}};
function InstallHint(){
  if(standalone())return html`<p class="sm soft">Du nutzt das Kampagnenbuch schon als App.</p>`;
  if(S.installEvt)return html`<button class="btn prime" onClick=${async()=>{const e=S.installEvt;S.installEvt=null;emit();try{e.prompt();await e.userChoice}catch(x){}}}>Als App installieren</button>`;
  return html`<p class="sm soft">${isSafari&&isMac?'Als App installieren: in Safari Ablage → Zum Dock hinzufügen.':'Als App installieren: in Chrome im Drei-Punkte-Menü → Streamen, speichern und teilen → Seite als App installieren, in Edge unter Apps → Diese Website als App installieren.'}</p>`}
function Account(){
  const close=()=>{S.acct=false;emit()},[n,setN]=useState((S.me&&S.me.name)||''),[busy,setBusy]=useState(false);
  const save=async e=>{e.preventDefault();if(!n.trim())return;setBusy(true);try{await setMyName(n);toast('Name gespeichert.')}catch(x){oops('Das Speichern')(x)}setBusy(false)};
  return html`<${Modal} title="Dein Konto" onClose=${close}><div class="stack" style="margin-top:.9rem">
    ${S.me&&S.me.email?html`<p class="soft sm" style="margin:0">Angemeldet als ${S.me.email}${S.isGM?' · Spielleitung':''}</p>`:null}
    <form class="rowf" style="align-items:flex-end" onSubmit=${save}><label class="fl grow"><span>Dein Name in der Gruppe</span><input class="in" id="acct-name" value=${n} onInput=${e=>setN(e.target.value)} maxlength="60"/></label><button class="btn" type="submit" disabled=${busy||!n.trim()}>Speichern</button></form>
    <${InstallHint}/>
    <div><button class="btn warn" onClick=${()=>{close();signOut()}}>Abmelden</button></div></div><//>`}
function Login(){
  const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',mail:'',pw:''}),[msg,setMsg]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
  const up=p=>{setF(Object.assign({},f,p));setMsg('')};
  const run=async fn=>{setBusy(true);setMsg('');setOk('');try{await fn()}catch(e){setMsg(authMsg(e))}setBusy(false)};
  const submit=e=>{e.preventDefault();
    if(mode==='reset')return run(async()=>{await resetMail(f.mail);setOk('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.')});
    if(mode==='new'){if(!f.name.trim()){setMsg('Gib deinen Namen ein.');return}return run(()=>signUpMail(f.name,f.mail,f.pw))}
    return run(()=>signInMail(f.mail,f.pw))};
  return html`<main class="wrap"><div class="login">
    <div class="brand"><${Lantern}/><span>Hollowmere<small>Kampagnenbuch</small></span></div>
    <p class="lead" style="margin:0">Melde dich an, um deinen Charakter, die Karte und die Chronik eurer Gruppe zu sehen.</p>
    <div class="box">
      <button class="btn solid gbtn" disabled=${busy} onClick=${()=>run(signInGoogle)}>Mit Google anmelden</button>
      <div class="or">oder mit E-Mail</div>
      <form class="stack" style="gap:.6rem" onSubmit=${submit}>
        ${mode==='new'?html`<label class="fl"><span>Dein Name</span><input class="in" id="lg-name" autocomplete="name" value=${f.name} onInput=${e=>up({name:e.target.value})}/></label>`:null}
        <label class="fl"><span>E-Mail</span><input class="in" id="lg-mail" type="email" autocomplete="email" value=${f.mail} onInput=${e=>up({mail:e.target.value})}/></label>
        ${mode!=='reset'?html`<label class="fl"><span>Passwort${mode==='new'?' (mindestens 6 Zeichen)':''}</span><input class="in" id="lg-pw" type="password" autocomplete=${mode==='new'?'new-password':'current-password'} value=${f.pw} onInput=${e=>up({pw:e.target.value})}/></label>`:null}
        ${msg?html`<p class="err" role="alert" style="margin:0">${msg}</p>`:null}${ok?html`<p class="ok" role="status" style="margin:0">${ok}</p>`:null}
        <button class="btn prime gbtn" type="submit" disabled=${busy}>${mode==='new'?'Konto anlegen':mode==='reset'?'Link zum Zurücksetzen schicken':'Anmelden'}</button>
      </form>
      <div class="rowf" style="justify-content:space-between">
        ${mode==='in'?html`<button class="linkbtn" onClick=${()=>{setMode('new');setMsg('')}}>Neu hier? Konto anlegen</button><button class="linkbtn" onClick=${()=>{setMode('reset');setMsg('')}}>Passwort vergessen</button>`
          :html`<button class="linkbtn" onClick=${()=>{setMode('in');setMsg('');setOk('')}}>Zurück zur Anmeldung</button>`}
      </div>
    </div>
    <p class="sm soft" style="margin:0">Dein Name und dein Charakter sind für deine Gruppe sichtbar. Deine E-Mail-Adresse nicht.</p>
  </div></main>`}
function NameAsk(){
  const [n,setN]=useState(''),[busy,setBusy]=useState(false);
  return html`<main class="wrap"><form class="login" onSubmit=${async e=>{e.preventDefault();if(!n.trim())return;setBusy(true);try{await setMyName(n)}catch(x){oops('Das Speichern')(x)}setBusy(false)}}>
    <div class="brand"><${Lantern}/><span>Hollowmere<small>Kampagnenbuch</small></span></div>
    <p class="lead" style="margin:0">Wie sollen dich die anderen in der Gruppe sehen?</p>
    <div class="box"><label class="fl"><span>Dein Name</span><input class="in" id="ask-name" value=${n} onInput=${e=>setN(e.target.value)} maxlength="60"/></label>
      <button class="btn solid gbtn" type="submit" disabled=${busy||!n.trim()}>Weiter</button></div></form></main>`}

/* ================= root ================= */
function Problem(){
  const t={lib:'Die App konnte ihre Bausteine nicht laden. Prüf deine Verbindung und lade die Seite neu.',config:'Die App ist noch nicht mit Firebase verbunden: In config.js fehlt die Konfiguration des Firebase-Projekts.',rules:'Die Datenbank lässt dich nicht hinein. Wahrscheinlich sind die Sicherheitsregeln in Firebase noch nicht eingetragen (Firestore Database → Regeln).',load:'Deine Daten konnten gerade nicht geladen werden. Prüf deine Verbindung und lade die Seite neu.'}[S.err]||'Etwas ist schiefgegangen. Lade die Seite neu.';
  return html`<main class="wrap"><div class="boot"><h1 class="h1">Hollowmere</h1><p class="lead">${t}</p>${S.uid?html`<button class="btn" onClick=${signOut}>Abmelden</button>`:null}</div></main>`}
function App(){
  const [,f]=useReducer(x=>x+1,0);
  subs.add(f); // the root listens from its very first render, so an early state change is never missed
  if(S.phase==='boot')return html`<main class="wrap"><div class="boot"><h1 class="h1">Hollowmere</h1><p class="lead">Die Laternen werden angezündet …</p></div></main>`;
  if(S.err)return html`<${Problem}/>`;
  if(S.phase==='login')return html`<${Login}/><${Toasts}/>`;
  if(S.me&&!S.me.name&&!(People.map[S.uid]||{}).name)return html`<${NameAsk}/><${Toasts}/>`;
  const t=S.ui.tab==='gm'&&!S.isGM?'sheet':S.ui.tab;
  return html`<${Top}/><main class="wrap" id="main"><${Strips}/>
    ${t==='party'?html`<${PartyTab}/>`:t==='map'?html`<${MapTab}/>`:t==='chron'?html`<${ChronTab}/>`:t==='notes'?html`<${NotesTab}/>`:t==='gm'?html`<${GmTab}/>`:html`<${SheetTab}/>`}
    </main>${S.acct?html`<${Account}/>`:null}<${Toasts}/>`}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();S.installEvt=e;emit()});
window.addEventListener('appinstalled',()=>{S.installEvt=null;emit()});
window.addEventListener('error',()=>{try{toast('Hier ist etwas schiefgegangen. Wenn es hakt, lade die Seite neu.','err')}catch(e){}});
const rootEl=document.getElementById('root');rootEl.textContent='';render(html`<${App}/>`,rootEl);
boot();

})();
