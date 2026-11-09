(function(){
"use strict";
var KEY="vault:v1",ITER=600000,IDLE=5*60*1000;
var PAL=[["#8b5cf6","#ec4899"],["#06b6d4","#3b82f6"],["#f59e0b","#ef4444"],["#10b981","#22d3ee"],["#ec4899","#f59e0b"],["#6366f1","#a855f7"]];
var ICONS=["🔐","💳","🏦","📧","🎮","🛒","💼","🎓","🌐","📱","✈️","❤️"];
function secStyle(s){var p=PAL[s.ci];return p?"--c1:"+p[0]+";--c2:"+p[1]:""}
var TK="vault:theme",root=document.documentElement,tb=document.getElementById("themeBtn");
function effTheme(){return root.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}
function paintBtn(){tb.textContent=effTheme()==="dark"?"☀":"☾"}
try{var st=localStorage.getItem(TK);if(st)root.setAttribute("data-theme",st)}catch(e){}
paintBtn();
tb.onclick=function(){var n=effTheme()==="dark"?"light":"dark";root.setAttribute("data-theme",n);try{localStorage.setItem(TK,n)}catch(e){}paintBtn()};
var enc=new TextEncoder(),dec=new TextDecoder();
var app=document.getElementById("app"),stat=document.getElementById("stat"),dlg=document.getElementById("dlg");
var cryptoKey=null,salt=null,data=null,query="",revealed={},idleT=null,clipT=null;

function b64(buf){var a=new Uint8Array(buf),s="";for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}
function unb64(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function uid(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),function(x){return x.toString(16).padStart(2,"0")}).join("")}
function el(tag,props,kids){var e=document.createElement(tag);for(var k in (props||{})){if(k==="class")e.className=props[k];else if(k.slice(0,2)==="on")e.addEventListener(k.slice(2),props[k]);else e.setAttribute(k,props[k])}
 (kids||[]).forEach(function(c){e.append(c)});return e}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);return true}catch(e){return null}}

async function derive(pw,s){var base=await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt:s,iterations:ITER,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function seal(key,obj){var iv=crypto.getRandomValues(new Uint8Array(12));
 var ct=await crypto.subtle.encrypt({name:"AES-GCM",iv:iv},key,enc.encode(JSON.stringify(obj)));return{iv:b64(iv),ct:b64(ct)}}
async function open(key,blob){var pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(blob.iv)},key,unb64(blob.ct));return JSON.parse(dec.decode(pt))}
async function save(){var s=await seal(cryptoKey,data);
 if(!store(KEY,JSON.stringify({v:1,salt:b64(salt),iv:s.iv,ct:s.ct})))alert("Couldn’t save. Browser storage is blocked or full.")}

function resetIdle(){clearTimeout(idleT);if(cryptoKey)idleT=setTimeout(lock,IDLE)}
["click","keydown","mousemove","touchstart"].forEach(function(ev){document.addEventListener(ev,resetIdle,{passive:true})});
function lock(){cryptoKey=null;data=null;revealed={};query="";if(dlg.open)dlg.close();render()}

function strongEnough(p){return p.length>=12}

function viewLock(){
 var has=!!store(KEY);stat.textContent="locked";
 var pw=el("input",{type:"password",autocomplete:has?"current-password":"new-password",placeholder:"Master password"});
 var pw2=el("input",{type:"password",autocomplete:"new-password",placeholder:"Repeat master password"});
 var msg=el("div",{class:"msg",role:"alert"});
 var btn=el("button",{class:"pri"},[has?"Unlock":"Create vault"]);
 async function go(){msg.textContent="";msg.className="msg";btn.disabled=true;btn.textContent="Working…";
  try{
   if(has){var blob=JSON.parse(store(KEY));var s=unb64(blob.salt);var k=await derive(pw.value,s);
    try{data=await open(k,blob)}catch(e){throw new Error("Wrong master password.")}
    salt=s;cryptoKey=k}
   else{
    if(!strongEnough(pw.value))throw new Error("Use at least 12 characters. A short phrase of 4+ random words works well.");
    if(pw.value!==pw2.value)throw new Error("The two passwords don’t match.");
    salt=crypto.getRandomValues(new Uint8Array(16));cryptoKey=await derive(pw.value,salt);
    data={sections:[{id:uid(),name:"Personal",items:[]}]};await save()}
   pw.value="";pw2.value="";resetIdle();document.body.classList.add("enter");setTimeout(function(){document.body.classList.remove("enter")},1000);render();
  }catch(e){msg.textContent=e.message;btn.disabled=false;btn.textContent=has?"Unlock":"Create vault"}}
 btn.onclick=go;
 [pw,pw2].forEach(function(i){i.addEventListener("keydown",function(e){if(e.key==="Enter")go()})});
 var box=el("div",{class:"lock"},[
  el("h1",{style:"font-size:26px"},[has?"Unlock your vault":"Create your vault"]),
  el("p",{class:"lead"},[has?"Everything is encrypted with your master password. Nothing leaves this browser.":"Pick a master password. It encrypts everything with AES-256 and is never stored. If you forget it, the data can’t be recovered."]),
  el("label",{},["Master password"]),pw]);
 if(!has){box.append(el("label",{},["Confirm"]),pw2)}
 var sh=el("label",{class:"chk"},[el("input",{type:"checkbox",onchange:function(e){var t=e.target.checked?"text":"password";pw.type=t;pw2.type=t}}),"Show password"]);
 box.append(sh,msg,btn);
 if(has)box.append(el("div",{class:"stat",style:"margin-top:18px"},[el("a",{href:"#",style:"color:inherit",onclick:function(e){e.preventDefault();viewImport(true)}},["Restore from an encrypted backup"])]));
 return box}

function copy(text,btn){
 var done=function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1200);
  clearTimeout(clipT);clipT=setTimeout(function(){try{navigator.clipboard.writeText("")}catch(e){}},20000)};
 try{navigator.clipboard.writeText(text).then(done,function(){btn.textContent="Blocked"})}catch(e){btn.textContent="Blocked"}}

function genPw(){var cs="abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+",n=20,out="",r=crypto.getRandomValues(new Uint32Array(n));
 for(var i=0;i<n;i++)out+=cs[r[i]%cs.length];return out}

function itemView(sec,it){
 var shown=!!revealed[it.id];
 var code=el("code",{},[shown?it.pass:"•".repeat(Math.min(it.pass.length||8,16))]);
 var title=it.url?el("a",{href:/^https?:\/\//i.test(it.url)?it.url:"https://"+it.url,target:"_blank",rel:"noopener noreferrer"},[it.name]):document.createTextNode(it.name);
 var row=el("div",{class:"it"},[
  el("div",{class:"t"},[el("span",{},[title]),el("button",{class:"x","aria-label":"Delete "+it.name,onclick:async function(){if(confirm("Delete “"+it.name+"”?")){sec.items=sec.items.filter(function(x){return x.id!==it.id});await save();render()}}},["✕"])])]);
 if(it.user){var u=el("div",{class:"u"},[it.user]);row.append(u)}
 var b1=el("button",{onclick:function(){revealed[it.id]=!revealed[it.id];render()}},[shown?"Hide":"Show"]);
 var b2=el("button",{onclick:function(e){copy(it.pass,e.target)}},["Copy password"]);
 var pwRow=el("div",{class:"pw"},[code,b1,b2]);
 if(it.user)pwRow.append(el("button",{onclick:function(e){copy(it.user,e.target)}},["Copy user"]));
 row.append(pwRow);return row}

function secView(sec){
 var q=query.toLowerCase();
 var items=sec.items.filter(function(i){return !q||(i.name+" "+i.user+" "+i.url).toLowerCase().indexOf(q)>-1});
 if(q&&!items.length)return null;
 var nm=el("input",{placeholder:"Name",maxlength:80,"aria-label":"Name"}),us=el("input",{placeholder:"Username / email",autocomplete:"off","aria-label":"Username"}),
  ur=el("input",{placeholder:"Website (optional)",autocomplete:"off","aria-label":"Website"}),
  pw=el("input",{placeholder:"Password",type:"text",autocomplete:"off","aria-label":"Password"});
 var gen=el("button",{type:"button",title:"Generate a strong password",onclick:function(){pw.value=genPw()}},["Generate"]);
 var add=el("button",{class:"pri",onclick:async function(){if(!nm.value.trim()||!pw.value)return;
  sec.items.push({id:uid(),name:nm.value.trim(),user:us.value.trim(),url:ur.value.trim(),pass:pw.value});await save();render()}},["+ Add"]);
 var body=el("div",{},items.length?items.map(function(i){return itemView(sec,i)}):[el("div",{class:"empty"},["No entries yet. Add one below."])]);
 return el("section",{class:"sec",style:secStyle(sec)},[
  el("div",{class:"sh"},[el("span",{},[(sec.icon||"🔐")+" "+sec.name,el("span",{class:"n"},[String(sec.items.length)])]),el("button",{class:"x","aria-label":"Edit section "+sec.name,onclick:function(){sectionDlg(sec)}},["✎"]),
   el("button",{class:"x","aria-label":"Delete section "+sec.name,onclick:async function(){if(confirm("Delete section “"+sec.name+"” and all "+sec.items.length+" entries?")){data.sections=data.sections.filter(function(s){return s.id!==sec.id});await save();render()}}},["✕"])]),
  body,el("div",{class:"add"},[nm,us,ur,pw,gen,add])])}

function viewMain(){
 var total=data.sections.reduce(function(n,s){return n+s.items.length},0);
 stat.textContent=data.sections.length+" sections · "+total+" entries";
 var search=el("input",{type:"search",placeholder:"Search entries…","aria-label":"Search",value:query});
 search.addEventListener("input",function(){query=search.value;var pos=search.selectionStart;render();var s=document.querySelector("input[type=search]");if(s){s.focus();s.setSelectionRange(pos,pos)}});
 var wrap=el("div",{},[
  el("h1",{},["Every password,"," ",el("i",{},["locked and in one place."])]),
  el("p",{class:"lead"},["Encrypted with AES-256 before it touches storage. Locks itself after 5 minutes idle. Passwords are cleared from your clipboard after 20 seconds."]),
  el("div",{class:"bar"},[
   el("button",{class:"pri",onclick:addSection},["+ New section"]),search,
   el("button",{onclick:viewExport},["Export backup"]),el("button",{onclick:function(){viewImport(false)}},["Import backup"]),
   el("button",{onclick:function(){var on=!data.sections.every(function(s){return s.items.every(function(i){return revealed[i.id]})});data.sections.forEach(function(s){s.items.forEach(function(i){revealed[i.id]=on})});render()}},["Show / hide all"]),el("button",{onclick:viewChange},["Change master"]),el("button",{onclick:lock},["Lock now"])])]);
 var grid=el("div",{class:"grid"});
 data.sections.forEach(function(s){var v=secView(s);if(v)grid.append(v)});
 if(!query)grid.append(el("button",{class:"newsec",onclick:addSection},["+ Add section"]));
 wrap.append(grid);return wrap}

function addSection(){sectionDlg(null)}
function sectionDlg(sec){
 var nm=el("input",{placeholder:"Section name (e.g. Banking)",maxlength:40,value:sec?sec.name:""});
 var icon=(sec&&sec.icon)||"🔐",ci=sec&&sec.ci!=null?sec.ci:null;
 var ib=el("div",{class:"chips"}),cb=el("div",{class:"chips"});
 function paint(){ib.textContent="";ICONS.forEach(function(ic){ib.append(el("button",{type:"button",class:"chip"+(ic===icon?" on":""),"aria-pressed":String(ic===icon),onclick:function(){icon=ic;paint()}},[ic]))});
  cb.textContent="";PAL.forEach(function(p,i){cb.append(el("button",{type:"button","aria-label":"Colour "+(i+1),class:"sw"+(ci===i?" on":""),style:"background:linear-gradient(135deg,"+p[0]+","+p[1]+")",onclick:function(){ci=i;paint()}}))})}
 paint();
 openDlg(sec?"Edit section":"New section",[nm,el("p",{class:"stat"},["Icon"]),ib,el("p",{class:"stat"},["Colour"]),cb],sec?"Save":"Create",async function(){
  if(!nm.value.trim())return"Enter a name.";
  if(sec){sec.name=nm.value.trim();sec.icon=icon;sec.ci=ci}else data.sections.push({id:uid(),name:nm.value.trim(),icon:icon,ci:ci,items:[]});
  await save();render()});
 nm.focus()}

function viewExport(){
 var blob=JSON.stringify({v:1,salt:b64(salt),iv:"",ct:""});
 seal(cryptoKey,data).then(function(s){
  var out=JSON.stringify({v:1,salt:b64(salt),iv:s.iv,ct:s.ct});
  var ta=el("textarea",{readonly:"readonly","aria-label":"Encrypted backup"});ta.value=out;
  var note=el("p",{class:"stat"},["This text is encrypted. Save it in a note or file. You need your current master password to restore it."]);
  openDlg("Encrypted backup",[note,ta],"Copy",function(){ta.select();try{navigator.clipboard.writeText(out)}catch(e){}return"Copied. If it didn’t copy, select the text and copy manually."},true)})}

function viewImport(fromLock){
 var ta=el("textarea",{placeholder:"Paste your encrypted backup here","aria-label":"Backup text"});
 var pw=el("input",{type:"password",placeholder:"Master password of that backup"});
 openDlg("Import backup",[el("p",{class:"stat"},[fromLock?"This replaces everything stored in this browser.":"This replaces your current vault with the backup."]),ta,pw],"Import",async function(){
  try{var b=JSON.parse(ta.value.trim());var s=unb64(b.salt);var k=await derive(pw.value,s);var d=await open(k,b)}catch(e){return"Couldn’t decrypt. Check the text and password."}
  if(!confirm("Replace the current vault with this backup?"))return"";
  salt=s;cryptoKey=k;data=d;await save();resetIdle();render()})}

function viewChange(){
 var a=el("input",{type:"password",placeholder:"New master password (12+ characters)",autocomplete:"new-password"});
 var b=el("input",{type:"password",placeholder:"Repeat new master password",autocomplete:"new-password"});
 openDlg("Change master password",[a,b],"Change",async function(){
  if(!strongEnough(a.value))return"Use at least 12 characters.";if(a.value!==b.value)return"The two passwords don’t match.";
  salt=crypto.getRandomValues(new Uint8Array(16));cryptoKey=await derive(a.value,salt);await save()});}

function openDlg(title,kids,okLabel,onOk,keepOpen){
 dlg.textContent="";var msg=el("div",{class:"msg",role:"alert"});
 var ok=el("button",{class:"pri"},[okLabel]),cancel=el("button",{onclick:function(){dlg.close()}},["Close"]);
 ok.onclick=async function(){ok.disabled=true;var r;try{r=await onOk()}catch(e){r="Something went wrong."}ok.disabled=false;
  if(r){msg.textContent=r;msg.className=keepOpen?"msg ok":"msg"}else if(!keepOpen&&dlg.open)dlg.close()};
 dlg.append(el("h2",{style:"margin:0 0 10px;font-size:18px"},[title]));kids.forEach(function(k){dlg.append(k)});
 dlg.append(msg,el("div",{class:"row"},[cancel,ok]));
 if(!dlg.open)dlg.showModal()}

function render(){app.textContent="";
 if(!cryptoKey){app.append(viewLock())}else{app.append(viewMain())}}

if(!window.crypto||!crypto.subtle){app.textContent="This page needs a secure (https) browser context with Web Crypto support."}
else render();
})();
