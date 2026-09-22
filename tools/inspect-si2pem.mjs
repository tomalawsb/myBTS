const tests=['50101','51200'];
for(const ident of tests){
 const url='https://si2pem.gov.pl/geoserver/public/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=public:base_stations&outputFormat=application%2Fjson&CQL_FILTER='+encodeURIComponent(`identity_name='${ident}'`);
 try{
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}}),t=await r.text();
  console.log('\nWFS',ident,'STATUS',r.status,r.headers.get('content-type'));console.log(t.slice(0,8000));
  if(r.ok&&/json/i.test(r.headers.get('content-type')||'')){
   const j=JSON.parse(t),f=j.features?.[0];if(f){const id=String(f.id||'').split('.').pop();console.log('FEATURE ID',id,'PROPS',JSON.stringify(f.properties));
    for(const u of [`https://si2pem.gov.pl/all_installation_info/?base_station_id=${id}`,`https://si2pem.gov.pl/base_station/${id}/report/`]){
     const rr=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}});console.log('DETAIL',u,'STATUS',rr.status,'TYPE',rr.headers.get('content-type'),'URL',rr.url);const buf=await rr.arrayBuffer();console.log('BYTES',buf.byteLength,'HEAD',new TextDecoder().decode(buf.slice(0,5000)).replace(/\s+/g,' ').slice(0,4500));
    }
   }
  }
 }catch(e){console.log('ERR',ident,e.message)}
}
