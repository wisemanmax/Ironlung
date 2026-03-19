export const Undo={
  _setItem:null,_setRemaining:null,_duration:6000,
  set:(label,item,type)=>{
    const entry={label,item,type,ts:Date.now()};
    if(Undo._timer)clearTimeout(Undo._timer);
    if(Undo._setItem)Undo._setItem(entry);
    if(Undo._setRemaining)Undo._setRemaining(Undo._duration);
    Undo._timer=setTimeout(()=>{if(Undo._setItem)Undo._setItem(null);if(Undo._setRemaining)Undo._setRemaining(0);},Undo._duration);
  },
  get:()=>null,  // kept for compat; state now held in React
  clear:()=>{if(Undo._timer)clearTimeout(Undo._timer);if(Undo._setItem)Undo._setItem(null);if(Undo._setRemaining)Undo._setRemaining(0);},
};
