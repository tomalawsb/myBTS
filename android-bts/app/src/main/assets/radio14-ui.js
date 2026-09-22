(() => {
'use strict';

const BTS14_VERSION='1.4';
const activeOperator14=new Map();
const autoSiAttempt14=new Set();
let uiTimer14=null;

const css14=document.createElement('style');
css14.textContent=`
/* BTS Asystent 1.4 */
#btsAimChip{display:none!important}
.bts14-card{width:270px;max-width:calc(100vw - 26px);background:#fff;color:#172033;font-family:inherit}
.bts14-head{padding:9px 10px 7px;border-bottom:1px solid #e8edf3}.bts14-head strong{display:block;font-size:13px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bts14-head small{display:block;color:#667085;font-size:9.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.bts14-ops{display:flex;gap:4px;padding:7px 8px 4px;overflow-x:auto;scrollbar-width:none}.bts14-ops::-webkit-scrollbar{display:none}.bts14-op{flex:1 0 auto;min-width:62px;border:1px solid #dbe3ee;border-radius:10px;padding:7px 8px;background:#f3f6fa;color:#475467;font-size:9.5px;font-weight:900}.bts14-op.active{color:#fff;border-color:transparent;background:var(--op,#1d4ed8);box-shadow:0 5px 14px color-mix(in srgb,var(--op,#1d4ed8) 25%,transparent)}
.bts14-hero{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin:3px 8px 7px;padding:8px 9px;border-radius:11px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff}.bts14-hero span{display:block;font-size:8px;font-weight:850;text-transform:uppercase;color:rgba(255,255,255,.74)}.bts14-hero strong{display:block;font-size:20px;line-height:1;margin-top:2px}.bts14-hero b{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px}
.bts14-subnav{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:0 8px 6px}.bts14-subnav button{border:0;border-radius:8px;padding:6px 2px;background:#eef2f7;color:#526071;font-size:8.8px;font-weight:900}.bts14-subnav button.active{background:#1d4ed8;color:#fff}
.bts14-body{padding:0 8px 8px}.bts14-auto{margin-top:5px;padding:5px 7px;border-radius:8px;background:#ecfeff;color:#0f6674;font-size:8.2px;font-weight:800;line-height:1.2}.bts14-auto.error{background:#fff1f2;color:#be123c}.bts14-auto.ok{background:#ecfdf3;color:#166534}
.bts13-si2pem button{display:none!important}.bts13-si2pem{margin-top:5px!important}.bts13-si2pem-status{padding:5px 7px!important;border-radius:8px;background:#f3f6fa;font-size:8px!important}
#bts14SearchHere,#bts14Reopen{position:fixed;z-index:1510;border:0;border-radius:999px;color:#fff;font:850 10px system-ui;box-shadow:0 8px 24px #0004;padding:8px 11px}
#bts14SearchHere{left:10px;top:calc(126px + env(safe-area-inset-top));background:#1d4ed8}#bts14Reopen{right:10px;top:calc(232px + env(safe-area-inset-top));background:#0f766e;display:none}
.dark .bts14-card{background:#182032;color:#edf2ff}.dark .bts14-head{border-color:#2a3547}.dark .bts14-head small{color:#a7b1c5}.dark .bts14-op{background:#202a3b;color:#d8e2f3;border-color:#344158}.dark .bts14-subnav button{background:#202a3b;color:#d8e2f3}.dark .bts14-auto{background:#14333a;color:#8be4ef}.dark .bts14-auto.error{background:#451a22;color:#fda4af}.dark .bts14-auto.ok{background:#143520;color:#86efac}.dark .bts13-si2pem-status{background:#202a3b}
@media(max-width:420px){.bts14-card{width:252px}.bts14-head{padding:8px 9px 6px}.bts14-ops{padding:6px 7px 4px}.bts14-op{min-width:58px;padding:6px 7px}.bts14-hero{margin-left:7px;margin-right:7px}.bts14-subnav{padding-left:7px;padding-right:7px}.bts14-body{padding-left:7px;padding-right:7px}#bts14SearchHere{top:calc(122px + env(safe-area-inset-top));font-size:9.5px;padding:7px 10px}#bts14Reopen{top:calc(224px + env(safe-area-inset-top));font-size:9.5px;padding:7px 10px}}
`;
document.head.appendChild(css14);

function op14(v){
  const t=ntext(v);
  if(t.includes('orange'))return'Orange';
  if(t.includes('t-mobile')||t.includes('tmobile'))return'T-Mobile';
  if(t==='p4'||t.includes('play')||t.includes('p4 '))return'Play';
  if(t.includes('polkomtel')||t==='plus'||t.includes('plus'))return'Plus';
  if(t.includes('aero2'))return'Aero2';
  const raw=String(v||'').trim();return raw||'Operator';
}
function opsFrom14(v){
  let raw=[];try{raw=splitOperators(v||'')||[];}catch(_){raw=String(v||'').split(/\s*[\/,+;|]\s*/);}
  const out=[];for(const x of raw){const o=op14(x);if(o&&!out.some(y=>ntext(y)===ntext(o)))out.push(o);}return out;
}
function siteKey14(s){return `${Number(s?.latitude).toFixed(5)}|${Number(s?.longitude).toFixed(5)}`;}
function declaredOps14(s){
  const out=[],add=v=>{const o=op14(v);if(o&&!out.some(x=>ntext(x)===ntext(o)))out.push(o);};
  opsFrom14(s?.operator).forEach(add);(s?.shared_operators||[]).forEach(x=>opsFrom14(x).forEach(add));(s?._siteOperators||[]).forEach(x=>opsFrom14(x).forEach(add));
  return out;
}
function stationHasOp14(s,op){return opsFrom14(s?.operator).some(x=>ntext(x)===ntext(op));}
function nearbyMembers14(seed){
  const declared=declaredOps14(seed),wanted=new Set(declared.map(ntext));const candidates=[];
  for(const s of state.stations||[]){
    if(!s||!Number.isFinite(+s.latitude)||!Number.isFinite(+s.longitude))continue;
    const d=haversineKm(+seed.latitude,+seed.longitude,+s.latitude,+s.longitude);if(d>.06)continue;
    const sop=opsFrom14(s.operator);if(wanted.size&&sop.length&&!sop.some(x=>wanted.has(ntext(x))))continue;
    candidates.push({s,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  return candidates;
}
function syntheticMember14(seed,op){
  return {...seed,operator:op,station_id:'',bands:[],azimuths:[],radio_sectors:[],power:'',erp:'',antenna_height_m:null,tilt_deg:null,range_km:null,param_sources:[],source:'Lokalizacja współdzielona • oczekiwanie na SI2PEM',__synthetic14:true,__siteSeed14:seed,shared_operators:declaredOps14(seed).filter(x=>ntext(x)!==ntext(op))};
}
function siteGroup14(seed){
  const declared=declaredOps14(seed),near=nearbyMembers14(seed),ops=[...declared];
  for(const {s} of near)for(const o of opsFrom14(s.operator))if(!ops.some(x=>ntext(x)===ntext(o)))ops.push(o);
  if(!ops.length)ops.push(op14(seed.operator));
  const members=new Map();
  for(const op of ops){const found=near.find(x=>stationHasOp14(x.s,op));members.set(op,found?.s||syntheticMember14(seed,op));}
  return{key:siteKey14(seed),ops,members};
}
function currentOp14(seed,group=siteGroup14(seed)){
  const saved=activeOperator14.get(group.key);if(saved&&group.ops.some(x=>ntext(x)===ntext(saved)))return group.ops.find(x=>ntext(x)===ntext(saved));
  const own=op14(seed.operator),match=group.ops.find(x=>ntext(x)===ntext(own));return match||group.ops[0];
}
function currentMember14(seed){const g=siteGroup14(seed),op=currentOp14(seed,g);return{group:g,op,station:g.members.get(op)||seed};}
function opColor14(op){try{return operatorColor(op);}catch(_){return'#1d4ed8';}}
function escapeAttr14(s){return escapeHtml(String(s||''));}
function autoStatus14(s){
  const st=si2pemStatus13?.get?.(stationKey13(s));if(!st)return'<div class="bts14-auto">SI2PEM: dane zostaną pobrane automatycznie.</div>';
  const cls=st.state==='ok'?'ok':st.state==='error'?'error':'';const txt=st.state==='loading'?'SI2PEM: pobieram raport automatycznie…':`SI2PEM: ${st.label||st.state}`;return `<div class="bts14-auto ${cls}">${escapeHtml(txt)}</div>`;
}
function popup14(seed){
  const {group,op,station}=currentMember14(seed);applySiCache13?.(station);
  const o=getOrigin(),d=haversineKm(o.lat,o.lng,station.latitude,station.longitude),b=azimuthDeg(o.lat,o.lng,station.latitude,station.longitude),t=popupTab13.get(stationKey13(station))||'bts';
  const title=station.city||seed.city||'Stacja BTS',addr=station.address||seed.address||`ID ${station.station_id||seed.station_id||'—'}`;
  return `<div class="bts14-card" data-bts14-site="${escapeAttr14(group.key)}"><div class="bts14-head"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(addr)}${group.ops.length>1?` • wspólna lokalizacja ${group.ops.length} sieci`:''}</small></div><div class="bts14-ops">${group.ops.map(x=>`<button class="bts14-op ${ntext(x)===ntext(op)?'active':''}" style="--op:${opColor14(x)}" data-bts14-op="${escapeAttr14(x)}">${escapeHtml(x)}</button>`).join('')}</div><div class="bts14-hero"><div><span>${escapeHtml(op)} • odległość</span><strong>${escapeHtml(formatDistance(d))}</strong></div><b>${Math.round(b)}°</b></div><div class="bts14-subnav"><button class="${t==='bts'?'active':''}" data-bts14-tab="bts">BTS</button><button class="${t==='radio'?'active':''}" data-bts14-tab="radio">Radio</button><button class="${t==='range'?'active':''}" data-bts14-tab="range">Zasięg</button><button class="${t==='terrain'?'active':''}" data-bts14-tab="terrain">Teren</button></div><div class="bts14-body">${body13(station,t)}${autoStatus14(station)}</div></div>`;
}

popupHtml=popup14;
openStationPopup=function(station){
  if(!state.map||!window.L||!station)return;
  if(!state.stationPopup){state.stationPopup=L.popup({className:'bts-leaflet-popup',closeButton:false,autoPan:true,autoClose:true,closeOnClick:true,keepInView:true,maxWidth:292,minWidth:0,autoPanPadding:[16,110]});state.stationPopup.on('remove',()=>{if(!state.suppressPopupClose)state.selectedPopupOpen=false;});}
  state.selectedPopupOpen=true;state.suppressPopupClose=true;state.stationPopup.setLatLng([station.latitude,station.longitude]).setContent(popup14(station)).openOn(state.map);state.suppressPopupClose=false;
};
refreshStationPopupContent=function(station){if(!station||!state.selectedPopupOpen)return;if(state.stationPopup&&state.map&&state.map.hasLayer(state.stationPopup))state.stationPopup.setLatLng([station.latitude,station.longitude]).setContent(popup14(station));else openStationPopup(station);};

function activateOperator14(seed,op){
  const g=siteGroup14(seed),realOp=g.ops.find(x=>ntext(x)===ntext(op))||g.ops[0],member=g.members.get(realOp)||seed;activeOperator14.set(g.key,realOp);state.selected=member;showStationDetails(member);renderSelectedStationExtras(member);updateNavigationIndicator();refreshStationPopupContent(member);scheduleRender();void autoSi2pem14(member);
}
async function autoSi2pem14(s){
  if(!s||typeof enrichSelectedSi2pem13!=='function')return;try{applySiCache13?.(s);}catch(_){}
  const k=stationKey13(s),st=si2pemStatus13?.get?.(k);if(st?.state==='ok'||st?.state==='loading')return;if(autoSiAttempt14.has(k))return;autoSiAttempt14.add(k);refreshStationPopupContent(s);await enrichSelectedSi2pem13(s,true);
}

const baseSelect14=selectStation;
selectStation=function(station,centerOnMap=true,openPopup=true){
  if(!station)return;baseSelect14(station,centerOnMap,openPopup);const g=siteGroup14(station),own=op14(station.operator),op=g.ops.find(x=>ntext(x)===ntext(own))||g.ops[0];activeOperator14.set(g.key,op);const member=g.members.get(op)||station;if(member!==state.selected){state.selected=member;showStationDetails(member);renderSelectedStationExtras(member);updateNavigationIndicator();if(openPopup)refreshStationPopupContent(member);}void autoSi2pem14(member);
};

document.addEventListener('click',e=>{
  const op=e.target.closest?.('[data-bts14-op]');if(op&&state.selected){e.preventDefault();e.stopPropagation();activateOperator14(state.selected,op.dataset.bts14Op);return;}
  const tab=e.target.closest?.('[data-bts14-tab]');if(tab&&state.selected){e.preventDefault();e.stopPropagation();const {station}=currentMember14(state.selected);popupTab13.set(stationKey13(station),tab.dataset.bts14Tab);refreshStationPopupContent(station);if(tab.dataset.bts14Tab==='radio')void autoSi2pem14(station);return;}
},true);

const searchHere=document.createElement('button');searchHere.id='bts14SearchHere';searchHere.textContent='↻ Szukaj tutaj';searchHere.title='Pokaż BTS-y do 10 km od środka mapy';document.body.appendChild(searchHere);
searchHere.onclick=()=>{if(!state.map)return;const c=state.map.getCenter();state.measure={lat:c.lat,lng:c.lng};state.measureSource='manual';state.radiusKm=10;try{setRadiusSelect();showRadiusChip('Mapa');updateMeasureMarker();renderMapAndList();updateNavigationIndicator();setStatus('BTS-y do 10 km od środka mapy.');}catch(_){scheduleRender();}};
const reopen=document.createElement('button');reopen.id='bts14Reopen';reopen.textContent='ℹ BTS';reopen.title='Pokaż kartę wybranego BTS';document.body.appendChild(reopen);reopen.onclick=()=>{if(state.selected)openStationPopup(state.selected);};
function updateFloating14(){const has=!!state.selected,open=!!(state.selectedPopupOpen&&state.stationPopup&&state.map?.hasLayer?.(state.stationPopup));reopen.style.display=has&&!open?'block':'none';}
uiTimer14=setInterval(updateFloating14,450);updateFloating14();

setTimeout(()=>{try{if(el?.datasetInfo)el.datasetInfo.title='BTS Asystent PL 1.4 • operatorzy osobno • SI2PEM automatycznie';}catch(_){}},500);
})();