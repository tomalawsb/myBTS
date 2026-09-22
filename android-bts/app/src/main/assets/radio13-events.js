'use strict';
function updatePopupAndCoverage13(){if(!state.selected)return;renderCoverage13(state.selected);refreshStationPopupContent(state.selected);}
document.addEventListener('click',ev=>{const tab=ev.target.closest?.('[data-bts13-tab]');if(tab&&state.selected){ev.preventDefault();ev.stopPropagation();popupTab13.set(stationKey13(state.selected),tab.dataset.bts13Tab);refreshStationPopupContent(state.selected);return;}const band=ev.target.closest?.('[data-bts13-band]');if(band&&state.selected){ev.preventDefault();ev.stopPropagation();const set=activeSet13(state.selected),b=band.dataset.bts13Band;if(set.has(b)){if(set.size>1)set.delete(b);}else set.add(b);updatePopupAndCoverage13();return;}if(ev.target.closest?.('[data-bts13-terrain]')){ev.preventDefault();ev.stopPropagation();document.getElementById('btsTerrainFab')?.click();return;}if(ev.target.closest?.('[data-bts13-update]')){ev.preventDefault();ev.stopPropagation();void updateFromUkeOnline({preserveSelected:true});return;}},true);

function hookUpdateButton13(){const btn=document.getElementById('ukeUpdateBtn');if(btn)btn.textContent='Aktualizuj bazę UKE';}
setTimeout(hookUpdateButton13,350);
setTimeout(()=>{try{if(el?.datasetInfo)el.datasetInfo.title='BTS Asystent PL 1.3 • UKE + SI2PEM + teren';if(state.selected)updatePopupAndCoverage13();}catch(_){}},650);
