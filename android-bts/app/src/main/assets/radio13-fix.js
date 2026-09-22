'use strict';

function hasNumber13(v){
  if(v===null||v===undefined)return false;
  if(typeof v==='string'&&v.trim()==='')return false;
  return Number.isFinite(Number(v));
}

radioEntries13=function(s){
  const raw=Array.isArray(s?.radio_sectors)?s.radio_sectors:[];
  const out=[];
  const push=e=>{
    if(!e)return;
    const band=e.band||e.pasmo||'Nieznane';
    const freq=hasNumber13(e.frequency_mhz)?Number(e.frequency_mhz):bandFreq13(band);
    let eirpDbm=hasNumber13(e.eirp_dbm)?Number(e.eirp_dbm):null;
    let erpDbw=hasNumber13(e.erp_dbw)?Number(e.erp_dbw):null;
    let eirpW=hasNumber13(e.eirp_w)?Number(e.eirp_w):null;
    if(eirpDbm===null&&eirpW!==null&&eirpW>0)eirpDbm=wToDbm13(eirpW);
    if(eirpDbm===null&&erpDbw!==null)eirpDbm=erpDbw+32.15;
    if(eirpW===null&&eirpDbm!==null)eirpW=dbmToW13(eirpDbm);
    out.push({
      band:String(band),
      frequency_mhz:freq,
      azimuth_deg:hasNumber13(e.azimuth_deg)?((Number(e.azimuth_deg)%360)+360)%360:null,
      erp_dbw:erpDbw,
      eirp_dbm:eirpDbm,
      eirp_w:eirpW,
      height_m:hasNumber13(e.height_m)?Number(e.height_m):null,
      tilt_deg:hasNumber13(e.tilt_deg)?Number(e.tilt_deg):null,
      range_km:hasNumber13(e.range_km)&&Number(e.range_km)>0?Number(e.range_km):null,
      source:String(e.source||s?.source||'baza')
    });
  };
  raw.forEach(push);

  const hasUseful=out.some(e=>e.eirp_dbm!==null||e.erp_dbw!==null||e.azimuth_deg!==null||e.height_m!==null||e.tilt_deg!==null||e.range_km!==null);
  if(!out.length||!hasUseful){
    out.length=0;
    const p=powerFromStation13(s);
    const azs=(s?.azimuths||[]).filter(v=>hasNumber13(v));
    const bearings=azs.length?azs:[null];
    for(const band of (s?.bands||['Nieznane'])){
      for(const az of bearings){
        push({
          band,
          frequency_mhz:bandFreq13(band),
          azimuth_deg:az,
          eirp_dbm:p?.eirpDbm??null,
          eirp_w:p?.watts??null,
          height_m:hasNumber13(s?.antenna_height_m)?Number(s.antenna_height_m):null,
          tilt_deg:hasNumber13(s?.tilt_deg)?Number(s.tilt_deg):null,
          range_km:hasNumber13(s?.range_km)?Number(s.range_km):null,
          source:s?.source||'baza'
        });
      }
    }
  }

  const seen=new Set();
  return out.filter(e=>{
    const k=[
      ntext(e.band),
      e.azimuth_deg===null?'x':Math.round(e.azimuth_deg*10),
      e.eirp_dbm===null?'x':Math.round(e.eirp_dbm*10),
      e.height_m===null?'x':Math.round(e.height_m*10),
      e.tilt_deg===null?'x':Math.round(e.tilt_deg*10)
    ].join('|');
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
};

quality13=function(s){
  const r=radioEntries13(s);
  const real=r.filter(e=>/SI2PEM|PEM|raport|UKE/i.test(e.source));
  const complete=real.some(e=>e.eirp_dbm!==null&&e.azimuth_deg!==null&&e.height_m!==null);
  if(complete)return{key:'exact',label:'dokładne'};
  const partial=r.some(e=>e.eirp_dbm!==null||e.erp_dbw!==null||e.azimuth_deg!==null||e.height_m!==null||e.tilt_deg!==null||e.range_km!==null);
  return partial?{key:'partial',label:'częściowe'}:{key:'estimate',label:'szacowane'};
};

powerText13=function(e){
  if(e&&e.eirp_dbm!==null&&Number.isFinite(e.eirp_dbm)){
    const w=e.eirp_w!==null&&Number.isFinite(e.eirp_w)?e.eirp_w:dbmToW13(e.eirp_dbm);
    return `${fmt(e.eirp_dbm,1)} dBm / ${w>=1000?fmt(w/1000,1)+' kW':fmt(w,0)+' W'}`;
  }
  if(e&&e.erp_dbw!==null&&Number.isFinite(e.erp_dbw))return `${fmt(e.erp_dbw,1)} dBW ERP`;
  return '—';
};

terrainBody13=function(s){
  const q=quality13(s);
  return `${bandButtons13(s)}<div class="bts13-grid">${cell13('Dane',q.label)}${cell13('Model','teren + Fresnel')}${cell13('DEM','Terrarium')}${cell13('Promień','do 10 km')}</div><button class="bts13-terrain-btn" data-bts13-terrain>⛰️ Profil / zasięg terenowy</button><div class="bts13-source">UKE aktualizuje lokalizacje i technologie. Moc, wysokość, azymut i tilt są używane tylko wtedy, gdy rzeczywiście występują w źródle technicznym lub raporcie SI2PEM; w przeciwnym razie zasięg jest oznaczony jako szacowany.</div>`;
};
