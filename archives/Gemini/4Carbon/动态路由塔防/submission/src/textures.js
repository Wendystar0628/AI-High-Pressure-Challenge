// 程序化高清 Canvas 纹理生成器（完全兼容 file:// 本地双击打开，近看仍具丰富材质细节）

import * as THREE from 'three';

const cache = new Map();

function makeCanvas(w, h, drawFn, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

export function getTextures() {
  if (cache.size > 0) return Object.fromEntries(cache);

  // 1. 标准链路纹理（高辨识度钢蓝光纤桥面 + 亮青导轨边线 + 四角铆钉，一眼与障碍和平台区分）
  cache.set(
    'link',
    makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1b3149';
      ctx.fillRect(0, 0, w, h);

      // 微细电路底纹
      ctx.strokeStyle = '#274769';
      ctx.lineWidth = 2;
      for (let i = 32; i < w; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }

      // 外框亮蓝金属路肩
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 7;
      ctx.strokeRect(6, 6, w - 12, h - 12);

      // 十字数据导槽
      ctx.fillStyle = '#102033';
      ctx.fillRect(w * 0.34, 12, w * 0.32, h - 24);
      ctx.fillRect(12, h * 0.34, w - 24, h * 0.32);

      // 正常业务光纤双导轨线
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.68)';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, w - 36, h - 36);

      // 四角定位焊点
      const corners = [
        [28, 28],
        [w - 28, 28],
        [28, h - 28],
        [w - 28, h - 28]
      ];
      for (const [cx, cy] of corners) {
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    })
  );

  // 2. 旧链路纹理（复古琥珀黄铜金属格栅 + 斜向警示纹 + 低速串行铜线）
  cache.set(
    'legacy',
    makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2a1d10';
      ctx.fillRect(0, 0, w, h);

      // 工业格栅网孔
      ctx.fillStyle = '#160f08';
      for (let y = 24; y < h - 24; y += 20) {
        for (let x = 24; x < w - 24; x += 20) {
          ctx.fillRect(x, y, 12, 12);
        }
      }

      // 边缘琥珀黄黑警示斜纹
      ctx.save();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 3;
      for (let i = -w; i < w * 2; i += 28) {
        ctx.beginPath();
        ctx.moveTo(i, 16);
        ctx.lineTo(i + 18, 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, h - 30);
        ctx.lineTo(i + 18, h - 16);
        ctx.stroke();
      }
      ctx.restore();

      // 中央裸露双绞铜轨
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 16);
      ctx.lineTo(w * 0.5, h - 16);
      ctx.moveTo(16, h * 0.5);
      ctx.lineTo(w - 16, h * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    })
  );

  // 3. 设备平台顶部纹理（六角安装卡座 + 科技蓝紫镶边）
  cache.set(
    'platform',
    makeCanvas(256, 256, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 16, w / 2, h / 2, w * 0.65);
      grad.addColorStop(0, '#233252');
      grad.addColorStop(1, '#141d33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 装甲分缝
      ctx.strokeStyle = '#4c6ef5';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // 六边形挂载插槽
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.72)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      const r = 68;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = w / 2 + Math.cos(a) * r;
        const py = h / 2 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // 内圈对准十字
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2);
      ctx.stroke();
    })
  );

  // 4. 交换节点甲板纹理
  cache.set(
    'nodeDeck',
    makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#122429';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * 48, h / 2 + Math.sin(a) * 48);
        ctx.lineTo(w / 2 + Math.cos(a) * 102, h / 2 + Math.sin(a) * 102);
        ctx.stroke();
      }
    })
  );

  // 5. 企业机柜正面纹理（阵列指示灯 + 散热孔）
  cache.set(
    'serverRack',
    makeCanvas(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#101826';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#263854';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      for (let y = 18; y < h - 20; y += 22) {
        ctx.fillStyle = '#090e17';
        ctx.fillRect(14, y, w - 28, 14);
        // 状态灯
        ctx.fillStyle = y % 44 === 18 ? '#00e5ff' : '#10b981';
        ctx.fillRect(18, y + 4, 8, 6);
        ctx.fillStyle = y % 66 === 18 ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(30, y + 4, 5, 6);
        // 网孔条
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(42, y + 3, w - 60, 8);
      }
    })
  );

  // 6. 公网数据洪流滚动纹理（用于骨干流域 z=5 河道）
  cache.set(
    'publicStream',
    makeCanvas(
      512,
      128,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#07152b');
        g.addColorStop(0.5, '#0c2d57');
        g.addColorStop(1, '#07152b');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // 高速流光条纹
        const lanes = [
          { y: 18, len: 90, x: 20, col: '#38bdf8' },
          { y: 36, len: 140, x: 180, col: '#fbbf24' },
          { y: 58, len: 110, x: 70, col: '#22d3ee' },
          { y: 78, len: 160, x: 290, col: '#818cf8' },
          { y: 98, len: 95, x: 140, col: '#38bdf8' },
          { y: 46, len: 80, x: 390, col: '#f472b6' }
        ];
        for (const ln of lanes) {
          const lg = ctx.createLinearGradient(ln.x, 0, ln.x + ln.len, 0);
          lg.addColorStop(0, 'rgba(0,0,0,0)');
          lg.addColorStop(0.6, ln.col);
          lg.addColorStop(1, '#ffffff');
          ctx.fillStyle = lg;
          ctx.fillRect(ln.x, ln.y, ln.len, 6);
        }
      },
      true
    )
  );

  // 7. 工业气隙黄黑警示条纹理
  cache.set(
    'hazard',
    makeCanvas(
      256,
      64,
      (ctx, w, h) => {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f59e0b';
        for (let x = -64; x < w + 64; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 24, 0);
          ctx.lineTo(x + 8, h);
          ctx.lineTo(x - 16, h);
          ctx.closePath();
          ctx.fill();
        }
      },
      true
    )
  );

  // 8. 当前路线流光箭头带纹理（带方向箭头 chevron，支持 UV 滚动）
  cache.set(
    'routeArrow',
    makeCanvas(
      128,
      64,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        // 柔和发光底带
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.42)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.72)');
        grad.addColorStop(0.75, 'rgba(255,255,255,0.42)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 8, w, h - 16);

        // 前进尖角箭头 >>
        ctx.fillStyle = '#ffffff';
        for (const ox of [22, 86]) {
          ctx.beginPath();
          ctx.moveTo(ox, 10);
          ctx.lineTo(ox + 26, h / 2);
          ctx.lineTo(ox, h - 10);
          ctx.lineTo(ox + 12, h - 10);
          ctx.lineTo(ox + 38, h / 2);
          ctx.lineTo(ox + 12, 10);
          ctx.closePath();
          ctx.fill();
        }
      },
      true
    )
  );

  // 9. 预览路线高对比虚线箭头纹理（与当前实心流光带一眼区分！）
  cache.set(
    'routePreview',
    makeCanvas(
      128,
      64,
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(8, 20, 44, h - 40);
        ctx.beginPath();
        ctx.moveTo(64, 6);
        ctx.lineTo(106, h / 2);
        ctx.lineTo(64, h - 6);
        ctx.lineTo(82, h - 6);
        ctx.lineTo(122, h / 2);
        ctx.lineTo(82, 6);
        ctx.closePath();
        ctx.fill();
      },
      true
    )
  );

  // 10. 柔光粒子贴图
  cache.set(
    'glow',
    makeCanvas(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );

  return Object.fromEntries(cache);
}
