(() => {
'use strict';
const DEM_Z = 11;
const tileCache = new Map();
let coverageLayer = null;
let lastHeading = null;
let lastSelectedId = null;

const css = document.createElement('style');
css.textContent = `
#btsTerrainFab{position:fixed;right:14px;bottom:150px;z-index:1500;border:0;border-radius:18px;padding:12px 14px;background:#0f766e;color:white;font-weight:800;box-shadow:0 8px 28px #0005;display:none}
#btsAimChip{position:fixed;left:50%;transform:translateX(-50%);top:max(10px,env(safe-area-inset-top));z-index:1499;background:#07131fef;color:#fff;border:1px solid #2dd4bf;border-radius:14px;padding:8px 12px;max-width:86vw;font:700 12px system-ui;box-shadow:0 6px 22px #0005;display:none;text-align:center}
#btsTerrainModal{position:fixed;inset:0;z-index:2200;background:#07131ff5;color:#eef6fb;display:none;overflow:auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:env(safe-area-inset-top) 12px 24px}
#btsTerrainModal .bar{position:sticky;top:0;background:#07131ff2;padding:12px 2px;display:flex;gap:8px;align-items:center;z-index:2}
#btsTerrainModal .bar strong{flex:1;font-size:18px} #btsTerrainModal button{border:0;border-radius:12px;padding:11px 13px;font-weight:750}
#btsTerrainModal .primary{background:#2dd4bf;color:#04221e}.secondary{background:#173248;color:#fff}.danger{background:#51212a;color:#fff}
#btsTerrainModal .card{background:#0d1d2b;border:1px solid #27445b;border-radius:16px;padding:12px;margin:10px 0}
#btsTerrainModal .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.field{display:flex;flex-direction:column;gap:5px}.field label{font-size:11px;color:#9db0bf}.field input,.field select{width:100%;background:#081824;color:#fff;border:1px solid #31516a;border-radius:10px;padding:9px}
#btsTerrainModal .big{font-size:21px;font-weight:900;color:#2dd4bf}.muted{color:#9db0bf;font-size:12px;line-height:1.45}.warn{color:#fbbf24}.bad{color:#fb7185}.good{color:#5eead4}
#btsTerrainModal svg{width:100%;height:auto;background:#081824;border-radius:12px;border:1px solid #20384a}
#btsTerrainModal .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
@media(max-width:520px){#btsTerrainModal .grid{grid-template-columns:1fr 1fr}#btsTerrainFab{bottom:126px}}
`;
document.head.appendChild(css);

const fab = document.createElement('button');
fab.id='btsTerrainFab'; fab.textContent='⛰️ Teren / zasięg'; document.body.appendChild(fab);
const aim = document.createElement('div'); aim.id='btsAimChip'; document.body.appendChild(aim);
const modal = document.createElement('div'); modal.id='btsTerrainModal'; modal.innerHTML=`
 <div class="bar"><strong>📡 BTS Asystent • teren i zasięg</strong><button id="btsClose" class="secondary">✕</button></div>
 <div class="card"><div id="btsStationTitle" class="big">Wybierz BTS</div><div id="btsStationMeta" class="muted"></div></div>
 <div class="card"><strong>Model radiowy</strong><div class="grid" style="margin-top:10px">
   <div class="field"><label>Pasmo / częstotliwość</label><select id="btsFreq"></select></div>
   <div class="field"><label>EIRP modelowe [dBm]</label><input id="btsEirp" type="number" min="30" max="75" step="1"></div>
   <div class="field"><label>Wysokość anteny BTS [m]</label><input id="btsTxH" type="number" min="5" max="150" step="1" value="30"></div>
   <div class="field"><label>Wysokość odbiornika [m]</label><input id="btsRxH" type="number" min="1" max="30" step="0.5" value="3"></div>
   <div class="field"><label>Otoczenie</label><select id="btsClutter"><option value="10">teren otwarty</option><option value="18" selected>podmiejski</option><option value="26">miejski / zabudowa</option></select></div>
   <div class="field"><label>Próg modelu [dBm]</label><input id="btsThreshold" type="number" min="-125" max="-75" value="-105"></div>
 </div><div id="btsPowerNote" class="muted" style="margin-top:8px"></div>
 <div class="actions"><button id="btsProfileBtn" class="primary">Profil BTS ↔ ja</button><button id="btsCoverageBtn" class="primary">Oblicz zasięg terenowy</button><button id="btsClearCoverage" class="secondary">Wyczyść zasięg</button></div></div>
 <div id="btsResult" class="card"><strong>Wynik</strong><div class="muted">Wybierz obliczenie. Model jest orientacyjny, nie jest oficjalną mapą operatora.</div></div>
 <div id="btsProfile" class="card" style="display:none"></div>
 <div class="card muted"><strong>Jak liczę</strong><br>Poziom modelowy = EIRP − strata wolnej przestrzeni − dodatkowa strata terenu − strata otoczenia. Teren jest pobierany z kafli DEM Terrarium. Sprawdzam krzywiznę Ziemi, 60% pierwszej strefy Fresnela i stratę dyfrakcyjną typu knife-edge. Gdy baza ma prawdziwy azymut, moc albo wysokość anteny, aplikacja używa tych danych; w przeciwnym razie pokazuje wyraźnie, że wartość jest szacowana.</div>`;
document.body.appendChild(modal);

const $=id=>document.getElementById(id);
$('btsClose').onclick=()=>modal.style.display='none';
fab.onclick=()=>openTerrain();
$('btsClearCoverage').onclick=()=>{ if(coverageLayer){coverageLayer.clearLayers();} setResult('Zasięg usunięty z mapy.'); };
$('btsProfileBtn').onclick=()=>runProfile().catch(e=>setResult('Błąd profilu: '+e.message,true));
$('btsCoverageBtn').onclick=()=>runCoverage().catch(e=>setResult('Błąd zasięgu: '+e.message,true));

function selected(){ try{return state && state.selected ? state.selected : null}catch{return null} }
function origin(){
 try{
  if(state?.userLocation && Number.isFinite(state.userLocation.lat)) return {lat:state.userLocation.lat,lng:state.userLocation.lng,source:'GPS'};
  if(state?.measure && Number.isFinite(state.measure.lat)) return {lat:state.measure.lat,lng:state.measure.lng,source:state.measureSource==='manual'?'punkt ręczny':'GPS'};
  if(typeof getOrigin==='function'){const o=getOrigin();return {lat:o.lat,lng:o.lng,source:'środek mapy'};}
 }catch{}
 return null;
}
function rad(v){return v*Math.PI/180} function deg(v){return v*180/Math.PI}
function hav(a,b){const R=6371.0088,dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng);const s=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(s))}
function bear(a,b){const y=Math.sin(rad(b.lng-a.lng))*Math.cos(rad(b.lat)),x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lng-a.lng));return (deg(Math.atan2(y,x))+360)%360}
function dest(lat,lon,bearing,km){const R=6371.0088,ad=km/R,br=rad(bearing),la1=rad(lat),lo1=rad(lon);const la2=Math.asin(Math.sin(la1)*Math.cos(ad)+Math.cos(la1)*Math.sin(ad)*Math.cos(br));const lo2=lo1+Math.atan2(Math.sin(br)*Math.sin(ad)*Math.cos(la1),Math.cos(ad)-Math.sin(la1)*Math.sin(la2));return {lat:deg(la2),lng:((deg(lo2)+540)%360)-180};}
function norm(v){return ((v+540)%360)-180}
function freqFromBand(b){const m=String(b||'').match(/(\d{3,4})/); if(!m)return null; let n=+m[1]; if(n<100)return null; return n;}
function stationFreqs(s){const f=(s?.bands||[]).map(freqFromBand).filter(Number.isFinite); return [...new Set(f)].sort((a,b)=>a-b);}
function defaultEirp(freq){return freq<=900?60:freq<=2100?58:freq<=2700?56:53;}
function bestPower(s){try{ if(typeof getBestPowerInfo==='function'){const i=getBestPowerInfo(s); if(i&&Number.isFinite(i.watts)&&i.watts>0)return {dbm:10*Math.log10(i.watts*1000),text:`Dane z bazy: ${i.watts.toFixed(i.watts<100?1:0)} W EIRP/ERP (${i.source||'źródło techniczne'}).`};}}catch{}; const keys=['eirp_dbm','erp_dbm','power_dbm']; for(const k of keys){if(Number.isFinite(+s?.[k]))return {dbm:+s[k],text:`Dane z bazy: ${k} = ${s[k]} dBm.`};} const w=+(s?.eirp_w??s?.erp_w??s?.power_w); if(Number.isFinite(w)&&w>0)return {dbm:10*Math.log10(w*1000),text:`Dane z bazy: ${w} W.`}; return null;}
function txHeight(s){for(const k of ['antenna_height_m','height_m','antennaHeight','height']){const v=+s?.[k];if(Number.isFinite(v)&&v>=5&&v<=200)return v;}return 30;}

function openTerrain(){const s=selected(); if(!s){alert('Najpierw wybierz BTS na mapie.');return;} modal.style.display='block'; $('btsStationTitle').textContent=`${s.operator||'Operator'} • ${s.station_id||s.id||'BTS'}`; $('btsStationMeta').textContent=`${s.city||''}${s.address?' • '+s.address:''}`;
 const freqs=stationFreqs(s); const list=freqs.length?freqs:[800,1800,2100,2600,3600]; $('btsFreq').innerHTML=list.map(f=>`<option value="${f}">${f} MHz</option>`).join(''); const f=list[0]; const p=bestPower(s); $('btsEirp').value=Math.round(p?p.dbm:defaultEirp(f)); $('btsTxH').value=Math.round(txHeight(s)); $('btsPowerNote').textContent=p?p.text:'Brak pewnej mocy w bazie. EIRP jest wartością modelową i można ją zmienić.'; $('btsFreq').onchange=()=>{if(!bestPower(s))$('btsEirp').value=defaultEirp(+$('btsFreq').value)}; }
function setResult(text,bad=false){$('btsResult').innerHTML=`<strong>Wynik</strong><div class="${bad?'bad':'muted'}" style="margin-top:6px">${text}</div>`;}

function tilePixel(lat,lon,z){const n=2**z,x=(lon+180)/360*n,lr=rad(lat),y=(1-Math.asinh(Math.tan(lr))/Math.PI)/2*n;const tx=Math.floor(x),ty=Math.floor(y);return {tx,ty,px:Math.max(0,Math.min(255,Math.floor((x-tx)*256))),py:Math.max(0,Math.min(255,Math.floor((y-ty)*256)))};}
async function loadTile(tx,ty,z=DEM_Z){const key=`${z}/${tx}/${ty}`;if(tileCache.has(key))return tileCache.get(key);const p=(async()=>{const urls=[`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`,`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${tx}/${ty}.png`];let err;for(const u of urls){try{const r=await fetch(u,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);const blob=await r.blob();const bmp=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);bmp.close?.();return ctx.getImageData(0,0,256,256).data;}catch(e){err=e;}}throw err||new Error('DEM niedostępny');})();tileCache.set(key,p);try{return await p}catch(e){tileCache.delete(key);throw e;}}
async function elevations(points,onProgress){const out=new Array(points.length),groups=new Map();points.forEach((p,i)=>{const q=tilePixel(p.lat,p.lng,DEM_Z),k=`${q.tx}/${q.ty}`;if(!groups.has(k))groups.set(k,{tx:q.tx,ty:q.ty,items:[]});groups.get(k).items.push({i,px:q.px,py:q.py});});let done=0;for(const g of groups.values()){const d=await loadTile(g.tx,g.ty);for(const it of g.items){const idx=(it.py*256+it.px)*4,r=d[idx],gg=d[idx+1],b=d[idx+2],e=r*256+gg+b/256-32768;out[it.i]=e;}done++;onProgress?.(done,groups.size);}return out;}
function fspl(f,d){return 32.44+20*Math.log10(Math.max(1,f))+20*Math.log10(Math.max(.05,d));}
function fresnel(f,d1,d2){const lambda=300/Math.max(1,f),a=Math.max(1,d1*1000),b=Math.max(1,d2*1000);return Math.sqrt(lambda*a*b/(a+b));}
function knife(v){if(v<=-.78)return 0;return 6.9+20*Math.log10(Math.sqrt((v-.1)*(v-.1)+1)+v-.1);}
function terrainLoss(ray,endIndex,f,txAlt,rxH){const end=ray[endIndex],total=end.km;if(!end||total<=0)return 0;const rxAlt=end.elev+rxH;let worstV=-99,worstMargin=999;for(let i=1;i<endIndex;i++){const p=ray[i],x=p.km/total,los=txAlt+(rxAlt-txAlt)*x,bulge=p.km*(total-p.km)/12.75,f1=fresnel(f,p.km,total-p.km),margin=los-(p.elev+bulge+.6*f1);worstMargin=Math.min(worstMargin,margin);if(margin<0){const lambda=300/f,h=-margin,d1=Math.max(1,p.km*1000),d2=Math.max(1,(total-p.km)*1000),v=h*Math.sqrt(2*(d1+d2)/(lambda*d1*d2));worstV=Math.max(worstV,v);}}return Math.min(55,(worstV>-90?knife(worstV):0)+(worstMargin<8&&worstMargin>=0?(8-worstMargin)*.35:0));}

async function runProfile(){const s=selected(),o=origin();if(!s||!o)throw new Error('Brak wybranego BTS lub pozycji.'); if(!state?.userLocation && window.AndroidNative) AndroidNative.startNativeTracking(); const end={lat:+s.latitude,lng:+s.longitude},dist=hav(o,end),az=bear(o,end),n=Math.max(60,Math.min(220,Math.ceil(dist*8)));const pts=[];for(let i=0;i<n;i++){const km=dist*i/(n-1),p=dest(o.lat,o.lng,az,km);pts.push({...p,km});}setResult(`Pobieram profil DEM: ${n} próbek na ${dist.toFixed(2)} km…`);const es=await elevations(pts,(a,b)=>setResult(`DEM: ${a}/${b} kafli…`));pts.forEach((p,i)=>p.elev=es[i]);const f=+$('btsFreq').value,rxH=+$('btsRxH').value||3,txH=+$('btsTxH').value||30,txAlt=pts[n-1].elev+txH,rxAlt=pts[0].elev+rxH;let worst=Infinity,worstKm=0;for(let i=1;i<n-1;i++){const p=pts[i],x=p.km/dist,los=rxAlt+(txAlt-rxAlt)*x,bulge=p.km*(dist-p.km)/12.75,req=.6*fresnel(f,p.km,dist-p.km),margin=los-(p.elev+bulge+req);if(margin<worst){worst=margin;worstKm=p.km;}}const status=worst>=10?'bardzo dobra widoczność':worst>=0?'strefa Fresnela częściowo ograniczona':'trasa zasłonięta terenem';setResult(`${status}. Najgorszy margines Fresnela: ${worst.toFixed(1)} m w odległości ${worstKm.toFixed(1)} km. Azymut do BTS: ${az.toFixed(0)}°.`);
 renderProfile(pts,rxAlt,txAlt,dist,worst,status);}
function renderProfile(pts,rxAlt,txAlt,dist,worst,status){const W=700,H=260,pl=42,pr=14,pt=18,pb=32,vals=pts.map(p=>p.elev),min=Math.min(...vals,rxAlt,txAlt)-20,max=Math.max(...vals,rxAlt,txAlt)+35,x=d=>pl+d/Math.max(.1,dist)*(W-pl-pr),y=e=>pt+(max-e)/(max-min)*(H-pt-pb);const path=pts.map((p,i)=>`${i?'L':'M'}${x(p.km).toFixed(1)},${y(p.elev).toFixed(1)}`).join(' '),los=`M${x(0)},${y(rxAlt)} L${x(dist)},${y(txAlt)}`;$('btsProfile').style.display='block';$('btsProfile').innerHTML=`<strong>Profil terenu</strong><div class="${worst<0?'bad':worst<10?'warn':'good'}" style="margin:6px 0">${status}</div><svg viewBox="0 0 ${W} ${H}"><path d="${path} L${x(dist)},${H-pb} L${x(0)},${H-pb} Z" fill="#24475a" opacity=".9"/><path d="${path}" fill="none" stroke="#8dd7c9" stroke-width="2"/><path d="${los}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="7 5"/><text x="${pl}" y="${H-9}" fill="#9db0bf" font-size="12">0 km</text><text x="${W-pr-65}" y="${H-9}" fill="#9db0bf" font-size="12">${dist.toFixed(1)} km</text></svg><div class="muted">Linia żółta: prosta antena BTS ↔ odbiornik. Ocena uwzględnia krzywiznę Ziemi oraz 60% pierwszej strefy Fresnela.</div>`;}

async function runCoverage(){const s=selected();if(!s)throw new Error('Wybierz BTS.');const f=+$('btsFreq').value,eirp=+$('btsEirp').value,txH=+$('btsTxH').value||30,rxH=+$('btsRxH').value||3,clutter=+$('btsClutter').value||18,threshold=+$('btsThreshold').value||-105;const maxKm=f<=900?30:f<=1800?22:f<=2200?18:f<=2700?14:9,step=1,bStep=20,bearings=[];for(let b=0;b<360;b+=bStep)bearings.push(b);const all=[],rays=[];for(const b of bearings){const ray=[{lat:+s.latitude,lng:+s.longitude,km:0,bearing:b}];for(let d=step;d<=maxKm;d+=step){const p=dest(+s.latitude,+s.longitude,b,d);ray.push({...p,km:d,bearing:b});}rays.push(ray);all.push(...ray);}setResult(`Pobieram DEM dla ${all.length} punktów…`);const es=await elevations(all,(a,b)=>setResult(`DEM ${a}/${b} kafli • ${all.length} próbek…`));let idx=0;rays.forEach(r=>r.forEach(p=>p.elev=es[idx++]));const reaches=[];for(const ray of rays){const txAlt=ray[0].elev+txH;let reach=.25,fail=0;for(let j=1;j<ray.length;j++){const d=ray[j].km,tl=terrainLoss(ray,j,f,txAlt,rxH),cl=clutter+4*Math.log10(1+d),level=eirp-fspl(f,d)-tl-cl;if(level>=threshold){reach=d;fail=0}else{fail++;if(fail>=2)break;}}reaches.push({bearing:ray[0].bearing,km:reach,...dest(+s.latitude,+s.longitude,ray[0].bearing,reach)});}if(!coverageLayer)coverageLayer=L.layerGroup().addTo(state.map);coverageLayer.clearLayers();const azs=Array.isArray(s.azimuths)?s.azimuths.filter(Number.isFinite):[];let polyPoints=reaches.map(r=>[r.lat,r.lng]);if(azs.length){const half=40;polyPoints=reaches.filter(r=>azs.some(a=>Math.abs(norm(r.bearing-a))<=half)).map(r=>[r.lat,r.lng]);}
 if(polyPoints.length>=3)L.polygon(polyPoints,{color:'#0f766e',weight:2,fillColor:'#2dd4bf',fillOpacity:.18}).addTo(coverageLayer);L.circleMarker([+s.latitude,+s.longitude],{radius:7,color:'#fff',fillColor:'#0f766e',fillOpacity:1}).addTo(coverageLayer);const vals=reaches.map(r=>r.km),avg=vals.reduce((a,b)=>a+b,0)/vals.length,best=Math.max(...vals),min=Math.min(...vals);setResult(`Orientacyjny zasięg terenowy: średnio ${avg.toFixed(1)} km, od ${min.toFixed(1)} do ${best.toFixed(1)} km zależnie od kierunku. ${azs.length?'Uwzględniłem znane azymuty sektorów.':'Brak azymutów sektorów, więc model jest dookólny.'}`);modal.style.display='none';try{state.map.fitBounds(L.latLngBounds(polyPoints).extend([+s.latitude,+s.longitude]),{padding:[25,25]});}catch{} }

function updateAim(){const s=selected(),o=origin();fab.style.display=s?'block':'none';if(!s||!o){aim.style.display='none';return;}const t={lat:+s.latitude,lng:+s.longitude},d=hav(o,t),b=bear(o,t),h=lastHeading;let text=`📡 ${s.operator||''} ${s.station_id||''} • ${d<1?(d*1000).toFixed(0)+' m':d.toFixed(2)+' km'} • ${b.toFixed(0)}°`;if(Number.isFinite(h)){const delta=norm(b-h);text+=Math.abs(delta)<6?' • ✅ kierunek':delta>0?` • ↪ ${Math.abs(delta).toFixed(0)}° w prawo`:` • ↩ ${Math.abs(delta).toFixed(0)}° w lewo`;}aim.textContent=text;aim.style.display='block';}
window.onNativeLocation=(lat,lon,acc,bearing,speed)=>{try{state.gpsTracking=true;state.measureSource='gps';const p={coords:{latitude:lat,longitude:lon,accuracy:acc>0?acc:null,heading:bearing>=0?bearing:null,speed:speed>=0?speed:null}};if(typeof updateUserPosition==='function')updateUserPosition(p,false); else {state.userLocation={lat,lng:lon,accuracy:acc};state.measure={lat,lng:lon};}updateAim();}catch(e){console.warn(e)}};
window.onNativeLocationError=msg=>{try{if(typeof setStatus==='function')setStatus(msg)}catch{};};
window.onNativeHeading=h=>{lastHeading=h;try{state.compassActive=true;state.compassHeading=h;state.compassSmoothedHeading=h;if(el?.compassHeadingLabel)el.compassHeadingLabel.textContent=`${Math.round(h)}°`;}catch{}updateAim();};
window.onNativeCompassUnavailable=()=>{};

function hookNative(){try{if(window.AndroidNative){AndroidNative.startNativeCompass(); if(el?.locateBtn){el.locateBtn.addEventListener('click',()=>setTimeout(()=>{try{if(state.gpsTracking)AndroidNative.startNativeTracking();else AndroidNative.stopNativeTracking();}catch{}},250),true);}}}catch{}}
setInterval(()=>{const s=selected(),id=s?.station_id||s?.id||null;if(id!==lastSelectedId){lastSelectedId=id;updateAim();}else updateAim();},700);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hookNative);else hookNative();
})();
