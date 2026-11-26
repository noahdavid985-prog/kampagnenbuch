(function(){'use strict';
if(!window.htmPreact||!window.nacl){document.getElementById('root').innerHTML='<main class="wrap"><div class="boot"><h1 class="h1">Tales of Nalvair</h1><p class="lead">Das Kampagnenbuch konnte seine Bausteine nicht laden. Prüf deine Verbindung und lade die Seite neu.</p></div></main>';return}
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
const CLASSES={Artificer:{hd:8,sv:['con','int'],ct:'halfup',ca:'int'},Barbarian:{hd:12,sv:['str','con']},Bard:{hd:8,sv:['dex','cha'],ct:'full',ca:'cha'},Cleric:{hd:8,sv:['wis','cha'],ct:'full',ca:'wis'},Druid:{hd:8,sv:['int','wis'],ct:'full',ca:'wis'},Fighter:{hd:10,sv:['str','con']},Monk:{hd:8,sv:['str','dex']},Paladin:{hd:10,sv:['wis','cha'],ct:'halfup',ca:'cha'},Ranger:{hd:10,sv:['str','dex'],ct:'halfup',ca:'wis'},Rogue:{hd:8,sv:['dex','int']},Sorcerer:{hd:6,sv:['con','cha'],ct:'full',ca:'cha'},Warlock:{hd:8,sv:['wis','cha'],ct:'pact',ca:'cha'},Wizard:{hd:6,sv:['int','wis'],ct:'full',ca:'int'}};
const FULL=[[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const CASTER={'':'Kein Caster / von Hand','full':'Full Caster','halfup':'Half Caster (Paladin, Ranger, Artificer)','half':'Half Caster, Regeln von 2014 (ab Level 2)','pact':'Pact Magic (Warlock)'};
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
  atk:[],cast:{type:'',ab:'',slots:[0,0,0,0,0,0,0,0,0],used:[0,0,0,0,0,0,0,0,0]},spells:[],feats:[],items:[],coins:{cp:0,sp:0,gp:0,pp:0},shareHp:true,col:''}}
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
  const c={name:s.name||'',cls:s.cls||'',sub:s.sub||'',lvl:lvlOf(s),race:s.race||'',size:s.size||'',look:String(s.look||'').slice(0,600),cond:(s.cond||[]).slice(0,16),shareHp:s.shareHp!==false,col:s.col||'',pv:x.pv||0,joined:x.joined||Date.now(),init:x.init||null,at:Date.now()};
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
/* look: dark (default), light, or follow the device; index.html sets it before the first paint, this keeps it current */
const mqLight=window.matchMedia?matchMedia('(prefers-color-scheme: light)'):null;
const themePref=()=>{const t=LS.get('theme','dark');return t==='light'||t==='auto'?t:'dark'};
const lightOn=()=>{const t=themePref();return t==='light'||(t==='auto'&&!!mqLight&&mqLight.matches)};
function applyTheme(){const l=lightOn();document.documentElement.setAttribute('data-theme',l?'light':'dark');
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',l?'#FBF9F3':'#0B161C')}
function setTheme(t){LS.set('theme',t);applyTheme();emit()}
if(mqLight){const f=()=>{if(themePref()==='auto'){applyTheme();emit()}};if(mqLight.addEventListener)mqLight.addEventListener('change',f);else if(mqLight.addListener)mqLight.addListener(f)}
applyTheme();
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
  const mine=S.chars[S.uid];if(mine&&num(mine.pv)>num(S.cardX.pv))S.cardX.pv=mine.pv; // the game master may have set my picture
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
  listen(db.doc('sheets/'+u),s=>{ // my sheet changed elsewhere: the game master handed me a character, or another device of mine saved
    if(!s.exists||sheetDirty||S.saving||(s.metadata&&s.metadata.hasPendingWrites))return;
    const d=normSheet(clone(s.data()));if(S.sheet&&canon(d)===canon(S.sheet))return;
    const was=S.sheet;S.sheet=d;emit();
    if(!was||was.name!==d.name)toast((d.name||'Ein Charakter')+' liegt jetzt in deinem Bogen.')});
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
const canon=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((o,kk)=>{o[kk]=v[kk];return o},{}):v);
async function gmAssign(uid,sheet,portrait){ // the game master puts a finished character into a player's sheet
  const s=normSheet(clone(sheet));delete s.tpl;delete s.plays;
  const old=S.chars[uid]||{};let pv=num(old.pv);
  if(portrait){const img=await loadImg(portrait),d=jpegUnder(coverCanvas(img,400,500),90000,0.84).d;pv=Date.now();
    await S.db.doc('chars/'+uid+'/media/portrait').set({d,v:pv});S.portraits[uid]={v:pv,d}}
  await S.db.doc('sheets/'+uid).set(s);
  await S.db.doc('chars/'+uid).set(cardOf(s,{pv,joined:old.joined||Date.now(),init:null}));
  if(uid===S.uid){clearTimeout(sheetT);sheetDirty=false;S.sheet=s;S.cardX.pv=pv}
  emit()}
function createSheet(s){S.sheet=normSheet(clone(s));delete S.sheet.tpl;delete S.sheet.plays;sheetDirty=true;flushSheet();ui({tab:'sheet',edit:true,sub:'kampf'});window.scrollTo(0,0)}
async function deleteSheet(){
  clearTimeout(sheetT);sheetDirty=false;
  try{await S.db.doc('sheets/'+S.uid).delete();await S.db.doc('chars/'+S.uid+'/media/portrait').delete();S.cardX.pv=0;S.cardX.init=null;await S.db.doc('chars/'+S.uid).set({joined:S.cardX.joined||Date.now()});S.sheet=null;delete S.portraits[S.uid];ui({edit:false})}catch(e){oops('Das Löschen')(e)}}
async function gmSetPortrait(uid,file){ // the game master puts a picture (or a placeholder) on a player's character
  try{const d=await pickPortrait(file),v=Date.now(),old=Object.assign({},S.chars[uid]||{}),raw=S.sheets[uid];delete old.id;
    await S.db.doc('chars/'+uid+'/media/portrait').set({d,v});
    await S.db.doc('chars/'+uid).set(Object.keys(old).length&&old.joined?Object.assign(old,{pv:v}):raw?cardOf(normSheet(clone(raw)),{pv:v,joined:old.joined||Date.now(),init:old.init||null}):{joined:Date.now(),pv:v});
    S.portraits[uid]={v,d};if(uid===S.uid)S.cardX.pv=v;emit();toast('Das Bild ist eingesetzt.')}
  catch(e){oops('Das Bild')(e)}}
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
  back:'<path d="M14 6l-6 6 6 6"/>',
  down:'<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  lamp:'<path d="M8.4 8.6h7.2l-1.1-1.8H9.5z"/><path d="M8.9 8.6v10h6.2v-10"/><path d="M7.7 18.6h8.6l-1.1 2.3H8.8z"/><path d="M12 3.2v3.6"/><path d="M12 11.1c1.5 1.6 1.8 2.8 1.2 3.9-.4.7-1.1 1-1.7.8-.7-.2-1.1-1-.8-1.9.2-.8.7-1.5 1.3-2.8z" fill="currentColor" stroke="none"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  moon:'<path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z"/>'};
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
function PortraitPick({uid,name,onFile,label}){
  const ref=useRef(null),p=S.portraits[uid],d=p&&p.d;
  return html`<button type="button" class="port" aria-label=${label||'Bild auswählen'} title=${label||'Bild auswählen'} onClick=${()=>ref.current&&ref.current.click()}>
      ${d?html`<img src=${d} alt=""/>`:html`<span aria-hidden="true">${initials(name)}</span>`}<span class="cam"><${Ic} n="cam"/></span></button>
    <input type="file" accept="image/*" hidden ref=${ref} onChange=${e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)(onFile||setPortrait)(f)}}/>`}
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

/* ================= overlay parts: medallion with level shield, nameplate, corner ornaments ================= */
const HCOL=[['amber','Amber'],['mint','Mint'],['coral','Koralle'],['violet','Violett'],['sky','Himmelblau'],['ivory','Elfenbein']];
const HCOL_NAME={pip:'sky',skibbidbabap:'sky',anaxarexol:'mint',nyx:'violet',raziel:'ivory',ben:'amber',balasar:'coral',norixius:'coral'}; // as in the camera overlay
function heroCol(c,uid){
  const k=c&&c.col;if(k&&HCOL.some(x=>x[0]===k))return k;
  const f=String((c&&c.name)||'').trim().split(/\s+/)[0].toLowerCase();if(HCOL_NAME[f])return HCOL_NAME[f];
  let h=0;const s=String(uid||f);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return HCOL[h%5][0]}
const mono=n=>(String(n||'').trim().charAt(0)||'?').toUpperCase();
function Medal({uid,name,lvl,onFile,label}){
  const ref=useRef(null),p=S.portraits[uid],d=p&&p.d;
  const face=d?html`<img src=${d} alt=${onFile?'':'Bild von '+(name||'einem Charakter')}/>`:html`<span aria-hidden="true">${mono(name)}</span>`;
  return html`<div class="medal">
    ${onFile?html`<button type="button" class="disc" aria-label=${label||'Bild auswählen'} title=${label||'Bild auswählen'} onClick=${()=>ref.current&&ref.current.click()}>${face}</button><span class="cam" aria-hidden="true"><${Ic} n="cam"/></span>
      <input type="file" accept="image/*" hidden ref=${ref} onChange=${e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)onFile(f)}}/>`
      :html`<div class="disc">${face}</div>`}
    ${lvl?html`<span class="shield" role="img" aria-label=${'Level '+lvl}><svg viewBox="0 0 52 60" aria-hidden="true"><path class="s1" d="M26 2 L49 9 V28 C49 43 39 52 26 58 C13 52 3 43 3 28 V9 Z"/><path class="s2" d="M26 7 L44 12.5 V28 C44 40 36 47.5 26 52.5 C16 47.5 8 40 8 28 V12.5 Z"/></svg><small aria-hidden="true">LEVEL</small><b aria-hidden="true">${lvl}</b></span>`:null}
  </div>`}
function NpSub({c}){
  const r=c.race,k=[c.cls,c.sub].filter(Boolean).join(' · ');
  if(!r&&!k)return html`<div class="np-sub">Noch ohne Class</div>`;
  return html`<div class="np-sub">${r?html`<span>${r}</span>`:null}${r&&k?html`<span class="sep" aria-hidden="true"></span> `:null}${k?html`<span class="k">${k}</span>`:null}</div>`}
const ORN='<path d="M9 64V22Q9 9 22 9h42"/><path d="M18 46V27q0-9 9-9h19" opacity=".5"/><rect x="5" y="5" width="8" height="8" transform="rotate(45 9 9)" fill="currentColor" stroke="none"/><circle cx="64" cy="9" r="2" fill="currentColor" stroke="none"/><circle cx="9" cy="64" r="2" fill="currentColor" stroke="none"/>';
function Orn(){return ['tl','tr','bl','br'].map(k=>html`<span key=${k} class=${'orn '+k} aria-hidden="true"><svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.6" dangerouslySetInnerHTML=${{__html:ORN}}></svg></span>`)}
function TitleCard(){return html`<div class="tcard"><${Lantern}/><h1 class="h1"><small>Tales of</small>Nalvair</h1><div class="dia" aria-hidden="true"><i></i><b></b><i></i></div><p class="script">Das Kampagnenbuch</p></div>`}

/* ================= masthead and strips ================= */
const TABS=[['sheet','Bogen','sheet'],['party','Gruppe','party'],['map','Karte','map'],['chron','Chronik','book'],['notes','Notizen','note'],['gm','Leitung','lantern']];
function chronUnread(){const seen=LS.get('seen',0);return S.inbox.filter(i=>!i.read).length+S.items.filter(i=>(i.pub||0)>seen).length}
function Top(){
  const unread=S.ui.tab==='chron'?S.inbox.filter(i=>!i.read).length:chronUnread();
  return html`<header class="top"><div class="wrap">
    <div class="top-row"><div class="brand"><${Lantern}/><span>Tales of Nalvair</span></div>
      <span class="right savest" role="status">${S.saving?'Speichert …':S.saveErr?'Nicht gespeichert':''}</span>
      <button class="acct themebtn" aria-label=${lightOn()?'Dunkles Design':'Helles Design'} title=${lightOn()?'Dunkles Design':'Helles Design'} onClick=${()=>setTheme(lightOn()?'dark':'light')}><${Ic} n=${lightOn()?'moon':'sun'}/></button>
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
  if(c.banner&&S.ui.tab!=='party')out.push(html`<div class="banner" key="b"><b>Von der Spielleitung:</b> ${c.banner}</div>`);
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
  if(mode==='build')return html`<${Builder} onExit=${()=>setMode('')}/>`;
  if(mode==='tpl')return html`<button class="btn quiet" onClick=${()=>setMode('')}><${Ic} n="back"/>Zurück</button>
    <h1 class="h1" style="margin-top:.8rem">Held vom Laternenfest</h1>
    <p class="lead">Die acht Helden aus der Nacht der gestohlenen Schatten, so wie sie auf Level 3 waren. Du übernimmst alle Werte und kannst danach alles ändern.</p>
    <div class="pick-grid">${HEROES.map(h=>html`<button key=${h.tpl} class="pick" onClick=${()=>createSheet(h)}><b>${h.name}</b><span class="soft">${h.race} ${h.cls}, ${h.sub}</span><span class="sm">${h.plays}</span></button>`)}</div>`;
  if(mode==='new')return html`<button class="btn quiet" onClick=${()=>setMode('')}><${Ic} n="back"/>Zurück</button>
    <h1 class="h1" style="margin-top:.8rem">Frei eintragen</h1>
    <p class="lead">Für höhere Level oder andere Regeln: Die Grundlagen reichen für den Anfang. Angriffe, Spells, Features und Ausrüstung trägst du gleich danach im Bogen ein.</p>
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
  const dr=hasDraft()?normDraft(LS.get(draftKey(),null)):null;
  return html`<h1 class="h1">Dein Charakter</h1>
    <p class="lead">Hier baust du deinen Helden und führst ihn durch die Kampagne. Gewürfelt wird am Tisch, der Bogen rechnet dir die Boni aus. Was du einträgst, wird automatisch gespeichert.</p>
    <div class="pick-grid" style="max-width:56rem">
      ${dr?html`<button class="pick lead-pick" id="nc-resume" onClick=${()=>setMode('build')}><b>Weiterbauen</b><span class="soft">${[dr.name.trim(),dr.cls,raceName(dr)].filter(Boolean).join(' · ')||'Dein Entwurf'}</span><span class="sm">Schritt ${dr.step+1} von ${BSTEPS.length}: ${BSTEPS[dr.step][1]}. Dein Entwurf ist in diesem Browser gespeichert.</span></button>`
        :html`<button class="pick lead-pick" id="nc-build" onClick=${()=>setMode('build')}><b>Schritt für Schritt bauen</b><span class="sm">Wie bei D&D Beyond: Klasse, Herkunft, Spezies, Attribute, Skills, Spells und Ausrüstung, jeweils mit Erklärung. Regeln von 2024, Level 1.</span></button>`}
      <button class="pick" onClick=${()=>setMode('tpl')}><b>Held vom Laternenfest</b><span class="sm">Mit Brannoc, Ida, Wren oder einem der anderen fünf weiterspielen. Alle Werte sind schon eingetragen.</span></button>
      <button class="pick" onClick=${()=>setMode('new')}><b>Frei eintragen</b><span class="sm">Für höhere Level oder andere Regeln: Grunddaten eintragen und den Rest im Bogen selbst ausfüllen.</span></button>
    </div>
    ${dr?html`<p class="sm" style="margin-top:.8rem"><${Confirm} label="Entwurf verwerfen und neu anfangen" cls="linkbtn" ask="Der Entwurf wird gelöscht." yes="Neu anfangen" onYes=${()=>{LS.set(draftKey(),null);setMode('build')}}/></p>`:null}`}

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

function Sheet({s,uid,edit,ro,set,gm,nopdf}){
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
    ${ro?null:html`<div><span class="lbl">Deine Farbe für Medaillon und Namensschild</span><div class="chips" role="group" aria-label="Farbe">
        ${HCOL.map(([k,n])=>html`<button key=${k} type="button" class=${'chip colchip hc-'+k} aria-pressed=${s.col===k} onClick=${()=>upd(()=>{s.col=k})}><i class="sw" aria-hidden="true"></i>${n}</button>`)}
        <button type="button" class="chip" aria-pressed=${!s.col} onClick=${()=>upd(()=>{s.col=''})}>Automatisch</button></div></div>`}
    ${ro?null:html`<label class="chk"><input type="checkbox" checked=${s.shareHp!==false} onChange=${ev=>{const v=ev.target.checked;upd(()=>{s.shareHp=v})}}/><span>Meine Hit Points in der Gruppenansicht zeigen</span></label>
      <div class="rowf"><${FileBtn} label="Bild auswählen" icon="cam" onFile=${setPortrait}/>
        <${Confirm} label="Charakter löschen" cls="btn warn" ask="Der ganze Bogen wird gelöscht." onYes=${deleteSheet}/></div>`}</div>`;

  return html`
    <div class="sh-head">
      <div class=${'np big hc-'+heroCol(s,uid)}>
        <${Medal} uid=${uid} name=${s.name} lvl=${L} label=${ro?'Bild einsetzen':'Bild auswählen'} onFile=${ro?(gm?f=>gmSetPortrait(uid,f):null):setPortrait}/>
        <div class="plate"><h1 class="np-name">${s.name||'Namenlos'}</h1><div class="np-rule" aria-hidden="true"></div><${NpSub} c=${s}/>
          <p class="np-who">gespielt von ${nameOf(uid)}</p>${s.bg?html`<div class="idtags"><span class="tag">Background: ${s.bg}</span></div>`:null}</div>
      </div>
      ${ro?(gm||!nopdf?html`<div class="sh-btns">${gm?html`<${FileBtn} label="Bild einsetzen" icon="cam" onFile=${f=>gmSetPortrait(uid,f)}/>`:null}${nopdf?null:html`<${PdfBtn} list=${()=>[{s,uid,player:pdfWho(uid)}]}/>`}</div>`:null)
        :html`<div class="sh-btns">
        <button class=${'btn'+(e?' solid':' prime')} aria-pressed=${e} onClick=${()=>ui({edit:!e})}><${Ic} n=${e?'check':'edit'}/>${e?'Fertig':'Bearbeiten'}</button>
        <button class="btn" onClick=${()=>setDlg('lvl')}>Level up</button><button class="btn" onClick=${()=>setDlg('rest')}>Rast</button><${PdfBtn} list=${()=>[{s,uid,player:pdfWho(uid)}]}/></div>`}
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

/* ================= rules data for the guided builder: 2024 Player's Handbook, level 1 =================
   Rule names stay English (as on D&D Beyond and in the book); every explanation is a short German summary. */

/* weapons: dice, damage type, category s(imple)/m(artial), r(anged)?, properties, mastery */
const WEAPONS={
  'Club':['1d4','bludgeoning','s',0,'Light','Slow'],'Dagger':['1d4','piercing','s',0,'Finesse, Light, Thrown (20/60)','Nick'],
  'Greatclub':['1d8','bludgeoning','s',0,'Two-Handed','Push'],'Handaxe':['1d6','slashing','s',0,'Light, Thrown (20/60)','Vex'],
  'Javelin':['1d6','piercing','s',0,'Thrown (30/120)','Slow'],'Light Hammer':['1d4','bludgeoning','s',0,'Light, Thrown (20/60)','Nick'],
  'Mace':['1d6','bludgeoning','s',0,'','Sap'],'Quarterstaff':['1d6','bludgeoning','s',0,'Versatile (1d8)','Topple'],
  'Sickle':['1d4','slashing','s',0,'Light','Nick'],'Spear':['1d6','piercing','s',0,'Thrown (20/60), Versatile (1d8)','Sap'],
  'Dart':['1d4','piercing','s',1,'Finesse, Thrown (20/60)','Vex'],'Light Crossbow':['1d8','piercing','s',1,'Ammunition (80/320), Loading, Two-Handed','Slow'],
  'Shortbow':['1d6','piercing','s',1,'Ammunition (80/320), Two-Handed','Vex'],'Sling':['1d4','bludgeoning','s',1,'Ammunition (30/120)','Slow'],
  'Battleaxe':['1d8','slashing','m',0,'Versatile (1d10)','Topple'],'Flail':['1d8','bludgeoning','m',0,'','Sap'],
  'Glaive':['1d10','slashing','m',0,'Heavy, Reach, Two-Handed','Graze'],'Greataxe':['1d12','slashing','m',0,'Heavy, Two-Handed','Cleave'],
  'Greatsword':['2d6','slashing','m',0,'Heavy, Two-Handed','Graze'],'Halberd':['1d10','slashing','m',0,'Heavy, Reach, Two-Handed','Cleave'],
  'Lance':['1d10','piercing','m',0,'Heavy, Reach, Two-Handed (unless mounted)','Topple'],'Longsword':['1d8','slashing','m',0,'Versatile (1d10)','Sap'],
  'Maul':['2d6','bludgeoning','m',0,'Heavy, Two-Handed','Topple'],'Morningstar':['1d8','piercing','m',0,'','Sap'],
  'Pike':['1d10','piercing','m',0,'Heavy, Reach, Two-Handed','Push'],'Rapier':['1d8','piercing','m',0,'Finesse','Vex'],
  'Scimitar':['1d6','slashing','m',0,'Finesse, Light','Nick'],'Shortsword':['1d6','piercing','m',0,'Finesse, Light','Vex'],
  'Trident':['1d8','piercing','m',0,'Thrown (20/60), Versatile (1d10)','Topple'],'Warhammer':['1d8','bludgeoning','m',0,'Versatile (1d10)','Push'],
  'War Pick':['1d8','piercing','m',0,'Versatile (1d10)','Sap'],'Whip':['1d4','slashing','m',0,'Finesse, Reach','Slow'],
  'Blowgun':['1','piercing','m',1,'Ammunition (25/100), Loading','Vex'],'Hand Crossbow':['1d6','piercing','m',1,'Ammunition (30/120), Light, Loading','Vex'],
  'Heavy Crossbow':['1d10','piercing','m',1,'Ammunition (100/400), Heavy, Loading, Two-Handed','Push'],'Longbow':['1d8','piercing','m',1,'Ammunition (150/600), Heavy, Two-Handed','Slow'],
  'Musket':['1d12','piercing','m',1,'Ammunition (40/120), Loading, Two-Handed','Slow'],'Pistol':['1d10','piercing','m',1,'Ammunition (30/90), Loading','Vex']};
const MASTERY={
  Cleave:'Triffst du, darfst du eine zweite Kreatur direkt daneben angreifen (einmal pro Zug, ohne Attributsbonus auf den Schaden).',
  Graze:'Verfehlst du, macht das Ziel trotzdem Schaden in Höhe deines Attributsmodifikators.',
  Nick:'Der Extra-Angriff mit der zweiten leichten Waffe kostet keine Bonusaktion mehr, sondern gehört zur Attack-Aktion.',
  Push:'Triffst du, schiebst du das Ziel (höchstens Large) bis zu 10 ft von dir weg.',
  Sap:'Triffst du, hat das Ziel bei seinem nächsten Angriff Disadvantage.',
  Slow:'Triffst du und machst Schaden, sinkt die Speed des Ziels bis zu deinem nächsten Zug um 10 ft.',
  Topple:'Triffst du, macht das Ziel einen CON Save oder liegt Prone.',
  Vex:'Triffst du und machst Schaden, hast du beim nächsten Angriff gegen dieses Ziel Advantage.'};
const isLight=w=>/Light/.test(WEAPONS[w][4]),isFinesse=w=>/Finesse/.test(WEAPONS[w][4]);

/* armor: base AC, how much DEX counts (99 = all, 2 = at most +2, 0 = none), training needed */
const ARMOR={'Padded Armor':[11,99,'light'],'Leather Armor':[11,99,'light'],'Studded Leather Armor':[12,99,'light'],
  'Hide Armor':[12,2,'medium'],'Chain Shirt':[13,2,'medium'],'Scale Mail':[14,2,'medium'],'Breastplate':[14,2,'medium'],'Half Plate Armor':[15,2,'medium'],
  'Ring Mail':[14,0,'heavy'],'Chain Mail':[16,0,'heavy'],'Splint Armor':[17,0,'heavy'],'Plate Armor':[18,0,'heavy']};

const PACKS={
  "Burglar's Pack":'Backpack, Ball Bearings, Bell, 10 Candles, Crowbar, Hooded Lantern, 7 Oil, 5 Tage Rationen, Rope, Tinderbox, Waterskin',
  "Dungeoneer's Pack":'Backpack, Caltrops, Crowbar, 2 Oil, 10 Tage Rationen, Rope, Tinderbox, 10 Torches, Waterskin',
  "Entertainer's Pack":'Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 Oil, 9 Tage Rationen, Tinderbox, Waterskin',
  "Explorer's Pack":'Backpack, Bedroll, 2 Oil, 10 Tage Rationen, Rope, Tinderbox, 10 Torches, Waterskin',
  "Priest's Pack":'Backpack, Blanket, Holy Water, Lamp, 7 Tage Rationen, Robe, Tinderbox',
  "Scholar's Pack":'Backpack, Book, Ink, Ink Pen, Lamp, 10 Oil, 10 Parchment, Tinderbox'};

const TOOLS={
  artisan:["Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies","Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils","Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools","Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools","Weaver's Tools","Woodcarver's Tools"],
  music:['Bagpipes','Drum','Dulcimer','Flute','Horn','Lute','Lyre','Pan Flute','Shawm','Viol'],
  gaming:['Dice','Dragonchess','Playing Cards','Three-Dragon Ante']};
const LANGS=['Common Sign Language','Draconic','Dwarvish','Elvish','Giant','Gnomish','Goblin','Halfling','Orc'];
const ALIGN=['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil','Unaligned'];
const SKILL_DE={'Acrobatics':'Akrobatik','Animal Handling':'Umgang mit Tieren','Arcana':'Arkane Kunde','Athletics':'Athletik','Deception':'Täuschen','History':'Geschichte','Insight':'Motiv erkennen','Intimidation':'Einschüchtern','Investigation':'Nachforschungen','Medicine':'Heilkunde','Nature':'Naturkunde','Perception':'Wahrnehmung','Performance':'Auftreten','Persuasion':'Überzeugen','Religion':'Religion','Sleight of Hand':'Fingerfertigkeit','Stealth':'Heimlichkeit','Survival':'Überleben'};
const AB_DE={str:'Stärke',dex:'Geschicklichkeit',con:'Konstitution',int:'Intelligenz',wis:'Weisheit',cha:'Charisma'};
const ALLSKILLS=SK.map(x=>x[0]);

/* origin feats */
const FEATS={
  'Alert':{d:'Du addierst deinen Proficiency Bonus zur Initiative. Direkt nach dem Initiative-Wurf darfst du deine Initiative mit einem willigen Verbündeten tauschen.'},
  'Crafter':{d:'Proficiency mit drei Artisan\'s Tools deiner Wahl. Nichtmagische Gegenstände kaufst du 20 % günstiger, und während einer Long Rest kannst du einfache Ausrüstung herstellen.',pick:'crafter'},
  'Healer':{d:'Mit einem Healer\'s Kit kannst du als Action einen Verbündeten versorgen: Er gibt einen Hit Die aus und heilt den Wurf plus deinen Proficiency Bonus. Würfelst du beim Heilen eine 1, darfst du neu würfeln.'},
  'Lucky':{d:'Du hast so viele Glückspunkte wie dein Proficiency Bonus. Für einen Punkt bekommst du Advantage auf einen d20-Wurf oder gibst einem Angriff gegen dich Disadvantage. Nach einer Long Rest sind alle wieder da.',uses:'pb'},
  'Magic Initiate':{d:'Du lernst zwei Cantrips und einen Spell des 1. Grades aus der Liste von Cleric, Druid oder Wizard. Den Spell kannst du einmal pro Long Rest ohne Slot wirken, mit Slots auch öfter.',pick:'magic'},
  'Musician':{d:'Proficiency mit drei Musikinstrumenten. Nach einer Short oder Long Rest kannst du mit einem Lied so vielen Verbündeten Heroic Inspiration geben, wie dein Proficiency Bonus beträgt.',pick:'musician'},
  'Savage Attacker':{d:'Einmal pro Zug darfst du die Schadenswürfel eines Waffentreffers zweimal würfeln und das bessere Ergebnis nehmen.'},
  'Skilled':{d:'Proficiency in drei Skills oder Tools deiner Wahl, beliebig gemischt.',pick:'skilled'},
  'Tavern Brawler':{d:'Dein Unarmed Strike macht 1d4 + STR. Einsen beim Schaden würfelst du neu, du kannst mit improvisierten Waffen umgehen und einmal pro Zug ein Ziel 5 ft wegstoßen.'},
  'Tough':{d:'Dein Hit-Point-Maximum steigt um 2 pro Level, also schon auf Level 1 um 2.'}};
const FIGHTING_STYLES={
  'Archery':'+2 auf Angriffswürfe mit Fernkampfwaffen.','Blind Fighting':'Du hast Blindsight 10 ft und siehst dort auch Unsichtbares.',
  'Defense':'+1 AC, solange du Rüstung trägst.','Dueling':'+2 Schaden mit einer einhändigen Nahkampfwaffe, wenn du keine zweite Waffe führst.',
  'Great Weapon Fighting':'Bei Zweihand- und Versatile-Waffen zählen gewürfelte 1en und 2en beim Schaden als 3.',
  'Interception':'Als Reaction verringerst du den Schaden an einem Verbündeten neben dir um 1d10 + Proficiency Bonus (mit Schild oder Waffe in der Hand).',
  'Protection':'Als Reaction gibst du einem Angriff gegen einen Verbündeten neben dir Disadvantage (mit Schild).',
  'Thrown Weapon Fighting':'Wurfwaffen ziehst du als Teil des Angriffs, und sie machen +2 Schaden.',
  'Two-Weapon Fighting':'Beim Extra-Angriff mit der zweiten leichten Waffe addierst du deinen Attributsmodifikator zum Schaden.',
  'Unarmed Fighting':'Dein Unarmed Strike macht 1d6 + STR, ohne Waffe und Schild 1d8. Wen du gepackt hältst, nimmt zu Beginn deines Zugs 1d4 Schaden.'};
const INVOCATIONS={
  'Armor of Shadows':'Du kannst Mage Armor auf dich selbst wirken, so oft du willst, ohne Slot.',
  'Eldritch Mind':'Advantage auf Constitution Saves, um Concentration zu halten.',
  'Pact of the Blade':'Du beschwörst eine Paktwaffe, mit der du proficient bist und für die du Charisma statt Stärke nutzen kannst.',
  'Pact of the Chain':'Du lernst Find Familiar und rufst einen besonderen Vertrauten, etwa einen Kobold, ein Quasit oder eine Schlange.',
  'Pact of the Tome':'Ein Buch der Schatten gibt dir drei zusätzliche Cantrips und zwei Ritual-Spells des 1. Grades von beliebigen Listen.'};

/* classes */
const C24={
  Barbarian:{hd:12,prim:'str',sv:['str','con'],tag:'Wilder Nahkämpfer, der vor Wut kaum umzuwerfen ist.',
    d:'Barbaren stürzen sich ins Getümmel und lassen ihre Wut für sich arbeiten. Im Rage teilen sie mehr Schaden aus und stecken Hiebe viel besser weg.',
    play:'Einfach zu spielen: nach vorn, Rage an, kräftig zuschlagen.',skills:[2,['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival']],
    armor:'Light, Medium, Shields',weapons:'Simple, Martial',w:['s','m'],at:['light','medium','shield'],mastery:2,
    eq:{A:{items:[['Greataxe',1],['Handaxe',4],["Explorer's Pack",1]],gp:15},B:{items:[],gp:75}},
    f:[['Rage','Bonusaktion, hält bis zu 10 Minuten: +2 Schaden mit Stärke-Angriffen, Advantage auf Stärke-Checks und -Saves, nur halber Schaden durch Hieb-, Stich- und Wuchtwaffen. Keine Spells.',2,'long'],
      ['Unarmored Defense','Ohne Rüstung ist deine AC 10 + DEX + CON. Ein Schild ist erlaubt.']],
    unarmored:'con'},
  Bard:{hd:8,prim:'cha',sv:['dex','cha'],tag:'Musiker und Alleskönner, der die Gruppe besser macht.',
    d:'Barden verweben Musik, Worte und Magie. Sie heilen, verzaubern, lenken ab und machen ihre Freunde mit Bardic Inspiration besser.',
    play:'Vielseitig: stark in Gesprächen, nützlich in jeder Lage.',skills:[3,ALLSKILLS],
    armor:'Light',weapons:'Simple',w:['s'],at:['light'],tools:{music:3},
    eq:{A:{items:[['Leather Armor',1],['Dagger',2],['Musikinstrument (siehe Tools)',1],["Entertainer's Pack",1]],gp:19},B:{items:[],gp:90}},
    f:[['Bardic Inspiration','Bonusaktion: Ein Verbündeter in 60 ft bekommt einen d6. Innerhalb einer Stunde darf er ihn nach einem missglückten d20-Wurf dazuzählen. So oft wie dein CHA-Modifikator (mindestens 1).','cha','long'],
      ['Spellcasting','Du wirkst Bard-Spells mit Charisma.']],
    sc:{ab:'cha',type:'full',cantrips:2,prep:4}},
  Cleric:{hd:8,prim:'wis',sv:['wis','cha'],tag:'Diener eines Gottes, Heiler und Beschützer.',
    d:'Kleriker tragen die Macht ihrer Gottheit in die Welt. Sie heilen, segnen und schützen, und mit Rüstung und Schild halten sie selbst an vorderster Front stand.',
    play:'Gut für Einsteiger: robust, hilfreich, viele nützliche Spells.',skills:[2,['History','Insight','Medicine','Persuasion','Religion']],
    armor:'Light, Medium, Shields',weapons:'Simple',w:['s'],at:['light','medium','shield'],
    eq:{A:{items:[['Chain Shirt',1],['Shield',1],['Mace',1],['Holy Symbol',1],["Priest's Pack",1]],gp:7},B:{items:[],gp:110}},
    f:[['Spellcasting','Du wirkst Cleric-Spells mit Weisheit. Nach jeder Long Rest wählst du neu, welche Spells du vorbereitet hast.']],
    sc:{ab:'wis',type:'full',cantrips:3,prep:4},
    order:{Protector:'Training mit Heavy Armor und Martial Weapons: du stehst vorn.',Thaumaturge:'Ein zusätzlicher Cantrip und dein WIS-Modifikator (mindestens +1) zusätzlich auf Arcana- und Religion-Checks.'}},
  Druid:{hd:8,prim:'wis',sv:['int','wis'],tag:'Hüter der Natur mit Pflanzen-, Tier- und Wettermagie.',
    d:'Druiden schöpfen Magie aus der Natur. Sie rufen Ranken und Blitze, heilen und reden mit Tieren. Ab Level 2 verwandeln sie sich selbst in Tiere.',
    play:'Vielseitige Magie, etwas mehr Planung.',skills:[2,['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival']],
    armor:'Light, Medium (keine Metallrüstung), Shields',weapons:'Simple',w:['s'],at:['light','medium','shield'],fixedTools:['Herbalism Kit'],
    eq:{A:{items:[['Leather Armor',1],['Shield',1],['Sickle',1],['Quarterstaff',1],["Explorer's Pack",1],['Herbalism Kit',1]],gp:9},B:{items:[],gp:50}},
    f:[['Spellcasting','Du wirkst Druid-Spells mit Weisheit. Nach jeder Long Rest wählst du neu, welche Spells du vorbereitet hast.'],['Druidic','Du kennst die Geheimsprache der Druiden und hast Speak with Animals immer vorbereitet.']],
    sc:{ab:'wis',type:'full',cantrips:2,prep:4},extraLang:['Druidic'],
    order:{Magician:'Ein zusätzlicher Cantrip und dein WIS-Modifikator (mindestens +1) zusätzlich auf Arcana- und Nature-Checks.',Warden:'Training mit Martial Weapons und Medium Armor: du kämpfst auch mit der Waffe.'}},
  Fighter:{hd:10,prim:'str',sv:['str','con'],tag:'Meister aller Waffen und Rüstungen.',
    d:'Kämpfer beherrschen jede Waffe und jede Rüstung. Sie halten durch, wo andere fallen, und holen mit Action Surge (ab Level 2) im richtigen Moment alles heraus.',
    play:'Am einfachsten zu spielen und sehr robust.',skills:[2,['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Persuasion','Perception','Survival']],
    armor:'Light, Medium, Heavy, Shields',weapons:'Simple, Martial',w:['s','m'],at:['light','medium','heavy','shield'],mastery:3,
    eq:{A:{items:[['Chain Mail',1],['Greatsword',1],['Flail',1],['Javelin',8],["Dungeoneer's Pack",1]],gp:4,label:'Schwer gerüstet, Nahkampf'},
      B:{items:[['Studded Leather Armor',1],['Scimitar',1],['Shortsword',1],['Longbow',1],['Arrows',20],['Quiver',1],["Dungeoneer's Pack",1]],gp:11,label:'Leicht gerüstet, Bogen und zwei Klingen'},
      C:{items:[],gp:155}},
    f:[['Second Wind','Bonusaktion: Du heilst 1d10 + dein Fighter-Level. Nach einer Short Rest bekommst du einen Einsatz zurück, nach einer Long Rest alle.',2,'long']]},
  Monk:{hd:8,prim:'dex',sv:['str','dex'],tag:'Flinker Kampfkünstler, der mit bloßen Händen kämpft.',
    d:'Mönche kämpfen mit Fäusten, Füßen und leichten Waffen und sind schneller als alle anderen. Ab Level 2 kommt Focus dazu, mit dem sie Schläge vervielfachen und ausweichen.',
    play:'Schnell und beweglich, mittlerer Aufwand.',skills:[2,['Acrobatics','Athletics','History','Insight','Religion','Stealth']],
    armor:'keine',weapons:'Simple, Martial mit der Eigenschaft Light',w:['s','ml'],at:[],tools:{monk:1},
    eq:{A:{items:[['Spear',1],['Dagger',5],['Artisan\'s Tools oder Musikinstrument (siehe Tools)',1],["Explorer's Pack",1]],gp:11},B:{items:[],gp:50}},
    f:[['Martial Arts','Unarmed Strikes und Monk-Waffen (Simple und leichte Martial Melee) machen mindestens 1d6 und dürfen DEX statt STR nutzen. Nach der Attack-Aktion darfst du als Bonusaktion einen Unarmed Strike ausführen.'],
      ['Unarmored Defense','Ohne Rüstung und Schild ist deine AC 10 + DEX + WIS.']],
    unarmored:'wis',unarmed:'1d6'},
  Paladin:{hd:10,prim:'str',sv:['wis','cha'],tag:'Heiliger Krieger mit Schwur, Schild und Heilkraft.',
    d:'Paladine sind durch einen heiligen Schwur gebunden. Sie kämpfen in schwerer Rüstung, heilen mit bloßer Hand und laden ihre Treffer mit göttlicher Macht auf.',
    play:'Robust und vielseitig, gut für Einsteiger.',skills:[2,['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion']],
    armor:'Light, Medium, Heavy, Shields',weapons:'Simple, Martial',w:['s','m'],at:['light','medium','heavy','shield'],mastery:2,
    eq:{A:{items:[['Chain Mail',1],['Shield',1],['Longsword',1],['Javelin',6],['Holy Symbol',1],["Priest's Pack",1]],gp:9},B:{items:[],gp:150}},
    f:[['Lay on Hands','Ein Vorrat von 5 Hit Points pro Paladin-Level. Mit einer Bonusaktion heilst du durch Berührung beliebig viel daraus, oder du gibst 5 Punkte aus, um das Gift zu entfernen.',5,'long'],
      ['Spellcasting','Du wirkst Paladin-Spells mit Charisma.']],
    sc:{ab:'cha',type:'halfup',cantrips:0,prep:2}},
  Ranger:{hd:10,prim:'dex',sv:['str','dex'],tag:'Fährtenleser und Bogenschütze mit Naturmagie.',
    d:'Waldläufer kennen die Wildnis wie niemand sonst. Sie jagen mit Bogen oder Klinge, markieren ihre Beute mit Hunter\'s Mark und nutzen kleine Naturzauber.',
    play:'Fernkampf oder zwei Klingen, mittlerer Aufwand.',skills:[3,['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival']],
    armor:'Light, Medium, Shields',weapons:'Simple, Martial',w:['s','m'],at:['light','medium','shield'],mastery:2,
    eq:{A:{items:[['Studded Leather Armor',1],['Scimitar',1],['Shortsword',1],['Longbow',1],['Arrows',20],['Quiver',1],['Druidic Focus (Mistelzweig)',1],["Explorer's Pack",1]],gp:7},B:{items:[],gp:150}},
    f:[['Favored Enemy','Hunter\'s Mark ist immer vorbereitet. Du kannst ihn zweimal pro Long Rest ohne Slot wirken.',2,'long'],['Spellcasting','Du wirkst Ranger-Spells mit Weisheit.']],
    sc:{ab:'wis',type:'halfup',cantrips:0,prep:2,always:["Hunter's Mark"]}},
  Rogue:{hd:8,prim:'dex',sv:['dex','int'],tag:'Heimlicher Spezialist für Schlösser, Fallen und gezielte Stiche.',
    d:'Schurken verlassen sich auf Geschick, List und den richtigen Moment. Mit Sneak Attack machen sie aus einem guten Treffer einen verheerenden.',
    play:'Einfach im Kampf, glänzt bei Erkundung und Tricks.',skills:[4,['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Persuasion','Sleight of Hand','Stealth']],
    armor:'Light',weapons:'Simple, Martial mit Finesse oder Light',w:['s','mfl'],at:['light'],mastery:2,fixedTools:["Thieves' Tools"],
    eq:{A:{items:[['Leather Armor',1],['Dagger',2],['Shortsword',1],['Shortbow',1],['Arrows',20],['Quiver',1],["Thieves' Tools",1],["Burglar's Pack",1]],gp:8},B:{items:[],gp:100}},
    f:[['Expertise','In zwei deiner Skills zählt dein Proficiency Bonus doppelt.'],['Sneak Attack','Einmal pro Zug +1d6 Schaden, wenn du mit einer Finesse- oder Fernkampfwaffe triffst und Advantage hast oder ein Verbündeter neben dem Ziel steht.'],
      ['Thieves\' Cant','Du kennst die Geheimsprache der Diebe und eine weitere Sprache.']],
    extraLang:["Thieves' Cant"],extraLangPick:1,expertise:2},
  Sorcerer:{hd:6,prim:'cha',sv:['con','cha'],tag:'Geborener Zauberer mit Magie im Blut.',
    d:'Zauberer tragen die Magie in sich, durch Abstammung oder ein seltsames Ereignis. Sie haben weniger Spells als ein Wizard, wirken sie aber mit roher Kraft.',
    play:'Starke Angriffszauber, wenig Hit Points.',skills:[2,['Arcana','Deception','Insight','Intimidation','Persuasion','Religion']],
    armor:'keine',weapons:'Simple',w:['s'],at:[],
    eq:{A:{items:[['Spear',1],['Dagger',2],['Arcane Focus (Kristall)',1],["Dungeoneer's Pack",1]],gp:28},B:{items:[],gp:50}},
    f:[['Innate Sorcery','Bonusaktion, 1 Minute lang: Deine Spell Save DC steigt um 1, und du hast Advantage auf Angriffe mit Sorcerer-Spells.',2,'long'],['Spellcasting','Du wirkst Sorcerer-Spells mit Charisma.']],
    sc:{ab:'cha',type:'full',cantrips:4,prep:2}},
  Warlock:{hd:8,prim:'cha',sv:['wis','cha'],tag:'Magie durch einen Pakt mit einem mächtigen Wesen.',
    d:'Hexenmeister haben einen Pakt mit einem übernatürlichen Wesen geschlossen. Sie haben wenige Spell Slots, die aber nach jeder Short Rest zurückkommen, und Eldritch Invocations, die ihre Magie formen.',
    play:'Mittlerer Aufwand, starke Cantrips.',skills:[2,['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion']],
    armor:'Light',weapons:'Simple',w:['s'],at:['light'],
    eq:{A:{items:[['Leather Armor',1],['Sickle',1],['Dagger',2],['Arcane Focus (Kugel)',1],['Book (okkultes Wissen)',1],["Scholar's Pack",1]],gp:15},B:{items:[],gp:100}},
    f:[['Pact Magic','Du wirkst Warlock-Spells mit Charisma. Deine Spell Slots kommen schon nach einer Short Rest zurück.']],
    sc:{ab:'cha',type:'pact',cantrips:2,prep:2}},
  Wizard:{hd:6,prim:'int',sv:['int','wis'],tag:'Gelehrter Magier mit dem größten Zauberbuch.',
    d:'Magier haben Zauberei studiert wie andere eine Wissenschaft. Ihr Zauberbuch wächst mit jedem Abenteuer, und für fast jedes Problem gibt es einen passenden Spell.',
    play:'Die meisten Optionen, braucht etwas Planung.',skills:[2,['Arcana','History','Insight','Investigation','Medicine','Nature','Religion']],
    armor:'keine',weapons:'Simple',w:['s'],at:[],
    eq:{A:{items:[['Dagger',2],['Quarterstaff',1],['Robe',1],['Spellbook',1],["Scholar's Pack",1]],gp:5},B:{items:[],gp:55}},
    f:[['Spellcasting','Du wirkst Wizard-Spells mit Intelligenz. Dein Zauberbuch enthält sechs Spells des 1. Grades, vier davon hast du jeweils vorbereitet.'],
      ['Ritual Adept','Ritual-Spells aus deinem Zauberbuch kannst du als Ritual wirken, ohne sie vorzubereiten.'],
      ['Arcane Recovery','Einmal am Tag holst du nach einer Short Rest verbrauchte Spell Slots zurück, zusammen höchstens halb so viele Grade wie dein Wizard-Level (aufgerundet).',1,'long']],
    sc:{ab:'int',type:'full',cantrips:3,prep:4,book:6}}};

/* species */
const SPECIES={
  Aasimar:{size:['Medium','Small'],speed:30,dv:60,tag:'Mit himmlischem Funken, heilende Hände.',
    d:'Aasimar tragen das Licht der Oberen Ebenen in sich. Manche sehen fast aus wie Menschen, andere haben leuchtende Augen oder einen Schimmer auf der Haut.',
    t:[['Celestial Resistance','Resistance gegen Necrotic und Radiant.'],['Darkvision','60 ft.'],['Healing Hands','Magic-Aktion: Du heilst eine berührte Kreatur um so viele d4, wie dein Proficiency Bonus beträgt.',1,'long'],['Light Bearer','Du kennst den Cantrip Light (Charisma).'],['Celestial Revelation','Ab Level 3: himmlische Verwandlung mit Flügeln, Strahlen oder Schrecken.']],cantrip:['Light','cha']},
  Dragonborn:{size:['Medium'],speed:30,dv:60,tag:'Drachenblut mit Odemwaffe.',
    d:'Drachenblütige stammen von Drachen ab, sind stolz, groß und geschuppt. Ihre Abstammung bestimmt die Art ihres Odems und ihre Resistenz.',
    t:[['Draconic Ancestry','Deine Drachenart bestimmt Schadensart von Odem und Resistenz.'],['Breath Weapon','Ersetzt einen Angriff: 15-ft-Kegel oder 30-ft-Linie, DEX Save (DC 8 + CON + Proficiency Bonus), 1d10 Schaden, halb bei Erfolg.','pb','long'],['Damage Resistance','Resistance gegen die Schadensart deiner Abstammung.'],['Darkvision','60 ft.'],['Draconic Flight','Ab Level 5: für kurze Zeit Flügel.']],
    choose:{key:'ancestry',label:'Drachenart',opts:{Black:'Acid',Blue:'Lightning',Brass:'Fire',Bronze:'Lightning',Copper:'Acid',Gold:'Fire',Green:'Poison',Red:'Fire',Silver:'Cold',White:'Cold'}}},
  Dwarf:{size:['Medium'],speed:30,dv:120,tag:'Zäh, standhaft, spürt Stein.',
    d:'Zwerge stammen aus den Tiefen der Erde. Sie sind zäh, vertragen Gift und spüren durch den Stein, was sich um sie herum bewegt.',
    t:[['Darkvision','120 ft.'],['Dwarven Resilience','Resistance gegen Poison und Advantage gegen den Zustand Poisoned.'],['Dwarven Toughness','+1 Hit Point pro Level.'],['Stonecunning','Bonusaktion: 10 Minuten Tremorsense 60 ft, solange du auf Stein stehst.','pb','long']],hpPerLevel:1},
  Elf:{size:['Medium'],speed:30,dv:60,tag:'Feenblut, scharfe Sinne, Trance statt Schlaf.',
    d:'Elfen sind langlebig und mit dem Feenreich verbunden. Sie schlafen nicht, sondern meditieren, und ihre Linie gibt ihnen eigene Magie.',
    t:[['Darkvision','60 ft (Drow: 120 ft).'],['Fey Ancestry','Advantage gegen Charmed.'],['Keen Senses','Proficiency in Insight, Perception oder Survival.'],['Trance','Vier Stunden Meditation ersetzen eine Long Rest voll Schlaf.']],keen:['Insight','Perception','Survival'],
    choose:{key:'lineage',label:'Elfenlinie',opts:{Drow:'Darkvision 120 ft, Cantrip Dancing Lights; ab Level 3 Faerie Fire, ab 5 Darkness.','High Elf':'Cantrip Prestidigitation (nach jeder Long Rest austauschbar); ab Level 3 Detect Magic, ab 5 Misty Step.','Wood Elf':'Speed 35 ft, Cantrip Druidcraft; ab Level 3 Longstrider, ab 5 Pass without Trace.'}}},
  Gnome:{size:['Small'],speed:30,dv:60,tag:'Klein, schlau, magisch begabt.',
    d:'Gnome sind kleine, neugierige Tüftler und Geschichtenerzähler. Ihr Verstand ist schwer zu beeinflussen.',
    t:[['Darkvision','60 ft.'],['Gnomish Cunning','Advantage auf Intelligence-, Wisdom- und Charisma-Saves.']],
    choose:{key:'lineage',label:'Gnomenlinie',opts:{'Forest Gnome':'Cantrip Minor Illusion; Speak with Animals so oft wie dein Proficiency Bonus pro Long Rest ohne Slot.','Rock Gnome':'Cantrips Mending und Prestidigitation; du baust kleine Uhrwerk-Spielereien.'}}},
  Goliath:{size:['Medium'],speed:35,dv:0,tag:'Riesenblut, groß und kräftig.',
    d:'Goliaths stammen von Riesen ab. Sie sind groß, stark und tragen eine Gabe ihrer Riesenvorfahren in sich.',
    t:[['Giant Ancestry','Eine Gabe deiner Riesenabstammung, so oft wie dein Proficiency Bonus pro Long Rest.','pb','long'],['Large Form','Ab Level 5: kurz zu Large wachsen.'],['Powerful Build','Advantage, um Grappled zu beenden; du trägst wie eine Größe größer.']],
    choose:{key:'ancestry',label:'Riesengabe',opts:{"Cloud's Jaunt":'Bonusaktion: bis zu 30 ft teleportieren.',"Fire's Burn":'Bei einem Treffer +1d10 Fire.',"Frost's Chill":'Bei einem Treffer +1d6 Cold und Speed −10 ft.',"Hill's Tumble":'Bei einem Treffer: Ziel (höchstens Large) liegt Prone.',"Stone's Endurance":'Reaction: Schaden um 1d12 + CON verringern.',"Storm's Thunder":'Reaction, wenn du Schaden nimmst: Angreifer in 60 ft nimmt 1d8 Thunder.'}}},
  Halfling:{size:['Small'],speed:30,dv:0,tag:'Klein, mutig und vom Glück begünstigt.',
    d:'Halblinge sind klein, gesellig und erstaunlich mutig. Das Glück scheint ihnen in letzter Sekunde immer wieder zu helfen.',
    t:[['Brave','Advantage gegen Frightened.'],['Halfling Nimbleness','Du darfst dich durch den Raum größerer Kreaturen bewegen.'],['Luck','Würfelst du bei einem d20-Wurf eine 1, würfelst du neu.'],['Naturally Stealthy','Du kannst dich hinter größeren Kreaturen verstecken.']]},
  Human:{size:['Medium','Small'],speed:30,dv:0,tag:'Anpassungsfähig, mit einem Extra-Feat.',
    d:'Menschen sind die verbreitetsten und vielseitigsten Leute der Welt. Sie bekommen ein zusätzliches Origin Feat und einen Skill.',
    t:[['Resourceful','Nach jeder Long Rest hast du Heroic Inspiration: einmal einen beliebigen Wurf neu würfeln.'],['Skillful','Proficiency in einem Skill deiner Wahl.'],['Versatile','Ein zusätzliches Origin Feat deiner Wahl.']],skillful:true,versatile:true},
  Orc:{size:['Medium'],speed:30,dv:120,tag:'Ausdauernd, schnell, kaum kleinzukriegen.',
    d:'Orks sind kräftig, ausdauernd und kämpfen sich durch, wo andere aufgeben.',
    t:[['Adrenaline Rush','Bonusaktion: Dash und Temporary Hit Points in Höhe deines Proficiency Bonus.','pb','short'],['Darkvision','120 ft.'],['Relentless Endurance','Fällst du auf 0 Hit Points, bleibst du stattdessen bei 1 stehen.',1,'long']]},
  Tiefling:{size:['Medium','Small'],speed:30,dv:60,tag:'Höllisches Erbe, Hörner und Magie.',
    d:'Tieflinge tragen das Erbe der Unteren Ebenen: Hörner, Schwanz, ungewöhnliche Haut. Ihr Erbe gibt ihnen Resistenz und Magie.',
    t:[['Darkvision','60 ft.'],['Fiendish Legacy','Resistenz und Magie je nach Erbe (siehe Auswahl).'],['Otherworldly Presence','Du kennst den Cantrip Thaumaturgy.']],cantrip:['Thaumaturgy',null],
    choose:{key:'lineage',label:'Höllisches Erbe',opts:{Abyssal:'Resistance gegen Poison, Cantrip Poison Spray; ab Level 3 Ray of Sickness, ab 5 Hold Person.',Chthonic:'Resistance gegen Necrotic, Cantrip Chill Touch; ab Level 3 False Life, ab 5 Ray of Enfeeblement.',Infernal:'Resistance gegen Fire, Cantrip Fire Bolt; ab Level 3 Hellish Rebuke, ab 5 Darkness.'}}}};
const LINEAGE_CANTRIP={Drow:'Dancing Lights','High Elf':'Prestidigitation','Wood Elf':'Druidcraft','Forest Gnome':'Minor Illusion','Rock Gnome':'Mending',Abyssal:'Poison Spray',Chthonic:'Chill Touch',Infernal:'Fire Bolt'};

/* backgrounds */
const BG24={
  Acolyte:{ab:['int','wis','cha'],sk:['Insight','Religion'],tool:"Calligrapher's Supplies",feat:'Magic Initiate',fl:'Cleric',d:'Du hast in einem Tempel gedient und die Riten deines Glaubens gelernt.',eq:[['Calligrapher\'s Supplies',1],['Book (Gebete)',1],['Holy Symbol',1],['Parchment',10],['Robe',1]],gp:8},
  Artisan:{ab:['str','dex','int'],sk:['Investigation','Persuasion'],tool:'artisan',feat:'Crafter',d:'Du hast in einer Werkstatt ein Handwerk gelernt und weißt, was gute Arbeit wert ist.',eq:[["Artisan's Tools (deine Wahl)",1],['Pouch',2],["Traveler's Clothes",1]],gp:32},
  Charlatan:{ab:['dex','con','cha'],sk:['Deception','Sleight of Hand'],tool:'Forgery Kit',feat:'Skilled',d:'Du hast dich mit falschen Namen, gefälschten Papieren und schönen Lügen durchgeschlagen.',eq:[['Forgery Kit',1],['Costume',1],['Fine Clothes',1]],gp:15},
  Criminal:{ab:['dex','con','int'],sk:['Sleight of Hand','Stealth'],tool:"Thieves' Tools",feat:'Alert',d:'Du hast als Dieb, Schmuggler oder Einbrecher gelebt und kennst die dunklen Gassen.',eq:[['Dagger',2],["Thieves' Tools",1],['Crowbar',1],['Pouch',2],["Traveler's Clothes",1]],gp:16},
  Entertainer:{ab:['str','dex','cha'],sk:['Acrobatics','Performance'],tool:'music',feat:'Musician',d:'Du bist mit Gauklern, Musikern oder einem Wanderzirkus über Land gezogen.',eq:[['Musikinstrument (deine Wahl)',1],['Costume',2],['Mirror',1],['Perfume',1],["Traveler's Clothes",1]],gp:11},
  Farmer:{ab:['str','con','wis'],sk:['Animal Handling','Nature'],tool:"Carpenter's Tools",feat:'Tough',d:'Du bist auf dem Land aufgewachsen, hast Felder bestellt und Tiere versorgt.',eq:[['Sickle',1],["Carpenter's Tools",1],["Healer's Kit",1],['Iron Pot',1],['Shovel',1],["Traveler's Clothes",1]],gp:30},
  Guard:{ab:['str','int','wis'],sk:['Athletics','Perception'],tool:'gaming',feat:'Alert',d:'Du hast Stadtmauern, Tore oder einen Adligen bewacht und gelernt, wachsam zu bleiben.',eq:[['Spear',1],['Light Crossbow',1],['Bolts',20],['Spielset (deine Wahl)',1],['Hooded Lantern',1],['Manacles',1],['Quiver',1],["Traveler's Clothes",1]],gp:12},
  Guide:{ab:['dex','con','wis'],sk:['Stealth','Survival'],tool:"Cartographer's Tools",feat:'Magic Initiate',fl:'Druid',d:'Du hast Reisende durch die Wildnis geführt und kennst Pfade, die auf keiner Karte stehen.',eq:[['Shortbow',1],['Arrows',20],["Cartographer's Tools",1],['Bedroll',1],['Quiver',1],['Tent',1],["Traveler's Clothes",1]],gp:3},
  Hermit:{ab:['con','wis','cha'],sk:['Medicine','Religion'],tool:'Herbalism Kit',feat:'Healer',d:'Du hast lange abgeschieden gelebt, in einer Hütte, Höhle oder einem Kloster.',eq:[['Quarterstaff',1],['Herbalism Kit',1],['Bedroll',1],['Book (Philosophie)',1],['Lamp',1],['Oil',3],["Traveler's Clothes",1]],gp:16},
  Merchant:{ab:['con','int','cha'],sk:['Animal Handling','Persuasion'],tool:"Navigator's Tools",feat:'Lucky',d:'Du hast mit Waren gehandelt, Karawanen begleitet und gelernt, gut zu verhandeln.',eq:[["Navigator's Tools",1],['Pouch',2],["Traveler's Clothes",1]],gp:22},
  Noble:{ab:['str','int','cha'],sk:['History','Persuasion'],tool:'gaming',feat:'Skilled',d:'Du bist in einer adligen Familie aufgewachsen, mit Titel, Pflichten und Bediensteten.',eq:[['Spielset (deine Wahl)',1],['Fine Clothes',1],['Perfume',1]],gp:29},
  Sage:{ab:['con','int','wis'],sk:['Arcana','History'],tool:"Calligrapher's Supplies",feat:'Magic Initiate',fl:'Wizard',d:'Du hast Jahre in Bibliotheken und Akademien verbracht und Wissen gesammelt.',eq:[['Quarterstaff',1],["Calligrapher's Supplies",1],['Book (Geschichte)',1],['Parchment',8],['Robe',1]],gp:8},
  Sailor:{ab:['str','dex','wis'],sk:['Acrobatics','Perception'],tool:"Navigator's Tools",feat:'Tavern Brawler',d:'Du bist zur See gefahren, hast Stürme überstanden und in Hafenkneipen gerauft.',eq:[['Dagger',1],["Navigator's Tools",1],['Rope',1],["Traveler's Clothes",1]],gp:20},
  Scribe:{ab:['dex','int','wis'],sk:['Investigation','Perception'],tool:"Calligrapher's Supplies",feat:'Skilled',d:'Du hast Bücher abgeschrieben, Urkunden aufgesetzt und gelernt, auf jedes Detail zu achten.',eq:[["Calligrapher's Supplies",1],['Fine Clothes',1],['Lamp',1],['Oil',3],['Parchment',12]],gp:23},
  Soldier:{ab:['str','dex','con'],sk:['Athletics','Intimidation'],tool:'gaming',feat:'Savage Attacker',d:'Du hast in einer Armee gedient, gedrillt und gekämpft.',eq:[['Spear',1],['Shortbow',1],['Arrows',20],['Spielset (deine Wahl)',1],["Healer's Kit",1],['Quiver',1],["Traveler's Clothes",1]],gp:14},
  Wayfarer:{ab:['dex','wis','cha'],sk:['Insight','Stealth'],tool:"Thieves' Tools",feat:'Lucky',d:'Du bist auf der Straße aufgewachsen und hast gelernt, mit wenig auszukommen.',eq:[['Dagger',2],["Thieves' Tools",1],['Spielset (deine Wahl)',1],['Bedroll',1],['Pouch',2],["Traveler's Clothes",1]],gp:16}};

/* spells of levels 0 and 1: casting time, range, concentration, ritual, short summary */
const SP={
  'Acid Splash':[0,'Action','60 ft',0,0,'Kreaturen in 5 ft Radius machen einen DEX Save, sonst 1d6 Acid.'],
  'Blade Ward':[0,'Action','Self',1,0,'Bis 1 Minute: Wer dich angreift, zieht 1d4 von seinem Angriffswurf ab.'],
  'Chill Touch':[0,'Action','Touch',0,0,'Melee Spell Attack, 1d10 Necrotic. Das Ziel kann bis zu deinem nächsten Zug nicht geheilt werden.'],
  'Dancing Lights':[0,'Action','120 ft',1,0,'Bis zu vier schwebende Lichter, die du bewegen kannst.'],
  'Druidcraft':[0,'Action','30 ft',0,0,'Kleine Naturwunder: Wetter vorhersagen, Blüte öffnen, Funken, Duft.'],
  'Eldritch Blast':[0,'Action','120 ft',0,0,'Ranged Spell Attack, 1d10 Force. Ab Level 5 mehrere Strahlen.'],
  'Elementalism':[0,'Action','30 ft',0,0,'Kleine Elementareffekte: Windstoß, Funken, Nebel, Staub formen.'],
  'Fire Bolt':[0,'Action','120 ft',0,0,'Ranged Spell Attack, 1d10 Fire. Entzündet brennbare Dinge.'],
  'Friends':[0,'Action','10 ft',1,0,'Advantage auf Charisma-Checks gegen eine Kreatur. Sie merkt danach, dass du gezaubert hast.'],
  'Guidance':[0,'Action','Touch',1,0,'Ein Verbündeter bekommt +1d4 auf Checks mit einem Skill deiner Wahl.'],
  'Light':[0,'Action','Touch',0,0,'Ein Gegenstand leuchtet eine Stunde hell im Umkreis von 20 ft.'],
  'Mage Hand':[0,'Action','30 ft',0,0,'Eine Geisterhand bewegt Gegenstände bis 10 lb, öffnet Türen, holt Dinge.'],
  'Mending':[0,'1 Minute','Touch',0,0,'Repariert einen Riss oder Bruch an einem Gegenstand.'],
  'Message':[0,'Action','120 ft',0,0,'Du flüsterst einer Kreatur eine Nachricht zu, sie kann leise antworten.'],
  'Mind Sliver':[0,'Action','60 ft',0,0,'INT Save, sonst 1d6 Psychic und −1d4 auf den nächsten Save.'],
  'Minor Illusion':[0,'Action','30 ft',0,0,'Ein Geräusch oder ein unbewegtes Bild (5-ft-Würfel) für 1 Minute.'],
  'Poison Spray':[0,'Action','30 ft',0,0,'Ranged Spell Attack, 1d12 Poison.'],
  'Prestidigitation':[0,'Action','10 ft',0,0,'Harmlose Tricks: Kerze anzünden, reinigen, wärmen, kleines Zeichen.'],
  'Produce Flame':[0,'Bonus Action','Self',0,0,'Flamme in der Hand als Licht. Geworfen: Ranged Spell Attack 60 ft, 1d8 Fire.'],
  'Ray of Frost':[0,'Action','60 ft',0,0,'Ranged Spell Attack, 1d8 Cold und Speed −10 ft.'],
  'Resistance':[0,'Action','Touch',1,0,'Wähle eine Schadensart: Einmal pro Zug sinkt Schaden dieser Art am Ziel um 1d4.'],
  'Sacred Flame':[0,'Action','60 ft',0,0,'DEX Save, sonst 1d8 Radiant. Deckung hilft nicht.'],
  'Shillelagh':[0,'Bonus Action','Self',0,0,'Keule oder Kampfstab nutzt dein Zauberattribut und macht 1d8 Schaden.'],
  'Shocking Grasp':[0,'Action','Touch',0,0,'Melee Spell Attack, 1d8 Lightning. Das Ziel kann keine Opportunity Attacks machen.'],
  'Sorcerous Burst':[0,'Action','120 ft',0,0,'Ranged Spell Attack, 1d8 einer Element-Schadensart. Jede gewürfelte 8 bringt einen Extra-d8.'],
  'Spare the Dying':[0,'Action','15 ft',0,0,'Stabilisiert eine Kreatur mit 0 Hit Points.'],
  'Starry Wisp':[0,'Action','60 ft',0,0,'Ranged Spell Attack, 1d8 Radiant. Das Ziel leuchtet und kann nicht unsichtbar sein.'],
  'Thaumaturgy':[0,'Action','30 ft',0,0,'Kleine Wunder: donnernde Stimme, flackernde Flammen, Beben, Türen fliegen auf.'],
  'Thorn Whip':[0,'Action','30 ft',0,0,'Melee Spell Attack, 1d6 Piercing. Zieht das Ziel bis 10 ft zu dir.'],
  'Thunderclap':[0,'Action','Self',0,0,'Alle in 5 ft machen einen CON Save, sonst 1d6 Thunder.'],
  'Toll the Dead':[0,'Action','60 ft',0,0,'WIS Save, sonst 1d8 Necrotic, 1d12 wenn das Ziel schon verletzt ist.'],
  'True Strike':[0,'Action','Self',0,0,'Ein Waffenangriff mit deinem Zauberattribut statt STR oder DEX.'],
  'Vicious Mockery':[0,'Action','60 ft',0,0,'WIS Save, sonst 1d6 Psychic und Disadvantage beim nächsten Angriff.'],
  'Word of Radiance':[0,'Action','5 ft',0,0,'Gewählte Kreaturen in 5 ft machen einen CON Save, sonst 1d6 Radiant.'],
  'Alarm':[1,'1 Minute','30 ft',0,1,'Ein Bereich warnt dich 8 Stunden lang, wenn jemand ihn betritt.'],
  'Animal Friendship':[1,'Action','30 ft',0,0,'Ein Tier macht einen WIS Save, sonst ist es 24 Stunden Charmed.'],
  'Armor of Agathys':[1,'Bonus Action','Self',0,0,'5 Temporary Hit Points. Wer dich im Nahkampf trifft, nimmt 5 Cold.'],
  'Arms of Hadar':[1,'Action','Self',0,0,'Alle in 10 ft machen einen STR Save, sonst 2d6 Necrotic und keine Reactions.'],
  'Bane':[1,'Action','30 ft',1,0,'Bis zu drei Kreaturen machen einen CHA Save, sonst −1d4 auf Angriffe und Saves.'],
  'Bless':[1,'Action','30 ft',1,0,'Bis zu drei Verbündete bekommen +1d4 auf Angriffe und Saves.'],
  'Burning Hands':[1,'Action','Self (15-ft-Kegel)',0,0,'DEX Save, sonst 3d6 Fire, halb bei Erfolg.'],
  'Charm Person':[1,'Action','30 ft',0,0,'Ein Humanoid macht einen WIS Save, sonst ist er eine Stunde lang freundlich zu dir.'],
  'Chromatic Orb':[1,'Action','90 ft',0,0,'Ranged Spell Attack, 3d8 einer gewählten Schadensart. Bei doppelten Würfeln springt die Kugel weiter.'],
  'Color Spray':[1,'Action','Self (15-ft-Kegel)',0,0,'CON Save, sonst Blinded bis zum Ende deines nächsten Zugs.'],
  'Command':[1,'Action','60 ft',0,0,'WIS Save, sonst befolgt das Ziel ein Wort: Approach, Drop, Flee, Grovel oder Halt.'],
  'Compelled Duel':[1,'Bonus Action','30 ft',1,0,'WIS Save, sonst hat das Ziel Disadvantage gegen andere und kann sich nicht freiwillig von dir entfernen.'],
  'Comprehend Languages':[1,'Action','Self',0,1,'Eine Stunde lang verstehst du jede gesprochene und geschriebene Sprache.'],
  'Create or Destroy Water':[1,'Action','30 ft',0,0,'Erschafft oder vernichtet bis zu 10 Gallonen Wasser.'],
  'Cure Wounds':[1,'Action','Touch',0,0,'Heilt 2d8 + dein Zaubermodifikator.'],
  'Detect Evil and Good':[1,'Action','Self',1,0,'Du spürst Aberrationen, Himmlische, Elementare, Feen, Unholde und Untote in 30 ft.'],
  'Detect Magic':[1,'Action','Self',1,1,'Du spürst Magie in 30 ft und erkennst ihre Schule.'],
  'Detect Poison and Disease':[1,'Action','Self',1,1,'Du spürst Gifte, giftige Kreaturen und Krankheiten in 30 ft.'],
  'Disguise Self':[1,'Action','Self',0,0,'Eine Stunde lang siehst du anders aus, auch Kleidung und Ausrüstung.'],
  'Dissonant Whispers':[1,'Action','60 ft',0,0,'WIS Save, sonst 3d6 Psychic und das Ziel muss vor dir fliehen. Halb bei Erfolg.'],
  'Divine Favor':[1,'Bonus Action','Self',0,0,'Eine Minute lang machen deine Waffentreffer +1d4 Radiant.'],
  'Divine Smite':[1,'Bonus Action','Self',0,0,'Direkt nach einem Nahkampftreffer: +2d8 Radiant, gegen Unholde und Untote +1d8 mehr.'],
  'Ensnaring Strike':[1,'Bonus Action','Self',1,0,'Nach einem Waffentreffer: STR Save, sonst Restrained in Ranken und 1d6 Piercing pro Zug.'],
  'Entangle':[1,'Action','90 ft',1,0,'Ranken in einem 20-ft-Quadrat: STR Save, sonst Restrained. Schwieriges Gelände.'],
  'Expeditious Retreat':[1,'Bonus Action','Self',1,0,'Du kannst jede Runde als Bonusaktion Dash nutzen.'],
  'Faerie Fire':[1,'Action','60 ft',1,0,'Kreaturen in einem 20-ft-Würfel leuchten (DEX Save). Angriffe gegen sie haben Advantage.'],
  'False Life':[1,'Action','Self',0,0,'Du bekommst 2d4 + 4 Temporary Hit Points.'],
  'Feather Fall':[1,'Reaction','60 ft',0,0,'Bis zu fünf fallende Kreaturen sinken langsam und nehmen keinen Fallschaden.'],
  'Find Familiar':[1,'1 Stunde','10 ft',0,1,'Ein Geist in Tiergestalt wird dein Vertrauter, späht für dich und hilft.'],
  'Floating Disk':[1,'Action','30 ft',0,1,'Eine schwebende Scheibe trägt eine Stunde lang bis zu 500 lb hinter dir her.'],
  'Fog Cloud':[1,'Action','120 ft',1,0,'Dichter Nebel mit 20 ft Radius, niemand sieht hindurch.'],
  'Goodberry':[1,'Action','Self',0,0,'Zehn Beeren, jede heilt 1 Hit Point und ersetzt eine Tagesration.'],
  'Grease':[1,'Action','60 ft',0,0,'Ein 10-ft-Quadrat wird rutschig: DEX Save, sonst Prone. Schwieriges Gelände.'],
  'Guiding Bolt':[1,'Action','120 ft',0,0,'Ranged Spell Attack, 4d6 Radiant. Der nächste Angriff gegen das Ziel hat Advantage.'],
  'Hail of Thorns':[1,'Bonus Action','Self',0,0,'Nach einem Fernkampftreffer: Dornen regnen, DEX Save in 5 ft, 1d10 Piercing.'],
  'Healing Word':[1,'Bonus Action','60 ft',0,0,'Heilt 2d4 + dein Zaubermodifikator aus der Entfernung.'],
  'Hellish Rebuke':[1,'Reaction','60 ft',0,0,'Wenn dich jemand verletzt: DEX Save, sonst 2d10 Fire, halb bei Erfolg.'],
  'Heroism':[1,'Action','Touch',1,0,'Das Ziel ist immun gegen Frightened und bekommt jede Runde Temporary Hit Points.'],
  'Hex':[1,'Bonus Action','90 ft',1,0,'Deine Treffer gegen das Ziel machen +1d6 Necrotic. Es hat Disadvantage auf Checks mit einem Attribut.'],
  "Hunter's Mark":[1,'Bonus Action','90 ft',1,0,'Deine Waffentreffer gegen das Ziel machen +1d6 Force. Advantage, um es aufzuspüren.'],
  'Ice Knife':[1,'Action','60 ft',0,0,'Ranged Spell Attack, 1d10 Piercing. Danach explodiert es: DEX Save in 5 ft, 2d6 Cold.'],
  'Identify':[1,'1 Minute','Touch',0,1,'Du erfährst alle Eigenschaften eines magischen Gegenstands.'],
  'Illusory Script':[1,'1 Minute','Touch',0,1,'Eine geheime Nachricht, die nur bestimmte Personen lesen können.'],
  'Inflict Wounds':[1,'Action','Touch',0,0,'CON Save, sonst 2d10 Necrotic, halb bei Erfolg.'],
  'Jump':[1,'Bonus Action','Touch',0,0,'Eine Minute lang springt das Ziel bis zu 30 ft weit.'],
  'Longstrider':[1,'Action','Touch',0,0,'Eine Stunde lang +10 ft Speed.'],
  'Mage Armor':[1,'Action','Touch',0,0,'Ohne Rüstung ist die AC 8 Stunden lang 13 + DEX.'],
  'Magic Missile':[1,'Action','120 ft',0,0,'Drei Geschosse treffen automatisch, je 1d4 + 1 Force.'],
  'Protection from Evil and Good':[1,'Action','Touch',1,0,'Schutz vor Aberrationen, Himmlischen, Elementaren, Feen, Unholden und Untoten.'],
  'Purify Food and Drink':[1,'Action','10 ft',0,1,'Reinigt Essen und Trinken von Gift und Krankheit.'],
  'Ray of Sickness':[1,'Action','60 ft',0,0,'Ranged Spell Attack, 2d8 Poison und Poisoned bis zu deinem nächsten Zug.'],
  'Sanctuary':[1,'Bonus Action','30 ft',0,0,'Wer das Ziel angreifen will, muss einen WIS Save schaffen.'],
  'Searing Smite':[1,'Bonus Action','Self',0,0,'Nach einem Nahkampftreffer: +1d6 Fire, das Ziel brennt jede Runde weiter, bis es einen CON Save schafft.'],
  'Shield':[1,'Reaction','Self',0,0,'Wenn du getroffen wirst: +5 AC bis zu deinem nächsten Zug.'],
  'Shield of Faith':[1,'Bonus Action','60 ft',1,0,'+2 AC für 10 Minuten.'],
  'Silent Image':[1,'Action','60 ft',1,0,'Eine lautlose Illusion bis 15-ft-Würfel, die du bewegen kannst.'],
  'Sleep':[1,'Action','60 ft',1,0,'Kreaturen in 5 ft Radius machen einen WIS Save, sonst Incapacitated und dann Unconscious.'],
  'Speak with Animals':[1,'Action','Self',0,1,'Zehn Minuten lang sprichst du mit Tieren.'],
  "Tasha's Hideous Laughter":[1,'Action','30 ft',1,0,'WIS Save, sonst fällt das Ziel lachend um und kann nichts tun.'],
  'Thunderous Smite':[1,'Bonus Action','Self',0,0,'Nach einem Nahkampftreffer: +2d6 Thunder, STR Save, sonst 10 ft weg und Prone.'],
  'Thunderwave':[1,'Action','Self (15-ft-Würfel)',0,0,'CON Save, sonst 2d8 Thunder und 10 ft weggeschleudert. Halb bei Erfolg.'],
  'Unseen Servant':[1,'Action','60 ft',0,1,'Ein unsichtbarer Diener erledigt eine Stunde lang einfache Aufgaben.'],
  'Witch Bolt':[1,'Action','60 ft',1,0,'Ranged Spell Attack, 2d12 Lightning. In den Folgerunden 1d12 als Bonusaktion.'],
  'Wrathful Smite':[1,'Bonus Action','Self',0,0,'Nach einem Nahkampftreffer: +1d6 Necrotic, WIS Save, sonst Frightened.']};
const SPL={
  Bard:[['Blade Ward','Dancing Lights','Friends','Light','Mage Hand','Mending','Message','Minor Illusion','Prestidigitation','Starry Wisp','Thunderclap','True Strike','Vicious Mockery'],
    ['Animal Friendship','Bane','Charm Person','Color Spray','Command','Comprehend Languages','Cure Wounds','Detect Magic','Disguise Self','Dissonant Whispers','Faerie Fire','Feather Fall','Healing Word','Heroism','Identify','Illusory Script','Longstrider','Silent Image','Sleep','Speak with Animals',"Tasha's Hideous Laughter",'Thunderwave','Unseen Servant']],
  Cleric:[['Guidance','Light','Mending','Resistance','Sacred Flame','Spare the Dying','Thaumaturgy','Toll the Dead','Word of Radiance'],
    ['Bane','Bless','Command','Create or Destroy Water','Cure Wounds','Detect Evil and Good','Detect Magic','Detect Poison and Disease','Guiding Bolt','Healing Word','Inflict Wounds','Protection from Evil and Good','Purify Food and Drink','Sanctuary','Shield of Faith']],
  Druid:[['Druidcraft','Elementalism','Guidance','Mending','Message','Poison Spray','Produce Flame','Resistance','Shillelagh','Spare the Dying','Starry Wisp','Thorn Whip','Thunderclap'],
    ['Animal Friendship','Charm Person','Create or Destroy Water','Cure Wounds','Detect Magic','Detect Poison and Disease','Entangle','Faerie Fire','Fog Cloud','Goodberry','Healing Word','Ice Knife','Jump','Longstrider','Protection from Evil and Good','Purify Food and Drink','Speak with Animals','Thunderwave']],
  Paladin:[[],['Bless','Command','Compelled Duel','Cure Wounds','Detect Evil and Good','Detect Magic','Detect Poison and Disease','Divine Favor','Divine Smite','Heroism','Protection from Evil and Good','Purify Food and Drink','Searing Smite','Shield of Faith','Thunderous Smite','Wrathful Smite']],
  Ranger:[[],['Alarm','Animal Friendship','Cure Wounds','Detect Magic','Detect Poison and Disease','Ensnaring Strike','Entangle','Fog Cloud','Goodberry','Hail of Thorns',"Hunter's Mark",'Jump','Longstrider','Speak with Animals']],
  Sorcerer:[['Acid Splash','Blade Ward','Chill Touch','Dancing Lights','Elementalism','Fire Bolt','Friends','Light','Mage Hand','Mending','Message','Mind Sliver','Minor Illusion','Poison Spray','Prestidigitation','Ray of Frost','Shocking Grasp','Sorcerous Burst','Thunderclap','True Strike'],
    ['Burning Hands','Charm Person','Chromatic Orb','Color Spray','Comprehend Languages','Detect Magic','Disguise Self','Expeditious Retreat','False Life','Feather Fall','Fog Cloud','Grease','Ice Knife','Jump','Mage Armor','Magic Missile','Ray of Sickness','Shield','Silent Image','Sleep','Thunderwave','Witch Bolt']],
  Warlock:[['Blade Ward','Chill Touch','Eldritch Blast','Friends','Mage Hand','Mind Sliver','Minor Illusion','Poison Spray','Prestidigitation','Thunderclap','Toll the Dead','True Strike'],
    ['Armor of Agathys','Arms of Hadar','Bane','Charm Person','Comprehend Languages','Detect Magic','Expeditious Retreat','Hellish Rebuke','Hex','Illusory Script','Protection from Evil and Good','Speak with Animals',"Tasha's Hideous Laughter",'Unseen Servant','Witch Bolt']],
  Wizard:[['Acid Splash','Blade Ward','Chill Touch','Dancing Lights','Elementalism','Fire Bolt','Friends','Light','Mage Hand','Mending','Message','Mind Sliver','Minor Illusion','Poison Spray','Prestidigitation','Ray of Frost','Shocking Grasp','Thunderclap','Toll the Dead','True Strike'],
    ['Alarm','Burning Hands','Charm Person','Chromatic Orb','Color Spray','Comprehend Languages','Detect Magic','Disguise Self','Expeditious Retreat','False Life','Feather Fall','Find Familiar','Floating Disk','Fog Cloud','Grease','Ice Knife','Identify','Illusory Script','Jump','Longstrider','Mage Armor','Magic Missile','Protection from Evil and Good','Ray of Sickness','Shield','Silent Image','Sleep',"Tasha's Hideous Laughter",'Thunderwave','Unseen Servant']]};
const POINT_COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};

/* ================= guided character builder: 2024 rules, level 1 =================
   A draft is kept per player in this browser until the character is created. Every step can be revisited;
   derive() turns the draft into everything the steps and the finished sheet need, missing() lists what is still open. */
const BSTEPS=[['cls','Klasse'],['bg','Herkunft'],['sp','Spezies'],['ab','Attribute'],['sk','Fertigkeiten'],['spl','Spells'],['eq','Ausrüstung'],['det','Details'],['end','Fertig']];
const PRIO={Barbarian:['str','con','dex','wis','cha','int'],Bard:['cha','dex','con','wis','int','str'],Cleric:['wis','con','str','dex','cha','int'],Druid:['wis','con','dex','int','cha','str'],
  Fighter:['str','con','dex','wis','cha','int'],Monk:['dex','wis','con','str','int','cha'],Paladin:['str','cha','con','wis','dex','int'],Ranger:['dex','wis','con','str','int','cha'],
  Rogue:['dex','con','int','wis','cha','str'],Sorcerer:['cha','con','dex','wis','int','str'],Warlock:['cha','con','dex','wis','int','str'],Wizard:['int','con','dex','wis','cha','str']};
const STD=[15,14,13,12,10,8];
const ALLTOOLS=[...TOOLS.artisan,...TOOLS.music,...TOOLS.gaming,'Disguise Kit','Forgery Kit','Herbalism Kit',"Navigator's Tools","Poisoner's Kit","Thieves' Tools"];
const TOOLCAT={artisan:"Artisan's Tools",music:'Musikinstrument',gaming:'Spielset'};
const ALLC=Object.keys(SP).filter(n=>SP[n][0]===0).sort(),ALLR=Object.keys(SP).filter(n=>SP[n][0]===1&&SP[n][4]).sort();
const MI_LISTS=['Cleric','Druid','Wizard'],SPAB=['int','wis','cha'];
/* damage cantrips also go on the attack list: dice, damage type, save (null = spell attack roll) */
const ATKC={'Acid Splash':['1d6','acid','dex'],'Chill Touch':['1d10','necrotic',null],'Eldritch Blast':['1d10','force',null],'Fire Bolt':['1d10','fire',null],'Mind Sliver':['1d6','psychic','int'],
  'Poison Spray':['1d12','poison',null],'Produce Flame':['1d8','fire',null],'Ray of Frost':['1d8','cold',null],'Sacred Flame':['1d8','radiant','dex'],'Shocking Grasp':['1d8','lightning',null],
  'Sorcerous Burst':['1d8','Element nach Wahl',null],'Starry Wisp':['1d8','radiant',null],'Thorn Whip':['1d6','piercing',null],'Thunderclap':['1d6','thunder','con'],
  'Toll the Dead':['1d8 (1d12 verletzt)','necrotic','wis'],'Vicious Mockery':['1d6','psychic','wis'],'Word of Radiance':['1d6','radiant','con']};

function blankDraft(){return {v:1,step:0,far:0,cls:'',cc:{style:'',order:'',inv:'',mastery:[]},bg:'',bgTool:'',bgEq:'A',sp:'',spCh:'',size:'',spAb:'',feat2:'',
  abM:'std',std:{},pbuy:{str:8,dex:8,con:8,int:8,wis:8,cha:8},man:{str:'',dex:'',con:'',int:'',wis:'',cha:''},bonus:'21',b2:'',b1:'',
  skills:[],keen:'',skillful:'',fp:{bg:{},sp:{}},exp:[],langs:[],ctools:[],spells:{c:[],l1:[],prep:[]},tome:{c:[],r:[]},eqC:'A',
  name:'',align:'',age:'',height:'',look:'',traits:'',ideals:'',bonds:'',flaws:'',story:''}}
function normDraft(x){const d=Object.assign(blankDraft(),x||{}),b=blankDraft();
  ['cc','pbuy','man','spells','tome'].forEach(k=>{d[k]=Object.assign(b[k],d[k]||{})});
  d.fp=Object.assign({bg:{},sp:{}},d.fp||{});['skills','exp','langs','ctools'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
  ['c','l1','prep'].forEach(k=>{if(!Array.isArray(d.spells[k]))d.spells[k]=[]});['c','r'].forEach(k=>{if(!Array.isArray(d.tome[k]))d.tome[k]=[]});
  if(!Array.isArray(d.cc.mastery))d.cc.mastery=[];d.step=clamp(num(d.step),0,BSTEPS.length-1);return d}
const draftKey=()=>'draft-'+(S.uid||'x');
const hasDraft=()=>{const x=LS.get(draftKey(),null);return !!(x&&(x.cls||x.bg||x.sp||x.name))};

function weaponProf(cw,w){const W=WEAPONS[w];if(!W)return false;if(W[2]==='s')return cw.includes('s');if(cw.includes('m'))return true;
  if(cw.includes('ml'))return /Light/.test(W[4]);if(cw.includes('mfl'))return /Finesse|Light/.test(W[4]);return false}
function speciesSpells(d){
  const out=[],ab=d.spAb;
  if(d.sp==='Aasimar')out.push({n:'Light',ab:'cha'});
  if(d.sp==='Elf'&&LINEAGE_CANTRIP[d.spCh])out.push({n:LINEAGE_CANTRIP[d.spCh],ab});
  if(d.sp==='Gnome'&&d.spCh==='Forest Gnome')out.push({n:'Minor Illusion',ab},{n:'Speak with Animals',ab,note:'So oft wie dein Proficiency Bonus pro Long Rest ohne Slot.'});
  if(d.sp==='Gnome'&&d.spCh==='Rock Gnome')out.push({n:'Mending',ab},{n:'Prestidigitation',ab});
  if(d.sp==='Tiefling'){out.push({n:'Thaumaturgy',ab});if(LINEAGE_CANTRIP[d.spCh])out.push({n:LINEAGE_CANTRIP[d.spCh],ab})}
  return out}
const needSpAb=d=>['Elf','Gnome','Tiefling'].includes(d.sp);
const raceName=d=>!d.sp?'':d.spCh&&(d.sp==='Elf'||d.sp==='Gnome')?d.spCh:d.spCh?d.sp+' ('+d.spCh+')':d.sp;

function derive(d){
  const C=C24[d.cls]||null,B=BG24[d.bg]||null,P=SPECIES[d.sp]||null,o={C,B,P};
  /* origin feats: one from the background, a second one for humans (only Magic Initiate and Skilled may repeat) */
  o.feats=[];if(B)o.feats.push({src:'bg',n:B.feat,list:B.fl||''});
  o.feat2dup=n=>!!B&&B.feat===n&&!['Magic Initiate','Skilled'].includes(n);
  if(P&&P.versatile&&FEATS[d.feat2]&&!o.feat2dup(d.feat2))o.feats.push({src:'sp',n:d.feat2,list:''});
  o.has=n=>o.feats.some(f=>f.n===n);
  /* ability scores */
  o.base={};o.pbLeft=27;
  AB.forEach(a=>{let v=null;
    if(d.abM==='std')v=STD.includes(d.std[a])?d.std[a]:null;
    else if(d.abM==='pb'){v=clamp(Math.round(num(d.pbuy[a]))||8,8,15);o.pbLeft-=POINT_COST[v]}
    else v=d.man[a]===''||d.man[a]==null?null:clamp(Math.round(num(d.man[a])),3,20);
    o.base[a]=v});
  o.bon={};AB.forEach(a=>{o.bon[a]=0});
  if(B){if(d.bonus==='111')B.ab.forEach(a=>{o.bon[a]+=1});else{if(B.ab.includes(d.b2))o.bon[d.b2]+=2;if(B.ab.includes(d.b1)&&d.b1!==d.b2)o.bon[d.b1]+=1}}
  o.ab={};AB.forEach(a=>{o.ab[a]=o.base[a]==null?null:Math.min(20,o.base[a]+o.bon[a])});
  o.m=a=>mod(o.ab[a]==null?10:o.ab[a]);
  /* class choices */
  o.cw=C?C.w.slice():[];if(d.cc.order==='Protector'||d.cc.order==='Warden')o.cw.push('m');
  o.mastOpts=C&&C.mastery?Object.keys(WEAPONS).filter(w=>weaponProf(o.cw,w)&&(d.cls!=='Barbarian'||!WEAPONS[w][3])):[];
  o.mastery=C&&C.mastery?d.cc.mastery.filter(w=>o.mastOpts.includes(w)).slice(0,C.mastery):[];
  /* skills, in the order the rules hand them out */
  const known=new Set(B?B.sk:[]);o.bgSk=B?B.sk.slice():[];
  o.clsOpts=C?C.skills[1]:[];o.clsN=C?C.skills[0]:0;o.kCls=new Set(known);
  o.clsSk=d.skills.filter(x=>o.clsOpts.includes(x)&&!known.has(x)).slice(0,o.clsN);o.clsSk.forEach(x=>known.add(x));
  o.kKeen=new Set(known);o.keen=P&&P.keen&&P.keen.includes(d.keen)&&!known.has(d.keen)?d.keen:'';if(o.keen)known.add(o.keen);
  o.kSkillful=new Set(known);o.skillful=P&&P.skillful&&ALLSKILLS.includes(d.skillful)&&!known.has(d.skillful)?d.skillful:'';if(o.skillful)known.add(o.skillful);
  /* tools */
  const tools=[],addT=t=>{if(t&&!tools.includes(t))tools.push(t)};
  o.bgToolOpts=B&&TOOLS[B.tool]?TOOLS[B.tool]:null;
  if(B){if(o.bgToolOpts){if(o.bgToolOpts.includes(d.bgTool))addT(d.bgTool)}else addT(B.tool)}
  (C&&C.fixedTools||[]).forEach(addT);
  o.ctoolOpts=C&&C.tools?(C.tools.music?TOOLS.music:[...TOOLS.artisan,...TOOLS.music]):[];o.ctoolN=C&&C.tools?(C.tools.music||C.tools.monk||0):0;
  o.tCls=tools.slice();o.ctools=d.ctools.filter(t=>o.ctoolOpts.includes(t)&&!tools.includes(t)).slice(0,o.ctoolN);o.ctools.forEach(addT);
  o.featTools={};o.tFeat={};o.skilled={};o.kSkilled={};
  o.feats.forEach(f=>{const fp=d.fp[f.src]||{};
    if(f.n==='Crafter'||f.n==='Musician'){const opts=f.n==='Crafter'?TOOLS.artisan:TOOLS.music;o.tFeat[f.src]=tools.slice();
      o.featTools[f.src]=(fp.tools||[]).filter(t=>opts.includes(t)&&!tools.includes(t)).slice(0,3);o.featTools[f.src].forEach(addT)}});
  o.feats.forEach(f=>{const fp=d.fp[f.src]||{};
    if(f.n==='Skilled'){o.kSkilled[f.src]={sk:new Set(known),t:tools.slice()};
      o.skilled[f.src]=(fp.picks||[]).filter(x=>ALLSKILLS.includes(x)?!known.has(x):ALLTOOLS.includes(x)&&!tools.includes(x)).slice(0,3);
      o.skilled[f.src].forEach(x=>{if(ALLSKILLS.includes(x))known.add(x);else addT(x)})}});
  o.known=known;o.tools=tools;
  o.expN=C&&C.expertise||0;o.exp=d.exp.filter(x=>known.has(x)).slice(0,o.expN);
  /* languages */
  o.langN=2+(C&&C.extraLangPick||0);o.langPicks=d.langs.filter(l=>LANGS.includes(l)).slice(0,o.langN);
  o.langs=['Common'].concat(o.langPicks,C&&C.extraLang||[]);
  /* spells */
  o.sc=C&&C.sc||null;o.needSpAb=needSpAb(d);
  o.spAuto=speciesSpells(d).map(x=>Object.assign({src:'Spezies'},x));
  if(o.sc&&o.sc.always)o.sc.always.forEach(n=>o.spAuto.push({n,ab:o.sc.ab,src:d.cls,note:'Immer vorbereitet, zählt nicht mit.'}));
  if(d.cls==='Druid')o.spAuto.push({n:'Speak with Animals',ab:'wis',src:'Druidic',note:'Immer vorbereitet, zählt nicht mit.'});
  if(d.cls==='Warlock'&&d.cc.inv==='Pact of the Chain')o.spAuto.push({n:'Find Familiar',ab:'cha',src:'Pact of the Chain',note:'Als Magic-Aktion ohne Slot.'});
  if(d.cls==='Warlock'&&d.cc.inv==='Armor of Shadows')o.spAuto.push({n:'Mage Armor',ab:'cha',src:'Armor of Shadows',note:'Auf dich selbst, beliebig oft ohne Slot.'});
  const kSp=new Set(o.spAuto.map(x=>x.n));o.kSpCls=new Set(kSp);
  o.cN=o.sc?o.sc.cantrips+(d.cc.order==='Thaumaturge'||d.cc.order==='Magician'?1:0):0;
  o.lN=o.sc?(o.sc.book||o.sc.prep):0;
  o.cOpts=o.sc?SPL[d.cls][0]:[];o.lOpts=o.sc?SPL[d.cls][1]:[];
  o.spC=d.spells.c.filter(n=>o.cOpts.includes(n)&&!kSp.has(n)).slice(0,o.cN);
  o.spL=d.spells.l1.filter(n=>o.lOpts.includes(n)&&!kSp.has(n)).slice(0,o.lN);
  o.spP=o.sc&&o.sc.book?d.spells.prep.filter(n=>o.spL.includes(n)).slice(0,o.sc.prep):o.spL.slice();
  o.spC.forEach(n=>kSp.add(n));o.spL.forEach(n=>kSp.add(n));
  o.mi={};
  o.feats.filter(f=>f.n==='Magic Initiate').forEach(f=>{const fp=d.fp[f.src]||{};let list=f.list||fp.list||'';
    if(!MI_LISTS.includes(list)||(f.src==='sp'&&o.mi.bg&&o.mi.bg.list===list))list='';
    const x={src:f.src,list,fixed:!!f.list,ab:SPAB.includes(fp.ab)?fp.ab:'',before:new Set(kSp)};
    x.c=list?(fp.c||[]).filter(n=>SPL[list][0].includes(n)&&!kSp.has(n)).slice(0,2):[];
    x.l1=list&&SPL[list][1].includes(fp.l1)&&!kSp.has(fp.l1)?fp.l1:'';
    x.c.forEach(n=>kSp.add(n));if(x.l1)kSp.add(x.l1);o.mi[f.src]=x});
  o.tome=null;
  if(d.cls==='Warlock'&&d.cc.inv==='Pact of the Tome'){o.tome={before:new Set(kSp)};
    o.tome.c=d.tome.c.filter(n=>ALLC.includes(n)&&!kSp.has(n)).slice(0,3);o.tome.c.forEach(n=>kSp.add(n));
    o.tome.r=d.tome.r.filter(n=>ALLR.includes(n)&&!kSp.has(n)).slice(0,2)}
  o.anySpells=!!o.sc||o.spAuto.length>0||Object.keys(o.mi).length>0||!!o.tome;
  return o}

function missing(d,o){
  const m=[],add=(i,t)=>m.push([i,t]),C=o.C,B=o.B,P=o.P;
  if(!C)add(0,'Wähle eine Klasse.');
  else{if(d.cls==='Fighter'&&!FIGHTING_STYLES[d.cc.style])add(0,'Fighting Style wählen.');
    if(C.order&&!C.order[d.cc.order])add(0,(d.cls==='Cleric'?'Divine Order':'Primal Order')+' wählen.');
    if(d.cls==='Warlock'&&!INVOCATIONS[d.cc.inv])add(0,'Eldritch Invocation wählen.');
    if(C.mastery&&o.mastery.length<C.mastery)add(0,'Weapon Mastery: noch '+(C.mastery-o.mastery.length)+' Waffe'+(C.mastery-o.mastery.length>1?'n':'')+' wählen.')}
  if(!B)add(1,'Wähle einen Background.');else if(o.bgToolOpts&&!o.bgToolOpts.includes(d.bgTool))add(1,TOOLCAT[B.tool]+' für deinen Background wählen.');
  if(!P)add(2,'Wähle eine Spezies.');
  else{if(P.choose&&!P.choose.opts[d.spCh])add(2,P.choose.label+' wählen.');
    if(P.size.length>1&&!P.size.includes(d.size))add(2,'Größe wählen: Small oder Medium.');
    if(o.needSpAb&&!SPAB.includes(d.spAb))add(2,'Zauberattribut für die Magie deiner Spezies wählen.');
    if(P.versatile&&!o.feats.some(f=>f.src==='sp'))add(2,'Versatile: ein Origin Feat wählen.')}
  if(AB.some(a=>o.base[a]==null))add(3,d.abM==='std'?'Alle sechs Werte des Standard Array verteilen.':'Alle sechs Attributswerte eintragen.');
  if(d.abM==='pb'&&o.pbLeft<0)add(3,'Point Buy: '+(-o.pbLeft)+' Punkte zu viel ausgegeben.');
  if(B&&d.bonus!=='111'&&!(B.ab.includes(d.b2)&&B.ab.includes(d.b1)&&d.b1!==d.b2))add(3,'Background-Bonus verteilen: +2 auf ein Attribut, +1 auf ein anderes.');
  if(C&&o.clsSk.length<o.clsN)add(4,'Klassen-Skills: noch '+(o.clsN-o.clsSk.length)+' wählen.');
  if(P&&P.keen&&!o.keen)add(4,'Keen Senses: einen Skill wählen.');
  if(P&&P.skillful&&!o.skillful)add(4,'Skillful: einen Skill wählen.');
  if(o.ctoolN&&o.ctools.length<o.ctoolN)add(4,(d.cls==='Bard'?'Musikinstrumente':'Tool oder Instrument')+': noch '+(o.ctoolN-o.ctools.length)+' wählen.');
  o.feats.forEach(f=>{if(f.n==='Skilled'&&o.skilled[f.src].length<3)add(4,'Skilled: noch '+(3-o.skilled[f.src].length)+' Skills oder Tools wählen.');
    if((f.n==='Crafter'||f.n==='Musician')&&o.featTools[f.src].length<3)add(4,f.n+': noch '+(3-o.featTools[f.src].length)+(f.n==='Crafter'?" Artisan's Tools":' Instrumente')+' wählen.')});
  if(o.expN&&o.exp.length<o.expN)add(4,'Expertise: noch '+(o.expN-o.exp.length)+' Skill'+(o.expN-o.exp.length>1?'s':'')+' wählen.');
  if(o.langPicks.length<o.langN)add(4,'Sprachen: noch '+(o.langN-o.langPicks.length)+' wählen.');
  if(o.sc){if(o.spC.length<o.cN)add(5,'Cantrips: noch '+(o.cN-o.spC.length)+' wählen.');
    if(o.spL.length<o.lN)add(5,(o.sc.book?'Zauberbuch':'Spells des 1. Grades')+': noch '+(o.lN-o.spL.length)+' wählen.');
    if(o.sc.book&&o.spP.length<o.sc.prep)add(5,'Vorbereitet: noch '+(o.sc.prep-o.spP.length)+' Spells aus dem Zauberbuch markieren.')}
  Object.values(o.mi).forEach(x=>{if(!x.list)add(5,'Magic Initiate: Spell-Liste wählen.');else{if(x.c.length<2)add(5,'Magic Initiate: noch '+(2-x.c.length)+' Cantrip'+(2-x.c.length>1?'s':'')+' wählen.');if(!x.l1)add(5,'Magic Initiate: einen Spell des 1. Grades wählen.')}
    if(!x.ab)add(5,'Magic Initiate: Zauberattribut wählen.')});
  if(o.tome){if(o.tome.c.length<3)add(5,'Pact of the Tome: noch '+(3-o.tome.c.length)+' Cantrips wählen.');if(o.tome.r.length<2)add(5,'Pact of the Tome: noch '+(2-o.tome.r.length)+' Ritual-Spells wählen.')}
  if(!String(d.name||'').trim())add(7,'Gib deinem Charakter einen Namen.');
  return m}

/* ---------- the finished sheet ---------- */
function eqItems(d,o){
  const C=o.C,B=o.B,out=[],put=(n,q)=>{const x=out.find(i=>i.n===n);if(x)x.q+=q;else out.push({n,q})};
  const ph=n=>/\((siehe Tools|deine Wahl)\)/.test(n);
  const opt=C&&C.eq[d.eqC]||C&&C.eq.A;
  if(opt)opt.items.forEach(([n,q])=>put(ph(n)?(o.ctools[0]||n.replace(/ \(siehe Tools\)/,'')):n,q));
  if(B&&d.bgEq!=='B')B.eq.forEach(([n,q])=>put(ph(n)&&o.bgToolOpts&&o.bgToolOpts.includes(d.bgTool)?d.bgTool:n,q));
  return {items:out,gp:(opt?opt.gp:0)+(B?(d.bgEq==='B'?50:B.gp):0)}}
function acOf(d,o,items){
  const C=o.C,dex=o.m('dex'),armor=items.find(i=>ARMOR[i.n]),shield=items.some(i=>i.n==='Shield');
  let ac,note;
  if(armor){const [b,cap]=ARMOR[armor.n];ac=b+Math.min(dex,cap);note=armor.n}
  else if(C&&C.unarmored==='con'){ac=10+dex+o.m('con');note='Unarmored Defense'}
  else if(C&&C.unarmored==='wis'&&!shield){ac=10+dex+o.m('wis');note='Unarmored Defense'}
  else{ac=10+dex;note='ohne Rüstung'}
  if(shield){ac+=2;note+=', Shield'}
  if(d.cls==='Fighter'&&d.cc.style==='Defense'&&armor){ac+=1;note+=', Defense'}
  return {ac,note}}
function buildSheet(d){
  const o=derive(d),C=o.C,B=o.B,P=o.P,s=blankSheet(),PB=2;
  const uses=u=>u==='pb'?PB:u==='cha'?Math.max(1,o.m('cha')):num(u);
  s.name=String(d.name||'').trim();s.cls=d.cls;s.lvl=1;s.race=raceName(d);s.bg=d.bg;s.align=d.align;
  s.size=[P?(P.size.length>1?d.size:P.size[0]):'',String(d.height||'').trim()].filter(Boolean).join(', ');
  ['age','look','traits','ideals','bonds','flaws','story'].forEach(k=>{s[k]=String(d[k]||'')});
  AB.forEach(a=>{s.ab[a]=o.ab[a]==null?10:o.ab[a]});
  if(C){s.hd=C.hd;s.saves=C.sv.slice()}
  o.known.forEach(k=>{s.skills[k]=1});o.exp.forEach(k=>{s.skills[k]=2});
  s.hpMax=Math.max(1,(C?C.hd:8)+o.m('con')+(d.sp==='Dwarf'?1:0)+(o.has('Tough')?2:0));s.hp=s.hpMax;
  s.speed=(P?(d.sp==='Elf'&&d.spCh==='Wood Elf'?35:P.speed):30)+' ft';
  s.senses=[P&&P.dv?'Darkvision '+(d.spCh==='Drow'?120:P.dv)+' ft':'',d.cc.style==='Blind Fighting'&&d.cls==='Fighter'?'Blindsight 10 ft':''].filter(Boolean).join(', ');
  if(o.has('Alert'))s.initMisc=PB;
  s.insp=d.sp==='Human';
  s.langs=o.langs.join(', ');
  const ex=items=>items.length?items.join(', '):'';
  const armorT=C?C.armor+(d.cc.order==='Protector'?', Heavy':''):'',weapT=C?C.weapons+((d.cc.order==='Protector'||d.cc.order==='Warden')&&!/Martial/.test(C.weapons)?', Martial':''):'';
  s.profs=[armorT?'Armor: '+armorT:'',weapT?'Weapons: '+weapT:'',o.tools.length?'Tools: '+ex(o.tools):'',o.mastery.length?'Weapon Mastery: '+o.mastery.map(w=>w+' ('+WEAPONS[w][5]+')').join(', '):''].filter(Boolean).join('\n');
  /* equipment, armor class, attacks */
  const eq=eqItems(d,o);
  s.items=eq.items.map(i=>({id:rid(),n:i.n,q:i.q,note:PACKS[i.n]||(WEAPONS[i.n]?WEAPONS[i.n][0]+' '+WEAPONS[i.n][1]+(WEAPONS[i.n][4]?', '+WEAPONS[i.n][4]:''):ARMOR[i.n]?'AC '+ARMOR[i.n][0]+(ARMOR[i.n][1]===99?' + DEX':ARMOR[i.n][1]?' + DEX (max 2)':''):i.n==='Shield'?'+2 AC':'')}));
  s.coins.gp=eq.gp;
  const a=acOf(d,o,eq.items);s.ac=a.ac;s.acNote=a.note;
  const monkW=w=>d.cls==='Monk'&&!WEAPONS[w][3]&&(WEAPONS[w][2]==='s'||/Light/.test(WEAPONS[w][4]))&&!/Heavy|Two-Handed/.test(WEAPONS[w][4]);
  eq.items.filter(i=>WEAPONS[i.n]).forEach(i=>{const W=WEAPONS[i.n],rng=!!W[3],fin=/Finesse/.test(W[4])||monkW(i.n);
    const ab=rng?'dex':fin&&o.m('dex')>o.m('str')?'dex':'str';let dmg=W[0];if(monkW(i.n)&&(dmg==='1d4'||dmg==='1'))dmg='1d6';
    const mastered=o.mastery.includes(i.n);
    s.atk.push({id:rid(),n:i.n,ab,prof:weaponProf(o.cw,i.n),bonus:rng&&d.cc.style==='Archery'&&d.cls==='Fighter'?2:0,dmg,dab:true,ty:W[1],
      note:[rng?'Ranged':'Melee',W[4],mastered?'Mastery: '+W[5]:''].filter(Boolean).join(' · ')})});
  const unarmed=d.cls==='Monk'?['1d6','Martial Arts: auch als Bonusaktion nach der Attack-Aktion']:d.cc.style==='Unarmed Fighting'&&d.cls==='Fighter'?['1d6','1d8 ohne Waffe und Schild']:o.has('Tavern Brawler')?['1d4','Tavern Brawler: Einsen neu würfeln']:['1',''];
  s.atk.push({id:rid(),n:'Unarmed Strike',ab:d.cls==='Monk'&&o.m('dex')>o.m('str')?'dex':'str',prof:true,bonus:0,dmg:unarmed[0],dab:true,ty:'bludgeoning',note:['Melee',unarmed[1]].filter(Boolean).join(' · ')});
  /* spells */
  const sp=[],addS=(n,prep,extra,ab)=>{if(sp.some(x=>x.n===n)||!SP[n])return;const X=SP[n];
    sp.push({id:rid(),n,l:X[0],prep,t:X[1],r:X[2],c:!!X[3],rit:!!X[4],d:X[5]+(extra?' '+extra:''),_ab:ab})};
  const cab=o.sc?o.sc.ab:'';
  o.spAuto.forEach(x=>addS(x.n,true,[x.src+(x.ab?' ('+ABS[x.ab]+')':'')+'.',x.note||''].filter(Boolean).join(' '),x.ab||cab));
  o.spC.forEach(n=>addS(n,true,'',cab));o.spL.forEach(n=>addS(n,o.spP.includes(n),o.sc&&o.sc.book?'Im Zauberbuch.':'',cab));
  Object.values(o.mi).forEach(x=>{const tag='Magic Initiate ('+x.list+(x.ab?', '+ABS[x.ab]:'')+').';x.c.forEach(n=>addS(n,true,tag,x.ab));
    if(x.l1)addS(x.l1,true,tag+' Einmal pro Long Rest ohne Slot, mit Slots auch öfter.',x.ab)});
  if(o.tome){o.tome.c.forEach(n=>addS(n,true,'Book of Shadows.','cha'));o.tome.r.forEach(n=>addS(n,true,'Book of Shadows: als Ritual wirken.','cha'))}
  sp.sort((x,y)=>x.l-y.l||x.n.localeCompare(y.n));
  sp.forEach(x=>{const k=ATKC[x.n];if(k){const ab=x._ab||cab||'cha';
    s.atk.push(k[2]?{id:rid(),n:x.n,ab:'none',prof:true,bonus:0,dmg:k[0],dab:false,ty:k[1],note:'Cantrip · '+x.r+' · '+ABS[k[2]]+' Save gegen DC '+(8+PB+o.m(ab))}
      :{id:rid(),n:x.n,ab,prof:true,bonus:0,dmg:k[0],dab:false,ty:k[1],note:'Cantrip · '+x.r+' · Spell Attack'})}
    delete x._ab});
  s.spells=sp;
  if(o.sc){const t=o.sc.type;s.cast={type:t,ab:o.sc.ab,slots:slotsFor(t,1),used:[0,0,0,0,0,0,0,0,0]}}
  else{const first=o.spAuto.find(x=>x.ab)||Object.values(o.mi).find(x=>x.ab);if(first)s.cast.ab=first.ab}
  /* features */
  const F=(n,dsc,src,u,rest)=>s.feats.push({id:rid(),n,src,d:dsc,max:u?uses(u):0,used:0,rest:u?(rest||'long'):''});
  if(C){const src=d.cls+' 1';
    C.f.forEach(([n,dsc,u,r])=>F(n,n==='Expertise'&&o.exp.length?dsc+' Gewählt: '+o.exp.join(', ')+'.':dsc,src,u,r));
    if(d.cls==='Fighter'&&FIGHTING_STYLES[d.cc.style])F('Fighting Style: '+d.cc.style,FIGHTING_STYLES[d.cc.style],src);
    if(C.order&&C.order[d.cc.order])F((d.cls==='Cleric'?'Divine Order: ':'Primal Order: ')+d.cc.order,C.order[d.cc.order],src);
    if(d.cls==='Warlock'&&INVOCATIONS[d.cc.inv])F('Eldritch Invocation: '+d.cc.inv,INVOCATIONS[d.cc.inv],src);
    if(o.mastery.length)F('Weapon Mastery',o.mastery.map(w=>w+' ('+WEAPONS[w][5]+'): '+MASTERY[WEAPONS[w][5]]).join('\n')+'\nNach jeder Long Rest darfst du eine Waffe tauschen.',src)}
  if(P){P.t.forEach(([n,dsc,u,r])=>F(n,dsc,'Spezies',u,r));
    if(P.choose&&P.choose.opts[d.spCh])F(P.choose.label+': '+d.spCh,d.sp==='Dragonborn'?'Schadensart: '+P.choose.opts[d.spCh]+'.':P.choose.opts[d.spCh],'Spezies')}
  o.feats.forEach(f=>{let dsc=FEATS[f.n].d;const x=o.mi[f.src];
    if(x&&x.list)dsc+='\nListe: '+x.list+(x.ab?', Zauberattribut '+ABN[x.ab]:'')+'. Cantrips: '+(x.c.join(', ')||'–')+'. Spell: '+(x.l1||'–')+'.';
    if(o.skilled[f.src]&&o.skilled[f.src].length)dsc+='\nGewählt: '+o.skilled[f.src].join(', ')+'.';
    if(o.featTools[f.src]&&o.featTools[f.src].length)dsc+='\nGewählt: '+o.featTools[f.src].join(', ')+'.';
    if(f.n==='Alert')dsc+='\nIm Bogen als Initiative-Zusatzbonus eingetragen. Steigt dein Proficiency Bonus, erhöh ihn dort.';
    if(f.n==='Tough')dsc+='\nIm Hit-Point-Maximum schon eingerechnet. Beim Level up jeweils 2 dazuzählen.';
    F(f.n,dsc,f.src==='bg'?'Feat · '+d.bg:'Feat · Human',f.n==='Lucky'?'pb':f.n==='Magic Initiate'&&x&&x.l1?1:0,'long')});
  return s}

/* ---------- small pick controls ---------- */
function Choice({t,n,max,ex,children}){
  return html`<section class="choice"><h3 class="h3">${t}${max?html`<span class=${'cnt'+(n>=max?' full':'')}>${n} von ${max}</span>`:null}</h3>${ex?html`<p class="sm soft" style="max-width:70ch;margin:.25rem 0 0">${ex}</p>`:null}${children}</section>`}
/* opts: [key, title, text, why-disabled, tags] */
function Opts({opts,sel,max,on,cls}){
  const s=Array.isArray(sel)?sel:sel?[sel]:[],multi=Array.isArray(sel),full=multi&&s.length>=max,[all,setAll]=useState(false);
  const done=multi?full:s.length>0,long=opts.length>8,fold=long&&done&&!all,shown=fold?opts.filter(x=>s.includes(x[0])):opts;
  return html`<div class=${'olist'+(cls?' '+cls:'')}>${shown.map(([k,t,x,dis,tags])=>{const p=s.includes(k);
    return html`<button key=${k} type="button" class="oitem" aria-pressed=${p} disabled=${!p&&(!!dis||(full&&max>1))}
      onClick=${()=>on(multi?(p?s.filter(y=>y!==k):max===1?[k]:s.concat(k)):(p?'':k))}>
      <b>${t}</b>${tags&&tags.length?html`<span class="tags">${tags.map(g=>html`<span class="tag" key=${g}>${g}</span>`)}</span>`:null}
      ${x?html`<span class="d">${x}</span>`:null}${dis&&!p?html`<span class="d why">${dis}</span>`:null}</button>`})}</div>
    ${long&&done?html`<button type="button" class="linkbtn" style="margin-top:.6rem" onClick=${()=>setAll(!all)}>${fold?'Alle '+opts.length+' zur Auswahl zeigen':'Nur deine Auswahl zeigen'}</button>`:null}`}
function Chips({opts,sel,max,on}){ /* opts: [key, label, sub, why-disabled] */
  const full=sel.length>=max;
  return html`<div class="chips" style="margin-top:.6rem">${opts.map(([k,l,sub,dis])=>{const p=sel.includes(k);
    return html`<button key=${k} type="button" class="chip" aria-pressed=${p} title=${dis||null} disabled=${!p&&(!!dis||(full&&max>1))} onClick=${()=>on(p?sel.filter(y=>y!==k):max===1?[k]:sel.concat(k))}>${l}${sub?html`<small>${sub}</small>`:null}</button>`})}</div>`}
const skOpt=(k,dis)=>[k,k,ABS[(SK.find(x=>x[0]===k)||[])[1]]+' · '+SKILL_DE[k],dis];
const spOpt=(n,before)=>{const X=SP[n];return [n,n,X[5],before&&before.has(n)?'Kennst du schon.':'',[X[1],X[2],X[3]?'Concentration':'',X[4]?'Ritual':''].filter(Boolean)]};

/* ---------- the steps ---------- */
function StepCls({d,o,up}){
  const C=o.C;
  return html`<p class="lead">Deine Klasse ist dein Handwerk als Abenteurer. Sie entscheidet, wie du kämpfst, ob du zauberst und was du am besten kannst. Tipp auf eine Klasse, um mehr zu lesen.</p>
    <div class="pick-grid opt-grid">${Object.keys(C24).map(k=>html`<button key=${k} type="button" class="pick" aria-pressed=${d.cls===k}
      onClick=${()=>up(x=>{if(x.cls!==k){x.cls=k;x.cc={style:'',order:'',inv:'',mastery:[]};x.skills=[];x.exp=[];x.ctools=[];x.spells={c:[],l1:[],prep:[]};x.tome={c:[],r:[]};x.eqC='A'}})}>
      <b>${k}</b><span class="sm soft">${C24[k].tag}</span><span class="tags"><span class="tag">d${C24[k].hd} Hit Die</span><span class="tag">${ABN[C24[k].prim]}</span>${C24[k].sc?html`<span class="tag violet">Magie</span>`:null}</span></button>`)}</div>
    ${C?html`<div class="detail" id="b-detail">
      <h2 class="h2">${d.cls}</h2><p>${C.d}</p><p class="soft">${C.play}</p>
      <div class="facts">
        <div class="fact"><small>Hit Points auf Level 1</small>${C.hd} + CON Modifier</div>
        <div class="fact"><small>Hauptattribut</small>${ABN[C.prim]}</div>
        <div class="fact"><small>Saving Throws</small>${C.sv.map(a=>ABN[a]).join(', ')}</div>
        <div class="fact"><small>Skills</small>${C.skills[1].length===18?'Drei beliebige':C.skills[0]+' aus '+C.skills[1].length}</div>
        <div class="fact"><small>Armor Training</small>${C.armor}</div>
        <div class="fact"><small>Weapons</small>${C.weapons}</div>
      </div>
      <h3 class="h3">Was du auf Level 1 kannst</h3>
      <ul class="feat-list">${C.f.map(([n,x])=>html`<li key=${n}><b>${n}.</b> ${x}</li>`)}
        ${d.cls==='Fighter'?html`<li><b>Fighting Style.</b> Ein Kampfstil deiner Wahl, siehe unten.</li>`:null}
        ${C.mastery?html`<li><b>Weapon Mastery.</b> Bei ${C.mastery} Waffenarten nutzt du deren Mastery-Eigenschaft, siehe unten.</li>`:null}</ul>
      ${d.cls==='Fighter'?html`<${Choice} t="Fighting Style" ex="Ein Kampfstil, der zu deiner Waffe passt. Defense ist immer nützlich, Archery für Bogenschützen, Great Weapon Fighting für Zweihänder.">
        <${Opts} opts=${Object.keys(FIGHTING_STYLES).map(k=>[k,k,FIGHTING_STYLES[k]])} sel=${d.cc.style} on=${v=>up(x=>{x.cc.style=v})}/><//>`:null}
      ${C.order?html`<${Choice} t=${d.cls==='Cleric'?'Divine Order':'Primal Order'} ex=${d.cls==='Cleric'?'Welche Rolle du deinem Gott gegenüber einnimmst.':'Wie du der Natur dienst.'}>
        <${Opts} opts=${Object.keys(C.order).map(k=>[k,k,C.order[k]])} sel=${d.cc.order} on=${v=>up(x=>{x.cc.order=v})}/><//>`:null}
      ${d.cls==='Warlock'?html`<${Choice} t="Eldritch Invocation" ex="Eine Gabe deines Patrons. Die drei Pacts bestimmen, wie dein Warlock sich anfühlt: mit Waffe, mit Vertrautem oder mit Buch.">
        <${Opts} opts=${Object.keys(INVOCATIONS).map(k=>[k,k,INVOCATIONS[k]])} sel=${d.cc.inv} on=${v=>up(x=>{x.cc.inv=v})}/><//>`:null}
      ${C.mastery?html`<${Choice} t="Weapon Mastery" n=${o.mastery.length} max=${C.mastery} ex=${'Wähle '+C.mastery+' Waffenarten, deren Mastery du nutzen kannst. Am besten die Waffen, die du trägst. Was die Mastery-Eigenschaften tun, steht unter der Liste.'}>
        <${Opts} cls="sm" opts=${o.mastOpts.map(w=>[w,w,WEAPONS[w][0]+' '+WEAPONS[w][1]+(WEAPONS[w][3]?', Fernkampf':''),'',[WEAPONS[w][5]]])} sel=${o.mastery} max=${C.mastery} on=${v=>up(x=>{x.cc.mastery=v})}/>
        <dl class="kv sm" style="margin-top:.9rem">${Object.keys(MASTERY).map(k=>html`<dt key=${k+'t'}>${k}</dt><dd key=${k}>${MASTERY[k]}</dd>`)}</dl><//>`:null}
    </div>`:null}`}

function StepBg({d,o,up}){
  const B=o.B;
  return html`<p class="lead">Dein Background erzählt, was du gemacht hast, bevor du Abenteurer wurdest. Er gibt dir zwei Skills, ein Tool, ein Origin Feat, Ausrüstung und die Wahl, welche drei Attribute steigen.</p>
    <div class="pick-grid opt-grid">${Object.keys(BG24).map(k=>html`<button key=${k} type="button" class="pick" aria-pressed=${d.bg===k} onClick=${()=>up(x=>{if(x.bg!==k){x.bg=k;x.bgTool='';x.b2='';x.b1='';x.fp.bg={}}})}>
      <b>${k}</b><span class="sm soft">${BG24[k].d}</span><span class="tags"><span class="tag amber">${BG24[k].feat}</span></span></button>`)}</div>
    ${B?html`<div class="detail" id="b-detail"><h2 class="h2">${d.bg}</h2><p>${B.d}</p>
      <div class="facts">
        <div class="fact"><small>Attribute (+2/+1 oder +1/+1/+1)</small>${B.ab.map(a=>ABN[a]).join(', ')}</div>
        <div class="fact"><small>Skills</small>${B.sk.join(', ')}</div>
        <div class="fact"><small>Tool</small>${o.bgToolOpts?TOOLCAT[B.tool]+' deiner Wahl':B.tool}</div>
        <div class="fact"><small>Origin Feat</small>${B.feat}${B.fl?' ('+B.fl+')':''}</div>
      </div>
      <h3 class="h3">${B.feat}</h3><p class="sm" style="max-width:70ch;margin-top:.3rem">${FEATS[B.feat].d}</p>
      ${B.feat==='Magic Initiate'?html`<p class="sm soft">Die Spells suchst du im Schritt Spells aus.</p>`:FEATS[B.feat].pick?html`<p class="sm soft">Was du dafür wählst, kommt im Schritt Fertigkeiten.</p>`:null}
      ${o.bgToolOpts?html`<${Choice} t=${TOOLCAT[B.tool]} ex="Mit diesem Werkzeug bist du geübt. Es liegt auch in deiner Ausrüstung.">
        <${Chips} opts=${o.bgToolOpts.map(t=>[t,t])} sel=${d.bgTool?[d.bgTool]:[]} max=${1} on=${v=>up(x=>{x.bgTool=v[0]||''})}/><//>`:null}
      <p class="sm soft" style="margin-top:1rem">Die Attributs-Boni verteilst du im Schritt Attribute, die Ausrüstung wählst du im Schritt Ausrüstung.</p>
    </div>`:null}`}

function StepSp({d,o,up}){
  const P=o.P;
  return html`<p class="lead">Deine Spezies bestimmt Größe, Geschwindigkeit und ein paar besondere Fähigkeiten, etwa im Dunkeln zu sehen. Auf Attribute hat sie in den Regeln von 2024 keinen Einfluss mehr, das macht jetzt der Background.</p>
    <div class="pick-grid opt-grid">${Object.keys(SPECIES).map(k=>html`<button key=${k} type="button" class="pick" aria-pressed=${d.sp===k} onClick=${()=>up(x=>{if(x.sp!==k){x.sp=k;x.spCh='';x.size=SPECIES[k].size.length>1?'':SPECIES[k].size[0];x.keen='';x.skillful='';x.feat2='';x.fp.sp={}}})}>
      <b>${k}</b><span class="sm soft">${SPECIES[k].tag}</span><span class="tags"><span class="tag">${SPECIES[k].size.join(' oder ')}</span><span class="tag">${SPECIES[k].speed} ft</span></span></button>`)}</div>
    ${P?html`<div class="detail" id="b-detail"><h2 class="h2">${d.sp}</h2><p>${P.d}</p>
      <div class="facts">
        <div class="fact"><small>Größe</small>${P.size.join(' oder ')}</div>
        <div class="fact"><small>Speed</small>${P.speed} ft${d.sp==='Elf'?' (Wood Elf 35 ft)':''}</div>
        <div class="fact"><small>Darkvision</small>${P.dv?P.dv+' ft':'keine'}</div>
      </div>
      <h3 class="h3">Besondere Fähigkeiten</h3>
      <ul class="feat-list">${P.t.map(([n,x])=>html`<li key=${n}><b>${n}.</b> ${x}</li>`)}</ul>
      ${P.choose?html`<${Choice} t=${P.choose.label}><${Opts} opts=${Object.keys(P.choose.opts).map(k=>[k,k,d.sp==='Dragonborn'?'Schadensart: '+P.choose.opts[k]:P.choose.opts[k]])} sel=${d.spCh} on=${v=>up(x=>{x.spCh=v})}/><//>`:null}
      ${P.size.length>1?html`<${Choice} t="Größe" ex="Small ist etwa 0,6 bis 1,2 m groß, Medium etwa 1,2 bis 2,1 m. Regeltechnisch ändert das fast nichts."><div class="seg" style="margin-top:.6rem">${P.size.map(z=>html`<button key=${z} type="button" aria-pressed=${d.size===z} onClick=${()=>up(x=>{x.size=z})}>${z}</button>`)}</div><//>`:null}
      ${o.needSpAb?html`<${Choice} t="Zauberattribut für deine Spezies-Magie" ex="Mit diesem Attribut wirkst du die Spells deiner Spezies. Nimm am besten das Attribut, mit dem auch deine Klasse zaubert, sonst dein höchstes von den dreien.">
        <div class="seg" style="margin-top:.6rem">${SPAB.map(a=>html`<button key=${a} type="button" aria-pressed=${d.spAb===a} onClick=${()=>up(x=>{x.spAb=a})}>${ABN[a]}</button>`)}</div><//>`:null}
      ${P.versatile?html`<${Choice} t="Versatile: dein zweites Origin Feat" ex=${'Menschen bekommen zusätzlich zum Feat ihres Backgrounds'+(o.B?' ('+o.B.feat+')':'')+' noch eines. Magic Initiate und Skilled darfst du doppelt nehmen, die anderen nicht.'}>
        <${Opts} opts=${Object.keys(FEATS).map(k=>[k,k,FEATS[k].d,o.feat2dup(k)?'Hast du schon durch deinen Background.':''])} sel=${d.feat2} on=${v=>up(x=>{x.feat2=v;x.fp.sp={}})}/><//>`:null}
    </div>`:null}`}

function StepAb({d,o,up}){
  const C=o.C,B=o.B,prio=PRIO[d.cls]||AB;
  const suggest=()=>up(x=>{if(x.abM==='std'){x.std={};prio.forEach((a,i)=>{x.std[a]=STD[i]})}else if(x.abM==='pb'){x.pbuy={};prio.forEach((a,i)=>{x.pbuy[a]=STD[i]<8?8:STD[i]})}
    if(B){const r=prio.filter(a=>B.ab.includes(a));x.bonus='21';x.b2=r[0];x.b1=r[1]}});
  const setStd=(a,v)=>up(x=>{const old=x.std[a];AB.forEach(b=>{if(b!==a&&x.std[b]===v)x.std[b]=STD.includes(old)?old:''});x.std[a]=v});
  const cell=a=>d.abM==='std'?html`<select class="in" style="width:5.2rem" aria-label=${ABN[a]} value=${STD.includes(d.std[a])?d.std[a]:''} onChange=${e=>setStd(a,e.target.value===''?'':+e.target.value)}>
        <option value="">–</option>${STD.map(v=>html`<option key=${v} value=${v}>${v}${AB.some(b=>b!==a&&d.std[b]===v)?' (tauschen)':''}</option>`)}</select>`
    :d.abM==='pb'?html`<${Counter} v=${o.base[a]} min=${8} max=${15} label=${ABN[a]} on=${v=>{if(v>15||v<8)return;const cost=POINT_COST[v]-POINT_COST[o.base[a]];if(cost>o.pbLeft&&v>o.base[a])return;up(x=>{x.pbuy[a]=v})}}/>`
    :html`<${In} type="number" cls="tiny" min="3" max="20" lbl=${ABN[a]} v=${d.man[a]} on=${v=>up(x=>{x.man[a]=v})}/>`;
  return html`<p class="lead">Sechs Attribute beschreiben, was dein Charakter körperlich und geistig draufhat. Aus jedem Wert ergibt sich ein Modifier, den du auf Würfe zählst: 10 ist Durchschnitt (+0), 14 ist gut (+2), 16 sehr gut (+3).</p>
    <div class="rowf"><div class="seg">${[['std','Standard Array'],['pb','Point Buy'],['man','Eigene Werte']].map(([k,l])=>html`<button key=${k} type="button" aria-pressed=${d.abM===k} onClick=${()=>up(x=>{x.abM=k})}>${l}</button>`)}</div>
      ${d.abM!=='man'&&C?html`<button class="btn s" type="button" onClick=${suggest}>Vorschlag für ${d.cls}</button>`:null}</div>
    <p class="sm soft" style="max-width:70ch;margin-top:.6rem">${d.abM==='std'?'Verteile die Werte 15, 14, 13, 12, 10 und 8 auf die sechs Attribute. Jeder Wert kommt einmal vor.'
      :d.abM==='pb'?html`Jedes Attribut startet bei 8. Du hast 27 Punkte, höher als 15 geht es nicht. Noch übrig: <b class=${o.pbLeft<0?'err':''}>${o.pbLeft}</b>.`
      :'Für gewürfelte Werte oder wenn eure Spielleitung andere Werte vorgibt. Trag die Werte ohne Background-Bonus ein.'}</p>
    <table class="abtab"><thead><tr><th>Attribut</th><th>Wert</th><th class="bon">Background</th><th>Gesamt</th><th>Mod</th></tr></thead><tbody>
      ${AB.map(a=>html`<tr key=${a}><td><b>${ABN[a]}</b><div class="sm soft sub">${AB_DE[a]}${C&&C.prim===a?' · Hauptattribut':''}${C&&C.sv.includes(a)?' · Save':''}</div></td>
        <td>${cell(a)}</td><td class="soft bon">${o.bon[a]?'+'+o.bon[a]:'–'}</td><td class="tot">${o.ab[a]==null?'–':o.ab[a]}${o.bon[a]?html`<small class="bon-in">+${o.bon[a]}</small>`:null}</td><td class="md">${o.ab[a]==null?'–':sg(mod(o.ab[a]))}</td></tr>`)}
    </tbody></table>
    ${B?html`<${Choice} t=${'Bonus durch deinen Background ('+d.bg+')'} ex=${'Dein Background erlaubt '+B.ab.map(a=>ABN[a]).join(', ')+'. Entweder +2 auf eines und +1 auf ein anderes, oder +1 auf alle drei. Kein Wert darf über 20 steigen.'}>
      <div class="seg" style="margin-top:.6rem">${[['21','+2 und +1'],['111','+1, +1, +1']].map(([k,l])=>html`<button key=${k} type="button" aria-pressed=${d.bonus===k} onClick=${()=>up(x=>{x.bonus=k})}>${l}</button>`)}</div>
      ${d.bonus==='21'?html`<div class="rowf" style="margin-top:.7rem"><span class="sm" style="width:3rem">+2 auf</span>${B.ab.map(a=>html`<button key=${a} type="button" class="chip" aria-pressed=${d.b2===a} onClick=${()=>up(x=>{x.b2=a;if(x.b1===a)x.b1=''})}>${ABN[a]}</button>`)}</div>
        <div class="rowf" style="margin-top:.4rem"><span class="sm" style="width:3rem">+1 auf</span>${B.ab.map(a=>html`<button key=${a} type="button" class="chip" aria-pressed=${d.b1===a} disabled=${d.b2===a} onClick=${()=>up(x=>{x.b1=a})}>${ABN[a]}</button>`)}</div>`:null}
    <//>`:html`<p class="hint" style="margin-top:1rem">Wähl zuerst einen Background, dann kannst du hier seinen Bonus verteilen.</p>`}`}

function StepSk({d,o,up}){
  const C=o.C,B=o.B,P=o.P;
  if(!C||!B)return html`<p class="hint">Wähl zuerst Klasse und Background, dann siehst du hier, welche Skills du bekommst und welche du aussuchen darfst.</p>`;
  const skillDis=(k,before)=>before.has(k)?'Hast du schon.':'';
  return html`<p class="lead">Skills sind Dinge, in denen du geübt bist. Bei Würfen darauf zählst du deinen Proficiency Bonus (+2 auf Level 1) dazu. Tools funktionieren genauso, Sprachen kannst du einfach.</p>
    <${Choice} t=${'Von deinem Background ('+d.bg+')'}><div class="chips" style="margin-top:.6rem">${o.bgSk.map(k=>html`<span class="chip on" key=${k}>${k}<small>${SKILL_DE[k]}</small></span>`)}</div><//>
    <${Choice} t=${'Von deiner Klasse ('+d.cls+')'} n=${o.clsSk.length} max=${o.clsN} ex=${C.skills[1].length===18?'Barden dürfen aus allen Skills wählen.':'Wähle aus der Liste deiner Klasse.'}>
      <${Chips} opts=${o.clsOpts.map(k=>skOpt(k,skillDis(k,o.kCls)))} sel=${o.clsSk} max=${o.clsN} on=${v=>up(x=>{x.skills=v})}/><//>
    ${P&&P.keen?html`<${Choice} t="Keen Senses (Elf)" n=${o.keen?1:0} max=${1}><${Chips} opts=${P.keen.map(k=>skOpt(k,skillDis(k,o.kKeen)))} sel=${o.keen?[o.keen]:[]} max=${1} on=${v=>up(x=>{x.keen=v[0]||''})}/><//>`:null}
    ${P&&P.skillful?html`<${Choice} t="Skillful (Human)" n=${o.skillful?1:0} max=${1} ex="Ein Skill deiner Wahl."><${Chips} opts=${ALLSKILLS.map(k=>skOpt(k,skillDis(k,o.kSkillful)))} sel=${o.skillful?[o.skillful]:[]} max=${1} on=${v=>up(x=>{x.skillful=v[0]||''})}/><//>`:null}
    ${o.feats.filter(f=>f.n==='Skilled').map(f=>{const K=o.kSkilled[f.src];return html`<${Choice} key=${f.src} t=${'Skilled ('+(f.src==='bg'?d.bg:'Human')+')'} n=${o.skilled[f.src].length} max=${3} ex="Drei Skills oder Tools, beliebig gemischt.">
      <${Chips} opts=${ALLSKILLS.map(k=>skOpt(k,skillDis(k,K.sk))).concat(ALLTOOLS.map(t=>[t,t,'Tool',K.t.includes(t)?'Hast du schon.':'']))} sel=${o.skilled[f.src]} max=${3} on=${v=>up(x=>{x.fp[f.src]=Object.assign({},x.fp[f.src],{picks:v})})}/><//>`})}
    ${o.expN?html`<${Choice} t="Expertise (Rogue)" n=${o.exp.length} max=${o.expN} ex="In zwei deiner Skills zählt der Proficiency Bonus doppelt. Beliebt sind Stealth und Perception.">
      <${Chips} opts=${[...o.known].sort().map(k=>skOpt(k,''))} sel=${o.exp} max=${o.expN} on=${v=>up(x=>{x.exp=v})}/><//>`:null}
    <h2 class="h2">Tools</h2>
    <div class="chips">${o.tCls.map(t=>html`<span class="chip on" key=${t}>${t}</span>`)}${!o.tCls.length?html`<span class="soft sm">${o.bgToolOpts?'Dein Tool vom Background wählst du im Schritt Herkunft.':'Noch keine.'}</span>`:null}</div>
    ${o.ctoolN?html`<${Choice} t=${d.cls==='Bard'?'Drei Musikinstrumente (Bard)':'Ein Artisan\'s Tool oder Instrument (Monk)'} n=${o.ctools.length} max=${o.ctoolN}>
      <${Chips} opts=${o.ctoolOpts.map(t=>[t,t,'',o.tCls.includes(t)?'Hast du schon.':''])} sel=${o.ctools} max=${o.ctoolN} on=${v=>up(x=>{x.ctools=v})}/><//>`:null}
    ${o.feats.filter(f=>f.n==='Crafter'||f.n==='Musician').map(f=>{const opts=f.n==='Crafter'?TOOLS.artisan:TOOLS.music,K=o.tFeat[f.src];
      return html`<${Choice} key=${f.src} t=${f.n+': drei '+(f.n==='Crafter'?"Artisan's Tools":'Instrumente')} n=${o.featTools[f.src].length} max=${3}>
        <${Chips} opts=${opts.map(t=>[t,t,'',K.includes(t)?'Hast du schon.':''])} sel=${o.featTools[f.src]} max=${3} on=${v=>up(x=>{x.fp[f.src]=Object.assign({},x.fp[f.src],{tools:v})})}/><//>`})}
    <h2 class="h2">Sprachen</h2>
    <p class="sm soft" style="max-width:70ch">Du sprichst Common${(C.extraLang||[]).length?' und '+C.extraLang.join(', '):''}. Dazu kommen ${o.langN} Sprachen deiner Wahl${C.extraLangPick?' (eine davon durch Thieves\' Cant)':''}.</p>
    <${Chips} opts=${LANGS.map(l=>[l,l])} sel=${o.langPicks} max=${o.langN} on=${v=>up(x=>{x.langs=v})}/>`}

function StepSpl({d,o,up}){
  const sc=o.sc;
  if(!o.C)return html`<p class="hint">Wähl zuerst eine Klasse.</p>`;
  if(!o.anySpells)return html`<p class="lead">${d.cls} zaubert nicht${['Barbarian','Fighter','Monk','Rogue'].includes(d.cls)?'':' auf Level 1'}. Du kannst diesen Schritt überspringen.</p>
    <p class="sm soft" style="max-width:70ch">Magie bekommst du trotzdem, wenn du als Human das Feat Magic Initiate nimmst, einen Background mit Magic Initiate wählst (Acolyte, Guide, Sage) oder eine Spezies mit eigener Magie (Aasimar, Elf, Gnome, Tiefling).</p>`;
  return html`<p class="lead">Cantrips kannst du so oft wirken, wie du willst. Spells des 1. Grades kosten einen Spell Slot${sc?', davon hast du auf Level 1 '+(sc.type==='pact'?'einen, er kommt nach jeder Short Rest zurück':'zwei, sie kommen nach jeder Long Rest zurück'):''}. Concentration heißt: nur ein solcher Spell gleichzeitig.</p>
    ${sc?html`<div class="facts"><div class="fact"><small>Zauberattribut</small>${ABN[sc.ab]}</div><div class="fact"><small>Spell Save DC</small>${8+2+o.m(sc.ab)}</div><div class="fact"><small>Spell Attack</small>${sg(2+o.m(sc.ab))}</div></div>`:null}
    ${o.spAuto.length?html`<${Choice} t="Bekommst du automatisch"><ul class="feat-list">${o.spAuto.map(x=>html`<li key=${x.n}><b>${x.n}</b> <span class="tag">${x.src}</span> ${SP[x.n][5]} ${x.note||''}</li>`)}</ul><//>`:null}
    ${sc&&o.cN?html`<${Choice} t="Cantrips" n=${o.spC.length} max=${o.cN}><${Opts} opts=${o.cOpts.map(n=>spOpt(n,o.kSpCls))} sel=${o.spC} max=${o.cN} on=${v=>up(x=>{x.spells.c=v})}/><//>`:null}
    ${sc?html`<${Choice} t=${sc.book?'Dein Zauberbuch':'Vorbereitete Spells des 1. Grades'} n=${o.spL.length} max=${o.lN} ex=${sc.book?'Sechs Spells stehen in deinem Zauberbuch. Vier davon hast du jeweils vorbereitet, die wählst du gleich darunter.':'Nach jeder Long Rest darfst du '+(d.cls==='Wizard'?'':'einen oder alle ')+'neu wählen. Für den Anfang reichen gute Allrounder.'}>
      <${Opts} opts=${o.lOpts.map(n=>spOpt(n,o.kSpCls))} sel=${o.spL} max=${o.lN} on=${v=>up(x=>{x.spells.l1=v})}/><//>`:null}
    ${sc&&sc.book&&o.spL.length?html`<${Choice} t="Davon vorbereitet" n=${o.spP.length} max=${sc.prep}><${Chips} opts=${o.spL.map(n=>[n,n])} sel=${o.spP} max=${sc.prep} on=${v=>up(x=>{x.spells.prep=v})}/><//>`:null}
    ${Object.values(o.mi).map(x=>html`<div key=${x.src} class="detail"><h2 class="h2">Magic Initiate ${x.src==='bg'?'('+d.bg+')':'(Human)'}</h2>
      <p class="sm">${FEATS['Magic Initiate'].d}</p>
      ${x.fixed?html`<p class="sm soft">Spell-Liste durch deinen Background: <b>${x.list}</b>.</p>`:html`<${Choice} t="Spell-Liste"><div class="seg" style="margin-top:.6rem">${MI_LISTS.map(l=>html`<button key=${l} type="button" aria-pressed=${x.list===l} disabled=${o.mi.bg&&o.mi.bg.list===l} onClick=${()=>up(y=>{y.fp.sp=Object.assign({},y.fp.sp,{list:l,c:[],l1:''})})}>${l}</button>`)}</div><//>`}
      <${Choice} t="Zauberattribut" ex="Meist das Attribut, mit dem du ohnehin am besten bist."><div class="seg" style="margin-top:.6rem">${SPAB.map(a=>html`<button key=${a} type="button" aria-pressed=${x.ab===a} onClick=${()=>up(y=>{y.fp[x.src]=Object.assign({},y.fp[x.src],{ab:a})})}>${ABN[a]}</button>`)}</div><//>
      ${x.list?html`<${Choice} t="Zwei Cantrips" n=${x.c.length} max=${2}><${Opts} opts=${SPL[x.list][0].map(n=>spOpt(n,x.before))} sel=${x.c} max=${2} on=${v=>up(y=>{y.fp[x.src]=Object.assign({},y.fp[x.src],{c:v})})}/><//>
        <${Choice} t="Ein Spell des 1. Grades" n=${x.l1?1:0} max=${1}><${Opts} opts=${SPL[x.list][1].map(n=>spOpt(n,x.before))} sel=${x.l1?[x.l1]:[]} max=${1} on=${v=>up(y=>{y.fp[x.src]=Object.assign({},y.fp[x.src],{l1:v[0]||''})})}/><//>`:null}
    </div>`)}
    ${o.tome?html`<div class="detail"><h2 class="h2">Pact of the Tome</h2><p class="sm">Dein Book of Shadows: drei Cantrips von beliebigen Listen und zwei Ritual-Spells des 1. Grades, die du immer vorbereitet hast.</p>
      <${Choice} t="Drei Cantrips" n=${o.tome.c.length} max=${3}><${Opts} opts=${ALLC.map(n=>spOpt(n,o.tome.before))} sel=${o.tome.c} max=${3} on=${v=>up(y=>{y.tome.c=v})}/><//>
      <${Choice} t="Zwei Ritual-Spells" n=${o.tome.r.length} max=${2}><${Opts} opts=${ALLR.map(n=>spOpt(n,o.tome.before))} sel=${o.tome.r} max=${2} on=${v=>up(y=>{y.tome.r=v})}/><//></div>`:null}`}

function StepEq({d,o,up}){
  const C=o.C,B=o.B;
  if(!C||!B)return html`<p class="hint">Wähl zuerst Klasse und Background, dann siehst du hier deine Startausrüstung.</p>`;
  const list=items=>items.map(([n,q])=>(q>1?q+' ':'')+n).join(', ');
  const eq=eqItems(d,o),ac=acOf(d,o,eq.items),weap=eq.items.filter(i=>WEAPONS[i.n]).map(i=>i.n);
  return html`<p class="lead">Du startest entweder mit dem Paket deiner Klasse und deines Backgrounds oder nimmst das Geld und kaufst selbst ein. Für den Anfang ist das Paket fast immer die bessere Wahl.</p>
    <${Choice} t=${'Klasse ('+d.cls+')'}><div class="pick-grid" style="margin-top:.6rem">${Object.keys(C.eq).map(k=>{const x=C.eq[k];return html`<button key=${k} type="button" class="pick" aria-pressed=${d.eqC===k} onClick=${()=>up(y=>{y.eqC=k})}>
      <b>Option ${k}${x.label?': '+x.label:''}</b><span class="sm">${x.items.length?list(x.items)+', '+x.gp+' GP':'Nur Gold: '+x.gp+' GP. Ausrüstung kaufst du selbst.'}</span></button>`})}</div><//>
    <${Choice} t=${'Background ('+d.bg+')'}><div class="pick-grid" style="margin-top:.6rem">
      <button type="button" class="pick" aria-pressed=${d.bgEq!=='B'} onClick=${()=>up(y=>{y.bgEq='A'})}><b>Option A</b><span class="sm">${list(B.eq)}, ${B.gp} GP</span></button>
      <button type="button" class="pick" aria-pressed=${d.bgEq==='B'} onClick=${()=>up(y=>{y.bgEq='B'})}><b>Option B</b><span class="sm">Nur Gold: 50 GP.</span></button></div><//>
    <div class="facts" style="margin-top:1.4rem"><div class="fact"><small>Armor Class damit</small>${ac.ac} <span class="soft sm">(${ac.note})</span></div>
      <div class="fact"><small>Waffen</small>${weap.length?weap.join(', '):'keine'}</div><div class="fact"><small>Gold</small>${eq.gp} GP</div></div>
    ${Object.keys(PACKS).some(p=>eq.items.some(i=>i.n===p))?html`<dl class="kv sm">${Object.keys(PACKS).filter(p=>eq.items.some(i=>i.n===p)).map(p=>html`<dt key=${p+'t'}>${p}</dt><dd key=${p}>${PACKS[p]}</dd>`)}</dl>`:null}`}

function StepDet({d,o,up}){
  const f=(k,l,ph)=>html`<${F} l=${l}><${In} id=${'b-'+k} v=${d[k]} ph=${ph} on=${v=>up(x=>{x[k]=v})}/><//>`,a=(k,l,ph,r)=>html`<${F} l=${l} wide=${true}><${Area} id=${'b-'+k} rows=${r||2} v=${d[k]} ph=${ph} on=${v=>up(x=>{x[k]=v})}/><//>`;
  return html`<p class="lead">Wer ist dein Charakter? Name und Kurzbeschreibung sieht die ganze Gruppe, den Rest nur du und die Spielleitung. Alles lässt sich später im Bogen ändern, das Bild lädst du dort hoch.</p>
    <div class="fg" style="max-width:46rem">
      ${f('name','Name','')}
      <${F} l="Alignment"><select class="in" id="b-align" value=${d.align} onChange=${e=>{const v=e.target.value;up(x=>{x.align=v})}}><option value="">–</option>${ALIGN.map(v=>html`<option key=${v} value=${v}>${v}</option>`)}</select><//>
      ${f('age','Alter','')}${f('height','Größe und Statur','1,78 m, kräftig')}
      ${a('look','Kurzbeschreibung für die Gruppe','Woran erkennt man deinen Charakter? Zwei, drei Sätze.',3)}
      ${a('traits','Personality Traits','Wie benimmt sich dein Charakter?')}${a('ideals','Ideals','Woran glaubt er?')}
      ${a('bonds','Bonds','Wer oder was ist ihm wichtig?')}${a('flaws','Flaws','Was ist seine Schwäche?')}
      ${a('story','Hintergrundgeschichte','',5)}
    </div>`}

function StepEnd({d,o,miss,go,make}){
  const s=buildSheet(d),ready=!miss.length,base=!!(o.C&&o.B&&o.P);
  return html`${ready?html`<p class="lead">Alles ausgewählt. So sieht dein Bogen aus. Wenn du ihn anlegst, kannst du ihn jederzeit weiter bearbeiten.</p>`
      :html`<div class="miss"><h3 class="h3">Noch offen</h3><ul>${miss.map(([i,t],j)=>html`<li key=${j}><button type="button" class="linkbtn" onClick=${()=>go(i)}>${BSTEPS[i][1]}</button>: ${t}</li>`)}</ul></div>`}
    <div class="rowf" style="margin:1.2rem 0">${ready?html`<button class="btn solid" type="button" onClick=${make}><${Ic} n="check"/>Charakter anlegen</button>`
      :base?html`<${Confirm} label="Trotzdem anlegen" cls="btn" ask="Offenes kannst du später im Bogen von Hand eintragen." yes="Anlegen" onYes=${make}/>`:null}</div>
    ${base?html`<div class="preview"><span class="lbl">Vorschau</span><${Sheet} s=${normSheet(s)} uid=${S.uid} ro=${true} nopdf=${true} set=${()=>{}}/></div>`:null}`}

function Builder({onExit}){
  const [d,setD]=useState(()=>normDraft(LS.get(draftKey(),null)));
  const up=fn=>setD(p=>{const n=clone(p);fn(n);LS.set(draftKey(),n);return n});
  const o=derive(d),miss=missing(d,o),k=BSTEPS[d.step][0];
  const go=i=>{up(x=>{x.step=clamp(i,0,BSTEPS.length-1);x.far=Math.max(x.far||0,x.step)});window.scrollTo(0,0)};
  const make=()=>{const s=buildSheet(d);if(!s.name)s.name='Namenlos';LS.set(draftKey(),null);createSheet(s);ui({edit:false});toast(s.name+' ist angelegt. Bild und Feinschliff gehen jederzeit über Bearbeiten.')};
  const here=miss.filter(m=>m[0]===d.step),nav=useRef(null);
  useEffect(()=>{const n=nav.current,b=n&&n.querySelector('[aria-current="step"]');if(b)n.scrollLeft=Math.max(0,b.offsetLeft-n.offsetLeft-(n.clientWidth-b.offsetWidth)/2)},[d.step]);
  const P={d,o,up};
  return html`<div class="builder">
    <div class="rowf"><button class="btn quiet" type="button" onClick=${onExit}><${Ic} n="back"/>Zurück zur Auswahl</button><span class="sm soft right">Dein Entwurf wird in diesem Browser gespeichert.</span></div>
    <h1 class="h1" style="margin-top:.8rem">${d.name.trim()||'Neuer Charakter'}</h1>
    <p class="sm soft" style="margin-top:.3rem">${[d.cls,raceName(d),d.bg].filter(Boolean).join(' · ')||'Regeln von 2024 · Level 1'}</p>
    <nav class="bsteps" aria-label="Schritte" ref=${nav}>${BSTEPS.map(([sk,l],i)=>{const ok=i<=d.far&&!miss.some(m=>m[0]===i);
      return html`<button key=${sk} type="button" class=${ok&&i!==d.step?'done':''} aria-current=${i===d.step?'step':null} onClick=${()=>go(i)}><i>${ok&&i!==d.step?'✓':i+1}</i>${l}</button>`})}</nav>
    ${k==='cls'?html`<${StepCls} ...${P}/>`:k==='bg'?html`<${StepBg} ...${P}/>`:k==='sp'?html`<${StepSp} ...${P}/>`:k==='ab'?html`<${StepAb} ...${P}/>`
      :k==='sk'?html`<${StepSk} ...${P}/>`:k==='spl'?html`<${StepSpl} ...${P}/>`:k==='eq'?html`<${StepEq} ...${P}/>`:k==='det'?html`<${StepDet} ...${P}/>`
      :html`<${StepEnd} ...${P} miss=${miss} go=${go} make=${make}/>`}
    ${k!=='end'?html`<div class="bnav">
      <button class="btn" type="button" disabled=${d.step===0} onClick=${()=>go(d.step-1)}><${Ic} n="back"/>Zurück</button>
      ${here.length?html`<span class="sm soft grow">Noch offen: ${here.map(m=>m[1]).join(' ')}</span>`:html`<span class="sm ok grow">Dieser Schritt ist fertig.</span>`}
      <button class="btn solid" type="button" onClick=${()=>go(d.step+1)}>Weiter: ${BSTEPS[d.step+1][1]}</button></div>`:null}
  </div>`}

/* ================= group ================= */
function PCard({uid}){
  const c=S.chars[uid],me=uid===S.uid,on=!!S.online[uid],hpMax=Math.max(1,num(c.hpMax)),pct=clamp(num(c.hp)/hpMax*100,0,100);
  const hp=c.shareHp&&c.hpMax!=null,cond=c.cond&&c.cond.length;
  return html`<article class=${'pcard np hc-'+heroCol(c,uid)+(me?' me':'')}>
    <${Medal} uid=${uid} name=${c.name} lvl=${lvlOf(c)}/>
    <div class="plate">
      <span class=${'np-lamp'+(on?' on':'')} role="img" aria-label=${on?'gerade hier':'nicht hier'} title=${on?'gerade hier':'nicht hier'}><${Ic} n="lamp"/></span>
      <h3 class="np-name">${c.name}</h3>
      <div class="np-rule" aria-hidden="true"></div>
      <${NpSub} c=${c}/>
      <p class="np-who">gespielt von ${nameOf(uid)}${me?html`<span class="tag you">Du</span>`:null}</p>
      ${c.look||c.size||hp||cond?html`<div class="np-more">
        ${c.look?html`<p class="sm pre" style="margin:0">${c.look}</p>`:null}
        ${c.size?html`<div class="sm"><span class="soft">Größe:</span> ${c.size}</div>`:null}
        ${hp?html`<div><div class=${'bar'+(num(c.hp)===0?' out':pct<=50?' low':'')}><i style=${'width:'+pct+'%'}></i></div><span class="sm soft">HP ${c.hp} / ${c.hpMax}${num(c.tmp)?' (+'+c.tmp+' temp)':''}</span></div>`:null}
        ${cond?html`<div class="chips">${c.cond.map(n=>html`<span class="tag bad" key=${n}>${n}</span>`)}</div>`:null}</div>`:null}
    </div></article>`}
function Hero(){
  const c=campOf();
  return html`<section class="hero" aria-labelledby="hero-t"><${Orn}/>
    <div class="hero-main">${c.sub?html`<p class="eyebrow">${c.sub}</p>`:null}<h1 class="h1" id="hero-t">${c.title||'Tales of Nalvair'}</h1><div class="hero-rule" aria-hidden="true"></div>
      ${c.banner?html`<p class="quote">„${c.banner}“</p><p class="sm soft" style="margin:0">Nachricht der Spielleitung</p>`:null}</div>
    ${c.next?html`<div class="when"><span class="lbl" style="margin:0">Nächste Session</span><b>${fmtDate(c.next)}</b>${c.nextNote?html`<span class="soft sm">${c.nextNote}</span>`:null}</div>`:null}
  </section>`}
function OrderList(){
  const cb=S.combat;if(!cb||!cb.on||!cb.order||!cb.order.length)return null;
  return html`<section style="margin-bottom:1.4rem;max-width:30rem"><h2 class="h2" style="margin-top:0">Kampfreihenfolge · Runde ${cb.round}</h2>
    <ol class="order">${cb.order.map((o,i)=>html`<li key=${o.id} class=${i===cb.turn?'cur':''}><span class="i">${o.i}</span><span class="grow">${o.n}</span>${o.uid===S.uid?html`<span class="tag you">Du</span>`:o.uid?html`<span class="tag">Held</span>`:null}</li>`)}</ol></section>`}
function PartyTab(){
  const ids=Object.keys(S.chars),have=ids.filter(id=>S.chars[id].name).sort((a,b)=>S.chars[a].name.localeCompare(S.chars[b].name)),none=ids.filter(id=>!S.chars[id].name);
  return html`<${Hero}/>
    <div class="sect"><h2 class="h2">Die Gruppe</h2><i aria-hidden="true"></i><span class="lbl" style="margin:0">${have.length} ${have.length===1?'Held':'Helden'}</span></div>
    <p class="soft sm" style="margin:0 0 2rem">Die kleine Laterne leuchtet, wenn jemand gerade im Kampagnenbuch ist.</p>
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

/* ================= character sheets as PDF =================
   jsPDF and the two fonts load on the first download only. Light colours for paper; the layout flows over
   as many A4 pages as a sheet needs, long texts in two columns. Several sheets can go into one file. */
let pdfP=null;
const loadJs=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('load '+src));document.head.appendChild(s)});
function pdfReady(){
  if(!pdfP){const v='?v='+(window.HM_LIBV||'1');
    pdfP=Promise.all([window.jspdf?0:loadJs('lib/jspdf.umd.min.js'+v),window.HM_PDF_FONTS?0:loadJs('lib/pdf-fonts.js'+v)])
      .then(()=>{if(!window.jspdf||!window.HM_PDF_FONTS)throw new Error('pdf lib missing');return window.jspdf.jsPDF})
      .catch(e=>{pdfP=null;throw e})}
  return pdfP}
let pdfCps=null;
function pdfClean(t){ // only characters the embedded fonts can draw
  if(!pdfCps){pdfCps=new Set();String(window.HM_PDF_FONTS.cps).split(',').forEach(r=>{const [a,b]=r.split('-').map(Number);for(let i=a;i<=(b||a);i++)pdfCps.add(i)})}
  const rep={'\t':' ',' ':' ',' ':' ',' ':' ','‐':'-','‑':'-','−':'-','●':'•','→':'->','←':'<-','≤':'<=','≥':'>='};
  let o='';for(const ch of String(t==null?'':t).normalize('NFC').replace(/\r/g,'')){
    const c=ch.codePointAt(0);if(c===10||pdfCps.has(c)){o+=ch;continue}
    if(rep[ch]!=null){o+=Array.from(rep[ch]).filter(x=>pdfCps.has(x.codePointAt(0))).join('');continue}
    const base=ch.normalize('NFD').replace(/[̀-ͯ]/g,'');if(base&&Array.from(base).every(x=>pdfCps.has(x.codePointAt(0)))){o+=base;continue}
    o+='?'}
  return o}
const PDFC={ink:'#1C2A31',soft:'#5B6B73',faint:'#8C989E',rule:'#D4DBDE',panel:'#F6F3EC',amber:'#B07015',mint:'#1D8469',coral:'#B94B37',violet:'#6450BA'};
const A4W=210,A4H=297,PM=14,PCW=A4W-2*PM,PTOP=15,PBOT=A4H-17,LHF=1.3;
const pdfWho=uid=>{const n=String((People.map[uid]||{}).name||'').trim()||nameOf(uid);return n==='Jemand'?'':n};
/* file names stay plain ASCII: some systems drop a download name with umlauts and call the file "download" */
const pdfFile=n=>String(n||'Charakter').replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[^\x20-\x7e]/g,'').replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'Charakter';
const restDe=r=>r==='short'?'Short Rest':r==='long'?'Long Rest':'';

function pdfSheet(doc,raw,uid,opt){
  const s=normSheet(clone(raw)),L=lvlOf(s),PB=pb(s);
  let y=PTOP;
  const lh=pt=>pt*0.3528*LHF;
  const font=(f,pt,col)=>{doc.setFont(f==='head'?'Marcellus':'Outfit',f==='head'?'normal':f);doc.setFontSize(pt);doc.setTextColor(col||PDFC.ink)};
  const text=(t,x,yy,o)=>doc.text(Array.isArray(t)?t:pdfClean(t),x,yy,Object.assign({baseline:'top'},o||{}));
  const wrap=(t,w)=>doc.splitTextToSize(pdfClean(t),w);
  const page=()=>{doc.addPage();y=PTOP;opt.pages.push(doc.internal.getNumberOfPages())};
  const need=h=>{if(y+h>PBOT)page()};
  const fitPt=(t,max,w,f)=>{let pt=max;font(f||'head',pt);while(pt>7&&doc.getTextWidth(pdfClean(t))>w){pt-=.5;font(f||'head',pt)}return pt};
  const rr=(x,yy,w,h,fill)=>{doc.setDrawColor(PDFC.rule);doc.setLineWidth(.3);if(fill){doc.setFillColor(fill);doc.roundedRect(x,yy,w,h,1.8,1.8,'FD')}else doc.roundedRect(x,yy,w,h,1.8,1.8,'S')};
  const cap=(t,x,yy,o,col)=>{font('medium',6.2,col||PDFC.soft);text(String(t).toUpperCase(),x,yy,Object.assign({charSpace:.25},o||{}))};
  const mark=(x,yy,lvl)=>{doc.setLineWidth(.3);if(lvl){doc.setFillColor(PDFC.amber);doc.setDrawColor(PDFC.amber);doc.circle(x,yy,.95,'F');if(lvl>1)doc.circle(x,yy,1.6,'S')}else{doc.setDrawColor(PDFC.faint);doc.circle(x,yy,.95,'S')}};
  const sec=(t,sub,after)=>{need(12+(after||0));y+=2.5;font('head',13.5);text(t,PM,y);
    if(sub){const w=doc.getTextWidth(pdfClean(t));font('normal',8,PDFC.soft);text(sub,PM+w+3,y+2)}
    y+=lh(13.5)+.2;doc.setDrawColor(PDFC.amber);doc.setLineWidth(.45);doc.line(PM,y,PM+PCW,y);y+=2.8};

  /* ---- header with picture ---- */
  const pic=S.portraits[uid]&&S.portraits[uid].d,pw=30,ph=37.5,px=A4W-PM-pw,y0=y,tw=PCW-pw-6;
  cap('Tales of Nalvair · Charakterbogen',PM,y,null,PDFC.amber);
  const npt=fitPt(s.name||'Namenlos',26,tw);font('head',npt);text(s.name||'Namenlos',PM,y+4.6);
  let hy=y+4.6+lh(npt);
  font('normal',10.5,PDFC.soft);
  const idl=wrap([[s.cls||'Ohne Class',s.sub].filter(Boolean).join(' · '),'Level '+L,s.race,s.bg,s.align].filter(Boolean).join('   ·   '),tw);
  text(idl,PM,hy+.6);hy+=.6+idl.length*lh(10.5);
  const by=[opt.player?'Gespielt von '+opt.player:'',num(s.xp)?s.xp+' XP':''].filter(Boolean).join(' · ');
  if(by){font('normal',8.5,PDFC.faint);text(by,PM,hy+1);hy+=1+lh(8.5)}
  if(pic){try{doc.addImage(pic,'JPEG',px,y0,pw,ph,'p-'+uid,'FAST')}catch(e){}doc.setDrawColor(PDFC.rule);doc.setLineWidth(.3);doc.rect(px,y0,pw,ph,'S')}
  else{rr(px,y0,pw,ph,PDFC.panel);font('head',22,PDFC.faint);text(initials(s.name),px+pw/2,y0+ph/2,{align:'center',baseline:'middle'})}
  y=Math.max(hy,y0+ph)+5;

  /* ---- vital numbers ---- */
  const stats=[['Armor Class',s.ac===''?'–':String(s.ac),s.acNote],['Initiative',sg(initB(s)),''],['Speed',s.speed||'–',''],['Prof. Bonus',sg(PB),''],
    ['Passive Perc.',String(passive(s)),''],['Hit Points',s.hp+' / '+s.hpMax,num(s.tmp)?'+'+num(s.tmp)+' temporär':''],['Hit Dice',Math.max(0,L-num(s.hdUsed))+' / '+L,'d'+s.hd]];
  const sw=(PCW-6*2.6)/7,sh=20;
  stats.forEach(([l,v,sub],i)=>{const x=PM+i*(sw+2.6);rr(x,y,sw,sh,i===5?'#EEF7F3':null);cap(l,x+sw/2,y+2.3,{align:'center'});
    const pt=fitPt(v,16,sw-3);font('head',pt,i===5?PDFC.mint:PDFC.ink);text(v,x+sw/2,y+7.2+(16-pt)*.18,{align:'center'});
    if(sub){font('normal',6.2,PDFC.soft);const ls=wrap(sub,sw-2.5).slice(0,2);text(ls,x+sw/2,y+14.6-(ls.length-1)*1.3,{align:'center'})}});
  y+=sh+3.4;

  /* ---- abilities and saving throws ---- */
  const aw=(PCW-5*2.6)/6,ah=23.5;
  AB.forEach((a,i)=>{const x=PM+i*(aw+2.6),prof=s.saves.includes(a);rr(x,y,aw,ah,prof?'#FBF3E4':null);cap(ABN[a],x+aw/2,y+2.3,{align:'center'});
    font('head',19);text(sg(mod(s.ab[a])),x+aw/2,y+6,{align:'center'});font('normal',8.5,PDFC.soft);text(String(s.ab[a]),x+aw/2,y+13.4,{align:'center'});
    const sv='Save '+sg(saveB(s,a));font(prof?'bold':'normal',7.4,prof?PDFC.amber:PDFC.soft);const w=doc.getTextWidth(pdfClean(sv)),sx=x+aw/2-(w+2.6)/2;mark(sx+.95,y+19.25,prof?1:0);font(prof?'bold':'normal',7.4,prof?PDFC.amber:PDFC.soft);text(sv,sx+2.6,y+17.9)});
  y+=ah+1.5;

  /* ---- skills ---- */
  sec('Skills',s.joat?'Jack of All Trades: halber Proficiency Bonus auf alle anderen':'',32);
  const cw=(PCW-2*7)/3,rh=5.15;
  SK.forEach(([n,a],i)=>{const col=Math.floor(i/6),row=i%6,x=PM+col*(cw+7),yy=y+row*rh,l=s.skills[n]||0;
    mark(x+1.2,yy+2,l);font(l?'medium':'normal',8.6);text(n,x+3.8,yy+.25);const nw=doc.getTextWidth(pdfClean(n));
    font('normal',6,PDFC.faint);text(ABS[a],x+3.8+nw+1.3,yy+1.15);font(l?'bold':'normal',8.6,l?PDFC.ink:PDFC.soft);text(sg(skillB(s,n,a)),x+cw,yy+.25,{align:'right'});
    doc.setDrawColor(PDFC.rule);doc.setLineWidth(.15);doc.line(x,yy+rh-.55,x+cw,yy+rh-.55)});
  y+=6*rh+1.5;

  /* ---- attacks ---- */
  if(s.atk.length){
    const cols=[['Angriff',46],['Treffer',15],['Schaden',30],['Art',23],['Notizen',PCW-114]];
    sec('Angriffe',s.cast.ab?'Spell Save DC '+spellDC(s)+' · Spell Attack '+sg(spellAtk(s)):'',14);
    let x=PM;cols.forEach(([l,w])=>{cap(l,x,y);x+=w});y+=4.2;
    s.atk.forEach(a=>{const hit=atkHit(s,a);font('normal',7.8);const nt=wrap(a.note||'',cols[4][1]-1);font('medium',9);const nm=wrap(a.n||'Angriff',cols[0][1]-2);
      font('normal',8.6);const dm=wrap(atkDmg(s,a)||'–',cols[2][1]-2);const h=Math.max(nm.length*lh(9),nt.length*lh(7.8),dm.length*lh(8.6))+2;need(h);
      let x=PM;font('medium',9);text(nm,x,y);x+=cols[0][1];font('bold',9,hit==null?PDFC.soft:PDFC.coral);text(hit==null?'–':sg(hit),x,y);x+=cols[1][1];
      font('normal',8.6);text(dm,x,y+.2);x+=cols[2][1];font('normal',8.2,PDFC.soft);text(a.ty||'',x,y+.3);x+=cols[3][1];font('normal',7.8,PDFC.soft);text(nt,x,y+.5);
      y+=h;doc.setDrawColor(PDFC.rule);doc.setLineWidth(.15);doc.line(PM,y-1,PM+PCW,y-1)});
    y+=1}

  /* ---- limited uses ---- */
  const lim=s.feats.filter(f=>num(f.max)>0);
  if(lim.length){sec('Begrenzte Fähigkeiten','abgehakt = verbraucht',8);
    lim.forEach(f=>{need(6.2);const n=num(f.max),u=clamp(num(f.used),0,n);font('medium',9);text(f.n,PM,y);
      const nw=Math.min(doc.getTextWidth(pdfClean(f.n)),110);font('normal',7.2,PDFC.soft);text(restDe(f.rest),PM+nw+3,y+.9);
      if(n<=20){for(let k=0;k<n;k++){const bx=PM+PCW-(n-k)*4.4+1;doc.setDrawColor(PDFC.amber);doc.setLineWidth(.3);if(k<u){doc.setFillColor(PDFC.amber);doc.rect(bx,y+.3,3.2,3.2,'FD')}else doc.rect(bx,y+.3,3.2,3.2,'S')}}
      else{font('bold',9,PDFC.amber);text((n-u)+' von '+n+' übrig',PM+PCW,y,{align:'right'})}
      y+=6})}

  /* ---- senses, languages, training ---- */
  const kv=[['Senses',s.senses],['Languages',s.langs],['Proficiencies',s.profs],['Conditions',(s.cond||[]).join(', ')],['Heroic Inspiration',s.insp?'Ja':''],
    ['Death Saves',(num(s.ds[0])||num(s.ds[1]))?num(s.ds[0])+' Erfolge, '+num(s.ds[1])+' Fehlschläge':'']].filter(x=>String(x[1]||'').trim());
  if(kv.length){sec('Sinne, Sprachen, Training','',8);kv.forEach(([k,v])=>{font('normal',8.6);const ls=wrap(v,PCW-36);const h=ls.length*lh(8.6)+1.4;need(h);
    cap(k,PM,y+.7);font('normal',8.6);text(ls,PM+36,y);y+=h})}

  /* ---- two-column flow for the long parts ---- */
  const W=(PCW-7)/2;
  const rows={
    head:(t,pt,col,f)=>{font(f||'medium',pt);return wrap(t,W).map((l,i,a)=>({h:lh(pt),keep:true,draw:(x,yy)=>{font(f||'medium',pt,col);text(l,x,yy)}}))},
    para:(t,pt,col,f)=>{font(f||'normal',pt);return wrap(t,W).map(l=>({h:lh(pt),draw:(x,yy)=>{font(f||'normal',pt,col);text(l,x,yy)}}))},
    gap:h=>[{h,gap:true,draw:()=>{}}],
    item:list=>{if(list.length<=10)list.slice(0,-1).forEach(r=>{r.keep=true});return list}}; // short entries are not split across columns
  const flow=list=>{let top=y,c=0,cy=y,maxY=y;
    const bal=from=>{let t=0;for(let k=from;k<list.length;k++)t+=list[k].h;return t<=2*(PBOT-top)-6?top+t/2:null};
    let target=bal(0);
    for(let i=0;i<list.length;i++){const r=list[i];if(r.gap&&cy===top)continue;
      let hh=r.h;for(let k=i;list[k]&&list[k].keep&&list[k+1];k++)hh+=list[k+1].h;
      const lim=c===0&&target!=null?target:PBOT;
      if(cy+hh>lim&&cy>top){if(c===0){c=1;cy=top}else{page();top=y;c=0;cy=top;maxY=top;target=bal(i)}if(r.gap)continue}
      r.draw(PM+c*(W+7),cy);cy+=r.h;maxY=Math.max(maxY,cy)}
    y=maxY+1};

  if(s.feats.length){sec('Features & Traits','',16);const R=[];
    s.feats.forEach(f=>{const meta=[f.src,num(f.max)?num(f.max)+'× pro '+restDe(f.rest||'long'):''].filter(Boolean).join(' · ');
      R.push(...rows.item([...rows.head(f.n||'Feature',9.4),...(meta?rows.head(meta,7,PDFC.amber,'medium'):[]),...rows.para(f.d||'',8.3,PDFC.ink)]),...rows.gap(2.4))});
    flow(R)}

  if(s.spells.length||(s.cast&&s.cast.type)){
    const ca=s.cast||{},slots=(ca.slots||[]).map(num),used=(ca.used||[]).map(num);
    sec('Spells',ca.ab?ABN[ca.ab]+' · Save DC '+spellDC(s)+' · Spell Attack '+sg(spellAtk(s)):'',16);
    const sl=slots.map((n,i)=>n?(i+1)+'. Grad: '+n+(used[i]?' ('+Math.min(used[i],n)+' verbraucht)':''):'').filter(Boolean);
    if(sl.length){font('normal',8.6);const ls=wrap((ca.type==='pact'?'Pact-Slots, zurück nach Short Rest. ':'Spell Slots: ')+sl.join('   ·   '),PCW);need(ls.length*lh(8.6)+2);text(ls,PM,y);y+=ls.length*lh(8.6)+2}
    const R=[];const by={};s.spells.forEach(x=>{const l=clamp(num(x.l),0,9);(by[l]=by[l]||[]).push(x)});
    Object.keys(by).map(Number).sort((a,b)=>a-b).forEach(l=>{R.push(...rows.head(l?l+'. Grad':'Cantrips',10.5,PDFC.violet,'head'),...rows.gap(.8));
      by[l].sort((a,b)=>String(a.n).localeCompare(String(b.n))).forEach(x=>{
        const meta=[x.t,x.r,x.c?'Concentration':'',x.rit?'Ritual':'',l&&x.prep===false?'nicht vorbereitet':''].filter(Boolean).join(' · ');
        R.push(...rows.item([...rows.head(x.n||'Spell',9.2,l&&x.prep===false?PDFC.soft:PDFC.ink),...(meta?rows.head(meta,7,PDFC.soft,'normal'):[]),...rows.para(x.d||'',8.2)]),...rows.gap(2.2))});
      R.push(...rows.gap(1.5))});
    flow(R)}

  const co=s.coins||{},coins=['cp','sp','gp','pp'].filter(k=>num(co[k])).map(k=>num(co[k])+' '+k.toUpperCase());
  if(s.items.length||coins.length){sec('Ausrüstung',coins.length?'Geld: '+coins.join(' · '):'',12);const R=[];
    s.items.forEach(i=>{R.push(...rows.item([...rows.head((num(i.q)>1?num(i.q)+'× ':'')+(i.n||'Gegenstand'),9),...(i.note?rows.para(i.note,8,PDFC.soft):[])]),...rows.gap(1.6))});
    flow(R)}

  const prof=[['Aussehen',s.look],['Personality Traits',s.traits],['Ideals',s.ideals],['Bonds',s.bonds],['Flaws',s.flaws],['Hintergrundgeschichte',s.story]].filter(x=>String(x[1]||'').trim());
  const facts=[s.size?'Größe: '+s.size:'',s.age?'Alter: '+s.age:'',s.align?'Alignment: '+s.align:''].filter(Boolean).join('   ·   ');
  if(prof.length||facts){sec('Persönlichkeit & Geschichte','',16);
    if(facts){font('normal',8.6,PDFC.soft);const ls=wrap(facts,PCW);text(ls,PM,y);y+=ls.length*lh(8.6)+2}
    const R=[];prof.forEach(([k,v])=>{R.push(...rows.head(k,9.4,PDFC.amber),...rows.para(v,8.6),...rows.gap(2.6))});flow(R)}
}

async function sheetsPdf(list,fname){
  const jsPDF=await pdfReady(),F=window.HM_PDF_FONTS;
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  [['Outfit-Regular','Outfit','normal'],['Outfit-Medium','Outfit','medium'],['Outfit-SemiBold','Outfit','bold'],['Marcellus-Regular','Marcellus','normal']].forEach(([f,n,st])=>{doc.addFileToVFS(f+'.ttf',F[f]);doc.addFont(f+'.ttf',n,st)});
  doc.setLineHeightFactor(LHF);
  const ranges=[];
  list.forEach((c,i)=>{if(i)doc.addPage();const pages=[doc.internal.getNumberOfPages()];pdfSheet(doc,c.s,c.uid,{player:c.player,pages});ranges.push({name:c.s.name||'Namenlos',pages})});
  const day=new Date().toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'});
  ranges.forEach(r=>r.pages.forEach((p,i)=>{doc.setPage(p);doc.setDrawColor(PDFC.rule);doc.setLineWidth(.2);doc.line(PM,A4H-11.5,PM+PCW,A4H-11.5);
    doc.setFont('Outfit','normal');doc.setFontSize(7);doc.setTextColor(PDFC.faint);
    doc.text(pdfClean('Tales of Nalvair · Kampagnenbuch · Stand '+day),PM,A4H-9.5,{baseline:'top'});
    doc.text(pdfClean(r.name),A4W/2,A4H-9.5,{baseline:'top',align:'center'});
    doc.text('Seite '+(i+1)+' von '+r.pages.length,PM+PCW,A4H-9.5,{baseline:'top',align:'right'})}));
  doc.setProperties({title:list.length===1?(list[0].s.name||'Charakter')+' – Charakterbogen':'Tales of Nalvair – Charakterbögen',subject:'Charakterbogen',creator:'Tales of Nalvair · Kampagnenbuch'});
  const blob=doc.output('blob'),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fname;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return blob}

function PdfBtn({list,file,label,cls}){
  const [busy,setBusy]=useState(false);
  const go=async()=>{const l=list().filter(x=>x&&x.s);if(!l.length)return;setBusy(true);
    try{await sheetsPdf(l,file?pdfFile(file)+'.pdf':pdfFile(l[0].s.name)+' - Charakterbogen.pdf')}
    catch(e){console.error(e);toast('Das PDF ließ sich nicht erstellen. Prüf die Verbindung und versuch es noch einmal.','err')}
    setBusy(false)};
  return html`<button type="button" class=${cls||'btn'} disabled=${busy} onClick=${go}><${Ic} n="down"/>${busy?'PDF entsteht …':(label||'PDF')}</button>`}

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
    <div class="fg" style="max-width:46rem"><${F} l="Titel"><${Late} id="cp-title" v=${c.title} ph="Öl für die Laterne" on=${v=>up({title:v})}/><//><${F} l="Unterzeile"><${Late} id="cp-sub" v=${c.sub} ph="Akt I · Hollowmere · Sitzung 2" on=${v=>up({sub:v})}/><//></div>
    <p class="sm soft" style="margin-top:.4rem">Beides steht groß oben auf der Gruppenseite, die Unterzeile klein darüber.</p>
    <h2 class="h2">Nachricht an alle</h2>
    <div class="rowf" style="max-width:46rem"><span class="grow"><${Late} id="cp-banner" v=${c.banner} ph="Roll initiative!" lbl="Nachricht an alle" on=${v=>up({banner:v})}/></span>${c.banner?html`<button class="btn quiet" onClick=${()=>up({banner:''})}>Leeren</button>`:null}</div>
    <p class="sm soft" style="margin-top:.4rem">Steht bei allen ganz oben und auf der Gruppenseite groß unter dem Titel, bis du sie leerst. Mit Enter abschicken.</p>
    <h2 class="h2">Nächste Session</h2>
    <div class="fg" style="max-width:46rem"><${F} l="Datum und Uhrzeit"><input class="in" id="cp-next" type="datetime-local" value=${toLocal(c.next)} onChange=${e=>{const t=e.target.value?new Date(e.target.value).getTime():0;up({next:isFinite(t)?t:0})}}/><//>
      <${F} l="Notiz dazu"><${Late} id="cp-nextnote" v=${c.nextNote} ph="Wir treffen uns im Voice-Channel" on=${v=>up({nextNote:v})}/><//></div>`}
/* characters prepared outside the app (a file with finished sheets and pictures) go to the players here */
function GmImport(){
  const [list,setList]=useState(null),[to,setTo]=useState({}),[busy,setBusy]=useState(''),[done,setDone]=useState({});
  const people=Array.from(new Set(Object.keys(People.map).concat(Object.keys(S.chars),Object.keys(S.sheets))));
  const who=u=>String((People.map[u]||{}).name||'').trim()||nameOf(u);
  const read=async f=>{try{const j=JSON.parse(await f.text()),arr=Array.isArray(j)?j:j.chars;
      if(!Array.isArray(arr)||!arr.length)throw new Error('leer');
      const ok=arr.filter(c=>c&&c.sheet&&typeof c.sheet==='object').map((c,i)=>({i,sheet:normSheet(c.sheet),portrait:typeof c.portrait==='string'&&/^data:image\//.test(c.portrait)?c.portrait:'',hint:String(c.player||'')}));
      if(!ok.length)throw new Error('leer');
      const guess={};ok.forEach(c=>{const h=c.hint.toLowerCase();const u=h&&people.find(p=>who(p).toLowerCase()===h||who(p).toLowerCase().split(' ')[0]===h.split(' ')[0]);if(u)guess[c.i]=u});
      setList(ok);setTo(guess);setDone({})}
    catch(e){toast('Diese Datei enthält keine Charaktere, die ich lesen kann.','err')}};
  const give=async c=>{const u=to[c.i];if(!u)return;setBusy(String(c.i));
    try{await gmAssign(u,c.sheet,c.portrait);setDone(Object.assign({},done,{[c.i]:u}));toast((c.sheet.name||'Der Charakter')+' gehört jetzt '+who(u)+'.')}
    catch(e){oops('Das Zuweisen')(e)}setBusy('')};
  return html`<div class="box plain" style="margin:0 0 1.4rem;max-width:60rem"><h2 class="h2" style="margin-top:0">Fertige Charaktere übernehmen</h2>
    <p class="sm" style="max-width:66ch">Lade die Charakter-Datei, die Claude für dich gebaut hat. Dann wählst du für jeden Charakter, wem er gehört. Er liegt sofort im Bogen des Spielers, mit Bild in der Gruppenansicht. Wer nicht in der Liste steht, muss sich zuerst einmal in der App anmelden.</p>
    <${FileBtn} label=${list?'Andere Datei wählen':'Charakter-Datei wählen'} icon="sheet" accept=".json,application/json" onFile=${read}/>
    ${list?html`<div class="stack" style="margin-top:1rem">${list.map(c=>{const u=to[c.i],has=u&&S.sheets[u]&&done[c.i]!==u;
      return html`<div class="imp-row" key=${c.i}>
        <div class=${'port sm'+(c.portrait?'':' none')}>${c.portrait?html`<img src=${c.portrait} alt=""/>`:html`<span aria-hidden="true">${initials(c.sheet.name)}</span>`}</div>
        <div class="grow"><b>${c.sheet.name||'Namenlos'}</b><div class="sm soft">${clsLine(c.sheet)}${c.hint?' · für '+c.hint:''}</div>
          ${done[c.i]?html`<div class="sm ok">Liegt bei ${who(done[c.i])}.</div>`:null}</div>
        <select class="in" style="width:auto;min-width:11rem" aria-label=${'Spieler für '+(c.sheet.name||'den Charakter')} value=${u||''} onChange=${e=>setTo(Object.assign({},to,{[c.i]:e.target.value}))}>
          <option value="">Spieler wählen</option>${people.map(p=>html`<option key=${p} value=${p}>${who(p)}${S.sheets[p]?' (hat schon '+(S.sheets[p].name||'einen Charakter')+')':''}</option>`)}</select>
        ${has?html`<${Confirm} label="Zuweisen" cls="btn s solid" ask=${'Ersetzt '+(S.sheets[u].name||'den Bogen')+'.'} yes="Ersetzen" onYes=${()=>give(c)}/>`
          :html`<button class="btn s solid" disabled=${!u||busy===String(c.i)} onClick=${()=>give(c)}>${busy===String(c.i)?'Speichert …':u&&done[c.i]===u?'Nochmal':'Zuweisen'}</button>`}</div>`})}</div>`:null}
  </div>`}
function GmPlayers(){
  const ids=Array.from(new Set(Object.keys(S.chars).concat(Object.keys(S.sheets)))),cur=S.ui.gmSheet&&S.sheets[S.ui.gmSheet]?S.ui.gmSheet:'';
  const kick=async u=>{try{await S.db.doc('sheets/'+u).delete();await S.db.doc('chars/'+u+'/media/portrait').delete();await S.db.doc('chars/'+u).delete();if(S.ui.gmSheet===u)ui({gmSheet:''})}catch(e){oops('Das Entfernen')(e)}};
  if(cur){const s=normSheet(clone(S.sheets[cur]));return html`<button class="btn quiet" onClick=${()=>ui({gmSheet:''})}><${Ic} n="back"/>Alle Spieler</button>
    <p class="sm soft" style="margin:.8rem 0">Bogen von ${pdfWho(cur)||nameOf(cur)}. Ein Bild kannst du einsetzen, zum Beispiel als Platzhalter. Die Werte ändert der Spieler selbst.</p><${Sheet} key=${cur} s=${s} uid=${cur} ro=${true} gm=${true} set=${()=>{}}/>`}
  const withSheet=ids.filter(u=>S.sheets[u]);
  return html`<p class="lead">Alle, die das Kampagnenbuch geöffnet haben, mit den Werten, die du am häufigsten brauchst.</p><${GmImport}/>
    ${withSheet.length?html`<div class="rowf" style="margin-bottom:.8rem"><${PdfBtn} label=${withSheet.length>1?'Alle '+withSheet.length+' Bögen als PDF':'Bogen als PDF'} file="Tales of Nalvair - alle Charaktere" list=${()=>withSheet.filter(u=>S.sheets[u]).map(u=>({s:S.sheets[u],uid:u,player:pdfWho(u)}))}/><span class="sm soft">Ein Bogen pro Charakter, alle in einer Datei.</span></div>`:null}
    ${!ids.length?html`<p class="empty">Noch war niemand da. Schick deinen Spielern die Adresse der App (unter Session).</p>`:html`<div class="scrollx"><table class="roster">
      <thead><tr><th>Spieler</th><th>Charakter</th><th>AC</th><th>HP</th><th>Passive Perc.</th><th>Init</th><th></th></tr></thead>
      <tbody>${ids.map(u=>{const raw=S.sheets[u],s=raw?normSheet(clone(raw)):null,c=S.chars[u]||{};return html`<tr key=${u}><td><${Who} uid=${u}/></td>
        <td>${s?html`<b>${s.name||'Namenlos'}</b><br/><span class="sm soft">${clsLine(s)}</span>`:html`<span class="soft">noch keiner</span>`}</td>
        <td>${s?s.ac:''}</td><td>${s?s.hp+' / '+s.hpMax+(num(s.tmp)?' +'+s.tmp:''):''}</td><td>${s?passive(s):''}</td><td>${s?sg(initB(s)):''}</td>
        <td><span class="rowf">${s?html`<button class="btn s" onClick=${()=>{ui({gmSheet:u});window.scrollTo(0,0)}}>Bogen</button><${PdfBtn} cls="btn s" list=${()=>[{s:S.sheets[u],uid:u,player:pdfWho(u)}]}/>`:null}<${FileBtn} cls="btn s" label="Bild" icon="cam" onFile=${f=>gmSetPortrait(u,f)}/>${u!==S.uid&&(s||c.joined)?html`<${Confirm} label="Entfernen" ask=${s?'Charakter und Bogen löschen?':'Aus der Liste nehmen?'} yes="Entfernen" onYes=${()=>kick(u)}/>`:null}</span></td></tr>`})}</tbody></table></div>`}`}
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
    <div><span class="lbl">Darstellung</span><div class="seg" role="group" aria-label="Darstellung">${[['dark','Dunkel'],['light','Hell'],['auto','Wie das Gerät']].map(([k,n])=>html`<button key=${k} type="button" aria-pressed=${themePref()===k} onClick=${()=>setTheme(k)}>${n}</button>`)}</div></div>
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
  return html`<main class="wrap"><div class="login"><${Orn}/>
    <${TitleCard}/>
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
  return html`<main class="wrap"><form class="login" onSubmit=${async e=>{e.preventDefault();if(!n.trim())return;setBusy(true);try{await setMyName(n)}catch(x){oops('Das Speichern')(x)}setBusy(false)}}><${Orn}/>
    <${TitleCard}/>
    <p class="lead" style="margin:0">Wie sollen dich die anderen in der Gruppe sehen?</p>
    <div class="box"><label class="fl"><span>Dein Name</span><input class="in" id="ask-name" value=${n} onInput=${e=>setN(e.target.value)} maxlength="60"/></label>
      <button class="btn solid gbtn" type="submit" disabled=${busy||!n.trim()}>Weiter</button></div></form></main>`}

/* ================= root ================= */
function Problem(){
  const t={lib:'Die App konnte ihre Bausteine nicht laden. Prüf deine Verbindung und lade die Seite neu.',config:'Die App ist noch nicht mit Firebase verbunden: In config.js fehlt die Konfiguration des Firebase-Projekts.',rules:'Die Datenbank lässt dich nicht hinein. Wahrscheinlich sind die Sicherheitsregeln in Firebase noch nicht eingetragen (Firestore Database → Regeln).',load:'Deine Daten konnten gerade nicht geladen werden. Prüf deine Verbindung und lade die Seite neu.'}[S.err]||'Etwas ist schiefgegangen. Lade die Seite neu.';
  return html`<main class="wrap"><div class="boot"><h1 class="h1">Tales of Nalvair</h1><p class="lead">${t}</p>${S.uid?html`<button class="btn" onClick=${signOut}>Abmelden</button>`:null}</div></main>`}
function App(){
  const [,f]=useReducer(x=>x+1,0);
  subs.add(f); // the root listens from its very first render, so an early state change is never missed
  if(S.phase==='boot')return html`<main class="wrap"><div class="boot"><h1 class="h1">Tales of Nalvair</h1><p class="lead">Die Laternen werden angezündet …</p></div></main>`;
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
