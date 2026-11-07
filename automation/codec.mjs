// PNG/APNG and ZIP writer. Full RGBA frames; SOURCE blend prevents ghosting.
export const RULES={checked:'2026-11-06',counts:[8,16,24],maxBytes:1000000,maxZip:60000000};
const enc=new TextEncoder();
export const concat=(...a)=>{let r=new Uint8Array(a.reduce((n,x)=>n+x.length,0)),p=0;for(const x of a){r.set(x,p);p+=x.length}return r};
const be=(n,size=4)=>{let b=new Uint8Array(size);for(let i=size-1;i>=0;i--){b[i]=n&255;n=Math.floor(n/256)}return b};
export function crc32(a){let c=0xffffffff;for(const x of a){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
const chunk=(t,d)=>{const a=concat(enc.encode(t),d);return concat(be(d.length),a,be(crc32(a)))};
export function validate({width,height,frames,seconds,loops,bytes=0,kind='sticker',identical=false}){const e=[];
if(kind==='main'?(width!==240||height!==240):kind==='tab'?(width!==96||height!==74):(width>320||height>270||Math.max(width,height)<270))e.push('画像サイズが規格外です');
if(kind!=='tab'){if(frames<5||frames>20)e.push('5〜20コマが必要です');if(![1,2,3,4].includes(seconds))e.push('1周の再生時間は1〜4秒の整数です');if(!Number.isInteger(loops)||loops<1||loops>4||seconds*loops>4)e.push('ループ数・合計再生時間が規格外です');if(identical)e.push('全コマが同一です')}
if(bytes>RULES.maxBytes)e.push('1MBを超えています');return e}
export async function apng(frames,width,height,seconds=1,loops=2){if(!frames.length)throw Error('コマがありません');let seq=0;
let out=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',concat(be(width),be(height),new Uint8Array([8,6,0,0,0])))];
if(frames.length>1)out.push(chunk('acTL',concat(be(frames.length),be(loops))));
for(let k=0;k<frames.length;k++){if(frames[k].length!==width*height*4)throw Error('コマのサイズが一致しません');
if(frames.length>1)out.push(chunk('fcTL',concat(be(seq++),be(width),be(height),be(0),be(0),be(seconds,2),be(frames.length,2),new Uint8Array([0,0]))));
const raw=new Uint8Array(height*(width*4+1));for(let y=0;y<height;y++)raw.set(frames[k].subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
out.push(k===0?chunk('IDAT',compressed):chunk('fdAT',concat(be(seq++),compressed)))}out.push(chunk('IEND',new Uint8Array()));return concat(...out)}
const le=(n,s=4)=>be(n,s).reverse();
export function zip(files){let local=[],central=[],offset=0;for(const [name,data] of files){let n=enc.encode(name),c=crc32(data),h=concat(le(0x04034b50),le(20,2),le(0x800,2),le(0,2),le(0,2),le(33,2),le(c),le(data.length),le(data.length),le(n.length,2),le(0,2),n,data);local.push(h);central.push(concat(le(0x02014b50),le(20,2),le(20,2),le(0x800,2),le(0,2),le(0,2),le(33,2),le(c),le(data.length),le(data.length),le(n.length,2),le(0,2),le(0,2),le(0,2),le(0,2),le(0),le(offset),n));offset+=h.length}let cd=concat(...central);return concat(...local,cd,le(0x06054b50),le(0,2),le(0,2),le(files.length,2),le(files.length,2),le(cd.length),le(offset),le(0,2))}
export function inspect(frames,w,h){let warnings=[],centers=[],hashes=[];for(const a of frames){let n=0,xs=0,ys=0,transparent=0,edge=false;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let alpha=a[(y*w+x)*4+3];if(alpha===0)transparent++;if(alpha>32){n++;xs+=x;ys+=y;if(!x||!y||x===w-1||y===h-1)edge=true}}if(!n)warnings.push('空のコマがあります');if(!transparent)warnings.push('透過背景がありません');if(edge)warnings.push('端に接触：耳・足・尻尾の欠けを確認');centers.push([xs/(n||1),ys/(n||1)]);hashes.push(crc32(a))}
for(let i=1;i<centers.length;i++)if(Math.hypot(centers[i][0]-centers[i-1][0],centers[i][1]-centers[i-1][1])>Math.min(w,h)*.12)warnings.push('コマ間の位置ずれが大きい可能性');if(centers.length>1&&Math.hypot(centers[0][0]-centers.at(-1)[0],centers[0][1]-centers.at(-1)[1])>Math.min(w,h)*.1)warnings.push('ループ境界の位置ずれを確認');return {warnings:[...new Set(warnings)],identical:new Set(hashes).size===1,manual:['顔・毛色・画風の一貫性','左右の前足・余計な手足','不自然な透過・動き・ループを目視確認']}}
