// 程序化高动态范围锻造与影棚环境贴图生成（通过 Three.js PMREMGenerator 提供真实 PBR 环境反射）

import * as THREE from 'three';

export function createProceduralForgeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x090b10);

  // 顶部冷蓝钢青柔光箱（与暖火形成冷暖明暗对比，凸显倒角金属感）
  const coolTop = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.8, 3.8), side: THREE.DoubleSide })
  );
  coolTop.position.set(0, 12, -2);
  coolTop.rotation.x = Math.PI * 0.42;
  envScene.add(coolTop);

  // 右前侧炽热炉火高光条（高亮度暖橙反射带）
  const forgeKey = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.1, 0.75), side: THREE.DoubleSide })
  );
  forgeKey.position.set(11, -2, 8);
  forgeKey.lookAt(0, 0, 0);
  envScene.add(forgeKey);

  // 左侧冷白边缘轮廓光带
  const rimLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.5, 3.4), side: THREE.DoubleSide })
  );
  rimLeft.position.set(-13, 3, -4);
  rimLeft.lookAt(0, 0, 0);
  envScene.add(rimLeft);

  // 底部暗熔岩微弱反光板
  const floorWarm = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.65, 0.25, 0.08), side: THREE.DoubleSide })
  );
  floorWarm.position.set(0, -12, 0);
  floorWarm.rotation.x = -Math.PI * 0.5;
  envScene.add(floorWarm);

  // 前方细长高光反光条（让平面旋转或倒角扫过时出现清晰锐利的高光流光）
  const specStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 2.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 3.4, 3.2), side: THREE.DoubleSide })
  );
  specStrip.position.set(0, 5, 13);
  specStrip.lookAt(0, 0, 0);
  envScene.add(specStrip);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt;
}
