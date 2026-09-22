(() => {
'use strict';

const style = document.createElement('style');
style.textContent = `
/* BTS Asystent 1.1: lżejsza, responsywna warstwa mapy */
.bts-leaflet-popup .leaflet-popup-content-wrapper{border-radius:16px!important;overflow:hidden!important;box-shadow:0 12px 34px rgba(15,23,42,.22)!important}
.bts-leaflet-popup .leaflet-popup-content{width:auto!important;max-width:calc(100vw - 42px)!important;margin:0!important}
.bts-leaflet-popup .leaflet-popup-tip{box-shadow:none!important}
.bts-popup-lite{background:#fff;color:#172033;width:220px;max-width:calc(100vw - 42px);font-family:inherit}
.bts-popup-lite.far{width:176px}.bts-popup-lite.mid{width:202px}.bts-popup-lite.near{width:232px}
.bts-lite-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:start;padding:9px 10px 6px}
.bts-lite-head strong{font-size:13px;line-height:1.15;overflow-wrap:anywhere}.bts-lite-head small{display:block;margin-top:2px;color:#667085;font-size:10px;line-height:1.2}
.bts-op-badge{display:inline-flex;align-items:center;max-width:92px;padding:4px 7px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:9.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bts-share-badge{display:flex;align-items:center;gap:5px;margin:0 9px 6px;padding:5px 7px;border-radius:10px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;font-size:10px;font-weight:800;line-height:1.15}
.bts-share-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:conic-gradient(var(--c1) 0 50%,var(--c2) 50% 100%);box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.bts-lite-main{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin:0 9px 7px;padding:8px 9px;border-radius:12px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff}
.bts-lite-main span{display:block;color:rgba(255,255,255,.76);font-size:9px;font-weight:800;text-transform:uppercase}.bts-lite-main strong{display:block;font-size:19px;line-height:1}.bts-lite-main b{padding:4px 6px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px}
.bts-lite-bands{display:flex;gap:4px;flex-wrap:wrap;padding:0 9px 7px}.bts-lite-bands span{padding:3px 6px;border-radius:999px;background:#eef2f7;color:#475467;font-size:9.5px;font-weight:800}
.bts-lite-tech{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e7ebf0;border-top:1px solid #e7ebf0;border-bottom:1px solid #e7ebf0}.bts-lite-tech div{background:#fff;padding:5px 8px}.bts-lite-tech span{display:block;color:#667085;font-size:8.5px;font-weight:800;text-transform:uppercase}.bts-lite-tech b{display:block;margin-top:1px;font-size:9.5px;line-height:1.15;overflow-wrap:anywhere}
.bts-lite-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:7px 9px 9px}.bts-lite-actions button{min-height:30px;border:0;border-radius:10px;background:#e8f0ff;color:#1d4ed8;font-size:10px;font-weight:850}.bts-lite-actions button.terrain{background:#e7f8f4;color:#0f766e}
.bts-popup-lite.far .bts-lite-bands,.bts-popup-lite.far .bts-lite-tech{display:none}.bts-popup-lite.mid .bts-lite-tech{display:none}
.dark .bts-popup-lite{background:#182032;color:#edf2ff}.dark .bts-lite-head small{color:#a7b1c5}.dark .bts-lite-bands span{background:#202a3b;color:#d8e2f3}.dark .bts-lite-tech{background:#2a3547;border-color:#2a3547}.dark .bts-lite-tech div{background:#182032}.dark .bts-lite-tech span{color:#a7b1c5}.dark .bts-share-badge{background:#3d2813;color:#fdba74;border-color:#6b4420}
.shared-bts-marker{position:relative;border-radius:50%;background:conic-gradient(var(--c1) 0 50%,var(--c2) 50% 100%);border:2px solid #fff;box-shadow:0 3px 12px rgba(15,23,42,.28);will-change:transform}
.shared-bts-marker::after{content:'';position:absolute;inset:27%;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(15,23,42,.12)}
.shared-bts-marker.selected{box-shadow:0 0 0 3px rgba(15,118,110,.35),0 4px 16px rgba(15,23,42,.34)}
.shared-map-badge{position:absolute;right:-5px;top:-5px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:#172033;color:#fff;border:1px solid #fff;font-size:8px;font-weight:900;line-height:12px;text-align:center;z-index:2}
.shared-list-badge{background:#fff7ed!important;color:#9a3412!important;border:1px solid #fed7aa}
.dark .shared-list-badge{background:#3d2813!important;color:#fdba74!important;border-color:#6b4420}
#btsTerrainFab{width:48px!important;height:48px!important;padding:0!important;border-radius:999px!important;font-size:0!important;right:10px!important;bottom:72px!important;display:none}
#btsTerrainFab::after{content:'⛰️';font-size:21px}
@media(max-width:420px){.bts-popup-lite.near{width:218px}.bts-popup-lite.mid{width:194px}.bts-popup-lite.far{width:168px}.bts-lite-head{padding:8px 9px 5px}.bts-lite-main{margin:0 8px 6px;padding:7px 8px}.bts-lite-main strong{font-size:18px}.bts-lite-actions{padding:6px 8px 8px}}
`;
document.head.appendChild(style);

function sharedOperatorsFor(station){
  const out=[];
  const add=v=>{const t=String(v||'').trim();if(t&&!out.some(x=>normalizeText(x)===normalizeText(t)))out.push(t)};
  try{
    (station?._siteOperators||[]).forEach(add);
    splitOperators(station?.operator||'').forEach(add);
    (station?.shared_operators||[]).forEach(add);
  }catch(_){ }
  return out;
}
function partnerOperators(station){
  const own=new Set(splitOperators(station?.operator||'').map(normalizeText));
  return sharedOperatorsFor(station).filter(op=>!own.has(normalizeText(op)));
}
function stationSiteKey(station){return `${Number(station.latitude).toFixed(5)}|${Number(station.longitude).toFixed(5)}`;}
function zoomClass(){const z=state?.map?.getZoom?.()||13;return z<12?'far':z<15?'mid':'near';}
function sharedColorPair(station){
  const ops=sharedOperatorsFor(station);
  const first=ops[0]||station.operator||'Nieznany';
  const second=ops[1]||partnerOperators(station)[0]||first;
  return [operatorColor(first),operatorColor(second)];
}
function sharedLabel(station){
  const partners=partnerOperators(station);
  if(partners.length)return `Wspólnie: ${partners.join(', ')}`;
  const ops=sharedOperatorsFor(station);
  return ops.length>1?`Wspólna lokalizacja: ${ops.join(' + ')}`:'';
}

// Lżejsze odświeżanie: maksymalnie ~8 razy/s, a nie przy każdym drobnym zdarzeniu mapy/GPS.
let renderTimer11=null;
try{
  scheduleRender=function(){
    if(renderTimer11)clearTimeout(renderTimer11);
    renderTimer11=setTimeout(()=>{renderTimer11=null;requestAnimationFrame(()=>renderMapAndList());},120);
  };
}catch(_){ }

// Nie przeliczaj gradientu sektorów przy każdym przesunięciu mapy, jeśli wybrany BTS się nie zmienił.
try{
  const originalExtras=renderSelectedStationExtras;
  let lastExtras='';
  renderSelectedStationExtras=function(station){
    if(!station)return originalExtras(station);
    const key=stationKey(station);
    const hasLayers=state?.sectorLayer?.getLayers?.().length>0;
    if(key===lastExtras&&hasLayers)return;
    lastExtras=key;
    return originalExtras(station);
  };
}catch(_){ }

let canvasRenderer=null;
function getCanvasRenderer(){
  if(!canvasRenderer&&window.L?.canvas)canvasRenderer=L.canvas({padding:.45,tolerance:8});
  return canvasRenderer;
}

// Marker skaluje się z zoomem. Współdzielony obiekt jest dwukolorowy.
try{
  renderStationMarker=function(station){
    const z=state.map.getZoom();
    const selectedNow=state.selected&&stationKey(station)===stationKey(state.selected);
    const radius=(z<10?3:z<12?4:z<14?5:z<16?6:7)+(selectedNow?2:0);
    const ops=sharedOperatorsFor(station);
    let marker;
    if(ops.length>1||station.shared_site){
      const [c1,c2]=sharedColorPair(station);
      const size=Math.max(10,radius*2+4);
      marker=L.marker([station.latitude,station.longitude],{
        icon:L.divIcon({className:'',html:`<div class="shared-bts-marker${selectedNow?' selected':''}" style="--c1:${c1};--c2:${c2};width:${size}px;height:${size}px"><span class="shared-map-badge">${ops.length}</span></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]}),
        keyboard:false,
        riseOnHover:true
      });
    }else{
      marker=L.circleMarker([station.latitude,station.longitude],{radius,color:'#fff',weight:z<12?1.5:2,fillColor:operatorColor(station.operator),fillOpacity:.92,renderer:getCanvasRenderer()||undefined});
    }
    marker.on('click',event=>{if(event?.originalEvent)L.DomEvent.stopPropagation(event.originalEvent);selectStation(station,false,true);});
    marker.addTo(state.markerLayer);
  };
}catch(_){ }

// Na mapie jedna fizyczna lokalizacja = jeden marker. Lista nadal zachowuje rekordy operatorów osobno.
try{
  renderMarkers=function(stations){
    state.markerLayer.clearLayers();
    if(!stations?.length)return;
    const bySite=new Map();
    for(const st of stations){
      const k=stationSiteKey(st);
      let g=bySite.get(k);
      if(!g){g={rep:st,ops:[]};bySite.set(k,g);}
      if(state.selected&&stationSiteKey(state.selected)===k)g.rep=state.selected;
      for(const op of sharedOperatorsFor(st))if(!g.ops.some(x=>normalizeText(x)===normalizeText(op)))g.ops.push(op);
    }
    const sites=Array.from(bySite.values()).map(g=>{g.rep._siteOperators=g.ops;return g.rep;});
    const z=state.map.getZoom();
    const limit=isMobileLayout()?(z<11?70:z<14?100:135):(z<11?180:z<14?300:420);
    const shouldCluster=sites.length>limit||z<13;
    const items=shouldCluster?buildClusters(sites):sites.map(station=>({type:'station',station}));
    let rendered=0;
    for(const item of items){if(rendered>=limit)break;item.type==='cluster'?renderCluster(item):renderStationMarker(item.station);rendered++;}
  };
}catch(_){ }

// Kompaktowa karta: im mniejszy zoom, tym mniej zajmuje mapy.
try{
  popupHtml=function(station){
    const origin=getOrigin();
    const distance=haversineKm(origin.lat,origin.lng,station.latitude,station.longitude);
    const bearing=azimuthDeg(origin.lat,origin.lng,station.latitude,station.longitude);
    const zc=zoomClass();
    const partners=partnerOperators(station);
    const ops=sharedOperatorsFor(station);
    const [c1,c2]=sharedColorPair(station);
    const share=(partners.length||ops.length>1)?`<div class="bts-share-badge"><span class="bts-share-dot" style="--c1:${c1};--c2:${c2}"></span>${escapeHtml(sharedLabel(station))}</div>`:'';
    const bands=(station.bands||[]).slice(0,zc==='near'?4:2).map(b=>`<span>${escapeHtml(b)}</span>`).join('');
    const az=station.azimuths?.length?`${station.azimuths.slice(0,3).join('°, ')}°`:'brak';
    return `<div class="bts-popup-lite ${zc}">
      <div class="bts-lite-head"><div><strong>${escapeHtml(station.city||station.address||'Stacja BTS')}</strong><small>${escapeHtml(station.address||`ID ${station.station_id}`)}</small></div><span class="bts-op-badge">${escapeHtml(station.operator)}</span></div>
      ${share}
      <div class="bts-lite-main"><div><span>Odległość</span><strong>${escapeHtml(formatDistance(distance))}</strong></div><b>${Math.round(bearing)}°</b></div>
      <div class="bts-lite-bands">${bands}</div>
      <div class="bts-lite-tech"><div><span>Azymut sektora</span><b>${escapeHtml(az)}</b></div><div><span>Moc</span><b>${escapeHtml(getBestPowerInfo(station)?formatPower(station):'brak danych')}</b></div></div>
      <div class="bts-lite-actions"><button type="button" data-ui-action="details">Szczegóły</button><button class="terrain" type="button" data-ui-action="terrain">⛰️ Teren</button></div>
    </div>`;
  };
  openStationPopup=function(station){
    if(!state.map||!window.L||!station)return;
    if(!state.stationPopup){
      state.stationPopup=L.popup({className:'bts-leaflet-popup',closeButton:false,autoPan:true,autoClose:true,closeOnClick:true,keepInView:true,maxWidth:250,minWidth:0,autoPanPadding:[16,120]});
      state.stationPopup.on('remove',()=>{if(!state.suppressPopupClose)state.selectedPopupOpen=false;});
    }
    state.selectedPopupOpen=true;state.suppressPopupClose=true;
    state.stationPopup.setLatLng([station.latitude,station.longitude]).setContent(popupHtml(station)).openOn(state.map);
    state.suppressPopupClose=false;
  };
}catch(_){ }

document.addEventListener('click',event=>{
  const btn=event.target.closest?.('[data-ui-action]');
  if(!btn)return;
  event.preventDefault();event.stopPropagation();
  if(btn.dataset.uiAction==='details'){
    try{setTab('details');setPanelMode('half');}catch(_){ }
  }else if(btn.dataset.uiAction==='terrain'){
    document.getElementById('btsTerrainFab')?.click();
  }
},true);

// Po oryginalnym renderowaniu listy dopisz partnera współdzielonego obiektu.
try{
  const originalRenderList=renderList;
  renderList=function(){
    originalRenderList();
    const rows=el?.stationList?.querySelectorAll?.('.station-row')||[];
    rows.forEach(row=>{
      const station=state.currentList.find(item=>stationKey(item)===row.dataset.key);
      if(!station)return;
      const text=sharedLabel(station);
      if(!text)return;
      const meta=row.querySelector('.station-meta');
      if(meta&&!meta.querySelector('.shared-list-badge')){
        const badge=document.createElement('span');badge.className='badge shared-list-badge';badge.textContent=text;meta.prepend(badge);
      }
    });
  };
}catch(_){ }

// Mała legenda, tylko gdy użytkownik wybierze współdzieloną lokalizację.
function updateShareHint(){
  let hint=document.getElementById('btsShareHint');
  const s=state?.selected;
  const text=s?sharedLabel(s):'';
  if(!text){hint?.remove();return;}
  if(!hint){hint=document.createElement('div');hint.id='btsShareHint';Object.assign(hint.style,{position:'fixed',left:'10px',bottom:'72px',zIndex:'1450',maxWidth:'62vw',padding:'6px 9px',borderRadius:'999px',background:'rgba(255,255,255,.94)',color:'#172033',boxShadow:'0 6px 20px rgba(15,23,42,.18)',font:'800 10px system-ui'});document.body.appendChild(hint);}
  hint.textContent='◐ '+text;
}
try{
  const oldSelect=selectStation;
  selectStation=function(station,centerOnMap=true,openPopup=true){const r=oldSelect(station,centerOnMap,openPopup);setTimeout(updateShareHint,0);return r;};
  const oldHide=hideDetails;
  hideDetails=function(){const r=oldHide();updateShareHint();return r;};
}catch(_){ }

})();
