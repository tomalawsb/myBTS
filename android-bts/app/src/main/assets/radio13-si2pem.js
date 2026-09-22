'use strict';

const SI2PEM_WFS13='https://si2pem.gov.pl/geoserver/public/wfs';
const si2pemStatus13=new Map();
const pendingNative13=new Map();
const pendingPdf13=new Map();
let requestSeq13=0;

const siCss13=document.createElement('style');
siCss13.textContent=`
.bts13-si2pem{margin-top:7px;display:grid;gap:5px}.bts13-si2pem button{width:100%;border:0;border-radius:10px;padding:8px;background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;font-size:9.5px;font-weight:900}.bts13-si2pem button[disabled]{opacity:.6}.bts13-si2pem-status{font-size:8px;line-height:1.25;color:#667085;padding:0 2px}.dark .bts13-si2pem-status{color:#a7b1c5}
`;
document.head.appendChild(siCss13);

const oldNativeFetch13=window.onNativeFetch13;
window.onNativeFetch13=function(id,ok,payload,error){
  const p=pendingNative13.get(id);
  if(p){pendingNative13.delete(id);clearTimeout(p.timer);ok?p.resolve(payload):p.reject(new Error(error||'Błąd pobierania'));return;}
  if(typeof oldNativeFetch13==='function')oldNativeFetch13(id,ok,payload,error);
};
const oldNativePdf13=window.onNativePdfText13;
window.onNativePdfText13=function(id,ok,text,error){
  const p=pendingPdf13.get(id);
  if(p){pendingPdf13.delete(id);clearTimeout(p.timer);ok?p.resolve(text):p.reject(new Error(error||'Błąd odczytu PDF'));return;}
  if(typeof oldNativePdf13==='function')oldNativePdf13(id,ok,text,error);
};

function nativeText13(url){
  return new Promise((resolve,reject)=>{
    if(!window.AndroidNative?.fetchUrlAsync){reject(new Error('Brak modułu sieciowego Android'));return;}
    const id='s13f'+(++requestSeq13),timer=setTimeout(()=>{pendingNative13.delete(id);reject(new Error('Przekroczono czas pobierania'));},45000);
    pendingNative13.set(id,{resolve,reject,timer});
    AndroidNative.fetchUrlAsync(url,id,false);
  });
}
function nativePdfText13(url){
  return new Promise((resolve,reject)=>{
    if(!window.AndroidNative?.fetchPdfTextAsync){reject(new Error('Ta wersja aplikacji nie ma czytnika PDF'));return;}
    const id='s13p'+(++requestSeq13),timer=setTimeout(()=>{pendingPdf13.delete(id);reject(new Error('Przekroczono czas odczytu raportu'));},70000);
    pendingPdf13.set(id,{resolve,reject,timer});
    AndroidNative.fetchPdfTextAsync(url,id);
  });
}
function cqlQuote13(v){return String(v??'').replace(/'/g,"''");}
async function wfs13(layer,filter,count=100){
  const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:layer,outputFormat:'application/json',count:String(count)});
  if(filter)q.set('CQL_FILTER',filter);
  const raw=await nativeText13(SI2PEM_WFS13+'?'+q.toString());
  const j=JSON.parse(raw||'{}');
  return Array.isArray(j.features)?j.features:[];
}
function opSimple13(v){const t=ntext(v);if(t.includes('orange'))return'orange';if(t.includes('t-mobile')||t.includes('tmobile'))return't-mobile';if(t.includes('p4')||t.includes('play'))return'play';if(t.includes('polkomtel')||t.includes('plus'))return'plus';return t;}
function distFeature13(s,f){const c=f?.geometry?.coordinates;if(!Array.isArray(c)||c.length<2)return 999;try{return haversineKm(s.latitude,s.longitude,+c[1],+c[0]);}catch(_){return 999;}}
async function resolveIdentity13(s){
  const raw=String(s?.station_id||'').trim();
  const candidates=[raw,raw.replace(/^[A-Z]{2,5}[:\-]/i,''),raw.match(/[A-Z]{0,3}\d{3,7}/i)?.[0]].filter(Boolean);
  for(const id of [...new Set(candidates)]){
    const f=await wfs13('public:extend_base_stations',`identity_name='${cqlQuote13(id)}'`,5).catch(()=>[]);
    if(f.length)return String(f[0].properties?.identity_name||id);
  }
  const lat=+s.latitude,lon=+s.longitude;
  if(Number.isFinite(lat)&&Number.isFinite(lon)){
    const d=.006;
    const f=await wfs13('public:extend_base_stations',`BBOX(geom,${lon-d},${lat-d},${lon+d},${lat+d},'EPSG:4326')`,30).catch(()=>[]);
    const want=opSimple13(s.operator);
    f.sort((a,b)=>{const ao=opSimple13(a.properties?.operator_name)===want?0:1,bo=opSimple13(b.properties?.operator_name)===want?0:1;return ao-bo||distFeature13(s,a)-distFeature13(s,b);});
    const best=f[0];if(best&&distFeature13(s,best)<.8)return String(best.properties?.identity_name||'');
  }
  return raw;
}
async function findReport13(s){
  const identity=await resolveIdentity13(s);
  if(!identity)throw new Error('Nie udało się dopasować ID w SI2PEM');
  let f=await wfs13('public:measures_all',`identity_names='${cqlQuote13(identity)}'`,250);
  if(!f.length)f=await wfs13('public:measures_all',`identity_names LIKE '%${cqlQuote13(identity)}%'`,250);
  const rows=f.map(x=>x.properties||{}).filter(x=>x.url&&/\.pdf(?:$|\?)/i.test(String(x.url)));
  if(!rows.length)throw new Error('SI2PEM nie ma publicznego raportu PDF dla tej stacji');
  rows.sort((a,b)=>String(b.date||b.year||'').localeCompare(String(a.date||a.year||'')));
  const row=rows[0],url=String(row.url).replace(/^http:\/\/si2pem\.gov\.pl/i,'https://si2pem.gov.pl');
  return{identity,url,date:String(row.date||row.year||''),maxField:Number(row.intensity)||null,source:String(row.source||'SI2PEM')};
}
function allNums13(s){return (String(s||'').replace(/(\d)\s+(\d)/g,'$1$2').match(/-?\d+(?:[.,]\d+)?/g)||[]).map(x=>+x.replace(',','.')).filter(Number.isFinite);}
function labelWindows13(text,re,linesAfter=12){const lines=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),out=[];for(let i=0;i<lines.length;i++)if(re.test(lines[i]))out.push(lines.slice(i,Math.min(lines.length,i+linesAfter+1)).join(' '));return out;}
function valuesNear13(text,re,filter,linesAfter=12){const vals=[];for(const w of labelWindows13(text,re,linesAfter))for(const n of allNums13(w))if(filter(n)&&!vals.some(x=>Math.abs(x-n)<.01))vals.push(n);return vals;}
function median13(a){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;}
function modeLike13(a,max=8){const m=new Map();for(const v of a){const k=Math.round(v*10)/10;m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,max).map(x=>x[0]);}
function bandsFromPdf13(text,fallback){const known=[420,450,700,800,900,1800,2100,2600,3500,3600,3700,3800],found=[];const t=String(text||'');for(const f of known)if(new RegExp(`(^|\\D)${f}(?:[.,]0)?(\\D|$)`).test(t))found.push(f);const base=(fallback||[]).map(String);if(base.length)return base;return found.map(f=>f>=3500?`NR${f}`:`LTE${f}`);}
function parseSi2pemPdf13(text,s,report){
  const freqSet=new Set([420,450,700,800,900,1800,2100,2600,3500,3600,3700,3800]);
  let eirpW=valuesNear13(text,/(?:moc\s*[-–—]?\s*eirp|\beirp\b)/i,n=>n>=50&&n<=500000&&!freqSet.has(Math.round(n))&&!(n>=1900&&n<=2100),18);
  eirpW=eirpW.filter(n=>!(n>=0&&n<=70));
  const dbm=valuesNear13(text,/(?:maksymalna\s+moc\s+nadawania|moc\s+nadawania).*dbm|\[dbm\]/i,n=>n>=30&&n<=70,14);
  let az=valuesNear13(text,/azymut/i,n=>n>=0&&n<360&&!freqSet.has(Math.round(n)),14);
  az=modeLike13(az,10).filter(v=>v===0||v>=5);
  if(az.some(v=>v>=20))az=az.filter(v=>v===0||v>=10);
  const heights=valuesNear13(text,/(?:wysokość|wysokosc).*(?:anten|środka|srodka)|(?:anten|środka|srodka).*(?:wysokość|wysokosc)/i,n=>n>=5&&n<=150,12);
  const tilts=valuesNear13(text,/(?:tilt|pochylen)/i,n=>n>=0&&n<=25,10).filter(n=>!freqSet.has(Math.round(n)));
  const bands=bandsFromPdf13(text,s?.bands||[]);
  const eirp=median13(eirpW.length>6?modeLike13(eirpW,6):eirpW);
  const tx=median13(dbm);
  const h=median13(heights);
  const tilt=median13(tilts);
  if(!Number.isFinite(eirp)&&!az.length&&!Number.isFinite(h)&&!Number.isFinite(tilt)&&!Number.isFinite(tx))throw new Error('Raport znaleziony, ale nie udało się odczytać tabeli parametrów');
  const bearings=az.length?az.slice(0,8):[null],entries=[];
  for(const band of bands.length?bands:(s?.bands||['Nieznane']))for(const a of bearings)entries.push({band:String(band),frequency_mhz:bandFreq13(band),azimuth_deg:Number.isFinite(a)?a:null,eirp_w:Number.isFinite(eirp)?eirp:null,eirp_dbm:Number.isFinite(eirp)?wToDbm13(eirp):null,height_m:Number.isFinite(h)?h:null,tilt_deg:Number.isFinite(tilt)?tilt:null,tx_dbm:Number.isFinite(tx)?tx:null,source:'SI2PEM raport częściowy',report_url:report.url,report_date:report.date});
  return{entries,eirp_w:Number.isFinite(eirp)?eirp:null,tx_dbm:Number.isFinite(tx)?tx:null,azimuths:az,height_m:Number.isFinite(h)?h:null,tilt_deg:Number.isFinite(tilt)?tilt:null};
}
function cacheKeySi13(s){return'bts13.si2pem.'+stationKey13(s);}
function saveSiCache13(s,report,parsed){try{localStorage.setItem(cacheKeySi13(s),JSON.stringify({saved:Date.now(),report,parsed}));}catch(_){}}
function mergeSi13(s,report,parsed){
  const old=Array.isArray(s.radio_sectors)?s.radio_sectors:[];const keep=old.filter(e=>!/SI2PEM raport/i.test(String(e?.source||'')));
  s.radio_sectors=[...keep,...parsed.entries];
  if(parsed.azimuths?.length)s.azimuths=[...new Set([...(s.azimuths||[]),...parsed.azimuths])].sort((a,b)=>a-b);
  if(Number.isFinite(parsed.height_m))s.antenna_height_m=parsed.height_m;
  if(Number.isFinite(parsed.tilt_deg))s.tilt_deg=parsed.tilt_deg;
  if(Number.isFinite(parsed.eirp_w))s.power=`${Math.round(parsed.eirp_w)} W EIRP`;
  s.si2pem_report_url=report.url;s.si2pem_report_date=report.date;s.si2pem_identity=report.identity||s.station_id;
  s.param_sources=[...new Set([...(s.param_sources||[]),report.url])];
  if(!/SI2PEM raport/i.test(String(s.source||'')))s.source=`${s.source||'baza'} | SI2PEM raport`;
}
function applySiCache13(s){
  if(!s||s.__si13cache)return;s.__si13cache=true;
  try{const raw=localStorage.getItem(cacheKeySi13(s));if(!raw)return;const c=JSON.parse(raw);if(!c?.parsed?.entries?.length)return;mergeSi13(s,c.report||{},c.parsed);si2pemStatus13.set(stationKey13(s),{state:'ok',label:`SI2PEM ${c.report?.date||''}`.trim(),report:c.report});}catch(_){}
}
async function enrichSelectedSi2pem13(s=state?.selected,quiet=false){
  if(!s)return false;applySiCache13(s);const key=stationKey13(s);si2pemStatus13.set(key,{state:'loading',label:'Pobieram raport SI2PEM…'});if(!quiet)refreshStationPopupContent(s);
  try{
    const report=await findReport13(s);report.identity=await resolveIdentity13(s);
    const text=await nativePdfText13(report.url);
    const parsed=parseSi2pemPdf13(text,s,report);
    mergeSi13(s,report,parsed);saveSiCache13(s,report,parsed);
    const bits=[];if(Number.isFinite(parsed.eirp_w))bits.push(`EIRP ${parsed.eirp_w>=1000?fmt(parsed.eirp_w/1000,1)+' kW':fmt(parsed.eirp_w,0)+' W'}`);if(parsed.azimuths?.length)bits.push(`${parsed.azimuths.length} az.`);if(Number.isFinite(parsed.height_m))bits.push(`h ${fmt(parsed.height_m,1)} m`);
    si2pemStatus13.set(key,{state:'ok',label:`SI2PEM ${report.date||''}${bits.length?' • '+bits.join(' • '):''}`.trim(),report});
    renderCoverage13(s);refreshStationPopupContent(s);return true;
  }catch(e){si2pemStatus13.set(key,{state:'error',label:e?.message||'Brak danych SI2PEM'});refreshStationPopupContent(s);return false;}
}

const baseQualitySi13=quality13;
quality13=function(s){const r=radioEntries13(s);const exact=r.some(e=>/SI2PEM raport sektorowy/i.test(String(e.source||''))&&e.eirp_dbm!==null&&e.azimuth_deg!==null&&e.height_m!==null);if(exact)return{key:'exact',label:'dokładne'};const partial=r.some(e=>/SI2PEM raport/i.test(String(e.source||''))&&(e.eirp_dbm!==null||e.azimuth_deg!==null||e.height_m!==null));if(partial)return{key:'partial',label:'częściowe SI2PEM'};return baseQualitySi13(s);};

const baseRadioBodySi13=radioBody13;
radioBody13=function(s){applySiCache13(s);const st=si2pemStatus13.get(stationKey13(s));return baseRadioBodySi13(s)+`<div class="bts13-si2pem"><button data-si2pem13 ${st?.state==='loading'?'disabled':''}>${st?.state==='loading'?'Pobieranie SI2PEM…':'↓ Pobierz parametry SI2PEM'}</button>${st?.label?`<div class="bts13-si2pem-status">${escapeHtml(st.label)}</div>`:''}</div>`;};
const baseBtsBodySi13=btsBody13;
btsBody13=function(s){applySiCache13(s);return baseBtsBodySi13(s).replace('Aktualizuj bazę UKE','Aktualizuj UKE + SI2PEM').replace('Aktualizuj bazę UKE','Aktualizuj UKE + SI2PEM');};
const basePopupSi13=popup13;
popup13=function(s){applySiCache13(s);return basePopupSi13(s);};
popupHtml=popup13;

const baseUpdateUkeSi13=updateFromUkeOnline;
updateFromUkeOnline=async function(opts){const r=await baseUpdateUkeSi13(opts);if(state?.selected)void enrichSelectedSi2pem13(state.selected,true);return r;};

document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-si2pem13]');if(!b||!state?.selected)return;ev.preventDefault();ev.stopPropagation();void enrichSelectedSi2pem13(state.selected,false);},true);

window.enrichSelectedSi2pem13=enrichSelectedSi2pem13;
