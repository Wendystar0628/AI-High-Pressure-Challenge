const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("        demo.state = { begun: false, confirm: false, placed: false, destroyed: false };", "        demo.state = { begun: false, confirm: false, placed: false, destroyed: false, hidSel: false };");
s=s.replace("        } else if (st.placed) {\n          if (t < 6.2) demo.cursor = { x: demo.cursor.x + 2, y: demo.cursor.y - 1 };", "        } else if (st.placed) {\n          if (!st.hidSel && t >= 7.4) { st.hidSel = true; global.UI.hideSelection(); }\n          if (t < 6.2) demo.cursor = { x: demo.cursor.x + 2, y: demo.cursor.y - 1 };");
fs.writeFileSync(p,s);
