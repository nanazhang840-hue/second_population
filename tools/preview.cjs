const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname,'..'));
const port = Number(process.argv[3] || 8040);
const previewURL='http://127.0.0.1:'+port+'/index.html';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
http.createServer((req,res) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname.includes('\u0000')) { res.writeHead(400); return res.end(); }
    file = path.resolve(root,'.' + pathname);
    if (file !== root && !file.toLowerCase().startsWith((root + path.sep).toLowerCase())) { res.writeHead(403); return res.end(); }
    if (pathname.endsWith('/')) file = path.join(file,'index.html');
  } catch { res.writeHead(400); return res.end(); }
  fs.stat(file,(err,stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const headers = {'Content-Type':types[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) { res.writeHead(416,{'Content-Range':'bytes */' + stat.size}); return res.end(); }
      start = range[1] ? Number(range[1]) : Math.max(0,stat.size-Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]),end) : end;
      if (start > end || start >= stat.size) { res.writeHead(416,{'Content-Range':'bytes */' + stat.size}); return res.end(); }
      status = 206;
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
    }
    headers['Content-Length'] = Math.max(0,end-start+1);
    res.writeHead(status,headers);
    if (req.method === 'HEAD' || stat.size === 0) return res.end();
    const stream = fs.createReadStream(file,{start,end});
    stream.on('error',() => res.destroy());
    res.on('close',() => stream.destroy());
    stream.pipe(res);
  });
}).on('error',error=>{
  if(error.code==='EADDRINUSE'&&process.argv.includes('--open')) return openPreview();
  console.error(error.message);
  process.exitCode=1;
}).listen(port,'127.0.0.1',()=>{
  console.log('Preview: '+previewURL);
  if(process.argv.includes('--open')) openPreview();
});

function openPreview(){
  const browser=require('node:child_process').spawn('cmd.exe',['/d','/c','start','',previewURL],{windowsHide:true,stdio:'ignore'});
  browser.on('error',()=>console.log('Open '+previewURL+' in your browser.'));
}
