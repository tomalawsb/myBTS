(() => {
'use strict';
const style=document.createElement('style');
style.textContent=`
#bts14SearchHere{left:10px!important;top:calc(270px + env(safe-area-inset-top))!important}
#bts14Reopen{right:10px!important;top:calc(470px + env(safe-area-inset-top))!important}
@media(max-width:420px){
  #bts14SearchHere{top:calc(266px + env(safe-area-inset-top))!important}
  #bts14Reopen{top:calc(456px + env(safe-area-inset-top))!important}
}
`;
document.head.appendChild(style);
})();
