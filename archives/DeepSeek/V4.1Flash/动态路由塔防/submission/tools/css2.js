const fs=require('fs');let p='index.html';let h=fs.readFileSync(p,'utf8');
h=h.replace(".map-card { position: relative; overflow: hidden; background: rgba(4,13,20,.82);", ".map-card { position: relative; overflow: hidden; background: rgba(4,13,20,.96);");
h=h.replace(".map-card .art::after { content: \"\"; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(4,13,20,.92), transparent 45%), linear-gradient(90deg, rgba(4,13,20,.5), transparent 40%); }", ".map-card .art::after { content: \"\"; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(4,13,20,.94), rgba(4,13,20,.1) 45%, transparent 70%), linear-gradient(90deg, rgba(4,13,20,.55), transparent 40%); }");
h=h.replace(".map-card .body { position: relative; padding: 1.2rem 1.3rem 3.8rem; z-index: 2; }", ".map-card .body { position: relative; padding: 1.2rem 1.3rem 3.8rem; z-index: 2; background: linear-gradient(180deg, rgba(4,13,20,.96), rgba(4,13,20,.99)); }");
fs.writeFileSync(p,h);
