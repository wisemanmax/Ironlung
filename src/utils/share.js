// ─── Share Card Generator (Canvas API) ───
// roundRect polyfill for iOS < 16.1
if(typeof CanvasRenderingContext2D!=="undefined"&&!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    r=Math.min(r||0,w/2,h/2);this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.arcTo(x+w,y,x+w,y+r,r);
    this.lineTo(x+w,y+h-r);this.arcTo(x+w,y+h,x+w-r,y+h,r);this.lineTo(x+r,y+h);
    this.arcTo(x,y+h,x,y+h-r,r);this.lineTo(x,y+r);this.arcTo(x,y,x+r,y,r);this.closePath();
  };
}

export const ShareCard={
  generate:async(title,stats,subtitle)=>{
    const c=document.createElement("canvas");c.width=600;c.height=400;
    const ctx=c.getContext("2d");
    // Background
    const bg=ctx.createLinearGradient(0,0,600,400);bg.addColorStop(0,"#0e0e16");bg.addColorStop(1,"#1a1a2e");
    ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(0,0,600,400,24);ctx.fill();
    // Border
    ctx.strokeStyle="rgba(34,197,94,0.3)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(1,1,598,398,24);ctx.stroke();
    // IRONLOG brand
    ctx.font="bold 14px Inter,system-ui,sans-serif";ctx.fillStyle="rgba(255,255,255,0.4)";ctx.fillText("IRONLOG",24,36);
    // Title
    ctx.font="bold 28px Inter,system-ui,sans-serif";ctx.fillStyle="#e4e4e7";ctx.fillText(title,24,90);
    // Subtitle
    if(subtitle){ctx.font="14px Inter,system-ui,sans-serif";ctx.fillStyle="#71717a";ctx.fillText(subtitle,24,115);}
    // Stats grid
    const cols=Math.min(stats.length,3);const boxW=Math.floor((600-48-16*(cols-1))/cols);
    stats.forEach((s,i)=>{
      const col=i%cols;const row=Math.floor(i/cols);
      const x=24+col*(boxW+16);const y=140+row*100;
      ctx.fillStyle="rgba(255,255,255,0.03)";ctx.beginPath();ctx.roundRect(x,y,boxW,80,12);ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.06)";ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,y,boxW,80,12);ctx.stroke();
      ctx.font="bold 32px 'SF Mono',monospace";ctx.fillStyle=s.color||"#22c55e";ctx.fillText(s.value.toString(),x+16,y+42);
      ctx.font="bold 10px Inter,system-ui,sans-serif";ctx.fillStyle="#71717a";ctx.fillText(s.label.toUpperCase(),x+16,y+62);
    });
    // Date
    ctx.font="12px Inter,system-ui,sans-serif";ctx.fillStyle="#71717a";
    ctx.fillText(new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),24,380);
    return c;
  },
  share:async(canvas,filename)=>{
    // #E5: Wrap canvas.toBlob in a Promise — was declared async but used a callback API,
    // so all three await ShareCard.share(...) call sites returned before the share sheet appeared.
    return new Promise(resolve=>{
      canvas.toBlob(async blob=>{
        if(navigator.share&&blob){
          try{await navigator.share({files:[new File([blob],filename||"ironlog-share.png",{type:"image/png"})],title:"IRONLOG"});}
          catch(e){ShareCard.download(canvas,filename);}
        }else{ShareCard.download(canvas,filename);}
        resolve();
      },"image/png");
    });
  },
  download:(canvas,filename)=>{
    const url=canvas.toDataURL("image/png");const a=document.createElement("a");
    a.href=url;a.download=filename||"ironlog-share.png";a.click();
  },
};
