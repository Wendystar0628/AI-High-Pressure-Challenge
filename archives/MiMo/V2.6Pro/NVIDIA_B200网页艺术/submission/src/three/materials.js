// ============================================================
// 程序化材质与纹理：硅面 / 铜走线 / DRAM 阵列 / 金属 / PCB
// 全部由 Canvas 生成，不依赖任何外部素材
// ============================================================
import * as THREE from 'three';

function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noise(ctx, size, alpha, n = 1600) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const a = Math.random() * alpha;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
}

// ---------- 晶粒顶面：计算单元 / 缓存 / 接口区 ----------
export function dieTexture(variant = 0) {
  return canvasTexture(1024, (ctx, S) => {
    // 基底：深硅蓝
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#121c2e');
    g.addColorStop(0.5, '#0d1522');
    g.addColorStop(1, '#152238');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // 大网格（功能区）
    ctx.strokeStyle = 'rgba(120,170,230,0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      const v = (i / 8) * S;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(S, v); ctx.stroke();
    }

    // Tensor Core 阵列簇（SM 块）
    const rows = 8, cols = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 40 + c * 118, y = 40 + r * 118;
        const w = 96, h = 96;
        // 跳过中央条带（L2 / NV-HBI 区域）
        const cx = x + w / 2, cy = y + h / 2;
        if (variant === 0 && Math.abs(cx - S / 2) < 120) continue;
        if (variant === 1 && Math.abs(cy - S / 2) < 96) continue;
        const rg = ctx.createLinearGradient(x, y, x + w, y + h);
        rg.addColorStop(0, 'rgba(70,120,190,0.32)');
        rg.addColorStop(1, 'rgba(30,60,110,0.22)');
        ctx.fillStyle = rg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(140,190,255,0.28)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x, y, w, h);
        // 内部纹理：SM 细条
        ctx.fillStyle = 'rgba(160,210,255,0.13)';
        for (let k = 0; k < 6; k++) {
          ctx.fillRect(x + 10, y + 10 + k * 14, w - 20, 6);
        }
        // 亮点
        ctx.fillStyle = 'rgba(70,216,255,0.35)';
        ctx.fillRect(x + 8, y + 8, 5, 5);
      }
    }

    // L2 缓存带（中带）
    ctx.fillStyle = 'rgba(217,138,75,0.16)';
    if (variant === 0) ctx.fillRect(S / 2 - 110, 20, 220, S - 40);
    else ctx.fillRect(20, S / 2 - 88, S - 40, 176);
    ctx.strokeStyle = 'rgba(255,190,120,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 42; i++) {
      ctx.beginPath();
      if (variant === 0) {
        const x = S / 2 - 100 + i * 5;
        ctx.moveTo(x, 30); ctx.lineTo(x, S - 30);
      } else {
        const y = S / 2 - 80 + i * 4;
        ctx.moveTo(30, y); ctx.lineTo(S - 30, y);
      }
      ctx.stroke();
    }

    // HBM PHY 接口区（上下边缘，金色触点阵列）
    for (const edge of ['top', 'bottom']) {
      const y0 = edge === 'top' ? 6 : S - 34;
      for (let i = 0; i < 64; i++) {
        ctx.fillStyle = i % 4 === 0 ? 'rgba(255,200,110,0.75)' : 'rgba(200,150,70,0.4)';
        ctx.fillRect(30 + i * 15, y0, 8, 26);
      }
    }

    // NVLink / D2D PHY（左右边缘）
    for (const edge of ['left', 'right']) {
      const x0 = edge === 'left' ? 6 : S - 30;
      for (let i = 0; i < 48; i++) {
        ctx.fillStyle = 'rgba(70,216,255,0.5)';
        ctx.fillRect(x0, 40 + i * 19, 22, 8);
      }
    }

    // 片间互连桥（面向另一颗晶粒的一侧，高亮）
    ctx.fillStyle = 'rgba(70,216,255,0.22)';
    if (variant === 0) ctx.fillRect(S - 46, 200, 40, S - 400);
    else ctx.fillRect(6, 200, 40, S - 400);
    ctx.fillStyle = 'rgba(155,235,255,0.8)';
    for (let i = 0; i < 26; i++) {
      const y = 210 + i * 23;
      if (variant === 0) ctx.fillRect(S - 42, y, 32, 6);
      else ctx.fillRect(10, y, 32, 6);
    }

    noise(ctx, S, 0.05, 2400);
  });
}

// ---------- 基板：铜走线 ----------
export function substrateTexture() {
  return canvasTexture(1024, (ctx, S) => {
    ctx.fillStyle = '#0c1410';
    ctx.fillRect(0, 0, S, S);
    // 铜走线：曼哈顿路径
    const colors = ['rgba(190,120,60,0.5)', 'rgba(217,138,75,0.42)', 'rgba(150,95,50,0.4)'];
    for (let i = 0; i < 220; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 2 + Math.random() * 3.5;
      let x = Math.random() * S, y = Math.random() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        if (Math.random() > 0.5) x += (Math.random() - 0.5) * 320;
        else y += (Math.random() - 0.5) * 320;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 焊盘
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.fillStyle = 'rgba(230,170,90,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    noise(ctx, S, 0.04, 1800);
  });
}

// ---------- 基板内部铜层（剖切可见） ----------
export function copperLayerTexture() {
  return canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,180,100,0.7)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 30; i++) {
      const y = 16 + i * 16;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 64) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 10);
      }
      ctx.stroke();
    }
    noise(ctx, S, 0.06, 600);
  });
}

// ---------- DRAM 阵列 ----------
export function dramTexture() {
  return canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#0e1826';
    ctx.fillRect(0, 0, S, S);
    const cell = 12;
    for (let y = 0; y < S; y += cell) {
      for (let x = 0; x < S; x += cell) {
        const v = Math.random();
        ctx.fillStyle = v > 0.92 ? 'rgba(70,216,255,0.5)' : `rgba(90,140,200,${0.12 + v * 0.2})`;
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
    // 位线
    ctx.strokeStyle = 'rgba(120,180,240,0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x < S; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    noise(ctx, S, 0.05, 900);
  });
}

// ---------- 拉丝金属（盖板 / 框架） ----------
export function brushedMetalTexture(tint = '#8a97a8') {
  return canvasTexture(512, (ctx, S) => {
    const g = ctx.createLinearGradient(0, 0, S * 0.6, S);
    g.addColorStop(0, tint);
    g.addColorStop(0.45, '#66727f');
    g.addColorStop(1, '#4c5763');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      ctx.lineWidth = Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14);
      ctx.stroke();
    }
    noise(ctx, S, 0.035, 2200);
  });
}

// ---------- PCB 板（HGX） ----------
export function pcbTexture() {
  return canvasTexture(1024, (ctx, S) => {
    ctx.fillStyle = '#0b1a22';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(60,160,150,${0.12 + Math.random() * 0.2})`;
      ctx.lineWidth = 2 + Math.random() * 3;
      let x = Math.random() * S, y = Math.random() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 3; s++) {
        if (Math.random() > 0.5) x += (Math.random() - 0.5) * 380;
        else y += (Math.random() - 0.5) * 380;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = 'rgba(200,160,80,0.5)';
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    noise(ctx, S, 0.05, 1600);
  });
}

// ---------- 机架前面板 ----------
export function rackPanelTexture() {
  return canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, S, S);
    // 通风孔阵列
    for (let y = 12; y < S; y += 18) {
      for (let x = 12; x < S; x += 18) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,150,190,0.18)';
        ctx.beginPath();
        ctx.arc(x, y - 1, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    noise(ctx, S, 0.05, 900);
  });
}

// ---------- 材质库 ----------
export function buildMaterials() {
  const dieTex0 = dieTexture(0);
  const dieTex1 = dieTexture(1);

  const dieMatA = new THREE.MeshPhysicalMaterial({
    map: dieTex0,
    color: 0xbfd4ea,
    metalness: 0.72,
    roughness: 0.28,
    envMapIntensity: 1.25,
    iridescence: 0.85,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [120, 420],
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
  });

  const dieMatB = dieMatA.clone();
  dieMatB.map = dieTex1;

  const substrateMat = new THREE.MeshPhysicalMaterial({
    map: substrateTexture(),
    color: 0xc8d2c2,
    metalness: 0.45,
    roughness: 0.62,
    envMapIntensity: 0.7,
  });

  const copperMat = new THREE.MeshStandardMaterial({
    map: copperLayerTexture(),
    color: 0xd08a50,
    metalness: 0.95,
    roughness: 0.38,
    envMapIntensity: 1.1,
  });

  const interposerMat = new THREE.MeshPhysicalMaterial({
    color: 0x27364e,
    metalness: 0.65,
    roughness: 0.35,
    envMapIntensity: 1.0,
    iridescence: 0.5,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [200, 500],
  });

  const dramMat = new THREE.MeshPhysicalMaterial({
    map: dramTexture(),
    color: 0xa9c2e0,
    metalness: 0.6,
    roughness: 0.42,
    envMapIntensity: 1.0,
  });

  const dramAltMat = dramMat.clone();
  dramAltMat.color = new THREE.Color(0x8fb2d8);

  const logicDieMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c3e58,
    metalness: 0.7,
    roughness: 0.36,
    envMapIntensity: 1.1,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd8a860,
    metalness: 0.95,
    roughness: 0.32,
    envMapIntensity: 1.35,
  });

  const solderMat = new THREE.MeshStandardMaterial({
    color: 0xb8c0c8,
    metalness: 0.92,
    roughness: 0.34,
    envMapIntensity: 1.2,
  });

  const lidMat = new THREE.MeshPhysicalMaterial({
    map: brushedMetalTexture('#9aa8ba'),
    color: 0x9aa6b4,
    metalness: 0.9,
    roughness: 0.42,
    envMapIntensity: 1.3,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    metalness: 0.85,
    roughness: 0.45,
    envMapIntensity: 0.9,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: 0x22282e,
    metalness: 0.4,
    roughness: 0.55,
    envMapIntensity: 0.7,
  });

  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcbTexture(),
    color: 0x9fd8d0,
    metalness: 0.35,
    roughness: 0.6,
    envMapIntensity: 0.65,
  });

  const rackMat = new THREE.MeshStandardMaterial({
    map: rackPanelTexture(),
    color: 0x93a2b6,
    metalness: 0.78,
    roughness: 0.5,
    envMapIntensity: 0.85,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2a3340,
    metalness: 0.8,
    roughness: 0.42,
    envMapIntensity: 0.9,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x88c8ff,
    metalness: 0.1,
    roughness: 0.12,
    transmission: 0.72,
    thickness: 0.6,
    transparent: true,
    opacity: 0.5,
    envMapIntensity: 1.4,
  });

  // 发光材料（数据脉冲 / 激活）
  const glowCyan = new THREE.MeshBasicMaterial({ color: 0x46d8ff, toneMapped: false });
  const glowAmber = new THREE.MeshBasicMaterial({ color: 0xffb454, toneMapped: false });
  const glowGreen = new THREE.MeshBasicMaterial({ color: 0x6ef2a0, toneMapped: false });
  const glowCoral = new THREE.MeshBasicMaterial({ color: 0xff6b6b, toneMapped: false });

  const tsvMat = new THREE.MeshStandardMaterial({
    color: 0xc0c8d4,
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.2,
  });

  return {
    dieMatA, dieMatB, substrateMat, copperMat, interposerMat,
    dramMat, dramAltMat, logicDieMat, goldMat, solderMat,
    lidMat, frameMat, capMat, pcbMat, rackMat, darkMetalMat, glassMat,
    glowCyan, glowAmber, glowGreen, glowCoral, tsvMat,
  };
}
