const fs=require('fs');let h=fs.readFileSync('index.html','utf8');h=h.replace('@media (max-width: 1500px) {','@media (max-width: 1660px) {');fs.writeFileSync('index.html',h);
