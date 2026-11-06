import * as THREE from 'three';
import { GB, M } from '../core/builder.js';
import { MAT } from '../core/materials.js';
import { SP, texMat } from '../core/special.js';
import { setLayers } from '../core/G.js';

/** World building context: static geometry is accumulated per material and merged at the end. */
export class Ctx {
  constructor(scene, TX) {
    this.scene = scene;
    this.TX = TX;
    this.main = new GB();
    this.ds = new GB();
    this.glass = new GB();
    this.leaf = new GB();
    this.weed = new GB();
    this.net = new GB();
    this.flag = new GB();
    this.decals = [];
  }
  /** textured quad (sign, poster...). m: matrix; plane faces +z in local space */
  decal(tex, w, h, m, opts = {}) {
    const b = new GB();
    b.add(new THREE.PlaneGeometry(w, h), { c: opts.c || [1, 1, 1], t: opts.t || 0, w: opts.w || 0.2, e: opts.e || 0, l: opts.l === undefined ? 0.6 : opts.l }, m);
    const mesh = b.mesh(texMat(tex, { side: opts.side || THREE.FrontSide, alphaTest: opts.alphaTest || 0 }));
    setLayers(mesh, { shadow: opts.shadow !== false, outline: opts.outline !== false, refl: opts.refl !== false });
    this.scene.add(mesh);
    return mesh;
  }
  decalMat(tex, opts = {}) { return texMat(tex, opts); }
  finish() {
    if (this.beads && this.beads.length) {
      const g = new THREE.SphereGeometry(1, 8, 6);
      const im = new THREE.InstancedMesh(g, SP.drop, this.beads.length);
      const m = new THREE.Matrix4();
      this.beads.forEach((bd, i) => { m.compose(new THREE.Vector3(bd[0], bd[1], bd[2]), new THREE.Quaternion(), new THREE.Vector3(bd[3], bd[3] * 0.7, bd[3])); im.setMatrixAt(i, m); });
      setLayers(im, { shadow: false, outline: false, refl: false });
      this.scene.add(im);
    }
    const add = (gb, mat, layers = {}) => {
      if (gb.isEmpty()) return null;
      const m = gb.mesh(mat);
      setLayers(m, layers);
      this.scene.add(m);
      return m;
    };
    this.meshes = {
      main: add(this.main, MAT.toon),
      ds: add(this.ds, MAT.toonDS),
      leaf: add(this.leaf, MAT.leaf),
      weed: add(this.weed, MAT.weed, { refl: false }),
      net: add(this.net, MAT.net),
      flag: add(this.flag, MAT.flag),
      glass: add(this.glass, SP.glass, { shadow: false, outline: false, refl: false }),
    };
    if (this.meshes.glass) this.meshes.glass.renderOrder = 4;
  }
}

export { M };
