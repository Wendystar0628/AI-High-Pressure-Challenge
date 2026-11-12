/* jelly.js — tetrahedral volumetric soft body (XPBD), rigid balls, fracture & splitting */
(function () {
  'use strict';

  const GRAV = -9.81;
  const TABLE = { hx: 1.46, hz: 0.91, top: 0, floor: -0.92 };

  function qMul(a, b) {
    return [
      a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
      a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
      a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
      a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
    ];
  }
  function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; }
  function qToMat3(q) {
    const [x, y, z, w] = q;
    return new Float32Array([
      1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w),
      2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w),
      2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y)
    ]);
  }

  function boxTetMesh(sx, sy, sz, nx, ny, nz) {
    const nvx = nx + 1, nvy = ny + 1, nvz = nz + 1;
    const nv = nvx * nvy * nvz;
    const rest = new Float32Array(nv * 3);
    const idx = (i, j, k) => i + nvx * (j + nvy * k);
    let p = 0;
    for (let k = 0; k < nvz; k++) for (let j = 0; j < nvy; j++) for (let i = 0; i < nvx; i++) {
      rest[p++] = (i / nx - 0.5) * sx;
      rest[p++] = (j / ny - 0.5) * sy;
      rest[p++] = (k / nz - 0.5) * sz;
    }
    const tets = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = idx(i, j, k), b = idx(i+1, j, k), c = idx(i+1, j+1, k), d = idx(i, j+1, k);
      const e = idx(i, j, k+1), f = idx(i+1, j, k+1), g = idx(i+1, j+1, k+1), h = idx(i, j+1, k+1);
      // six-tetrahedra decomposition around diagonal a-g
      tets.push(a, b, c, g);
      tets.push(a, c, d, g);
      tets.push(a, d, h, g);
      tets.push(a, h, e, g);
      tets.push(a, e, f, g);
      tets.push(a, f, b, g);
    }
    return { rest, tets: new Int32Array(tets), nx, ny, nz, sx, sy, sz };
  }

  function invert3(cols) {
    // cols: [ax,ay,az, bx,by,bz, cx,cy,cz] column-major
    const a = cols[0], d = cols[1], g = cols[2];
    const b = cols[3], e = cols[4], h = cols[5];
    const c = cols[6], f = cols[7], i = cols[8];
    const A = e*i - f*h, B = f*g - d*i, C = d*h - e*g;
    const det = a*A + b*B + c*C;
    if (Math.abs(det) < 1e-12) return null;
    const id = 1 / det;
    return new Float32Array([
      A*id, B*id, C*id,
      (c*h - b*i)*id, (a*i - c*g)*id, (b*g - a*h)*id,
      (b*f - c*e)*id, (c*d - a*f)*id, (a*e - b*d)*id
    ]);
  }

  let BODY_ID = 0;

  class JellyBody {
    constructor(sim, data) {
      this.sim = sim;
      this.id = BODY_ID++;
      this.tag = (data.tag !== undefined) ? data.tag : null;
      this.color = data.color || [0.55, 1.0, 0.78];
      this.deepColor = data.deepColor || [0.10, 0.45, 0.34];
      this.alpha = data.alpha !== undefined ? data.alpha : 0.80;
      this.density = data.density || 150;
      this.toughMul = data.toughMul !== undefined ? data.toughMul : 1;
      this.softMul = data.softMul !== undefined ? data.softMul : 1;
      this.restPos = data.rest.slice();
      this.pos = data.rest.slice();
      this.prev = data.rest.slice();
      this.vel = new Float32Array(this.pos.length);
      this.tets = new Int32Array(data.tets);
      this.nt = this.tets.length / 4;
      // enforce positive rest orientation of each tetrahedron
      for (let t = 0; t < this.nt; t++) {
        const a = this.tets[t*4], b = this.tets[t*4+1], c = this.tets[t*4+2], d = this.tets[t*4+3];
        const rp = this.restPos;
        const e1x = rp[b*3]-rp[a*3], e1y = rp[b*3+1]-rp[a*3+1], e1z = rp[b*3+2]-rp[a*3+2];
        const e2x = rp[c*3]-rp[a*3], e2y = rp[c*3+1]-rp[a*3+1], e2z = rp[c*3+2]-rp[a*3+2];
        const e3x = rp[d*3]-rp[a*3], e3y = rp[d*3+1]-rp[a*3+1], e3z = rp[d*3+2]-rp[a*3+2];
        const vol = e1x*(e2y*e3z-e2z*e3y) + e1y*(e2z*e3x-e2x*e3z) + e1z*(e2x*e3y-e2y*e3x);
        if (vol < 0) { this.tets[t*4+1] = c; this.tets[t*4+2] = b; }
      }
      this.alive = new Uint8Array(this.nt).fill(1);
      this.damage = new Float32Array(this.nt);
      this.restVol = new Float32Array(this.nt);
      this.restInv = new Float32Array(this.nt * 9);
      this.faces = [];
      this.faceOwner = [];
      this.invMass = new Float32Array(this.pos.length / 3);
      this.edgeA = null; this.edgeB = null; this.edgeRest = null;
      this.mass = 0;
      this.fractured = false;
      this.groundY = 0;
      this.mesh = null;
      this.renderData = null;
      this.buildRest();
      this.rebuildFaces();
      this.bounds = { min: [0,0,0], max: [0,0,0] };
    }

    get nv() { return this.pos.length / 3; }

    buildRest() {
      const nv = this.nv;
      const inv = new Float32Array(nv);
      const vol = new Float32Array(nv);
      const tet = this.tets;
      for (let t = 0; t < this.nt; t++) {
        const a = tet[t*4], b = tet[t*4+1], c = tet[t*4+2], d = tet[t*4+3];
        const cols = new Float32Array(9);
        for (let k = 0; k < 3; k++) {
          cols[k] = this.restPos[b*3+k] - this.restPos[a*3+k];
          cols[k+3] = this.restPos[c*3+k] - this.restPos[a*3+k];
          cols[k+6] = this.restPos[d*3+k] - this.restPos[a*3+k];
        }
        const im = invert3(cols);
        this.restInv.set(im || [0,0,0,0,0,0,0,0,0], t * 9);
        const v = Math.abs(
          (this.restPos[b*3] - this.restPos[a*3]) * ((this.restPos[c*3+1]-this.restPos[a*3+1])*(this.restPos[d*3+2]-this.restPos[a*3+2]) - (this.restPos[c*3+2]-this.restPos[a*3+2])*(this.restPos[d*3+1]-this.restPos[a*3+1])) -
          (this.restPos[b*3+1] - this.restPos[a*3+1]) * ((this.restPos[c*3]-this.restPos[a*3])*(this.restPos[d*3+2]-this.restPos[a*3+2]) - (this.restPos[c*3+2]-this.restPos[a*3+2])*(this.restPos[d*3]-this.restPos[a*3])) +
          (this.restPos[b*3+2] - this.restPos[a*3+2]) * ((this.restPos[c*3]-this.restPos[a*3])*(this.restPos[d*3+1]-this.restPos[a*3+1]) - (this.restPos[c*3+1]-this.restPos[a*3+1])*(this.restPos[d*3]-this.restPos[a*3]))
        ) / 6;
        this.restVol[t] = v;
        vol[a] += v; vol[b] += v; vol[c] += v; vol[d] += v;
      }
      for (let i = 0; i < nv; i++) {
        inv[i] = vol[i] * this.density / 4;
        this.invMass[i] = inv[i] > 1e-12 ? 1 / inv[i] : 0;
        this.mass += inv[i];
      }
      // unique edges
      const set = new Set();
      const ea = [], eb = [];
      for (let t = 0; t < this.nt; t++) for (let m = 0; m < 4; m++) for (let n = m + 1; n < 4; n++) {
        const u = this.tets[t*4+m], v = this.tets[t*4+n];
        const key = u < v ? u * 4096 + v : v * 4096 + u;
        if (!set.has(key)) { set.add(key); ea.push(u); eb.push(v); }
      }
      this.edgeA = new Int32Array(ea); this.edgeB = new Int32Array(eb);
      this.edgeRest = new Float32Array(ea.length);
      for (let e = 0; e < ea.length; e++) {
        const a = ea[e], b = eb[e];
        this.edgeRest[e] = Math.hypot(
          this.restPos[a*3]-this.restPos[b*3],
          this.restPos[a*3+1]-this.restPos[b*3+1],
          this.restPos[a*3+2]-this.restPos[b*3+2]
        );
      }
    }

    rebuildFaces() {
      const faces = [], owners = [];
      const map = new Map();
      const tet = this.tets;
      const faceDefs = [[1,2,3,0],[0,3,2,1],[0,1,3,2],[0,2,1,3]];
      const key = (a,b,c) => {
        const s = [a,b,c].sort((x,y) => x-y);
        return s[0] * 1048576 + s[1] * 1024 + s[2];
      };
      for (let t = 0; t < this.nt; t++) {
        if (!this.alive[t]) continue;
        const ids = [tet[t*4], tet[t*4+1], tet[t*4+2], tet[t*4+3]];
        for (let f = 0; f < 4; f++) {
          const fd = faceDefs[f];
          let a = ids[fd[0]], b = ids[fd[1]], c = ids[fd[2]];
          const o = ids[fd[3]];
          const k = key(a,b,c);
          const prev = map.get(k);
          if (prev) { prev.count++; continue; }
          // orient outwards from opposite vertex
          const ax=this.pos[a*3], ay=this.pos[a*3+1], az=this.pos[a*3+2];
          const bx=this.pos[b*3], by=this.pos[b*3+1], bz=this.pos[b*3+2];
          const cx=this.pos[c*3], cy=this.pos[c*3+1], cz=this.pos[c*3+2];
          const ox=this.pos[o*3], oy=this.pos[o*3+1], oz=this.pos[o*3+2];
          const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
          const ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
          const nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
          const cenx=(ax+bx+cx)/3, ceny=(ay+by+cy)/3, cenz=(az+bz+cz)/3;
          if (nx*(cenx-ox)+ny*(ceny-oy)+nz*(cenz-oz) < 0) { const tmp=b; b=c; c=tmp; }
          const rec = { a, b, c, owner: t, count: 1 };
          map.set(k, rec);
          // stash in map order-independent
          rec.k = k;
        }
      }
      for (const rec of map.values()) { if (rec.count === 1) { faces.push(rec.a, rec.b, rec.c); owners.push(rec.owner); } }
      this.faces = faces;
      this.faceOwner = owners;
      this.faceCount = owners.length;
    }

    addBallContacts(balls, h, sim) {
      const faces = this.faces, pos = this.pos;
      if (!faces.length) return;
      let minx=1e9, miny=1e9, minz=1e9, maxx=-1e9, maxy=-1e9, maxz=-1e9;
      for (let i = 0; i < pos.length; i += 3) {
        if (pos[i] < minx) minx = pos[i]; if (pos[i] > maxx) maxx = pos[i];
        if (pos[i+1] < miny) miny = pos[i+1]; if (pos[i+1] > maxy) maxy = pos[i+1];
        if (pos[i+2] < minz) minz = pos[i+2]; if (pos[i+2] > maxz) maxz = pos[i+2];
      }
      this.bounds.min = [minx,miny,minz]; this.bounds.max = [maxx,maxy,maxz];
      for (const ball of balls) {
        const bpos = ball.pos;
        if (bpos[0] + ball.r < minx || bpos[0] - ball.r > maxx ||
            bpos[1] + ball.r < miny || bpos[1] - ball.r > maxy ||
            bpos[2] + ball.r < minz || bpos[2] - ball.r > maxz) continue;
        let best = null;
        const hits = [];
        const R = ball.r;
        for (let f = 0; f < this.faceCount; f++) {
          const ia = faces[f*3], ib = faces[f*3+1], ic = faces[f*3+2];
          const ax=pos[ia*3], ay=pos[ia*3+1], az=pos[ia*3+2];
          const bx=pos[ib*3], by=pos[ib*3+1], bz=pos[ib*3+2];
          const cx=pos[ic*3], cy=pos[ic*3+1], cz=pos[ic*3+2];
          if (bpos[0] < Math.min(ax,bx,cx)-R || bpos[0] > Math.max(ax,bx,cx)+R) continue;
          if (bpos[1] < Math.min(ay,by,cy)-R || bpos[1] > Math.max(ay,by,cy)+R) continue;
          if (bpos[2] < Math.min(az,bz,cz)-R || bpos[2] > Math.max(az,bz,cz)+R) continue;
          const abx=bx-ax, aby=by-ay, abz=bz-az;
          const acx=cx-ax, acy=cy-ay, acz=cz-az;
          const apx=bpos[0]-ax, apy=bpos[1]-ay, apz=bpos[2]-az;
          const d1=abx*apx+aby*apy+abz*apz, d2=acx*apx+acy*apy+acz*apz;
          let qx, qy, qz, w0, w1, w2;
          if (d1 <= 0 && d2 <= 0) { qx=ax; qy=ay; qz=az; w0=1; w1=0; w2=0; }
          else {
            const bpx=bpos[0]-bx, bpy=bpos[1]-by, bpz=bpos[2]-bz;
            const d3=abx*bpx+aby*bpy+abz*bpz, d4=acx*bpx+acy*bpy+acz*bpz;
            if (d3 >= 0 && d4 <= d3) { qx=bx; qy=by; qz=bz; w0=0; w1=1; w2=0; }
            else {
              const vc=d1*d4-d3*d2;
              if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                const v=d1/(d1-d3); qx=ax+abx*v; qy=ay+aby*v; qz=az+abz*v; w0=1-v; w1=v; w2=0;
              } else {
                const cpx=bpos[0]-cx, cpy=bpos[1]-cy, cpz=bpos[2]-cz;
                const d5=abx*cpx+aby*cpy+abz*cpz, d6=acx*cpx+acy*cpy+acz*cpz;
                if (d6 >= 0 && d5 <= d6) { qx=cx; qy=cy; qz=cz; w0=0; w1=0; w2=1; }
                else {
                  const vb=d5*d2-d1*d6;
                  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                    const w=d2/(d2-d6); qx=ax+acx*w; qy=ay+acy*w; qz=az+acz*w; w0=1-w; w1=0; w2=w;
                  } else {
                    const va=d3*d6-d5*d4;
                    if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) {
                      const w=(d4-d3)/((d4-d3)+(d5-d6)); qx=bx+(cx-bx)*w; qy=by+(cy-by)*w; qz=bz+(cz-bz)*w; w0=0; w1=1-w; w2=w;
                    } else {
                      const den=1/Math.max(1e-12, va+vb+vc);
                      w1=vb*den; w2=vc*den; w0=1-w1-w2;
                      qx=ax*w0+bx*w1+cx*w2; qy=ay*w0+by*w1+cy*w2; qz=az*w0+bz*w1+cz*w2;
                    }
                  }
                }
              }
            }
          }
          const dx=bpos[0]-qx, dy=bpos[1]-qy, dz=bpos[2]-qz;
          const dist2=dx*dx+dy*dy+dz*dz;
          if (dist2 > R*R) continue;
          const dist=Math.sqrt(dist2);
          const pen=R-dist;
          if (pen <= 0) continue;
          let fnx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
          let fny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
          let fnz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
          const fl=Math.hypot(fnx,fny,fnz)||1; fnx/=fl; fny/=fl; fnz/=fl;
          let nx,ny,nz;
          if (dist > 1e-6 && (dx*fnx+dy*fny+dz*fnz) > 0) { nx=dx/dist;ny=dy/dist;nz=dz/dist; }
          else { nx=fnx;ny=fny;nz=fnz; }
          const hrec = { f, ia, ib, ic, w0, w1, w2, nx, ny, nz, pen, qx, qy, qz };
          hits.push(hrec);
          if (!best || pen > best.pen) best = hrec;
        }
        if (!best || !hits.length) continue;
        const firm = 1 - Math.min(1, sim.softness * this.softMul);
        const kPer = sim.contactK * (0.35 + firm * firm * 2.2) * this.toughMul;
        const cPer = sim.contactC * (0.6 + firm);
        let fx = 0, fy = 0, fz = 0, maxPen = 0, cx0 = 0, cy0 = 0, cz0 = 0;
        let avgVsx = 0, avgVsy = 0, avgVsz = 0, nContrib = 0;
        const ballSpeed = Math.hypot(ball.vel[0], ball.vel[1], ball.vel[2]);
        for (let hi = 0; hi < hits.length; hi++) {
          const ht = hits[hi];
          const { ia, ib, ic, w0, w1, w2, nx, ny, nz } = ht;
          const svx=this.vel[ia*3]*w0+this.vel[ib*3]*w1+this.vel[ic*3]*w2;
          const svy=this.vel[ia*3+1]*w0+this.vel[ib*3+1]*w1+this.vel[ic*3+1]*w2;
          const svz=this.vel[ia*3+2]*w0+this.vel[ib*3+2]*w1+this.vel[ic*3+2]*w2;
          const vn=(ball.vel[0]-svx)*nx+(ball.vel[1]-svy)*ny+(ball.vel[2]-svz)*nz;
          let F = kPer * Math.min(ht.pen, 0.22) - cPer * vn;
          F = Math.max(0, Math.min(F, 500));
          // stronger resistance for very deep penetration
          if (ht.pen > 0.16) F += (ht.pen - 0.16) * 16000;
          fx += nx*F; fy += ny*F; fz += nz*F;
          maxPen = Math.max(maxPen, ht.pen);
          cx0 += ht.qx; cy0 += ht.qy; cz0 += ht.qz;
          avgVsx += svx; avgVsy += svy; avgVsz += svz;
          nContrib++;
        }
        if (!nContrib) continue;
        cx0 /= nContrib; cy0 /= nContrib; cz0 /= nContrib;
        avgVsx /= nContrib; avgVsy /= nContrib; avgVsz /= nContrib;
        // cap net force
        let fmag = Math.hypot(fx, fy, fz);
        const fcap = 7000;
        if (fmag > fcap) { const s = fcap/fmag; fx*=s; fy*=s; fz*=s; fmag=fcap; }
        ball.vel[0] += fx * ball.invMass * h;
        ball.vel[1] += fy * ball.invMass * h;
        ball.vel[2] += fz * ball.invMass * h;
        // gentle anti-tunnelling, never kicks hard
        if (maxPen > 0.10) {
          const bm = Math.min((maxPen - 0.10) * 0.12, 0.008);
          bpos[0] += best.nx * bm; bpos[1] += best.ny * bm; bpos[2] += best.nz * bm;
        }
        // distribute reaction + dent over nearby vertices
        const dent = Math.min(maxPen * sim.dentScale, sim.dentMax);
        const reach = ball.r + sim.dentReach;
        const reach2 = reach * reach;
        let wsum = 0;
        const ids = [], wts = [];
        for (let i = 0; i < this.nv; i++) {
          const dx = pos[i*3] - cx0, dy = pos[i*3+1] - cy0, dz = pos[i*3+2] - cz0;
          const d2 = dx*dx + dy*dy + dz*dz;
          if (d2 < reach2) {
            const w = 1 - Math.sqrt(d2)/reach;
            const ww = w*w * (0.5 + 0.5 * Math.min(2, this.invMass[i]/22));
            ids.push(i); wts.push(ww); wsum += ww;
          }
        }
        const relvx = ball.vel[0]-avgVsx, relvy = ball.vel[1]-avgVsy, relvz = ball.vel[2]-avgVsz;
        if (wsum > 1e-9) {
          const J = fmag * h * 0.32;
          const ax = fx/Math.max(fmag,1e-6), ay = fy/Math.max(fmag,1e-6), az = fz/Math.max(fmag,1e-6);
          for (let j = 0; j < ids.length; j++) {
            const i = ids[j], w = wts[j]/wsum;
            const dv = Math.min(J * w * this.invMass[i], 1.2);
            this.vel[i*3] -= ax*dv; this.vel[i*3+1] -= ay*dv; this.vel[i*3+2] -= az*dv;
            const dm = dent * w * Math.min(1, this.invMass[i]/12);
            pos[i*3] -= ax*dm; pos[i*3+1] -= ay*dm; pos[i*3+2] -= az*dm;
          }
        }
        if (ball.mass > 10) sim.dbg = { F: +fmag.toFixed(1), n: nContrib, pen: +maxPen.toFixed(3), ballY: +bpos[1].toFixed(3), vy: +ball.vel[1].toFixed(2) };
        const impactSpeed = Math.max(0, -(relvx*best.nx + relvy*best.ny + relvz*best.nz));
        if (impactSpeed > 1.1 && ball.impactCool <= 0) {
          sim.events.push({ type: 'jelly-hit', strength: Math.min(1, impactSpeed / 6), body: this, pos: [bpos[0], bpos[1], bpos[2]] });
          ball.impactCool = 0.10;
        }
        // tangential friction + spin (only the component tangent to the contact)
        const nvx = best.nx, nvy = best.ny, nvz = best.nz;
        const vnBest = relvx*nvx + relvy*nvy + relvz*nvz;
        const tx = relvx - nvx*vnBest, ty = relvy - nvy*vnBest, tz = relvz - nvz*vnBest;
        const tl = Math.hypot(tx, ty, tz);
        if (tl > 1e-4) {
          const ft = Math.min(tl * 0.05, 0.06);
          ball.vel[0] -= tx/tl*ft; ball.vel[1] -= ty/tl*ft; ball.vel[2] -= tz/tl*ft;
          const contactArm = [best.qx-bpos[0], best.qy-bpos[1], best.qz-bpos[2]];
          const jf = [ -tx/tl*ft*ball.mass, -ty/tl*ft*ball.mass, -tz/tl*ft*ball.mass ];
          ball.spin[0] += (contactArm[1]*jf[2]-contactArm[2]*jf[1]) * 0.9;
          ball.spin[1] += (contactArm[2]*jf[0]-contactArm[0]*jf[2]) * 0.9;
          ball.spin[2] += (contactArm[0]*jf[1]-contactArm[1]*jf[0]) * 0.9;
        }
        const t = this.faceOwner[best.f];
        this.damage[t] = Math.min(this.damage[t] + impactSpeed * 0.006, 1.2);
        if (ball.impactCool > 0) ball.impactCool -= h;
      }
    }

    applyGround(friction) {
      const pos=this.pos, prev=this.prev, vel=this.vel;
      const tableTop = 0;
      const onTable = this.centerXZonTable();
      const g = onTable ? tableTop : TABLE.floor;
      this.groundY = g;
      for (let i=0;i<this.nv;i++) {
        if (pos[i*3+1] < g) {
          pos[i*3+1] = g;
          const nx = pos[i*3] - (prev[i*3] + (pos[i*3]-prev[i*3])*0.0);
          // static-ish friction: pull horizontal position back toward previous
          pos[i*3] = prev[i*3] + (pos[i*3]-prev[i*3]) * (1 - friction);
          pos[i*3+2] = prev[i*3+2] + (pos[i*3+2]-prev[i*3+2]) * (1 - friction);
          if (vel[i*3+1] < 0) vel[i*3+1] *= -0.15;
        }
      }
    }

    centerXZonTable() {
      let cx=0, cz=0;
      for (let i=0;i<this.nv;i++){cx+=this.pos[i*3];cz+=this.pos[i*3+2];}
      cx/=this.nv; cz/=this.nv;
      return Math.abs(cx) < TABLE.hx + 0.2 && Math.abs(cz) < TABLE.hz + 0.2;
    }

    integrate(h) {
      const pos=this.pos, vel=this.vel;
      this.prev.set(pos);
      const damp = Math.exp(-0.9 * h);
      for (let i=0;i<this.nv;i++) {
        if (this.invMass[i] <= 0) continue;
        vel[i*3+1] += GRAV * h;
        vel[i*3] *= damp; vel[i*3+1] *= damp; vel[i*3+2] *= damp;
        pos[i*3] += vel[i*3]*h; pos[i*3+1] += vel[i*3+1]*h; pos[i*3+2] += vel[i*3+2]*h;
      }
    }

    solve(h, sim) {
      const iter = this.sim.iterations;
      const pos=this.pos, inv=this.invMass;
      const soft = this.sim.softness * this.softMul; // 0 firm .. 1 soft
      const edgeCompliance = (0.00000006 + soft * soft * 0.000060) / (this.sim.stiffScale);
      const volCompliance = (0.000000006 + soft * 0.000000060) * this.sim.volScale;
      const ea=this.edgeA, eb=this.edgeB, er=this.edgeRest;
      const h2 = h*h;
      let lambdaE = new Float32Array(ea.length);
      let lambdaV = new Float32Array(this.nt);
      for (let it=0; it<iter; it++) {
        // edges
        const alphaE = edgeCompliance / h2;
        for (let e=0;e<ea.length;e++) {
          const a=ea[e], b=eb[e];
          const wa=inv[a], wb=inv[b];
          if (wa+wb < 1e-12) continue;
          let dx=pos[b*3]-pos[a*3], dy=pos[b*3+1]-pos[a*3+1], dz=pos[b*3+2]-pos[a*3+2];
          const L=Math.hypot(dx,dy,dz);
          if (L<1e-8) continue;
          dx/=L; dy/=L; dz/=L;
          const C = L - er[e];
          const dlambda = (-C - alphaE*lambdaE[e]) / (wa+wb+alphaE);
          lambdaE[e] += dlambda;
          const ca = dlambda * wa, cb = dlambda * wb;
          pos[a*3] -= dx*ca; pos[a*3+1] -= dy*ca; pos[a*3+2] -= dz*ca;
          pos[b*3] += dx*cb; pos[b*3+1] += dy*cb; pos[b*3+2] += dz*cb;
        }
        // volumes
        const alphaV = volCompliance / h2;
        const tet=this.tets;
        for (let t=0;t<this.nt;t++) {
          if (!this.alive[t]) continue;
          const ia=tet[t*4], ib=tet[t*4+1], ic=tet[t*4+2], id=tet[t*4+3];
          const ax=pos[ia*3], ay=pos[ia*3+1], az=pos[ia*3+2];
          const bx=pos[ib*3], by=pos[ib*3+1], bz=pos[ib*3+2];
          const cx=pos[ic*3], cy=pos[ic*3+1], cz=pos[ic*3+2];
          const dx=pos[id*3], dy=pos[id*3+1], dz=pos[id*3+2];
          const e1x=bx-ax, e1y=by-ay, e1z=bz-az;
          const e2x=cx-ax, e2y=cy-ay, e2z=cz-az;
          const e3x=dx-ax, e3y=dy-ay, e3z=dz-az;
          // V = dot(e1, cross(e2,e3))/6
          const n2x=e2y*e3z-e2z*e3y, n2y=e2z*e3x-e2x*e3z, n2z=e2x*e3y-e2y*e3x;
          const V = (e1x*n2x+e1y*n2y+e1z*n2z)/6;
          // gradients
          const g1x=(e2y*e3z-e2z*e3y)/6, g1y=(e2z*e3x-e2x*e3z)/6, g1z=(e2x*e3y-e2y*e3x)/6;
          const g2x=(e3y*e1z-e3z*e1y)/6, g2y=(e3z*e1x-e3x*e1z)/6, g2z=(e3x*e1y-e3y*e1x)/6;
          const g3x=(e1y*e2z-e1z*e2y)/6, g3y=(e1z*e2x-e1x*e2z)/6, g3z=(e1x*e2y-e1y*e2x)/6;
          const g0x=-(g1x+g2x+g3x), g0y=-(g1y+g2y+g3y), g0z=-(g1z+g2z+g3z);
          const wsum = inv[ia]*(g0x*g0x+g0y*g0y+g0z*g0z) + inv[ib]*(g1x*g1x+g1y*g1y+g1z*g1z) + inv[ic]*(g2x*g2x+g2y*g2y+g2z*g2z) + inv[id]*(g3x*g3x+g3y*g3y+g3z*g3z);
          if (wsum < 1e-14) continue;
          const C = V - this.restVol[t];
          const dlambda = (-C - alphaV*lambdaV[t]) / (wsum + alphaV);
          lambdaV[t] += dlambda;
          pos[ia*3] += dlambda*inv[ia]*g0x; pos[ia*3+1] += dlambda*inv[ia]*g0y; pos[ia*3+2] += dlambda*inv[ia]*g0z;
          pos[ib*3] += dlambda*inv[ib]*g1x; pos[ib*3+1] += dlambda*inv[ib]*g1y; pos[ib*3+2] += dlambda*inv[ib]*g1z;
          pos[ic*3] += dlambda*inv[ic]*g2x; pos[ic*3+1] += dlambda*inv[ic]*g2y; pos[ic*3+2] += dlambda*inv[ic]*g2z;
          pos[id*3] += dlambda*inv[id]*g3x; pos[id*3+1] += dlambda*inv[id]*g3y; pos[id*3+2] += dlambda*inv[id]*g3z;
        }
        // bounds
        for (let i=0;i<this.nv;i++) {
          if (pos[i*3+1] < this.groundY) pos[i*3+1] = this.groundY;
        }
      }
      this.shapeMatch(sim, h);
    }

    shapeMatch(sim, h) {
      // soft global shape memory (best-fit rotation + translation)
      const nv = this.nv, pos = this.pos, rest = this.restPos;
      if (!this._restCenter) {
        this._restCenter = [0,0,0];
        for (let i=0;i<nv;i++){ this._restCenter[0]+=rest[i*3]; this._restCenter[1]+=rest[i*3+1]; this._restCenter[2]+=rest[i*3+2]; }
        this._restCenter = this._restCenter.map(v=>v/nv);
      }
      const rc = this._restCenter;
      let cx=0, cy=0, cz=0;
      for (let i=0;i<nv;i++){ cx+=pos[i*3]; cy+=pos[i*3+1]; cz+=pos[i*3+2]; }
      cx/=nv; cy/=nv; cz/=nv;
      // covariance A = sum q r^T
      let a00=0,a01=0,a02=0,a10=0,a11=0,a12=0,a20=0,a21=0,a22=0;
      for (let i=0;i<nv;i++) {
        const qx=pos[i*3]-cx, qy=pos[i*3+1]-cy, qz=pos[i*3+2]-cz;
        const rx=rest[i*3]-rc[0], ry=rest[i*3+1]-rc[1], rz=rest[i*3+2]-rc[2];
        a00+=qx*rx; a01+=qx*ry; a02+=qx*rz;
        a10+=qy*rx; a11+=qy*ry; a12+=qy*rz;
        a20+=qz*rx; a21+=qz*ry; a22+=qz*rz;
      }
      // polar decomposition: R <- 0.5(R + R^-T), 6 iterations
      let R = new Float32Array([a00,a10,a20, a01,a11,a21, a02,a12,a22]);
      for (let it=0; it<6; it++) {
        const inv = invert3(R);
        if (!inv) break;
        const itx = new Float32Array([inv[0],inv[3],inv[6], inv[1],inv[4],inv[7], inv[2],inv[5],inv[8]]);
        for (let k=0;k<9;k++) R[k] = 0.5*(R[k] + itx[k]);
      }
      const det = R[0]*(R[4]*R[8]-R[5]*R[7]) - R[3]*(R[1]*R[8]-R[2]*R[7]) + R[6]*(R[1]*R[5]-R[2]*R[4]);
      if (!isFinite(det) || det < 0.05) R = new Float32Array([1,0,0, 0,1,0, 0,0,1]);
      const firm = 1 - Math.min(1, sim.softness * this.softMul);
      const st = 0.020 + firm * 0.050;
      const maxMove = 0.008;
      for (let i=0;i<nv;i++) {
        const rx=rest[i*3]-rc[0], ry=rest[i*3+1]-rc[1], rz=rest[i*3+2]-rc[2];
        const tx=cx + R[0]*rx + R[3]*ry + R[6]*rz;
        const ty=cy + R[1]*rx + R[4]*ry + R[7]*rz;
        const tz=cz + R[2]*rx + R[5]*ry + R[8]*rz;
        let dx=(tx-pos[i*3])*st, dy=(ty-pos[i*3+1])*st, dz=(tz-pos[i*3+2])*st;
        const dl=Math.hypot(dx,dy,dz);
        if (dl>maxMove){ const s=maxMove/dl; dx*=s;dy*=s;dz*=s; }
        pos[i*3]+=dx; pos[i*3+1]+=dy; pos[i*3+2]+=dz;
      }
    }

    updateVelocities(h) {
      const pos=this.pos, prev=this.prev, vel=this.vel;
      for (let i=0;i<this.nv;i++) {
        vel[i*3] = (pos[i*3]-prev[i*3])/h;
        vel[i*3+1] = (pos[i*3+1]-prev[i*3+1])/h;
        vel[i*3+2] = (pos[i*3+2]-prev[i*3+2])/h;
      }
    }

    boundsOf() {
      let mnx=1e9,mny=1e9,mnz=1e9,mxx=-1e9,mxy=-1e9,mxz=-1e9;
      for (let i=0;i<this.pos.length;i+=3) {
        mnx=Math.min(mnx,this.pos[i]); mxx=Math.max(mxx,this.pos[i]);
        mny=Math.min(mny,this.pos[i+1]); mxy=Math.max(mxy,this.pos[i+1]);
        mnz=Math.min(mnz,this.pos[i+2]); mxz=Math.max(mxz,this.pos[i+2]);
      }
      return [mnx,mny,mnz,mxx,mxy,mxz];
    }

    checkFracture(sim) {
      if (this.nt === 0) return null;
      const limitBase = (0.16 + sim.toughness * 0.95) * this.toughMul;
      const tet=this.tets, pos=this.pos;
      let broke=false;
      const freshDead = [];
      const edgeSet = new Map();
      for (let t=0;t<this.nt;t++) if (this.alive[t]) {
        const a=tet[t*4];
        const cols = new Float32Array(9);
        for (let k=0;k<3;k++) {
          cols[k  ] = pos[tet[t*4+1]*3+k] - pos[a*3+k];
          cols[k+3] = pos[tet[t*4+2]*3+k] - pos[a*3+k];
          cols[k+6] = pos[tet[t*4+3]*3+k] - pos[a*3+k];
        }
        const m = this.restInv.subarray(t*9, t*9+9);
        // F = cols * m
        let frob2=0;
        for (let c=0;c<3;c++) for (let r=0;r<3;r++) {
          const v = cols[0*3+r]*m[c*3+0] + cols[1*3+r]*m[c*3+1] + cols[2*3+r]*m[c*3+2];
          frob2 += v*v;
        }
        const strain = Math.sqrt(Math.max(0, (frob2-3)/3));
        const limit = limitBase * (this.damage[t] > 0 ? 0.8 : 1.0);
        if (strain > limit) {
          this.alive[t] = 0;
          this.damage[t] = 1.5;
          freshDead.push(t);
          broke = true;
          sim.events.push({ type: 'crack', strength: Math.min(1, strain / (limitBase + 0.3)), pos: [0,0,0] });
        } else {
          this.damage[t] = Math.max(0, this.damage[t] - 0.0007);
          if (strain > limit * 0.55) this.damage[t] += (strain/limit - 0.55) * 0.55;
          if (this.damage[t] > 1.0) { this.alive[t] = 0; freshDead.push(t); broke = true; sim.events.push({ type:'crack', strength: 0.3, pos:[0,0,0] }); }
        }
      }
      if (!broke) return null;
      this.fractured = true;
      // stress-concentration: damaged neighbours of a fresh crack can tear too
      if (freshDead.length) {
        const fmap = new Map();
        const faceDefs2 = [[1,2,3],[0,3,2],[0,1,3],[0,2,1]];
        for (let t=0;t<this.nt;t++) if (this.alive[t]) {
          const ids=[tet[t*4],tet[t*4+1],tet[t*4+2],tet[t*4+3]];
          for (const fd of faceDefs2) {
            const s=[ids[fd[0]],ids[fd[1]],ids[fd[2]]].sort((a,b)=>a-b);
            fmap.set(s[0]*1048576+s[1]*1024+s[2], t);
          }
        }
        for (const t of freshDead) {
          const ids=[tet[t*4],tet[t*4+1],tet[t*4+2],tet[t*4+3]];
          for (const fd of faceDefs2) {
            const s=[ids[fd[0]],ids[fd[1]],ids[fd[2]]].sort((a,b)=>a-b);
            const other=fmap.get(s[0]*1048576+s[1]*1024+s[2]);
            if (other !== undefined && this.alive[other]) {
              this.damage[other] = Math.min(1.0, this.damage[other] + 0.55);
              if (this.damage[other] >= 1.0) {
                this.alive[other] = 0;
                sim.events.push({ type:'crack', strength: 0.25, pos:[0,0,0] });
              }
            }
          }
        }
      }
      // macro crack: once local damage is sufficient, a through-going crack becomes unstable
      let brokenTotal = 0;
      for (let t=0;t<this.nt;t++) if (!this.alive[t]) brokenTotal++;
      if (sim.toughness < 0.5 && brokenTotal > 22 && (this.macroCracks || 0) < 1) {
        this.macroCracks = 1;
        let dx=0, dy=0, dz=0, nDead=0;
        const pos2=this.pos;
        for (const t of freshDead) {
          const a=tet[t*4],b=tet[t*4+1],c=tet[t*4+2],d=tet[t*4+3];
          dx += (pos2[a*3]+pos2[b*3]+pos2[c*3]+pos2[d*3])/4;
          dy += (pos2[a*3+1]+pos2[b*3+1]+pos2[c*3+1]+pos2[d*3+1])/4;
          dz += (pos2[a*3+2]+pos2[b*3+2]+pos2[c*3+2]+pos2[d*3+2])/4;
          nDead++;
        }
        if (nDead) { dx/=nDead; dy/=nDead; dz/=nDead; }
        else { const c=this.sim.bodyCenter(this); dx=c[0]; dy=c[1]; dz=c[2]; }
        let cx=0,cy=0,cz=0;
        for (let i=0;i<this.nv;i++){cx+=pos2[i*3];cy+=pos2[i*3+1];cz+=pos2[i*3+2];}
        cx/=this.nv;cy/=this.nv;cz/=this.nv;
        let nx=dx-cx, ny=dy-cy, nz=dz-cz;
        ny += 0.35 * Math.hypot(nx,ny,nz);
        const nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
        const px=cx + (dx-cx)*0.55, py=cy + (dy-cy)*0.55, pz=cz + (dz-cz)*0.55;
        for (let t=0;t<this.nt;t++) {
          if (!this.alive[t]) continue;
          const a=tet[t*4],b=tet[t*4+1],c=tet[t*4+2],d=tet[t*4+3];
          const tx=(pos2[a*3]+pos2[b*3]+pos2[c*3]+pos2[d*3])/4;
          const ty=(pos2[a*3+1]+pos2[b*3+1]+pos2[c*3+1]+pos2[d*3+1])/4;
          const tz=(pos2[a*3+2]+pos2[b*3+2]+pos2[c*3+2]+pos2[d*3+2])/4;
          const sd=(tx-px)*nx+(ty-py)*ny+(tz-pz)*nz;
          if (Math.abs(sd) < 0.035) { this.alive[t]=0; this.damage[t]=1.5; }
        }
        sim.events.push({ type:'crack', strength: 1.0, pos:[dx,dy,dz] });
      }
      this.rebuildFaces();
      const comps = this.components();
      if (comps.length > 1) {
        const pieces = comps.filter(c => c.length >= 1).map(c => this.extract(c));
        return pieces;
      }
      return null;
    }

    components() {
      const parent = new Int32Array(this.nt);
      for (let i=0;i<this.nt;i++) parent[i]=i;
      const find = (x) => { while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];} return x; };
      const union = (a,b) => { a=find(a);b=find(b); if(a!==b) parent[b]=a; };
      const faceMap = new Map();
      const faceDefs = [[1,2,3],[0,3,2],[0,1,3],[0,2,1]];
      for (let t=0;t<this.nt;t++) if (this.alive[t]) {
        const ids=[this.tets[t*4],this.tets[t*4+1],this.tets[t*4+2],this.tets[t*4+3]];
        for (const fd of faceDefs) {
          const s=[ids[fd[0]],ids[fd[1]],ids[fd[2]]].sort((a,b)=>a-b);
          const key=s[0]*1048576+s[1]*1024+s[2];
          if (faceMap.has(key)) union(t, faceMap.get(key)); else faceMap.set(key,t);
        }
      }
      const groups = new Map();
      for (let t=0;t<this.nt;t++) if (this.alive[t]) {
        const r=find(t);
        if (!groups.has(r)) groups.set(r,[]);
        groups.get(r).push(t);
      }
      return [...groups.values()];
    }

    extract(tetList) {
      const used = new Map();
      const oldVerts = [];
      for (const t of tetList) for (let k=0;k<4;k++) {
        const v=this.tets[t*4+k];
        if (!used.has(v)) { used.set(v, oldVerts.length); oldVerts.push(v); }
      }
      const nv=oldVerts.length;
      const rest=new Float32Array(nv*3), pos=new Float32Array(nv*3), vel=new Float32Array(nv*3);
      for (let i=0;i<nv;i++) {
        const o=oldVerts[i];
        for (let k=0;k<3;k++) {
          rest[i*3+k]=this.restPos[o*3+k];
          pos[i*3+k]=this.pos[o*3+k];
          vel[i*3+k]=this.vel[o*3+k];
        }
      }
      const tets=new Int32Array(tetList.length*4);
      for (let i=0;i<tetList.length;i++) for (let k=0;k<4;k++) tets[i*4+k]=used.get(this.tets[tetList[i]*4+k]);
      const nb=new JellyBody(this.sim, {
        rest, tets, color: this.color, deepColor: this.deepColor, alpha: this.alpha,
        density: this.density, tag: null, toughMul: this.toughMul, softMul: this.softMul
      });
      nb.pos.set(pos); nb.prev.set(pos); nb.vel.set(vel);
      return nb;
    }

    getMesh() {
      const gl = this.sim.gl;
      if (!this.mesh) {
        const maxFaces = Math.max(160, this.faceCount * 4 + 80);
        this.mesh = new GLU.DynMesh(gl, maxFaces * 3, [{ name: 'aBruise', size: 1 }]);
      }
      return this.mesh;
    }

    buildRenderData() {
      if (!this.faceCount) return 0;
      const mesh=this.getMesh();
      const maxVerts=mesh.maxVerts;
      const nf=this.faceCount;
      const count=nf*3;
      if (count > maxVerts) return 0;
      const P=mesh.pos, N=mesh.normal, B=mesh.extraArrays.aBruise;
      const acc=new Float32Array(this.nv*3);
      const pos=this.pos;
      for (let f=0; f<nf; f++) {
        const a=this.faces[f*3], b=this.faces[f*3+1], c=this.faces[f*3+2];
        const ax=pos[a*3], ay=pos[a*3+1], az=pos[a*3+2];
        const bx=pos[b*3], by=pos[b*3+1], bz=pos[b*3+2];
        const cx=pos[c*3], cy=pos[c*3+1], cz=pos[c*3+2];
        let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
        let ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
        let nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l;
        acc[a*3]+=nx; acc[a*3+1]+=ny; acc[a*3+2]+=nz;
        acc[b*3]+=nx; acc[b*3+1]+=ny; acc[b*3+2]+=nz;
        acc[c*3]+=nx; acc[c*3+1]+=ny; acc[c*3+2]+=nz;
      }
      for (let f=0; f<nf; f++) {
        const a=this.faces[f*3], b=this.faces[f*3+1], c=this.faces[f*3+2];
        const br=Math.min(1, this.damage[this.faceOwner[f]] * 0.8);
        const idx=[a,b,c];
        for (let k=0;k<3;k++) {
          const vi=idx[k], o=f*9+k*3;
          P[o]=pos[vi*3];P[o+1]=pos[vi*3+1];P[o+2]=pos[vi*3+2];
          let nx=acc[vi*3],ny=acc[vi*3+1],nz=acc[vi*3+2];
          const nl=Math.hypot(nx,ny,nz)||1;
          N[o]=nx/nl;N[o+1]=ny/nl;N[o+2]=nz/nl;
          B[f*3+k]=br;
        }
      }
      mesh.uploadAll(count);
      return count;
    }
  }

  class Ball {
    constructor(opts) {
      this.pos = opts.pos.slice();
      this.vel = (opts.vel || [0,0,0]).slice();
      this.r = opts.r || 0.1;
      this.mass = opts.mass || 10;
      this.invMass = 1 / this.mass;
      this.color = opts.color || [0.72,0.73,0.75];
      this.metal = opts.metal !== undefined ? opts.metal : 1;
      this.rough = opts.rough !== undefined ? opts.rough : 0.22;
      this.rest = opts.rest !== undefined ? opts.rest : 0.42;
      this.name = opts.name || '';
      this.spin = [0,0,0];
      this.quat = [0,0,0,1];
      this.rotMat = qToMat3(this.quat);
      this.impactCool = 0;
      this.age = 0;
      this.sleep = false;
    }
    integrate(h) {
      this.age += h;
      if (this.sleep) return;
      this.vel[1] += GRAV * h;
      this.pos[0] += this.vel[0]*h;
      this.pos[1] += this.vel[1]*h;
      this.pos[2] += this.vel[2]*h;
    }
    integrateRotation(h) {
      const sp=this.spin;
      if (Math.abs(sp[0])+Math.abs(sp[1])+Math.abs(sp[2]) < 1e-5) return;
      const angle=Math.hypot(sp[0],sp[1],sp[2])*h;
      if (angle < 1e-7) return;
      const ax=sp[0]/Math.hypot(sp[0],sp[1],sp[2]);
      const ay=sp[1]/Math.hypot(sp[0],sp[1],sp[2]);
      const az=sp[2]/Math.hypot(sp[0],sp[1],sp[2]);
      const s=Math.sin(angle/2), c=Math.cos(angle/2);
      this.quat=qNorm(qMul([ax*s,ay*s,az*s,c], this.quat));
      this.rotMat=qToMat3(this.quat);
    }
  }

  class JellySim {
    constructor(gl) {
      this.gl = gl;
      this.bodies = [];
      this.balls = [];
      this.events = [];
      this.pending = [];
      this.time = 0;
      this.iterations = 7;
      this.softness = 0.55;
      this.toughness = 0.55;
      this.stiffScale = 0.15;
      this.contactK = 1000;
      this.contactC = 120;
      this.dentScale = 0.7;
      this.dentMax = 0.02;
      this.dentReach = 0.18;
      this.volScale = 4;
      this.ballJellyRestitution = 0.22;
      this.bodyMassScale = 1;
      this.onReset = null;
      this.selected = 0;
      this.impacts = 0;
    }

    addBody(def, tag) {
      const mesh = boxTetMesh(def.sx, def.sy, def.sz, def.nx, def.ny, def.nz);
      // bevel the outer boundary into a rounded gummy block
      const rr = Math.min(def.sx, def.sy, def.sz) * 0.105;
      const hx = def.sx/2 - rr, hy = def.sy/2 - rr, hz = def.sz/2 - rr;
      const nvx = def.nx + 1, nvy = def.ny + 1, nvz = def.nz + 1;
      for (let k = 0; k < nvz; k++) for (let j = 0; j < nvy; j++) for (let i = 0; i < nvx; i++) {
        if (i !== 0 && i !== def.nx && j !== 0 && j !== def.ny && k !== 0 && k !== def.nz) continue;
        const vi = (i + nvx * (j + nvy * k)) * 3;
        const x = mesh.rest[vi], y = mesh.rest[vi+1], z = mesh.rest[vi+2];
        const cx = Math.max(-hx, Math.min(hx, x));
        const cy = Math.max(-hy, Math.min(hy, y));
        const cz = Math.max(-hz, Math.min(hz, z));
        let dx = x-cx, dy = y-cy, dz = z-cz;
        const L = Math.hypot(dx,dy,dz) || 1;
        mesh.rest[vi] = cx + dx/L*rr;
        mesh.rest[vi+1] = cy + dy/L*rr;
        mesh.rest[vi+2] = cz + dz/L*rr;
      }
      for (let i=0;i<mesh.rest.length;i+=3) {
        mesh.rest[i] += def.center[0];
        mesh.rest[i+1] += def.center[1];
        mesh.rest[i+2] += def.center[2];
      }
      const body = new JellyBody(this, {
        rest: mesh.rest, tets: mesh.tets, color: def.color, deepColor: def.deepColor,
        density: def.density || 150, tag, toughMul: def.toughMul, softMul: def.softMul,
        alpha: def.alpha
      });
      body.spawn = { center: def.center, sx: def.sx, sy: def.sy, sz: def.sz, def };
      this.bodies.push(body);
      return body;
    }

    addBall(opts) {
      const b = new Ball(opts);
      this.balls.push(b);
      return b;
    }

    clearBalls(keepStatic) {
      this.balls = this.balls.filter(b => keepStatic && b.static);
    }

    step(dt) {
      const sub = 9;
      const h = dt / sub;
      for (let s=0;s<sub;s++) {
        for (const b of this.bodies) { b.groundY = 0; b.integrate(h); }
        for (const b of this.balls) b.integrate(h);
        for (const body of this.bodies) body.solve(h, this);
        for (const body of this.bodies) body.applyGround(0.55);
        for (const body of this.bodies) body.updateVelocities(h);
        // contacts transfer impulses after velocities are derived from deformation
        for (const ball of this.balls) {
          ball.impactCool -= h;
          for (const body of this.bodies) body.addBallContacts([ball], h, this);
        }
        for (const ball of this.balls) this.ballWorld(ball, h);
        this.ballBall(h);
      }
      // fracture check at lower rate
      const newBodies = [];
      const kept = [];
      for (const body of this.bodies) {
        const pieces = body.checkFracture(this);
        if (pieces) {
          for (const p of pieces) newBodies.push(p);
        } else if (body.alive.some(a => a)) {
          kept.push(body);
        }
      }
      this.bodies = kept.concat(newBodies);
      this.time += dt;
      // pending drops
      for (let i=this.pending.length-1;i>=0;i--) {
        const p=this.pending[i];
        p.delay -= dt;
        if (p.delay <= 0) { this.spawnDrop(p.opts); this.pending.splice(i,1); }
      }
      // remove old balls
      if (this.balls.length > 9) {
        this.balls.sort((a,b)=>(a.static?1:0)-(b.static?1:0) || b.age-a.age);
        this.balls.length = 9;
      }
    }

    ballWorld(ball, h) {
      const p=ball.pos, v=ball.vel;
      const onTable = Math.abs(p[0]) < TABLE.hx && Math.abs(p[2]) < TABLE.hz;
      const g = onTable ? 0 : TABLE.floor;
      if (p[1] - ball.r < g) {
        p[1] = g + ball.r;
        if (v[1] < 0) {
          if (v[1] < -0.8 && ball.impactCool <= 0) {
            this.events.push({ type:'ball-floor', strength: Math.min(1, -v[1]/5), pos:[...p] });
            ball.impactCool = 0.08;
          }
          v[1] = -v[1] * ball.rest;
          if (Math.abs(v[1]) < 0.35) v[1] = 0;
        }
        v[0] *= 0.985; v[2] *= 0.985;
        // rolling spin
        const r=ball.r;
        ball.spin[0] *= 0.9; ball.spin[1] *= 0.92; ball.spin[2] *= 0.9;
        ball.spin[0] += (v[2]/r - ball.spin[0]) * 0.25;
        ball.spin[2] += (-v[0]/r - ball.spin[2]) * 0.25;
      }
      // table edge: ball rolls off
      if (!onTable && p[1]-ball.r < TABLE.floor) { p[1]=TABLE.floor+ball.r; v[1]=Math.abs(v[1])*0.3; }
      ball.integrateRotation(h);
      // studio bounds
      if (Math.abs(p[0])>6 || Math.abs(p[2])>6) { v[0]*=-0.2; v[2]*=-0.2; p[0]=Math.max(-6,Math.min(6,p[0])); p[2]=Math.max(-6,Math.min(6,p[2])); }
    }

    ballBall(h) {
      const balls=this.balls;
      for (let i=0;i<balls.length;i++) for (let j=i+1;j<balls.length;j++) {
        const a=balls[i], b=balls[j];
        let dx=b.pos[0]-a.pos[0], dy=b.pos[1]-a.pos[1], dz=b.pos[2]-a.pos[2];
        const d=Math.hypot(dx,dy,dz);
        const rr=a.r+b.r;
        if (d>rr || d<1e-6) continue;
        dx/=d;dy/=d;dz/=d;
        const pen=rr-d;
        const tot=a.invMass+b.invMass;
        a.pos[0]-=dx*pen*(a.invMass/tot); a.pos[1]-=dy*pen*(a.invMass/tot); a.pos[2]-=dz*pen*(a.invMass/tot);
        b.pos[0]+=dx*pen*(b.invMass/tot); b.pos[1]+=dy*pen*(b.invMass/tot); b.pos[2]+=dz*pen*(b.invMass/tot);
        const rvx=b.vel[0]-a.vel[0], rvy=b.vel[1]-a.vel[1], rvz=b.vel[2]-a.vel[2];
        const vn=rvx*dx+rvy*dy+rvz*dz;
        if (vn<0) {
          const e=0.55;
          const jimp=-(1+e)*vn/tot;
          a.vel[0]-=dx*jimp*a.invMass; a.vel[1]-=dy*jimp*a.invMass; a.vel[2]-=dz*jimp*a.invMass;
          b.vel[0]+=dx*jimp*b.invMass; b.vel[1]+=dy*jimp*b.invMass; b.vel[2]+=dz*jimp*b.invMass;
          if (Math.abs(vn)>0.9) this.events.push({type:'ball-ball', strength:Math.min(1,Math.abs(vn)/4), pos:[...b.pos]});
        }
      }
    }

    bodyCenter(body) {
      let cx=0,cy=0,cz=0;
      for (let i=0;i<body.nv;i++){cx+=body.pos[i*3];cy+=body.pos[i*3+1];cz+=body.pos[i*3+2];}
      return [cx/body.nv, cy/body.nv, cz/body.nv];
    }

    bodyTop(body) {
      let m=-1e9;
      for (let i=1;i<body.pos.length;i+=3) if (body.pos[i]>m) m=body.pos[i];
      return m;
    }

    findTag(tag) { return this.bodies.find(b => b.tag === tag); }

    spawnDrop(opts) {
      const body = opts.body && this.bodies.includes(opts.body) ? opts.body : this.findTag(opts.tag);
      if (body) {
        const c = this.bodyCenter(body);
        const top = this.bodyTop(body);
        opts.pos = [c[0] + (opts.dx||0), top + 0.12 + opts.height, c[2] + (opts.dz||0)];
        opts.vel = [opts.vx||0, opts.vy||0, opts.vz||0];
      }
      if (!opts.pos) return null;
      const ball = this.addBall({
        pos: opts.pos, vel: opts.vel || [0,0,0],
        r: opts.r || (0.062 + Math.cbrt(opts.mass / 8) * 0.024),
        mass: opts.mass, color: opts.color || [0.78,0.79,0.81],
        metal: opts.metal !== undefined ? opts.metal : 1,
        rough: opts.rough !== undefined ? opts.rough : 0.18,
        rest: opts.rest !== undefined ? opts.rest : 0.34,
        name: opts.name
      });
      this.events.push({ type:'whoosh', pos: [opts.pos[0], opts.pos[1], opts.pos[2]] });
      return ball;
    }

    trigger(mode, p) {
      const tag = p.tag !== undefined ? p.tag : this.selected;
      const target = this.findTag(tag);
      if (!target) return;
      const mass = p.mass || 10;
      const height = p.height || 1.2;
      const base = { tag, mass, height, color:[0.8,0.81,0.83] };
      if (mode === 'center') {
        this.spawnDrop({ ...base, dx: 0.01, dz: 0.01, r: 0.062 + Math.cbrt(mass/8)*0.024 });
      } else if (mode === 'offset') {
        const c = this.bodyCenter(target);
        // choose offset relative to body extents
        const b = target.spawn;
        const dx = Math.min(0.24, (b ? b.sx : 0.5) * 0.36);
        const dz = Math.min(0.16, (b ? b.sz : 0.5) * 0.18);
        this.spawnDrop({ ...base, dx, dz, vx: 0.5, r: 0.062 + Math.cbrt(mass/8)*0.024, metal: 1 });
      } else if (mode === 'multi') {
        const m = mass;
        const h = height;
        const c = this.bodyCenter(target);
        const top = this.bodyTop(target);
        const seq = [
          { delay: 0.00, mass: m*0.72, height: h*0.55, dx: 0.03, dz: 0.02, r: 0.075 },
          { delay: 0.48, mass: m*1.08, height: h*0.82, dx: -0.05, dz: 0.03, r: 0.083 },
          { delay: 0.98, mass: m*1.7, height: h*1.12, dx: 0.02, dz: -0.02, r: 0.094 }
        ];
        for (const s of seq) {
          this.pending.push({ delay: s.delay, opts: { ...base, ...s,
            pos: [c[0] + s.dx, top + 0.16 + s.height, c[2] + s.dz],
            vel: [0, 0, 0], tag: undefined } });
        }
      }
      this.impacts++;
    }

    snapshotBalls() {
      return this.balls.filter(b=>b.static).map(b => ({ pos: [...b.pos], vel: [...b.vel] }));
    }
  }

  JellySim.Ball = Ball;
  JellySim.JellyBody = JellyBody;
  JellySim.boxTetMesh = boxTetMesh;
  JellySim.TABLE = TABLE;
  window.JellySim = JellySim;
  window.QMath = { qMul, qNorm, qToMat3 };
})();
