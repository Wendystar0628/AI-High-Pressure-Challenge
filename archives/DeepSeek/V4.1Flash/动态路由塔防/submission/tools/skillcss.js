const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
h=h.replace(".skill-btn.encrypted { border-color: rgba(200,110,255,.5); color: #d29bff; }", ".skill-btn.encrypted { border-color: rgba(200,110,255,.5); color: #d29bff; }\n  .skill-btn.cooling { color: transparent; }\n  .skill-btn.cooling .cd { color: #d8c2ff; }");
fs.writeFileSync('index.html',h);
