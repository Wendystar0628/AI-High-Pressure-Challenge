const fs=require('fs');
let p='js/models.js'; let s=fs.readFileSync(p,'utf8');
s=s.replace("g.fillStyle = '#0b1a24'; g.fillRect(0, 0, 256, 256);", "g.fillStyle = '#1c3e4e'; g.fillRect(0, 0, 256, 256);");
s=s.replace("g.strokeStyle = 'rgba(70,210,220,.20)'; g.lineWidth = 2;", "g.strokeStyle = 'rgba(120,245,235,.36)'; g.lineWidth = 2;");
s=s.replace("g.strokeStyle = 'rgba(70,210,220,.09)';", "g.strokeStyle = 'rgba(110,235,225,.16)';");
// Increase enemy silhouette scale
s=s.replace("root.scale.setScalar(0.88);", "root.scale.setScalar(1.32);");
s=s.replace("root.scale.setScalar(1.05);", "root.scale.setScalar(1.32);");
s=s.replace("root.scale.setScalar(0.95);\n    } else if (defId === 'ransomware')", "root.scale.setScalar(1.28);\n    } else if (defId === 'ransomware')");
s=s.replace("root.scale.setScalar(1.0);\n    } else if (defId === 'hotspot')", "root.scale.setScalar(1.2);\n    } else if (defId === 'hotspot')");
s=s.replace("root.scale.setScalar(1.0);\n    } else if (defId === 'packer')", "root.scale.setScalar(1.22);\n    } else if (defId === 'packer')");
s=s.replace("root.scale.setScalar(1.0);\n    } else if (defId === 'boss_wankui')", "root.scale.setScalar(1.25);\n    } else if (defId === 'boss_wankui')");
// towers a bit larger
s=s.replace("root.userData.parts = parts;\n    // shield bubble", "root.userData.parts = parts;\n    root.scale.setScalar(1.18);\n    // shield bubble");
fs.writeFileSync(p,s);
let q='js/ui.js'; let u=fs.readFileSync(q,'utf8');
u=u.replace("const s = Math.min(1.7, Math.max(0.82, innerWidth / 1920));\n      document.documentElement.style.fontSize = (16 * s) + 'px';", "const s = Math.min(1.7, Math.max(1.0, innerWidth / 1920));\n      document.documentElement.style.fontSize = (17.5 * s) + 'px';");
fs.writeFileSync(q,u);
