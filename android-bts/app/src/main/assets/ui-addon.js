(() => {
'use strict';

const RADIUS_KM = 10;
const popupTabs = new Map();
let renderTimer12 = null;
let nativeFirstFix = true;
let canvasRenderer = null;

const style = document.createElement('style');
style.textContent = `
/* BTS Asystent 1.2 */
.bts-leaflet-popup .leaflet-popup-content-wrapper{border-radius:16px!important;padding:0!important;overflow:hidden!important;box-shadow:0 12px 32px rgba(15,23,42,.24)!important}
.bts-leaflet-popup .leaflet-popup-content{width:auto!important;max-width:calc(100vw - 32px)!important;margin:0!important}
.bts-leaflet-popup .leaflet-popup-tip{box-shadow:none!important}
.bts12-card{width:238px;max-width:calc(100vw - 34px);background:#fff;color:#172033;font-family:inherit}
.bts12-card.far{width:196px}.bts12-card.mid{width:222px}.bts12-card.near{width:250px}
.bts12-head{display:flex;gap:8px;align-items:flex-start;padding:9px 10px 7px;border-bottom:1px solid #e8edf3}
.bts12-title{min-width:0;flex:1}.bts12-title strong{display:block;font-size:13px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bts12-title small{display:block;margin-top:2px;color:#667085;font-size:10px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bts12-op{flex:0 0 auto;max-width:92px;padding:4px 7px;border-radius:999px;color:#fff;background:#1d4ed8;font-size:9.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bts12-hero{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin:8px 9px;padding:8px 9px;border-radius:12px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff}
.bts12-hero span{display:block;color:rgba(255,255,255,.76);font-size:8.5px;font-weight:800;text-transform:uppercase}.bts12-hero strong{display:block;font-size:21px;line-height:1}.bts12-hero b{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px}
.bts12-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:0 9px 7px}.bts12-tabs button{border:0;border-radius:9px;padding:6px 4px;background:#eef2f7;color:#596579;font-size:9.5px;font-weight:850}.bts12-tabs button.active{background:#1d4ed8;color:#fff}
.bts12-body{padding:0 9px 9px;min-height:58px}.bts12-bands{display:flex;flex-wrap:wrap;gap:4px}.bts12-bands span{padding:4px 6px;border-radius:999px;background:#eef2f7;color:#475467;font-size:9.5px;font-weight:850}
.bts12-share{margin-top:7px;padding:6px 7px;border-radius:9px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;font-size:10px;font-weight:850;line-height:1.2}
.bts12-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e8edf3;border-radius:10px;overflow:hidden}.bts12-cell{padding:6px 7px;border-right:1px solid #e8edf3;border-bottom:1px solid #e8edf3;min-width:0}.bts12-cell:nth-child(2n){border-right:0}.bts12-cell:nth-last-child(-n+2){border-bottom:0}.bts12-cell span{display:block;color:#667085;font-size:8px;font-weight:850;text-transform:uppercase}.bts12-cell b{display:block;margin-top:2px;font-size:10px;line-height:1.15;overflow-wrap:anywhere}
.bts12-range{display:grid;grid-template-columns:1fr 1fr;gap:6px}.bts12-range div{padding:7px;border-radius:10px;background:#f3f6fa}.bts12-range span{display:block;color:#667085;font-size:8px;font-weight:850;text-transform:uppercase}.bts12-range b{display:block;margin-top:2px;font-size:11px}.bts12-terrain{width:100%;margin-top:7px;border:0;border-radius:10px;padding:8px;background:#e7f8f4;color:#0f766e;font-size:10px;font-weight:900}
.shared-bts-marker{position:relative;border-radius:50%;background:conic-gradient(var(--c1) 0 50%,var(--c2) 50% 100%);border:2px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,.28);will-change:transform}.shared-bts-marker::after{content:'';position:absolute;inset:28%;border-radius:50%;background:#fff}.shared-bts-marker.selected{box-shadow:0 0 0 3px rgba(15,118,110,.3),0 4px 15px rgba(15,23,42,.35)}.shared-map-badge{position:absolute;right:-4px;top:-4px;min-width:13px;height:13px;padding:0 3px;border-radius:999px;background:#172033;color:#fff;border:1px solid #fff;font-size:7.5px;font-weight:900;line-height:11px;text-align:center}
.shared-list-badge{background:#fff7ed!important;color:#9a3412!important;border:1px solid #fed7aa}
.bts12-radius-chip{position:fixed;z-index:1450;left:10px;bottom:72px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.94);color:#172033;box-shadow:0 6px 18px rgba(15,23,42,.16);font:850 10px system-ui;pointer-events:none}
#btsTerrainFab{width:44px!important;height:44px!important;padding:0!important;border-radius:999px!important;font-size:0!important;right:10px!important;bottom:70px!important;display:none}#btsTerrainFab::after{content:'⛰️';font-size:19px}
#btsTerrainModal>.card.muted{display:none!important}
.dark .bts12-card{background:#182032;color:#edf2ff}.dark .bts12-head{border-color:#2a3547}.dark .bts12-title small,.dark .bts12-cell span,.dark .bts12-range span{color:#a7b1c5}.dark .bts12-tabs button,.dark .bts12-bands span,.dark .bts12-range div{background:#202a3b;color:#d8e2f3}.dark .bts12-grid{border-color:#2a3547}.dark .bts12-cell{border-color:#2a3547}.dark .bts12-share{background:#3d2813;color:#fdba74;border-color:#6b4420}.dark .shared-list-badge{background:#3d2813!important;color:#fdba74!important;border-color:#6b4420}.dark .bts12-radius-chip{background:rgba(24,32,50,.94);color:#edf2ff}
@media(max-width:420px){.bts12-card.near{width:232px}.bts12-card.mid{width:210px}.bts12-card.far{width:188px}.bts12-hero strong{font-size:19px}.bts12-head{padding:8px 9px 6px}.bts12-body{padding:0 8px 8px}.bts12-tabs{padding:0 8px 6px}}
`;
document.head.appendChild(style);

function sharedOperatorsFor(station){
  const out=[];
  const add=v=>{const t=String(v||'').trim();if(t&&!out.some(x=>normalizeText(x)===normalizeText(t)))out.push(t);};
  try{(station?._siteOperators||[]).forEach(add);splitOperators(station?.operator||'').forEach(add);(station?.shared_operators||[]).forEach(add);}catch(_){}
  return out;
}
function partnerOperators(station){const own=new Set(splitOperators(station?.operator||'').map(normalizeText));return sharedOperatorsFor(station).filter(op=>!own.has(normalizeText(op)));}
function stationSiteKey(station){return `${Number(station.latitude).toFixed(5)}|${Number(station.longitude).toFixed(5)}`;}
function zoomClass(){const z=state?.map?.getZoom?.()||13;return z<12?'far':z<15?'mid':'near';}
function sharedColorPair(station){const ops=sharedOperatorsFor(station),a=ops[0]||station.operator||'Nieznany',b=ops[1]||a;return [operatorColor(a),operatorColor(b)];}
function sharedLabel(station){const p=partnerOperators(station);if(p.length)return `Wspólnie: ${p.join(', ')}`;const ops=sharedOperatorsFor(station);return ops.length>1?`Wspólnie: ${ops.join(', ')}`:'';}
function getRenderer(){if(!canvasRenderer&&window.L?.canvas)canvasRenderer=L.canvas({padding:.35,tolerance:7});return canvasRenderer;}
function setRadiusSelect(){state.radiusKm=RADIUS_KM;if(el?.radiusSelect){const option=Array.from(el.radiusSelect.options||[]).find(o=>Number(o.value)===RADIUS_KM);if(option)el.radiusSelect.value=String(RADIUS_KM);}}
function radiusBounds(lat,lng){const dLat=RADIUS_KM/111.32;const dLon=RADIUS_KM/(111.32*Math.max(.25,Math.cos(lat*Math.PI/180)));return [[lat-dLat,lng-dLon],[lat+dLat,lng+dLon]];}
function showRadiusChip(label=''){let chip=document.getElementById('bts12RadiusChip');if(!chip){chip=document.createElement('div');chip.id='bts12RadiusChip';chip.className='bts12-radius-chip';document.body.appendChild(chip);}chip.textContent=label?`${label} • 10 km`:'Promień 10 km';}
function clearRadiusChip(){document.getElementById('bts12RadiusChip')?.remove();}
function focusRadius(lat,lng,label=''){setRadiusSelect();showRadiusChip(label);if(state.map){state.map.fitBounds(radiusBounds(lat,lng),{padding:[28,28],animate:true,maxZoom:14});}setTimeout(()=>scheduleRender(),180);}

scheduleRender=function(){if(renderTimer12)clearTimeout(renderTimer12);renderTimer12=setTimeout(()=>{renderTimer12=null;requestAnimationFrame(()=>renderMapAndList());},170);};

const originalExtras=renderSelectedStationExtras;
let lastExtrasKey='';
renderSelectedStationExtras=function(station){if(!station)return originalExtras(station);const key=stationKey(station);if(key===lastExtrasKey&&state?.sectorLayer?.getLayers?.().length)return;lastExtrasKey=key;return originalExtras(station);};

renderStationMarker=function(station){
  const z=state.map.getZoom();
  const selectedNow=state.selected&&stationKey(station)===stationKey(state.selected);
  const radius=(z<10?3:z<12?4:z<14?5:z<16?6:7)+(selectedNow?2:0);
  const ops=sharedOperatorsFor(station);
  let marker;
  if(ops.length>1||station.shared_site){
    const [c1,c2]=sharedColorPair(station),size=Math.max(10,radius*2+4);
    marker=L.marker([station.latitude,station.longitude],{icon:L.divIcon({className:'',html:`<div class="shared-bts-marker${selectedNow?' selected':''}" style="--c1:${c1};--c2:${c2};width:${size}px;height:${size}px"><span class="shared-map-badge">${ops.length}</span></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]}),keyboard:false,riseOnHover:true});
  }else{
    marker=L.circleMarker([station.latitude,station.longitude],{radius,color:'#fff',weight:z<12?1.3:1.8,fillColor:operatorColor(station.operator),fillOpacity:.92,renderer:getRenderer()||undefined});
  }
  marker.on('click',e=>{if(e?.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);selectStation(station,false,true);});
  marker.addTo(state.markerLayer);
};

renderMarkers=function(stations){
  state.markerLayer.clearLayers();
  if(!stations?.length)return;
  const bySite=new Map();
  for(const st of stations){const k=stationSiteKey(st);let g=bySite.get(k);if(!g){g={rep:st,ops:[]};bySite.set(k,g);}if(state.selected&&stationSiteKey(state.selected)===k)g.rep=state.selected;for(const op of sharedOperatorsFor(st))if(!g.ops.some(x=>normalizeText(x)===normalizeText(op)))g.ops.push(op);}
  const sites=Array.from(bySite.values()).map(g=>{g.rep._siteOperators=g.ops;return g.rep;});
  const z=state.map.getZoom();
  const limit=isMobileLayout()?(z<11?55:z<14?80:115):(z<11?150:z<14?260:380);
  const items=(sites.length>limit||z<13)?buildClusters(sites):sites.map(station=>({type:'station',station}));
  let rendered=0;for(const item of items){if(rendered>=limit)break;item.type==='cluster'?renderCluster(item):renderStationMarker(item.station);rendered++;}
};

function tabFor(station){return popupTabs.get(stationKey(station))||'bts';}
function bandsHtml(station){const bands=(station.bands||[]).slice(0,5);return bands.length?`<div class="bts12-bands">${bands.map(b=>`<span>${escapeHtml(b)}</span>`).join('')}</div>`:'<div class="bts12-bands"><span>brak pasm</span></div>';}
function cell(label,value){return `<div class="bts12-cell"><span>${escapeHtml(label)}</span><b>${escapeHtml(value||'—')}</b></div>`;}
function popupBody(station,tab){
  if(tab==='param'){
    const az=station.azimuths?.length?`${station.azimuths.slice(0,5).join('°, ')}°`:'—';
    const power=getBestPowerInfo(station)?formatPower(station):'—';
    const height=Number.isFinite(station.antenna_height_m)?`${station.antenna_height_m} m`:'—';
    return `<div class="bts12-grid">${cell('ID',String(station.station_id||'—'))}${cell('Moc',power)}${cell('Azymut',az)}${cell('Wysokość',height)}</div>`;
  }
  if(tab==='range'){
    const range=formatRangeShort(estimateStationRangeKm(station));
    const az=station.azimuths?.length?`${station.azimuths.slice(0,4).join('°, ')}°`:'—';
    return `<div class="bts12-range"><div><span>Zasięg</span><b>~${escapeHtml(range)}</b></div><div><span>Sektory</span><b>${escapeHtml(az)}</b></div></div><button class="bts12-terrain" type="button" data-bts12-terrain>⛰️ Teren / profil</button>`;
  }
  const share=sharedLabel(station);return `${bandsHtml(station)}${share?`<div class="bts12-share">${escapeHtml(share)}</div>`:''}`;
}

popupHtml=function(station){
  const o=getOrigin(),distance=haversineKm(o.lat,o.lng,station.latitude,station.longitude),bearing=azimuthDeg(o.lat,o.lng,station.latitude,station.longitude),tab=tabFor(station);
  return `<div class="bts12-card ${zoomClass()}" data-bts12-key="${escapeHtml(stationKey(station))}">
    <div class="bts12-head"><div class="bts12-title"><strong>${escapeHtml(station.city||'Stacja BTS')}</strong><small>${escapeHtml(station.address||`ID ${station.station_id}`)}</small></div><span class="bts12-op">${escapeHtml(station.operator)}</span></div>
    <div class="bts12-hero"><div><span>Odległość</span><strong>${escapeHtml(formatDistance(distance))}</strong></div><b>${Math.round(bearing)}°</b></div>
    <div class="bts12-tabs"><button class="${tab==='bts'?'active':''}" data-bts12-tab="bts">BTS</button><button class="${tab==='param'?'active':''}" data-bts12-tab="param">Parametry</button><button class="${tab==='range'?'active':''}" data-bts12-tab="range">Zasięg</button></div>
    <div class="bts12-body">${popupBody(station,tab)}</div>
  </div>`;
};

openStationPopup=function(station){
  if(!state.map||!window.L||!station)return;
  if(!state.stationPopup){state.stationPopup=L.popup({className:'bts-leaflet-popup',closeButton:false,autoPan:true,autoClose:true,closeOnClick:true,keepInView:true,maxWidth:270,minWidth:0,autoPanPadding:[14,100]});state.stationPopup.on('remove',()=>{if(!state.suppressPopupClose)state.selectedPopupOpen=false;});}
  state.selectedPopupOpen=true;state.suppressPopupClose=true;state.stationPopup.setLatLng([station.latitude,station.longitude]).setContent(popupHtml(station)).openOn(state.map);state.suppressPopupClose=false;
};

document.addEventListener('click',e=>{
  const tab=e.target.closest?.('[data-bts12-tab]');
  if(tab&&state.selected){e.preventDefault();e.stopPropagation();popupTabs.set(stationKey(state.selected),tab.dataset.bts12Tab);refreshStationPopupContent(state.selected);return;}
  const terrain=e.target.closest?.('[data-bts12-terrain]');
  if(terrain){e.preventDefault();e.stopPropagation();document.getElementById('btsTerrainFab')?.click();}
},true);

const baseRenderList=renderList;
renderList=function(){baseRenderList();const rows=el?.stationList?.querySelectorAll?.('.station-row')||[];rows.forEach(row=>{const st=state.currentList.find(x=>stationKey(x)===row.dataset.key),txt=st?sharedLabel(st):'';if(!txt)return;const meta=row.querySelector('.station-meta');if(meta&&!meta.querySelector('.shared-list-badge')){const b=document.createElement('span');b.className='badge shared-list-badge';b.textContent=txt;meta.prepend(b);}});};

showStationDetails=function(station){
  el.emptyDetails.classList.add('hidden');el.detailCard.classList.remove('hidden');
  const o=getOrigin(),d=haversineKm(o.lat,o.lng,station.latitude,station.longitude),b=azimuthDeg(o.lat,o.lng,station.latitude,station.longitude);
  el.detailTitle.textContent=`${station.operator} • ${station.station_id}`;el.detailSubtitle.textContent=station.city||station.address||'';
  el.detailBody.innerHTML=[distanceHero(d,b,getOriginLabel()),detailLine('Operator',station.operator),detailLine('ID',String(station.station_id||'—')),detailLine('Wspólnie',sharedLabel(station)||'—'),detailLine('Pasma',formatBands(station.bands)),detailLine('Moc',getBestPowerInfo(station)?formatPower(station):'—'),detailLine('Azymut',station.azimuths?.length?`${station.azimuths.join('°, ')}°`:'—'),detailLine('Wysokość',Number.isFinite(station.antenna_height_m)?`${station.antenna_height_m} m`:'—'),detailLine('Współrzędne',`${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`)].join('');
};

const baseSetMeasurePoint=setMeasurePoint;
setMeasurePoint=function(latlng,source='manual'){
  const r=baseSetMeasurePoint(latlng,source);
  setRadiusSelect();focusRadius(latlng.lat,latlng.lng,source==='gps'?'GPS':'Wybrany punkt');
  return r;
};
const baseClearMeasurePoint=clearMeasurePoint;
clearMeasurePoint=function(){const r=baseClearMeasurePoint();state.radiusKm=null;if(el?.radiusSelect)el.radiusSelect.value='';clearRadiusChip();return r;};

function technicalQuery(raw){
  const q=normalizeText(raw);
  if(/^\d{4,8}$/.test(q))return true;
  if(/\b(gsm|umts|lte|nr|5g|t-mobile|tmobile|orange|play|plus|aero2|cellnex|towerlink)\b/.test(q))return true;
  return state.stations.some(s=>normalizeText(s.station_id)===q);
}
function coordQuery(raw){const m=String(raw).trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);if(!m)return null;const lat=Number(m[1].replace(',','.')),lon=Number(m[2].replace(',','.'));return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon,label:'Współrzędne'}:null;}
async function geocodeNative(q){try{if(window.AndroidNative?.geocodeAddress){const raw=AndroidNative.geocodeAddress(q),arr=JSON.parse(raw||'[]');const a=Array.isArray(arr)?arr[0]:null;if(a&&Number.isFinite(+a.lat)&&Number.isFinite(+a.lon))return{lat:+a.lat,lon:+a.lon,label:a.label||q};}}catch(_){}return null;}
async function geocodeNominatim(q){for(const query of [q,`${q}, Polska`]){try{const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=pl&addressdetails=1&accept-language=pl&q=${encodeURIComponent(query)}`;const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)continue;const arr=await r.json();const a=Array.isArray(arr)?arr[0]:null;if(a&&Number.isFinite(+a.lat)&&Number.isFinite(+a.lon))return{lat:+a.lat,lon:+a.lon,label:a.display_name||q};}catch(_){}}return null;}
async function geocodePhoton(q){try{const r=await fetch(`https://photon.komoot.io/api/?limit=5&lang=pl&q=${encodeURIComponent(q)}`);if(!r.ok)return null;const j=await r.json(),f=j?.features?.find(x=>!x.properties?.countrycode||String(x.properties.countrycode).toLowerCase()==='pl')||j?.features?.[0];if(!f?.geometry?.coordinates)return null;const [lon,lat]=f.geometry.coordinates;const p=f.properties||{};return{lat:+lat,lon:+lon,label:[p.name,p.street,p.city,p.state].filter(Boolean).join(', ')||q};}catch(_){return null;}}
async function geocodeSmart(q){return coordQuery(q)||await geocodeNative(q)||await geocodeNominatim(q)||await geocodePhoton(q);}

const baseRunSearch=runSearch;
runSearch=async function(options={}){
  const raw=el.searchInput.value.trim();
  if(raw.length<2)return baseRunSearch(options);
  if(technicalQuery(raw))return baseRunSearch(options);
  setStatus('Szukam miejsca…');
  const place=await geocodeSmart(raw);
  if(!place)return baseRunSearch(options);
  try{window.AndroidNative?.stopNativeTracking?.();}catch(_){}
  if(state.gpsTracking)stopGpsTracking({clearGpsMeasure:false});
  state.search='';
  setMeasurePoint({lat:place.lat,lng:place.lon},'manual');
  const count=state.stations.filter(s=>haversineKm(place.lat,place.lon,s.latitude,s.longitude)<=RADIUS_KM&&matchesNonSpatialFilters(s)).length;
  setStatus(`${place.label} • ${count} BTS do 10 km`);
};

if(el?.searchInput)el.searchInput.placeholder='Adres, miejscowość lub BTS';

const baseLocateUser=locateUser;
locateUser=async function(){
  if(!window.AndroidNative?.startNativeTracking)return baseLocateUser();
  if(state.gpsTracking){try{AndroidNative.stopNativeTracking();}catch(_){}state.gpsTracking=false;state.userWatchId=null;if(state.measureSource==='gps'){state.measure=null;state.measureSource=null;state.radiusKm=null;clearRadiusChip();}updateGpsButtonState();updateMeasureMarker();scheduleRender();setStatus('GPS wyłączony.');return;}
  state.measure=null;state.measureSource=null;state.gpsTracking=true;state.userWatchId=null;nativeFirstFix=true;setRadiusSelect();updateGpsButtonState();setStatus('Ustalam dokładną pozycję GPS…');try{AndroidNative.startNativeCompass();AndroidNative.startNativeTracking();}catch(e){state.gpsTracking=false;updateGpsButtonState();setStatus('Nie udało się uruchomić GPS.');}
};

window.onNativeLocation=function(lat,lng,accuracy,bearing,speed,time){
  lat=+lat;lng=+lng;if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  state.gpsTracking=true;setRadiusSelect();
  const pos={coords:{latitude:lat,longitude:lng,accuracy:+accuracy>0?+accuracy:null,heading:+bearing>=0?+bearing:null,speed:+speed>=0?+speed:null},timestamp:+time||Date.now()};
  updateUserPosition(pos,false);
  if(nativeFirstFix){nativeFirstFix=false;focusRadius(lat,lng,'GPS');}
};
window.onNativeLocationError=function(msg){state.gpsTracking=false;updateGpsButtonState();setStatus(msg||'GPS niedostępny.');};
window.onNativeHeading=function(h){h=+h;if(!Number.isFinite(h))return;state.compassActive=true;state.compassHeading=h;state.compassSmoothedHeading=h;updateUserMarkerHeading();updateNavigationIndicator();};

})();
