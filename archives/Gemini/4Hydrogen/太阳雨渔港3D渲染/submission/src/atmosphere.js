import * as THREE from 'three';
import { ENV_UNIFORMS, hash1, smoothstep } from './state.js';

export function buildAtmosphere(scene, dripOrigins = []) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------
  // 1. Anime Pale Cyan-White Sky Dome + Thin Drifting Clouds (Layer 2)
  // ---------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uSunDir: ENV_UNIFORMS.uSunDir,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uSunIntensity;
      varying vec3 vDir;

      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 nadirCol   = vec3(0.84, 0.94, 0.96);
        vec3 horizonCol = vec3(0.90, 0.96, 0.98);
        vec3 zenithCol  = vec3(0.70, 0.88, 0.93);

        vec3 col = vDir.y >= 0.0
          ? mix(horizonCol, zenithCol, pow(clamp(vDir.y, 0.0, 1.0), 0.72))
          : mix(horizonCol, nadirCol, clamp(-vDir.y * 2.0, 0.0, 1.0));

        // Soft warm sunlit glow around sun direction
        float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.95, 0.82) * pow(sunDot, 12.0) * 0.24 * uSunIntensity;
        col += vec3(1.0, 0.98, 0.90) * smoothstep(0.996, 0.9995, sunDot) * 0.55 * uSunIntensity;

        // Thin anime cel clouds drifting gently across upper sky
        if (vDir.y > 0.04) {
          vec2 skyUv = vDir.xz / (vDir.y + 0.22);
          vec2 p = skyUv * 1.15 + vec2(uTime * 0.012, uTime * 0.008);
          float c1 = sin(p.x * 1.7 + cos(p.y * 1.3)) + cos(p.y * 1.9 - sin(p.x * 1.1));
          float cloudBand = smoothstep(0.55, 0.92, c1 * 0.5 + 0.35) * smoothstep(0.04, 0.24, vDir.y);
          vec3 cloudTint = mix(vec3(0.98, 0.99, 1.0), vec3(0.84, 0.91, 0.95), 1.0 - uSunIntensity);
          col = mix(col, cloudTint, cloudBand * 0.52);
        }

        // Subtle overall sky dimming during rare cloud-over moment
        col *= mix(0.86, 1.0, uSunIntensity);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(210, 32, 20), skyMat);
  skyDome.layers.set(2);
  root.add(skyDome);

  // ---------------------------------------------------------
  // 2. Sun-Lit Diagonal Rain Streaks (带暖金色微光的短线 — Layer 1)
  // ---------------------------------------------------------
  const rainCount = 1600;
  const rainPos = new Float32Array(rainCount * 2 * 3);
  const rainSeed = new Float32Array(rainCount * 2);
  const rainEnd = new Float32Array(rainCount * 2); // 0 = head, 1 = tail

  for (let i = 0; i < rainCount; i++) {
    const rx = (hash1(i * 11 + 1) - 0.5) * 44;
    const ry = hash1(i * 17 + 2) * 24;
    const rz = (hash1(i * 23 + 3) - 0.5) * 44;
    const sd = hash1(i * 31 + 7);
    for (let v = 0; v < 2; v++) {
      const idx = (i * 2 + v) * 3;
      rainPos[idx] = rx;
      rainPos[idx + 1] = ry;
      rainPos[idx + 2] = rz;
      rainSeed[i * 2 + v] = sd;
      rainEnd[i * 2 + v] = v;
    }
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rainSeed, 1));
  rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(rainEnd, 1));

  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uWindVec: ENV_UNIFORMS.uWindVec,
      uGustStrength: ENV_UNIFORMS.uGustStrength,
      uRainDensity: ENV_UNIFORMS.uRainDensity,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aEnd;
      uniform float uTime;
      uniform vec2 uWindVec;
      uniform float uGustStrength;
      uniform float uRainDensity;
      varying float vVisible;
      varying float vSparkle;
      varying float vEnd;

      void main() {
        vEnd = aEnd;
        vVisible = step(aSeed, uRainDensity);

        float speed = 13.5 + aSeed * 5.0;
        float heightSpan = 24.0;
        float y = mod(position.y - uTime * speed + aSeed * 37.0, heightSpan) - 2.0;

        float slant = 0.16 + uGustStrength * 0.24;
        vec2 drift = uWindVec * (uTime * (2.6 + uGustStrength * 3.8));
        vec2 xz = mod(position.xz + drift + 22.0, 44.0) - 22.0;

        // Streak vector points down & along wind slant
        vec3 streakDir = normalize(vec3(uWindVec.x * slant, -1.0, uWindVec.y * slant));
        float len = (0.48 + aSeed * 0.34) * (1.0 + uGustStrength * 0.35);
        vec3 p = vec3(xz.x, y, xz.y) - streakDir * (aEnd * len);

        // Keep rain outside covered roofs (Warehouse, Waiting Room, & under Skiff)
        bool inWarehouse = p.x > -17.6 && p.x < -10.4 && p.z > -7.6 && p.z < 0.6 && p.y < 5.75;
        bool inWaiting   = p.x > -17.4 && p.x < -11.6 && p.z > 2.0  && p.z < 8.6 && p.y < 4.75;
        bool underSkiff  = p.x > 1.1   && p.x < 4.0   && p.z > 13.2 && p.z < 15.1 && p.y < 1.4;
        if (inWarehouse || inWaiting || underSkiff) {
          vVisible = 0.0;
        }

        // Warm golden glint when passing sunlit zones
        vSparkle = 0.55 + 0.45 * sin(uTime * 3.5 + aSeed * 62.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uSunIntensity;
      varying float vVisible;
      varying float vSparkle;
      varying float vEnd;

      void main() {
        if (vVisible < 0.5) discard;
        vec3 baseRain = vec3(0.92, 0.97, 0.99);
        vec3 goldGlint = vec3(1.0, 0.92, 0.72);
        vec3 col = mix(baseRain, goldGlint, vSparkle * 0.72 * uSunIntensity);
        float alpha = (1.0 - vEnd * 0.75) * mix(0.24, 0.52, vSparkle * uSunIntensity);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.layers.set(1);
  root.add(rainLines);

  // ---------------------------------------------------------
  // 3. Volumetric Golden Sunbeams (淡金色光柱 — visible indoors in Warehouse/Cabin & soft in sky)
  // ---------------------------------------------------------
  function createSunbeamMaterial(alphaPeak) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: ENV_UNIFORMS.uTime,
        uSunIntensity: ENV_UNIFORMS.uSunIntensity,
        uCloudCenter: ENV_UNIFORMS.uCloudCenter,
        uCloudRadius: ENV_UNIFORMS.uCloudRadius,
        uAlphaPeak: { value: alphaPeak },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSunIntensity;
        uniform vec2 uCloudCenter;
        uniform vec2 uCloudRadius;
        uniform float uAlphaPeak;
        varying vec2 vUv;
        varying vec3 vWPos;

        void main() {
          vec2 d = (vWPos.xz - uCloudCenter) / uCloudRadius;
          float cov = 1.0 - smoothstep(0.35, 1.15, dot(d, d));
          float cloudFade = (1.0 - 0.58 * cov) * uSunIntensity;

          float across = sin(vUv.x * 3.14159);
          float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
          float shimmer = 0.85 + 0.15 * sin(vUv.x * 9.0 + uTime * 1.4);

          vec3 warmGold = vec3(1.0, 0.85, 0.44);
          vec3 skyRay = vec3(1.0, 0.92, 0.68);
          vec3 col = mix(skyRay, warmGold, step(0.08, uAlphaPeak));
          float alpha = pow(across, 1.8) * along * shimmer * uAlphaPeak * cloudFade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }
  const skyBeamMat = createSunbeamMaterial(0.042);
  const indoorBeamMat = createSunbeamMaterial(0.165);

  function addSunbeam(x, y, z, width, length, rotY = 0, indoor = false) {
    // Two crossed planes forming a soft volumetric ray aligned to sun angle
    const bg = new THREE.Group();
    bg.position.set(x, y, z);
    bg.rotation.y = rotY;
    // Tilt along incoming sun direction (+X,+Z -> -X,-Z)
    bg.rotation.z = 0.68;
    bg.rotation.x = -0.34;
    root.add(bg);

    const mat = indoor ? indoorBeamMat : skyBeamMat;
    [0, Math.PI / 2].forEach((ry) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
      plane.rotation.y = ry;
      plane.layers.set(1);
      bg.add(plane);
    });
  }

  // Sunbeams piercing Fishery Co-op Warehouse high windows onto crates & puddles (Shot 8!)
  addSunbeam(-13.8, 3.6, -4.2, 2.4, 5.4, 0.2, true);
  addSunbeam(-14.2, 3.6, -1.6, 2.0, 5.2, 0.2, true);
  // Sunbeams touching Boat 2 cockpit & harbor surface (Shot 7!)
  addSunbeam(-3.0, 3.2, -0.4, 2.4, 5.6, 0.0, false);
  // Broad sky sun-shafts over harbor & foreground pier (soft & clear of Shot 3 / lighthouse!)
  addSunbeam(-2.8, 6.4, 9.2, 3.8, 9.0, 0.1, false);
  addSunbeam(10.2, 5.4, 5.8, 3.6, 10.0, 0.1, false);

  // ---------------------------------------------------------
  // 4. Dripping Water Drops from Umbrella, Lamps & Boats (Layer 1)
  // ---------------------------------------------------------
  const dripGeo = new THREE.SphereGeometry(0.017, 6, 5);
  dripGeo.scale(0.8, 1.5, 0.8);
  const dripMat = new THREE.MeshBasicMaterial({
    color: 0xfff5d6,
    transparent: true,
    opacity: 0.88,
  });
  const dripBeads = dripOrigins.map((o) => {
    const m = new THREE.Mesh(dripGeo, dripMat);
    m.layers.set(1);
    root.add(m);
    return { mesh: m, origin: o };
  });

  // ---------------------------------------------------------
  // 5. Cel-Shaded Tetrapod Foam Puffs & Distant Misty Sea Wisps (Layer 1)
  // ---------------------------------------------------------
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xf7fcfd,
    transparent: true,
    opacity: 0.72,
  });
  const foamPuffs = [];
  const foamSpots = [
    [5.2, 0.06, 17.3], [6.2, 0.06, 17.8], [6.9, 0.06, 16.9],
    [5.9, 0.06, -12.3], [6.4, 0.06, -11.0], [4.9, 0.06, -13.1],
  ];
  foamSpots.forEach(([fx, fy, fz], i) => {
    const puff = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), foamMat);
    puff.rotation.x = -Math.PI / 2;
    puff.position.set(fx, fy, fz);
    puff.layers.set(1);
    root.add(puff);
    foamPuffs.push({ mesh: puff, phase: i * 1.15 });
  });

  // Distant cel-shaded mist wisps slowly drifting over outer sea (Z ~ -56) with soft feathered edges
  const mistMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xeef8fa) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = (1.0 - smoothstep(0.25, 1.0, r)) * 0.36;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const mistWisps = [];
  for (let i = 0; i < 6; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(16 + i * 2, 2.6), mistMat);
    w.position.set(-32 + i * 14, 1.4 + (i % 2) * 0.8, -56 - (i % 3) * 5);
    w.layers.set(1);
    root.add(w);
    mistWisps.push({ mesh: w, baseX: w.position.x, speed: 0.65 + (i % 3) * 0.25 });
  }

  // ---------------------------------------------------------
  // 6. Faint Pastel Watercolor Rainbow over Outer Sea (Shot 11!)
  // ---------------------------------------------------------
  const rainbowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        if (uOpacity < 0.01) discard;
        // RingGeometry UVs map cleanly or use radial distance from center
        float t = vUv.y;
        // Soft pastel anime rainbow bands
        vec3 cRed    = vec3(0.98, 0.72, 0.68);
        vec3 cGold   = vec3(0.99, 0.90, 0.66);
        vec3 cMint   = vec3(0.68, 0.93, 0.82);
        vec3 cCyan   = vec3(0.66, 0.86, 0.98);
        vec3 cViolet = vec3(0.79, 0.74, 0.96);

        vec3 col = mix(cViolet, cCyan, smoothstep(0.12, 0.32, t));
        col = mix(col, cMint, smoothstep(0.32, 0.50, t));
        col = mix(col, cGold, smoothstep(0.50, 0.68, t));
        col = mix(col, cRed, smoothstep(0.68, 0.86, t));

        float bandAlpha = smoothstep(0.0, 0.20, t) * (1.0 - smoothstep(0.80, 1.0, t));
        float edgeFade = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        gl_FragColor = vec4(col, bandAlpha * edgeFade * uOpacity);
      }
    `,
  });

  // Build clean arc ribbon geometry for accurate UV along arch length (u) & radial thickness (v)
  const rInner = 24.0;
  const rOuter = 27.2;
  const rSegs = 48;
  const rPos = [];
  const rUvs = [];
  const rIdx = [];
  for (let i = 0; i <= rSegs; i++) {
    const u = i / rSegs;
    const ang = 0.08 + u * (Math.PI - 0.16);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    rPos.push(ca * rInner, sa * rInner, 0);
    rUvs.push(u, 0);
    rPos.push(ca * rOuter, sa * rOuter, 0);
    rUvs.push(u, 1);
  }
  for (let i = 0; i < rSegs; i++) {
    const a = i * 2;
    rIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const rainbowGeo = new THREE.BufferGeometry();
  rainbowGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  rainbowGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  rainbowGeo.setIndex(rIdx);
  const rainbowMesh = new THREE.Mesh(rainbowGeo, rainbowMat);
  rainbowMesh.position.set(-1.0, -2.5, -52);
  rainbowMesh.rotation.y = -0.18;
  rainbowMesh.layers.set(1);
  root.add(rainbowMesh);

  return {
    root,
    update(t) {
      // Dripping beads fall gently under gravity & reset cleanly
      dripBeads.forEach((d) => {
        const cycle = (t * 0.55 + d.origin.phase) % 1.0;
        if (cycle < 0.35) {
          // Swelling droplet clinging to rim
          const s = 0.4 + (cycle / 0.35) * 0.7;
          d.mesh.position.set(d.origin.x, d.origin.y - 0.02, d.origin.z);
          d.mesh.scale.setScalar(s);
          d.mesh.visible = true;
        } else {
          // Falling drop
          const fallT = (cycle - 0.35) / 0.65;
          const dropY = d.origin.y - fallT * fallT * 2.2;
          d.mesh.position.set(d.origin.x, dropY, d.origin.z);
          d.mesh.scale.setScalar(1.0);
          d.mesh.visible = dropY > 0.02;
        }
      });

      // Tetrapod foam surges smoothly
      foamPuffs.forEach((fp) => {
        const sc = 0.78 + 0.36 * Math.sin(t * 1.9 + fp.phase);
        fp.mesh.scale.setScalar(sc);
      });

      // Distant mist drifts slowly
      mistWisps.forEach((mw) => {
        const span = 96;
        mw.mesh.position.x = -48 + (((mw.baseX + 48 + t * mw.speed) % span) + span) % span;
      });

      // Rainbow blooms gently whenever rain density dips into light drizzle!
      const rainD = ENV_UNIFORMS.uRainDensity.value;
      const rainbowTarget = smoothstep(0.50, 0.28, rainD) * 0.32 * ENV_UNIFORMS.uSunIntensity.value;
      rainbowMat.uniforms.uOpacity.value = rainbowTarget;
    },
  };
}
