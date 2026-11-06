const{spawn}=require('node:child_process');const os=require('node:os');const path=require('node:path');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),['.', '--data-dir',path.join(os.tmpdir(),'nest-desktop-development'),'--width','1600','--height','1000','--remote-debugging-port=19156'],{env,stdio:'ignore',detached:true});
console.log(JSON.stringify({pid:child.pid,dataDir:path.join(os.tmpdir(),'nest-desktop-development')}));child.unref();
