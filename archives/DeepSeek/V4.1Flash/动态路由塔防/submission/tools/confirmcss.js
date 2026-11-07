const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
h=h.replace("  <div class=\"overlay\" id=\"overlay-confirm\" style=\"z-index:80\">", "  <div class=\"overlay\" id=\"overlay-confirm\" style=\"z-index:80\">");
h=h.replace("#screen-battle { pointer-events: none; }", "#overlay-confirm { background: rgba(2,7,11,.16); backdrop-filter: blur(1px); align-items: flex-start; justify-content: flex-end; padding: 9vh 3vw; }\n  #overlay-confirm .pause-panel { width: 28rem; }\n  #screen-battle { pointer-events: none; }");
fs.writeFileSync('index.html',h);
