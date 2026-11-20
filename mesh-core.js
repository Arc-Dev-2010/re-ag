/* Neural Grid MESH: original browser-first runtime. No third-party AI framework. */
(()=>{"use strict";
const VERSION="MESH-1.0.0",VOLUME_BYTES=1024;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const now=()=>globalThis.performance?.now?.()??Date.now();
const safeParse=(s,fallback)=>{try{return JSON.parse(s)||fallback}catch{return fallback}};
class VolumeManager{
 constructor(){this.volumes=new Map();this.next=1;this.bytesLive=0;this.peak=0;this.owners=new Map();this.free=[];this.poolLimit=2}
 allocate(owner,bytes=VOLUME_BYTES,label="workspace"){if(!owner||!Number.isFinite(bytes)||bytes<1)throw Error("Invalid allocation");const count=Math.ceil(bytes/VOLUME_BYTES),ids=[];for(let i=0;i<count;i++){const id=this.next++,buffer=this.free.pop()||new ArrayBuffer(VOLUME_BYTES);new Uint8Array(buffer).fill(0);this.volumes.set(id,{id,owner,label,buffer,refs:1,used:0,created:now()});ids.push(id);this.bytesLive+=VOLUME_BYTES}this.peak=Math.max(this.peak,this.bytesLive);this.owners.set(owner,(this.owners.get(owner)||0)+count);return {owner,label,ids,byteLength:count*VOLUME_BYTES,requested:bytes,released:false}}
 view(handle,index=0){if(!handle||handle.released)throw Error("Expired volume handle");const v=this.volumes.get(handle.ids[index]);if(!v||v.owner!==handle.owner)throw Error("Volume ownership violation");return new Uint8Array(v.buffer)}
 release(handle){if(!handle||handle.released)return false;for(const id of handle.ids){const v=this.volumes.get(id);if(v&&v.owner===handle.owner){this.volumes.delete(id);this.bytesLive-=VOLUME_BYTES;this.owners.set(handle.owner,Math.max(0,(this.owners.get(handle.owner)||1)-1));if(this.free.length<this.poolLimit){new Uint8Array(v.buffer).fill(0);this.free.push(v.buffer)}}}handle.released=true;return true}
 stats(){return {segments:this.volumes.size,liveBytes:this.bytesLive,pooledBytes:this.free.length*VOLUME_BYTES,reservedBytes:this.bytesLive+this.free.length*VOLUME_BYTES,peakBytes:this.peak,volumeBytes:VOLUME_BYTES,owners:Object.fromEntries(this.owners)}}
}
class CacheManager{
 constructor(cacheName="reag-mesh-v3"){this.cacheName=cacheName}
 async inspect(){if(!("caches"in window))return {supported:false,count:0,urls:[]};try{const keys=await caches.keys(),cache=await caches.open(this.cacheName),reqs=await cache.keys();return {supported:true,cacheName:this.cacheName,cacheCount:keys.length,count:reqs.length,urls:reqs.map(r=>new URL(r.url).pathname)}}catch{return {supported:false,count:0,urls:[]}}}
 async refresh(paths){if(!("caches"in window))return false;const cache=await caches.open(this.cacheName);for(const path of paths){try{const response=await fetch(path,{cache:"reload"});if(response.ok)await cache.put(path,response)}catch{}}return true}
}class Initiator{
 constructor(){this.active=new Set(["initiator"]);this.tasks=0;this.lastTask=null;this.boardMap=Array.from({length:9},(_,i)=>({index:i,row:Math.floor(i/3),col:i%3,x:(i%3+.5)/3,y:(Math.floor(i/3)+.5)/3}))}
 wake(name){this.active.add(name);return true} sleep(name){if(name!=="initiator"&&name!=="memory")this.active.delete(name)} async dispatch(name,fn){this.wake(name);this.tasks++;this.lastTask={agent:name,at:Date.now()};try{return await fn()}finally{this.sleep(name)}} coordinate(index){return this.boardMap[index]||null}
}
class MemoryAgent{
 constructor(pool){this.pool=pool;this.leases=new Map();this.next=1}
 reserve(owner,bytes,label){const h=this.pool.allocate(owner,bytes,label),id=this.next++;this.leases.set(id,h);return {id,owner,bytes:h.byteLength,label}}
 release(id){const h=this.leases.get(id);if(!h)return false;this.leases.delete(id);return this.pool.release(h)}
 releaseOwner(owner){for(const [id,h] of this.leases)if(h.owner===owner)this.release(id)}
}
class TinyNeuralMap{
 constructor(){this.nIn=9;this.nHidden=16;this.nOut=9;this.w1=new Float32Array(this.nIn*this.nHidden);this.b1=new Float32Array(this.nHidden);this.w2=new Float32Array(this.nHidden*this.nOut);this.b2=new Float32Array(this.nOut);this.rate=.035;this.samples=0;this.seed();this.load()}
 seed(){let s=0x6d2b79f5;const rnd=()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};for(let i=0;i<this.w1.length;i++)this.w1[i]=(rnd()-.5)*.35;for(let i=0;i<this.w2.length;i++)this.w2[i]=(rnd()-.5)*.25}
 encode(board){return board.map(v=>v==="X"?1:v==="O"?-1:0)}
 forward(input){const h=new Float32Array(this.nHidden),out=new Float32Array(this.nOut);for(let j=0;j<this.nHidden;j++){let z=this.b1[j];for(let i=0;i<this.nIn;i++)z+=input[i]*this.w1[i*this.nHidden+j];h[j]=Math.tanh(z)}for(let k=0;k<this.nOut;k++){let z=this.b2[k];for(let j=0;j<this.nHidden;j++)z+=h[j]*this.w2[j*this.nOut+k];out[k]=z}return {h,out}}
 predict(board){const {out}=this.forward(this.encode(board));const max=Math.max(...out),exp=out.map(v=>Math.exp(clamp(v-max,-18,18))),sum=exp.reduce((a,b)=>a+b,0)||1;return exp.map(v=>v/sum)}
 train(board,chosen,legal){if(chosen<0||chosen>8)return;const x=this.encode(board),{h,out}=this.forward(x),mask=out.map((_,i)=>legal.includes(i));if(!mask[chosen])return;const probs=this.predict(board),delta=probs.map((p,i)=>mask[i]?p-(i===chosen?1:0):0),dh=new Float32Array(this.nHidden);for(let j=0;j<this.nHidden;j++){for(let k=0;k<this.nOut;k++)this.w2[j*this.nOut+k]-=this.rate*clamp(delta[k],-1,1)*h[j];}for(let j=0;j<this.nHidden;j++){let g=0;for(let k=0;k<this.nOut;k++)g+=delta[k]*this.w2[j*this.nOut+k];dh[j]=g*(1-h[j]*h[j]);}for(let j=0;j<this.nHidden;j++){this.b1[j]-=this.rate*dh[j];for(let i=0;i<this.nIn;i++)this.w1[i*this.nHidden+j]-=this.rate*dh[j]*x[i]}for(let k=0;k<this.nOut;k++)this.b2[k]-=this.rate*delta[k];this.samples++}
 serial(){return {version:1,w1:Array.from(this.w1),b1:Array.from(this.b1),w2:Array.from(this.w2),b2:Array.from(this.b2),samples:this.samples}}
 load(){const d=safeParse(localStorage.getItem("ng-microbrain-v1"),null);if(d?.version===1&&d.w1?.length===this.w1.length&&d.w2?.length===this.w2.length){this.w1.set(d.w1);this.b1.set(d.b1);this.w2.set(d.w2);this.b2.set(d.b2);this.samples=d.samples||0}}
 save(){try{localStorage.setItem("ng-microbrain-v1",JSON.stringify(this.serial()))}catch{}}
}
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function result(b){for(const line of wins){const [a,c,d]=line;if(b[a]&&b[a]===b[c]&&b[a]===b[d])return {winner:b[a],line}}return b.every(Boolean)?{winner:"draw",line:[]}:null}
function minimax(b,max,alpha,beta,depth){const r=result(b);if(r)return r.winner==="O"?10-depth:r.winner==="X"?depth-10:0;if(max){let best=-Infinity;for(let i=0;i<9;i++)if(!b[i]){b[i]="O";best=Math.max(best,minimax(b,false,alpha,beta,depth+1));b[i]="";alpha=Math.max(alpha,best);if(beta<=alpha)break}return best}let best=Infinity;for(let i=0;i<9;i++)if(!b[i]){b[i]="X";best=Math.min(best,minimax(b,true,alpha,beta,depth+1));b[i]="";beta=Math.min(beta,best);if(beta<=alpha)break}return best}
class LearningAgent{
 constructor(){this.net=new TinyNeuralMap();this.games=0;this.profile=safeParse(localStorage.getItem("ng-opponent-profile-v1"),{moves:Array(9).fill(0),openings:{},samples:0})}
 observe(boardBefore,move){const legal=boardBefore.map((v,i)=>v?null:i).filter(v=>v!==null);this.net.train(boardBefore,move,legal);this.profile.moves[move]=(this.profile.moves[move]||0)+1;const key=boardBefore.map(v=>v||"-").join("");this.profile.openings[key]=(this.profile.openings[key]||0)+1;this.profile.samples++;this.net.save();this.persist()}
 probabilities(board){const p=this.net.predict(board);const total=this.profile.moves.reduce((a,b)=>a+b,0);return p.map((v,i)=>v+(total?this.profile.moves[i]/total*.12:0))}
 persist(){try{localStorage.setItem("ng-opponent-profile-v1",JSON.stringify(this.profile))}catch{}}
}
class StrategyAgent{
 choose(board,learning){const legal=board.map((v,i)=>v?null:i).filter(v=>v!==null);if(!legal.length)return -1;let best=-Infinity,candidates=[];for(const i of legal){board[i]="O";const score=minimax(board,false,-Infinity,Infinity,0);board[i]="";if(score>best){best=score;candidates=[i]}else if(score===best)candidates.push(i)}if(candidates.length===1)return candidates[0];const probs=learning.probabilities(board);return candidates.sort((a,b)=>probs[b]-probs[a])[0]}
}
class CodeAgent{
 generate(prompt){const p=String(prompt||"").toLowerCase(),tokens={accent:p.includes("purple")?"#a99bff":p.includes("pink")?"#ff83b7":p.includes("green")?"#9ed59b":"#65e6db",radius:p.includes("sharp")?"10px":p.includes("round")?"24px":"18px",density:p.includes("compact")?"12px":"20px",glass:p.includes("glass")||p.includes("transparent"),glow:p.includes("glow")||p.includes("neon"),dark:!(p.includes("light")||p.includes("bright"))};
 let title=p.includes("profile")?"Profile card":p.includes("welcome")||p.includes("hero")?"Welcome panel":p.includes("announcement")||p.includes("banner")?"Announcement banner":"Personal UI panel";
 const html=`<main class="ng-user-card"><div class="eyebrow">RE-AG? · PERSONAL SPACE</div><h1>${title}</h1><p>Your interface, arranged your way.</p><button id="action">Explore</button></main>`;
 const css=`*{box-sizing:border-box}body{margin:0;padding:24px;background:${tokens.dark?"#0b1020":"#f4f6fa"};font-family:system-ui;color:${tokens.dark?"#edf4ff":"#182235"}}.ng-user-card{padding:${tokens.density};border-radius:${tokens.radius};background:${tokens.glass?(tokens.dark?"#16233acc":"#ffffffbb"):(tokens.dark?"#17243a":"#fff")};border:1px solid ${tokens.dark?"#344763":"#dce3ef"};${tokens.glow?`box-shadow:0 0 28px ${tokens.accent}55;`:""}max-width:520px;margin:auto}.eyebrow{font-size:10px;letter-spacing:.16em;color:${tokens.accent};font-weight:800}.ng-user-card h1{font-size:30px;letter-spacing:-1px;margin:14px 0 5px}.ng-user-card p{opacity:.7}.ng-user-card button{border:0;border-radius:12px;background:${tokens.accent};color:#07131d;font-weight:800;padding:11px 16px}`;
 const js=`document.getElementById("action")?.addEventListener("click",()=>{document.querySelector("h1").textContent="Customized just for you."});`;
 const theme={accent:tokens.accent,radius:tokens.radius,density:tokens.density,dark:tokens.dark,glass:tokens.glass,glow:tokens.glow};
 return {title,html,css,js,theme,description:"Generated from a constrained set of UI design instructions. Edit the code, preview it in isolation, then save your personal theme."}}
}
class MeshRuntime{
 constructor(){this.pool=new VolumeManager();this.memory=new MemoryAgent(this.pool);this.initiator=new Initiator();this.learning=new LearningAgent();this.strategy=new StrategyAgent();this.code=new CodeAgent();this.cache=new CacheManager();this.lastWake=0}
 async run(agent,fn){return this.initiator.dispatch(agent,async()=>{const lease=this.memory.reserve(agent,1024,agent+"-scratch");try{return await fn()}finally{this.memory.release(lease.id)}})}
 status(){return {version:VERSION,agents:[{id:"initiator",name:"Initiator",active:this.initiator.active.has("initiator")},{id:"memory",name:"Memory Manager",active:true},{id:"learning",name:"Learning Agent",active:this.initiator.active.has("learning")},{id:"strategy",name:"Strategy Agent",active:this.initiator.active.has("strategy")},{id:"code",name:"Code Agent",active:this.initiator.active.has("code")}],memory:this.pool.stats(),learningSamples:this.learning.net.samples,opponentMoves:this.learning.profile.samples}}
}
const runtime=new MeshRuntime();
window.NeuralGrid={runtime,VERSION,VOLUME_BYTES,result,wins};
})();
