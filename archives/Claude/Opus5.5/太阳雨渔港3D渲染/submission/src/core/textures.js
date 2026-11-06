import * as THREE from 'three';
import { rand, rr } from './G.js';

const JP = '"Yu Gothic UI","Yu Gothic","Meiryo","MS Gothic","Microsoft YaHei",sans-serif';
const JPM = '"Yu Mincho","MS Mincho","Hiragino Mincho ProN","SimSun",serif';

export function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  t.userData.canvas = c;
  return t;
}

// weathering helpers
function stains(g, w, h, n = 20, col = 'rgba(120,90,60,', a = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w, y = rand() * h, r = rr(0.05, 0.25) * Math.max(w, h);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col + a + ')');
    gr.addColorStop(1, col + '0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }
}
function speckle(g, w, h, n = 400, col = 'rgba(0,0,0,0.08)') {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) g.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3));
}
function rustDrips(g, w, h, n = 6) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w, y0 = rand() * h * 0.3, len = rr(0.2, 0.6) * h;
    const gr = g.createLinearGradient(x, y0, x, y0 + len);
    gr.addColorStop(0, 'rgba(150,80,40,0.35)');
    gr.addColorStop(1, 'rgba(150,80,40,0)');
    g.fillStyle = gr;
    g.fillRect(x, y0, rr(2, 6), len);
  }
}
function fade(g, w, h, a = 0.18) {
  g.fillStyle = `rgba(245,245,240,${a})`;
  g.fillRect(0, 0, w, h);
}

export function makeTextures() {
  const TX = {};

  // harbour sign: port name + "注意落水"
  TX.portSign = canvasTex(1024, 640, (g, w, h) => {
    g.fillStyle = '#f2f0e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f5f8b'; g.fillRect(0, 0, w, 300);
    g.fillStyle = '#fff'; g.font = `bold 150px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('汐見漁港', w / 2, 140);
    g.font = `bold 40px ${JP}`; g.fillText('SHIOMI  FISHING  PORT', w / 2, 255);
    // warning band
    g.fillStyle = '#d23a2a'; g.fillRect(0, 300, w, 210);
    g.fillStyle = '#fff'; g.font = `bold 150px ${JP}`;
    g.fillText('注意落水', w / 2 + 70, 410);
    // pictogram: falling figure into waves
    g.fillStyle = '#fff'; g.beginPath(); g.arc(110, 360, 28, 0, Math.PI * 2); g.fill();
    g.lineWidth = 18; g.strokeStyle = '#fff'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(120, 395); g.lineTo(160, 455); g.moveTo(140, 420); g.lineTo(90, 430); g.moveTo(140, 420); g.lineTo(190, 400); g.moveTo(160, 455); g.lineTo(130, 490); g.moveTo(160, 455); g.lineTo(200, 480); g.stroke();
    g.lineWidth = 8; g.beginPath();
    for (let x = 40; x < 260; x += 40) { g.moveTo(x, 500); g.quadraticCurveTo(x + 10, 488, x + 20, 500); g.quadraticCurveTo(x + 30, 512, x + 40, 500); }
    g.stroke();
    g.fillStyle = '#333'; g.font = `bold 48px ${JP}`;
    g.fillText('岸壁で遊ばないでください', w / 2, 570);
    g.font = `30px ${JP}`; g.fillText('汐見漁業協同組合', w / 2, 618);
    fade(g, w, h, 0.22);
    stains(g, w, h, 18);
    rustDrips(g, w, h, 9);
    speckle(g, w, h, 900);
  });

  // auction price blackboard
  TX.blackboard = canvasTex(1024, 720, (g, w, h) => {
    g.fillStyle = '#28433a'; g.fillRect(0, 0, w, h);
    stains(g, w, h, 12, 'rgba(255,255,255,', 0.05);
    g.fillStyle = 'rgba(240,240,230,0.92)'; g.textBaseline = 'middle';
    g.font = `bold 72px ${JP}`; g.textAlign = 'left';
    g.fillText('本日のセリ値', 60, 80);
    g.font = `36px ${JP}`; g.fillText('10/30 (木)', 700, 86);
    g.strokeStyle = 'rgba(240,240,230,0.7)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(50, 135); g.lineTo(970, 135); g.stroke();
    const rows = [['アジ', '1,200', '箱'], ['サバ', '850', '箱'], ['イカ', '1,600', 'kg'], ['マダイ', '2,800', 'kg'], ['カワハギ', '980', 'kg'], ['タコ', '1,850', 'kg'], ['イワシ', '600', '箱']];
    rows.forEach((r, i) => {
      const y = 190 + i * 74;
      g.font = `56px ${JP}`; g.fillStyle = 'rgba(245,245,235,0.9)'; g.fillText(r[0], 80, y);
      g.textAlign = 'right'; g.fillStyle = i === 3 ? 'rgba(255,214,120,0.95)' : 'rgba(245,245,235,0.9)';
      g.fillText(r[1], 760, y); g.textAlign = 'left';
      g.font = `40px ${JP}`; g.fillStyle = 'rgba(245,245,235,0.75)'; g.fillText('円/' + r[2], 790, y + 4);
    });
    g.fillStyle = 'rgba(255,170,170,0.85)'; g.font = `40px ${JP}`;
    g.fillText('※ 次回セリ 午前5時', 80, 700);
    // chalk dust smudges
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${rr(0.02, 0.06)})`; g.fillRect(rand() * w, rand() * h, rr(30, 160), rr(6, 30)); }
    // frame
    g.strokeStyle = '#8a6a44'; g.lineWidth = 26; g.strokeRect(0, 0, w, h);
  });

  // ferry timetable (faded)
  TX.timetable = canvasTex(768, 1024, (g, w, h) => {
    g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f6d9e'; g.fillRect(0, 0, w, 150);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold 64px ${JP}`; g.fillText('定期船 時刻表', w / 2, 75);
    g.fillStyle = '#333'; g.font = `bold 44px ${JP}`;
    g.fillText('汐見 ⇄ 小島', w / 2, 210);
    g.font = `bold 38px ${JP}`;
    g.fillStyle = '#b8403a'; g.fillText('汐見 発', w * 0.28, 290); g.fillStyle = '#2f6d9e'; g.fillText('小島 発', w * 0.72, 290);
    g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 260); g.lineTo(w / 2, 900); g.stroke();
    const a = ['6:40', '8:15', '10:30', '12:50', '15:20', '17:05', '18:40'];
    const b = ['7:25', '9:10', '11:35', '13:55', '16:10', '17:50', '19:20'];
    g.fillStyle = '#222'; g.font = `52px ${JP}`;
    a.forEach((t, i) => { g.fillText(t, w * 0.28, 370 + i * 76); g.fillText(b[i], w * 0.72, 370 + i * 76); });
    g.font = `30px ${JP}`; g.fillStyle = '#555';
    g.fillText('※ 荒天時は欠航となります', w / 2, 950);
    fade(g, w, h, 0.3);
    stains(g, w, h, 14, 'rgba(170,140,80,', 0.1);
    speckle(g, w, h, 500, 'rgba(120,100,60,0.08)');
  });

  // vending machine front panel
  TX.vending = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#e8eef2'; g.fillRect(0, 0, w, h);
    // display window
    g.fillStyle = '#fbfdff'; g.fillRect(24, 40, w - 48, 520);
    const cols = ['#d83a33', '#2d6fc4', '#f2b134', '#3aa65a', '#7a4a2a', '#e86fa0', '#f5f5f5', '#1a1a1a'];
    for (let row = 0; row < 3; row++) {
      const y = 70 + row * 165;
      g.fillStyle = row === 2 ? '#d84a3a' : '#2e7fd0';
      g.fillRect(34, y + 128, w - 68, 22);
      g.fillStyle = '#fff'; g.font = `bold 16px ${JP}`; g.textAlign = 'center';
      g.fillText(row === 2 ? 'あったか〜い' : 'つめた〜い', w / 2, y + 145);
      for (let k = 0; k < 6; k++) {
        const x = 48 + k * 72;
        const c = cols[(row * 3 + k * 5) % cols.length];
        const can = (row + k) % 3 !== 0;
        g.fillStyle = c;
        if (can) { g.fillRect(x, y + 30, 42, 90); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 6, y + 30, 6, 90); g.fillStyle = '#ccc'; g.fillRect(x, y + 26, 42, 6); }
        else { g.fillRect(x + 6, y + 40, 30, 80); g.fillRect(x + 13, y + 16, 16, 26); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 8, y + 60, 26, 22); }
        g.fillStyle = '#222'; g.font = `bold 14px ${JP}`; g.fillText(['120', '130', '150', '160'][(row + k) % 4], x + 21, y + 160 - 40 + 0);
      }
    }
    // buttons
    g.fillStyle = '#c9d3da'; g.fillRect(24, 580, w - 48, 30);
    // logo band
    g.fillStyle = '#1f6fb8'; g.fillRect(0, 630, w, 120);
    g.fillStyle = '#fff'; g.font = `bold 60px ${JP}`; g.textAlign = 'center'; g.fillText('しおみ水', w / 2, 708);
    // coin slot & outlet
    g.fillStyle = '#9aa6ae'; g.fillRect(360, 780, 110, 120); g.fillStyle = '#333'; g.fillRect(400, 800, 30, 8);
    g.fillStyle = '#2b2f33'; g.fillRect(40, 930, 300, 70);
    g.fillStyle = '#556'; g.fillRect(50, 940, 280, 50);
    rustDrips(g, w, h, 5);
    speckle(g, w, h, 300);
  });

  // nautical chart on clipboard
  TX.chart = canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#f2ead2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfe4e6'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.55); g.bezierCurveTo(w * 0.6, h * 0.7, w * 0.4, h * 0.45, 0, h * 0.6); g.fill();
    g.strokeStyle = 'rgba(40,90,140,0.6)'; g.lineWidth = 2;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, h * 0.6 - k * 40); g.bezierCurveTo(w * 0.4, h * 0.45 - k * 40, w * 0.6, h * 0.7 - k * 40, w, h * 0.55 - k * 40); g.stroke(); }
    g.fillStyle = '#2a4f7a'; g.font = `18px ${JP}`;
    for (let i = 0; i < 40; i++) g.fillText(String(Math.floor(rr(3, 60))), rand() * w, rand() * h * 0.55);
    g.strokeStyle = '#b8403a'; g.lineWidth = 3; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(80, 520); g.lineTo(220, 300); g.lineTo(420, 120); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#333'; g.font = `bold 34px ${JP}`; g.fillText('汐見湾', 300, 600);
    // clip
    g.fillStyle = '#888'; g.fillRect(w / 2 - 60, 0, 120, 30);
  });
  TX.tide = canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#fbfaf3'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f6d9e'; g.font = `bold 46px ${JP}`; g.textAlign = 'center'; g.fillText('潮汐表 10月', w / 2, 70);
    g.strokeStyle = '#2f6d9e'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= w; x += 4) { const y = 200 + Math.sin(x / w * Math.PI * 4) * 60; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#333'; g.font = `26px ${JP}`; g.textAlign = 'left';
    for (let i = 0; i < 9; i++) g.fillText(`${20 + i}日  満 ${5 + (i % 4)}:${(i * 7) % 60}`.padEnd(14) + `  干 ${11 + (i % 3)}:${(i * 13) % 60}`, 30, 320 + i * 34);
    g.fillStyle = '#888'; g.fillRect(w / 2 - 60, 0, 120, 26);
  });
  // catch photos
  TX.photo = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 10, 0, h - 30); gr.addColorStop(0, '#8cc9e8'); gr.addColorStop(1, '#2d7aa6');
    g.fillStyle = gr; g.fillRect(10, 10, w - 20, h - 40);
    g.fillStyle = '#c94f3c'; g.beginPath(); g.ellipse(w / 2, h / 2 - 8, 80, 30, -0.15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(w / 2 + 70, h / 2 - 20); g.lineTo(w / 2 + 110, h / 2 - 45); g.lineTo(w / 2 + 108, h / 2 + 15); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 - 55, h / 2 - 14, 6, 0, 7); g.fill();
    g.fillStyle = '#333'; g.font = `18px ${JP}`; g.fillText('マダイ 4.2kg', 14, h - 10);
  });
  TX.photo2 = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0e2c0'; g.fillRect(10, 10, w - 20, h - 40);
    g.fillStyle = '#7b9cb0';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(60 + i * 35, 70 + (i % 2) * 30, 30, 10, 0.3, 0, 7); g.fill(); }
    g.fillStyle = '#333'; g.font = `18px ${JP}`; g.fillText('大漁！ 9.12', 14, h - 10);
  });
  // omamori (charm)
  TX.omamori = canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = '#c0282d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8c35a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#f2d36b'; g.font = `bold 40px ${JPM}`; g.textAlign = 'center';
    g.fillText('大', w / 2, 70); g.fillText('漁', w / 2, 115); g.font = `bold 22px ${JPM}`; g.fillText('守', w / 2, 160);
  });
  // radio dial
  TX.radio = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#333'; g.font = `14px ${JP}`;
    for (let i = 0; i < 9; i++) { const x = 16 + i * 28; g.fillRect(x, 50, 2, 16); g.fillText(String(53 + i * 13), x - 6, 86); }
    g.fillStyle = '#c33'; g.fillRect(120, 30, 3, 50);
    g.fillStyle = '#333'; g.font = `bold 16px ${JP}`; g.fillText('AM  kHz×10', 70, 115);
  });
  // wall clock face
  TX.clock = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fbfaf5'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.fillStyle = '#222'; g.font = `bold 30px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; g.fillText(String(i), 128 + Math.sin(a) * 98, 128 - Math.cos(a) * 98); }
    g.lineCap = 'round';
    const hr = (3 + 52 / 60) / 12 * Math.PI * 2, mn = 52 / 60 * Math.PI * 2;
    g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(hr) * 55, 128 - Math.cos(hr) * 55); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(mn) * 85, 128 - Math.cos(mn) * 85); g.stroke();
    g.strokeStyle = '#c33'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 90 * Math.sin(4), 128 - 90 * Math.cos(4)); g.stroke();
  });
  // calendar / poster
  TX.poster = canvasTex(384, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd0e8'); gr.addColorStop(1, '#2f7fb0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = `bold 54px ${JP}`; g.textAlign = 'center';
    g.fillText('海の安全', w / 2, 90);
    g.font = `bold 30px ${JP}`; g.fillText('ライフジャケットを', w / 2, 400); g.fillText('着用しましょう', w / 2, 445);
    g.fillStyle = '#f39a2b'; g.beginPath(); g.arc(w / 2, 240, 80, 0, 7); g.fill();
    g.fillStyle = '#2f7fb0'; g.beginPath(); g.arc(w / 2, 240, 42, 0, 7); g.fill();
    g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, 240); g.rotate(i * Math.PI / 2 + 0.78); g.fillRect(-12, -82, 24, 42); g.restore(); }
    fade(g, w, h, 0.25);
  });
  TX.calendar = canvasTex(256, 352, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c33'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#fff'; g.font = `bold 44px ${JP}`; g.textAlign = 'center'; g.fillText('10月', w / 2, 52);
    g.fillStyle = '#333'; g.font = `20px ${JP}`;
    for (let i = 0; i < 31; i++) { const c = i % 7, r = Math.floor(i / 7); g.fillStyle = c === 0 ? '#c33' : '#333'; g.fillText(String(i + 1), 22 + c * 35, 110 + r * 48); }
  });
  // misc labels
  TX.waitSign = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f4f7a'; g.font = `bold 84px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('待 合 所', w / 2, h / 2 + 4);
    fade(g, w, h, 0.12); stains(g, w, h, 6);
  });
  TX.kumiai = canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#244a6e'; g.font = `bold 96px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('汐見漁業協同組合', w / 2, h / 2 + 4);
    fade(g, w, h, 0.18); rustDrips(g, w, h, 6); stains(g, w, h, 8);
  });
  TX.plaque = canvasTex(1024, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9b25f'); gr.addColorStop(0.5, '#f1d48a'); gr.addColorStop(1, '#b88d3e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6526'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#4a3410'; g.font = `bold 64px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('汐見漁港 ・ 天気雨の午後', w / 2, 82);
    g.font = `30px ${JP}`; g.fillText('SHIOMI HARBOR  —  A SUNSHOWER AFTER SCHOOL', w / 2, 146);
  });
  TX.noEntry = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c33'; g.font = `bold 30px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('関係者以外', w / 2, 42); g.fillText('立入禁止', w / 2, 88);
    fade(g, w, h, 0.2);
  });
  TX.boatName1 = canvasTex(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1d2f4a'; g.font = `bold 70px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('第三汐見丸', w / 2, h / 2 + 4);
  });
  TX.boatName2 = canvasTex(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1d2f4a'; g.font = `bold 70px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('海 鳥 丸', w / 2, h / 2 + 4);
  });
  TX.boatName3 = canvasTex(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1d2f4a'; g.font = `bold 66px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SEA BREEZE', w / 2, h / 2 + 4);
  });
  TX.boatName4 = canvasTex(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1d2f4a'; g.font = `bold 70px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('汐 風 丸', w / 2, h / 2 + 4);
  });
  TX.buoyNum = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e8743a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `bold 96px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('7', w * 0.25, h / 2 + 4); g.fillText('7', w * 0.75, h / 2 + 4);
    fade(g, w, h, 0.28); speckle(g, w, h, 300, 'rgba(90,60,40,0.12)'); stains(g, w, h, 8, 'rgba(90,110,80,', 0.12);
  });
  TX.hydrant = canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = '#d22d26'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = `bold 34px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('消', w / 2, 40); g.fillText('火', w / 2, 90); g.fillText('栓', w / 2, 140);
    fade(g, w, h, 0.15); speckle(g, w, h, 120, 'rgba(80,40,20,0.15)');
  });
  TX.seriba = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0392b'; g.font = `bold 52px ${JPM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('セリ場', w / 2, h / 2 + 3);
    fade(g, w, h, 0.15); stains(g, w, h, 4);
  });
  TX.radar = null; // shader driven
  return TX;
}
