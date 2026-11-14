/**
 * Forge Studio — Interactive Composition Viewport & Precision Gizmo Overlay
 * Handles:
 *   - Viewport Zoom / Pan / Fit
 *   - Selection boxes, handles, 3D XYZ axis gizmos under active Camera & Parent transforms (2.2, 2.12)
 *   - Pan-Behind Anchor Point tool keeping visual screen position unchanged (2.2)
 *   - Motion Paths with straight/curve/broken spatial Bezier handles (2.3)
 *   - Interactive Rectangle, Ellipse, Pen Bezier drawing & vertex/tangent editing (2.5, 2.9)
 *   - Puppet Pin placement & dragging with triangulated mesh preview (2.8)
 *   - Visible Helper Gizmos: Grid, Spatial Field spheres/swirls, Lights & Camera frustum (2.1, 2.8)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, DEG2RAD, RAD2DEG, Vec2, Vec3, Mat4, uid } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;
  const Particles = Forge.Particles;
  const Scene = Forge.SceneEval;

  class CanvasOverlayController {
    constructor(app) {
      this.app = app;
      this.wrapEl = document.getElementById('viewport-stage');
      this.glCanvas = document.getElementById('gl-canvas');
      this.gizmoCanvas = document.getElementById('gizmo-canvas');
      this.ctx = this.gizmoCanvas.getContext('2d');

      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.autoFit = true;

      this.helpers = {
        grid: false,
        motionPath: true,
        fields: true,
        lightsCam: true,
        handles: true
      };

      this.customView = {
        enabled: false,
        orbitYaw: -28,
        orbitPitch: 18,
        distance: 920,
        eye: [920, 220, -820],
        target: [640, 360, 0]
      };

      this.dragState = null;
      this.activePenItem = null; // Currently open Bezier path being drawn by Pen tool
      this.selectedPathVertex = null; // { itemOrMask, contourIdx, vertIdx }

      this._bindEvents();
    }

    fitToViewport() {
      const comp = this.app.getActiveComp();
      if (!comp || !this.wrapEl) return;
      const rect = this.wrapEl.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return;
      const pad = 36;
      const zx = (rect.width - pad * 2) / comp.width;
      const zy = (rect.height - pad * 2) / comp.height;
      this.zoom = clamp(Math.min(zx, zy), 0.1, 4.0);
      this.panX = (rect.width - comp.width * this.zoom) * 0.5;
      this.panY = (rect.height - comp.height * this.zoom) * 0.5;
      this._applyStageLayout();
    }

    setZoomPreset(val) {
      if (val === 'fit') {
        this.autoFit = true;
        this.fitToViewport();
      } else {
        this.autoFit = false;
        const comp = this.app.getActiveComp();
        const rect = this.wrapEl.getBoundingClientRect();
        this.zoom = clamp(Number(val) || 1, 0.1, 5.0);
        if (comp) {
          this.panX = (rect.width - comp.width * this.zoom) * 0.5;
          this.panY = (rect.height - comp.height * this.zoom) * 0.5;
        }
        this._applyStageLayout();
      }
      this.renderGizmos();
    }

    _applyStageLayout() {
      const comp = this.app.getActiveComp();
      const rect = this.wrapEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const gw = Math.max(1, Math.round(rect.width * dpr));
      const gh = Math.max(1, Math.round(rect.height * dpr));
      if (this.gizmoCanvas.width !== gw || this.gizmoCanvas.height !== gh) {
        this.gizmoCanvas.width = gw;
        this.gizmoCanvas.height = gh;
      }

      if (!comp) {
        this.glCanvas.style.display = 'none';
        return;
      }
      this.glCanvas.style.display = 'block';
      this.glCanvas.style.left = `${this.panX}px`;
      this.glCanvas.style.top = `${this.panY}px`;
      this.glCanvas.style.width = `${comp.width * this.zoom}px`;
      this.glCanvas.style.height = `${comp.height * this.zoom}px`;
    }

    // Coordinate conversions: Viewport CSS px <-> Composition px <-> 3D World
    clientToComp(clientX, clientY) {
      const rect = this.wrapEl.getBoundingClientRect();
      const vx = clientX - rect.left;
      const vy = clientY - rect.top;
      return [
        (vx - this.panX) / this.zoom,
        (vy - this.panY) / this.zoom,
        vx,
        vy
      ];
    }

    compToViewport(cx, cy) {
      return [this.panX + cx * this.zoom, this.panY + cy * this.zoom];
    }

    worldToViewport(worldPt, cam, comp) {
      const proj = Mat4.projectToComp(cam.viewProj, worldPt, comp.width, comp.height);
      if (!proj) return null;
      return [this.panX + proj[0] * this.zoom, this.panY + proj[1] * this.zoom, proj[2], proj[3]];
    }

    layerPointToViewport(layer, localPt3, t, comp, cam) {
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const wp = Mat4.transformPoint(worldM, localPt3);
      if (layer.threeD) {
        return this.worldToViewport(wp, cam, comp);
      }
      return this.compToViewport(wp[0], wp[1]);
    }

    // Unproject composition pixel (cx, cy) onto a 3D world plane passing through `planeOrigin` with `planeNormal`
    compPointToWorldPlane(cx, cy, planeOrigin, planeNormal, cam, comp) {
      const ray = Mat4.unprojectRay(cam.invViewProj, cx, cy, comp.width, comp.height);
      const denom = Vec3.dot(ray.dir, planeNormal);
      if (Math.abs(denom) < 1e-6) return planeOrigin;
      const tHit = Vec3.dot(Vec3.sub(planeOrigin, ray.origin), planeNormal) / denom;
      return Vec3.addScaled(ray.origin, ray.dir, tHit);
    }

    _updateCustomOrbitEye() {
      const cv = this.customView;
      const comp = this.app.getActiveComp();
      const target = comp ? [comp.width * 0.5, comp.height * 0.5, 0] : [640, 360, 0];
      cv.target = target;
      const yaw = cv.orbitYaw * DEG2RAD;
      const pitch = clamp(cv.orbitPitch, -85, 85) * DEG2RAD;
      const d = cv.distance;
      cv.eye = [
        target[0] + Math.sin(yaw) * Math.cos(pitch) * d,
        target[1] - Math.sin(pitch) * d,
        target[2] - Math.cos(yaw) * Math.cos(pitch) * d
      ];
    }

    // =========================================================================
    // POINTER & WHEEL INTERACTION
    // =========================================================================
    _bindEvents() {
      this.wrapEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.wrapEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const nextZoom = clamp(this.zoom * factor, 0.12, 5.0);
        this.panX = mx - ((mx - this.panX) / this.zoom) * nextZoom;
        this.panY = my - ((my - this.panY) / this.zoom) * nextZoom;
        this.zoom = nextZoom;
        this.autoFit = false;
        this._applyStageLayout();
        this.renderGizmos();
        this.app.updateZoomReadout();
      }, { passive: false });

      this.wrapEl.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      window.addEventListener('pointermove', (e) => this._onPointerMove(e));
      window.addEventListener('pointerup', (e) => this._onPointerUp(e));
      this.wrapEl.addEventListener('dblclick', (e) => this._onDoubleClick(e));
    }

    _onDoubleClick(e) {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const [cx, cy] = this.clientToComp(e.clientX, e.clientY);
      const hit = Scene.pickLayerAtCompPoint(comp, cx, cy, this.app.currentTime, this.app.project, this.customView);
      if (hit && hit.type === 'precomp' && (hit.sourceCompId || hit.compId)) {
        this.app.setActiveComp(hit.sourceCompId || hit.compId);
      } else if (hit && hit.type === 'text') {
        const inp = document.getElementById('insp-text-content');
        if (inp) inp.focus();
      }
    }

    _onPointerDown(e) {
      if (this.app.exportMode) return;
      const comp = this.app.getActiveComp();
      if (!comp) return;

      const [cx, cy, vx, vy] = this.clientToComp(e.clientX, e.clientY);
      const tool = this.app.activeTool;

      // Middle click or Hand tool (`H`) or Spacebar held -> Pan Viewport
      if (e.button === 1 || tool === 'hand' || this.app.spacePressed) {
        this.dragState = {
          kind: 'pan',
          startClientX: e.clientX,
          startClientY: e.clientY,
          origPanX: this.panX,
          origPanY: this.panY
        };
        return;
      }

      if (e.button !== 0) return;

      // Camera Orbit Tool (`C`)
      if (tool === 'camera') {
        this.app.history.beginTransaction(this.app.project, '调整摄像机视角');
        const cam = Scene.getActiveCameraState(comp, this.app.currentTime, this.app.project, this.customView);
        this.dragState = {
          kind: 'orbitCamera',
          startClientX: e.clientX,
          startClientY: e.clientY,
          camLayer: this.customView.enabled ? null : cam.cameraLayer,
          startEye: [...cam.eye],
          startTarget: [...cam.target],
          altPan: e.altKey || e.shiftKey
        };
        return;
      }

      const t = this.app.currentTime;
      const cam = Scene.getActiveCameraState(comp, t, this.app.project, this.customView);
      const selLayer = this.app.getPrimarySelectedLayer();

      // 1. Rectangle / Ellipse Creation Tool (`rect` / `ellipse`)
      if (tool === 'rect' || tool === 'ellipse') {
        this.app.history.beginTransaction(this.app.project, '绘制图形');
        let targetLayer = (e.shiftKey && selLayer && selLayer.type === 'shape' && !selLayer.locked) ? selLayer : null;
        if (!targetLayer) {
          targetLayer = Scene.createShapeLayer(comp, tool === 'ellipse' ? `椭圆形状 ${comp.layers.length + 1}` : `矩形形状 ${comp.layers.length + 1}`, 'empty');
          targetLayer.transform.position.value = [cx, cy, 0];
          comp.layers.unshift(targetLayer);
          this.app.selectLayers([targetLayer.id]);
        }
        const invM = Mat4.invert(Anim.getLayerWorldMatrix(targetLayer, t, comp, this.app.project));
        const lp = Mat4.transformPoint(invM, [cx, cy, 0]);
        const newItem = tool === 'ellipse'
          ? {
              id: uid('sh'), kind: 'ellipse', name: `椭圆 ${targetLayer.shapeData.items.length + 1}`, enabled: true,
              position: Anim.createProp([lp[0], lp[1]], 'vec2', { label: '位置' }),
              size: Anim.createProp([4, 4], 'vec2', { label: '尺寸' })
            }
          : {
              id: uid('sh'), kind: 'rect', name: `矩形 ${targetLayer.shapeData.items.length + 1}`, enabled: true,
              position: Anim.createProp([lp[0], lp[1]], 'vec2', { label: '位置' }),
              size: Anim.createProp([4, 4], 'vec2', { label: '尺寸' }),
              roundness: Anim.createProp(8, 'scalar', { min: 0, max: 200, label: '圆角' })
            };
        targetLayer.shapeData.items.unshift(newItem);
        this.dragState = {
          kind: 'drawParametricShape',
          layer: targetLayer,
          item: newItem,
          startLocal: [lp[0], lp[1]],
          invM
        };
        this.app.refreshAll();
        return;
      }

      // 2. Pen / Bezier Path Drawing & Knot Editing (`pen`)
      if (tool === 'pen') {
        this._handlePenDown(e, cx, cy, vx, vy, comp, selLayer, t);
        return;
      }

      // 3. Puppet Pin Tool (`pin`)
      if (tool === 'pin') {
        let target = selLayer && (selLayer.type === 'shape' || selLayer.type === 'text') ? selLayer : null;
        if (!target) {
          const picked = Scene.pickLayerAtCompPoint(comp, cx, cy, t, this.app.project, this.customView);
          if (picked && (picked.type === 'shape' || picked.type === 'text')) {
            target = picked;
            this.app.selectLayers([target.id]);
          }
        }
        if (target && !target.locked) {
          const invM = Mat4.invert(Anim.getLayerWorldMatrix(target, t, comp, this.app.project));
          const lp = target.threeD
            ? Mat4.transformPoint(invM, this.compPointToWorldPlane(cx, cy, Mat4.transformPoint(Anim.getLayerWorldMatrix(target, t, comp, this.app.project), [0, 0, 0]), Vec3.norm(Mat4.transformDir(Anim.getLayerWorldMatrix(target, t, comp, this.app.project), [0, 0, -1])), cam, comp))
            : Mat4.transformPoint(invM, [cx, cy, 0]);

          // Check if clicking an existing pin first!
          for (let pi = 0; pi < (target.puppetPins || []).length; pi++) {
            const pin = target.puppetPins[pi];
            const pVal = Anim.evalProp(pin.position, t, { project: this.app.project, comp, layer: target });
            const vp = this.layerPointToViewport(target, [pVal[0], pVal[1], 0], t, comp, cam);
            if (vp && Math.hypot(vp[0] - vx, vp[1] - vy) <= 13) {
              this.app.history.beginTransaction(this.app.project, '拖动变形图钉');
              this.dragState = { kind: 'dragPin', layer: target, pin, invM };
              return;
            }
          }

          // Place a new Puppet Pin (`位置/旋转/缩放图钉`)!
          this.app.history.beginTransaction(this.app.project, '添加变形图钉');
          if (!target.puppetPins) target.puppetPins = [];
          if (target.type === 'shape' && target.shapeData) target.shapeData.triangulateMesh = true;
          const newPin = {
            id: uid('pin'),
            name: `图钉 ${target.puppetPins.length + 1}`,
            restPos: [lp[0], lp[1]],
            position: Anim.createProp([lp[0], lp[1]], 'vec2', { label: '图钉位置' }),
            rotation: Anim.createProp(0, 'scalar', { label: '图钉旋转 °' }),
            scale: Anim.createProp([100, 100], 'vec2', { label: '图钉缩放 %' })
          };
          newPin.position.animated = true;
          Anim.setPropValueAtTime(newPin.position, [lp[0], lp[1]], t);
          target.puppetPins.push(newPin);
          this.dragState = { kind: 'dragPin', layer: target, pin: newPin, invM };
          this.app.refreshAll();
          return;
        }
      }

      // 4. Check Gizmo Handles on Currently Selected Layer FIRST (3D XYZ axes, Motion Path handles, Scale/Rotate corners, Anchor, Pins, Path knots!)
      if (selLayer && !selLayer.locked && selLayer.visible !== false) {
        const gizmoHit = this._hitTestSelectedLayerGizmos(selLayer, vx, vy, cx, cy, t, comp, cam, e);
        if (gizmoHit) {
          this.app.history.beginTransaction(this.app.project, gizmoHit.label || '直接编辑变换');
          this.dragState = gizmoHit;
          return;
        }
      }

      // 5. Scene Raycast Hit-Test to Select & Drag Layer (`点选命中可见几何上最近的可选表面`)
      const hitLayer = Scene.pickLayerAtCompPoint(comp, cx, cy, t, this.app.project, this.customView);
      if (hitLayer) {
        if (e.shiftKey) {
          this.app.toggleLayerSelection(hitLayer.id);
        } else if (!this.app.selectedLayerIds.has(hitLayer.id)) {
          this.app.selectLayers([hitLayer.id]);
        }

        if (!hitLayer.locked) {
          if (tool === 'anchor') {
            this.app.history.beginTransaction(this.app.project, '移动图层锚点');
            this.dragState = this._makeAnchorDragState(hitLayer, cx, cy, t, comp, cam);
          } else if (tool === 'rotate') {
            this.app.history.beginTransaction(this.app.project, '旋转图层');
            this.dragState = this._makeRotateDragState(hitLayer, vx, vy, t, comp, cam);
          } else {
            this.app.history.beginTransaction(this.app.project, '平移图层');
            this.dragState = this._makeTranslateDragState(this.app.getSelectedLayers(), cx, cy, t, comp, cam);
          }
        }
      } else if (!e.shiftKey) {
        this.app.selectLayers([]);
      }
    }

    _handlePenDown(e, cx, cy, vx, vy, comp, selLayer, t) {
      const cam = Scene.getActiveCameraState(comp, t, this.app.project, this.customView);
      let targetLayer = selLayer && selLayer.type === 'shape' && !selLayer.locked ? selLayer : null;

      // Check existing Bezier path vertices/tangents on selected shape layer or mask first!
      if (selLayer && !selLayer.locked) {
        const pathContainers = [];
        if (selLayer.type === 'shape' && selLayer.shapeData) {
          for (const it of selLayer.shapeData.items) {
            if (it.kind === 'path' && it.path) pathContainers.push({ prop: it.path, item: it });
          }
        }
        for (const mk of (selLayer.masks || [])) {
          if (mk.path) pathContainers.push({ prop: mk.path, item: mk });
        }

        const invM = Mat4.invert(Anim.getLayerWorldMatrix(selLayer, t, comp, this.app.project));
        for (const pc of pathContainers) {
          const contours = Anim.evalProp(pc.prop, t, { project: this.app.project, comp, layer: selLayer }) || [];
          for (let ci = 0; ci < contours.length; ci++) {
            const c = contours[ci];
            for (let vi = 0; vi < c.vertices.length; vi++) {
              const v = c.vertices[vi];
              const vp = this.layerPointToViewport(selLayer, [v.p[0], v.p[1], 0], t, comp, cam);
              if (!vp) continue;
              // Close open path when clicking start vertex!
              if (this.activePenItem === pc.item && !c.closed && vi === 0 && c.vertices.length >= 2 && Math.hypot(vp[0] - vx, vp[1] - vy) <= 12) {
                this.app.history.beginTransaction(this.app.project, '闭合贝塞尔路径');
                const copy = Geo2D.cloneContours(contours);
                copy[ci].closed = true;
                Anim.setPropValueAtTime(pc.prop, copy, t);
                this.activePenItem = null;
                this.app.history.commitTransaction(this.app.project);
                this.app.refreshAll();
                return;
              }
              if (Math.hypot(vp[0] - vx, vp[1] - vy) <= 9) {
                this.app.history.beginTransaction(this.app.project, '编辑路径节点');
                this.selectedPathVertex = { prop: pc.prop, ci, vi };
                this.dragState = {
                  kind: 'dragBezierVertex',
                  layer: selLayer,
                  prop: pc.prop,
                  ci, vi,
                  subPart: e.altKey ? 'outHandle' : 'point',
                  breakTangent: e.altKey,
                  invM
                };
                return;
              }
            }
          }
        }
      }

      // Otherwise add a new Bezier vertex (creating a Shape Layer / Path Item if needed!)
      this.app.history.beginTransaction(this.app.project, '钢笔绘制路径');
      if (!targetLayer) {
        targetLayer = Scene.createShapeLayer(comp, `钢笔路径 ${comp.layers.length + 1}`, 'empty');
        targetLayer.transform.position.value = [comp.width * 0.5, comp.height * 0.5, 0];
        comp.layers.unshift(targetLayer);
        this.app.selectLayers([targetLayer.id]);
      }

      const invM = Mat4.invert(Anim.getLayerWorldMatrix(targetLayer, t, comp, this.app.project));
      const lp = Mat4.transformPoint(invM, [cx, cy, 0]);

      let pathItem = this.activePenItem && targetLayer.shapeData.items.includes(this.activePenItem)
        ? this.activePenItem
        : null;

      if (!pathItem) {
        pathItem = {
          id: uid('sh'),
          kind: 'path',
          name: `贝塞尔路径 ${targetLayer.shapeData.items.length + 1}`,
          enabled: true,
          path: Anim.createProp([{ closed: false, vertices: [] }], 'path', { label: '路径形状' })
        };
        targetLayer.shapeData.items.unshift(pathItem);
        this.activePenItem = pathItem;
      }

      const contours = Geo2D.cloneContours(Anim.evalProp(pathItem.path, t, { project: this.app.project, comp, layer: targetLayer }));
      if (contours.length === 0) contours.push({ closed: false, vertices: [] });
      const ci = contours.length - 1;
      contours[ci].vertices.push({ p: [lp[0], lp[1]], in: [0, 0], out: [0, 0] });
      const vi = contours[ci].vertices.length - 1;
      Anim.setPropValueAtTime(pathItem.path, contours, t);

      this.selectedPathVertex = { prop: pathItem.path, ci, vi };
      this.dragState = {
        kind: 'dragBezierVertex',
        layer: targetLayer,
        prop: pathItem.path,
        ci, vi,
        subPart: 'bothSymmetricOut',
        breakTangent: false,
        invM
      };
      this.app.refreshAll();
    }

    _hitTestSelectedLayerGizmos(layer, vx, vy, cx, cy, t, comp, cam, e) {
      // A. Puppet Pins on selected layer
      if (layer.puppetPins && layer.puppetPins.length > 0) {
        const invM = Mat4.invert(Anim.getLayerWorldMatrix(layer, t, comp, this.app.project));
        for (const pin of layer.puppetPins) {
          const pv = Anim.evalProp(pin.position, t, { project: this.app.project, comp, layer });
          const vp = this.layerPointToViewport(layer, [pv[0], pv[1], 0], t, comp, cam);
          if (vp && Math.hypot(vp[0] - vx, vp[1] - vy) <= 11) {
            return { kind: 'dragPin', label: '拖动图钉', layer, pin, invM };
          }
        }
      }

      // B. Bezier Path & Mask Vertices / Tangent Handles
      const pathProps = [];
      if (layer.type === 'shape' && layer.shapeData) {
        for (const it of layer.shapeData.items) {
          if (it.kind === 'path' && it.path) pathProps.push(it.path);
        }
      }
      for (const mk of (layer.masks || [])) {
        if (mk.path && mk.enabled !== false) pathProps.push(mk.path);
      }
      if (pathProps.length > 0) {
        const invM = Mat4.invert(Anim.getLayerWorldMatrix(layer, t, comp, this.app.project));
        for (const prop of pathProps) {
          const contours = Anim.evalProp(prop, t, { project: this.app.project, comp, layer }) || [];
          for (let ci = 0; ci < contours.length; ci++) {
            const verts = contours[ci].vertices;
            for (let vi = 0; vi < verts.length; vi++) {
              const v = verts[vi];
              const vpIn = this.layerPointToViewport(layer, [v.p[0] + (v.in?.[0] || 0), v.p[1] + (v.in?.[1] || 0), 0], t, comp, cam);
              const vpOut = this.layerPointToViewport(layer, [v.p[0] + (v.out?.[0] || 0), v.p[1] + (v.out?.[1] || 0), 0], t, comp, cam);
              const vpP = this.layerPointToViewport(layer, [v.p[0], v.p[1], 0], t, comp, cam);
              if (vpOut && (Math.abs(v.out?.[0] || 0) + Math.abs(v.out?.[1] || 0) > 0.5) && Math.hypot(vpOut[0] - vx, vpOut[1] - vy) <= 8) {
                return { kind: 'dragBezierVertex', label: '调整贝塞尔切线', layer, prop, ci, vi, subPart: 'outHandle', breakTangent: e.altKey, invM };
              }
              if (vpIn && (Math.abs(v.in?.[0] || 0) + Math.abs(v.in?.[1] || 0) > 0.5) && Math.hypot(vpIn[0] - vx, vpIn[1] - vy) <= 8) {
                return { kind: 'dragBezierVertex', label: '调整贝塞尔切线', layer, prop, ci, vi, subPart: 'inHandle', breakTangent: e.altKey, invM };
              }
              if (vpP && Math.hypot(vpP[0] - vx, vpP[1] - vy) <= 8) {
                this.selectedPathVertex = { prop, ci, vi };
                return { kind: 'dragBezierVertex', label: '移动路径节点', layer, prop, ci, vi, subPart: 'point', breakTangent: false, invM };
              }
            }
          }
        }
      }

      // C. Spatial Motion Path Keyframes & Spatial Bezier Handles (Section 2.3!)
      const posProp = layer.transform.position;
      if (this.helpers.motionPath && posProp && posProp.animated && posProp.keyframes.length >= 2) {
        const parentM = Anim.getParentWorldMatrix(layer, t, comp, this.app.project);
        const invParent = Mat4.invert(parentM);
        const projectParentPt = (pt) => {
          const wp = Mat4.transformPoint(parentM, [pt[0] || 0, pt[1] || 0, layer.threeD ? (pt[2] || 0) : 0]);
          return layer.threeD ? this.worldToViewport(wp, cam, comp) : this.compToViewport(wp[0], wp[1]);
        };

        for (let ki = 0; ki < posProp.keyframes.length; ki++) {
          const kf = posProp.keyframes[ki];
          const pOut = [
            kf.value[0] + (kf.spatialOut?.[0] || 0),
            kf.value[1] + (kf.spatialOut?.[1] || 0),
            (kf.value[2] || 0) + (kf.spatialOut?.[2] || 0)
          ];
          const pIn = [
            kf.value[0] + (kf.spatialIn?.[0] || 0),
            kf.value[1] + (kf.spatialIn?.[1] || 0),
            (kf.value[2] || 0) + (kf.spatialIn?.[2] || 0)
          ];
          const vpOut = projectParentPt(pOut);
          const vpIn = projectParentPt(pIn);
          const vpK = projectParentPt(kf.value);

          if (vpOut && Math.hypot(vpOut[0] - vx, vpOut[1] - vy) <= 9 && Vec3.dist(pOut, kf.value) > 1) {
            return { kind: 'dragMotionHandle', label: '编辑运动路径空间手柄', layer, posProp, kf, side: 'out', breakCorner: e.altKey, parentM, invParent, cam };
          }
          if (vpIn && Math.hypot(vpIn[0] - vx, vpIn[1] - vy) <= 9 && Vec3.dist(pIn, kf.value) > 1) {
            return { kind: 'dragMotionHandle', label: '编辑运动路径空间手柄', layer, posProp, kf, side: 'in', breakCorner: e.altKey, parentM, invParent, cam };
          }
          if (vpK && Math.hypot(vpK[0] - vx, vpK[1] - vy) <= 9) {
            return { kind: 'dragMotionKf', label: '移动运动路径关键帧位置', layer, posProp, kf, parentM, invParent, cam };
          }
        }
      }

      // D. 3D XYZ Axis Gimbal Arrows (Section 2.12 — exact projection & parent-compensated ray-axis drag!)
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const localTrVals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
      const originW = Mat4.transformPoint(worldM, localTrVals.anchor);
      const vpO = layer.threeD ? this.worldToViewport(originW, cam, comp) : this.compToViewport(originW[0], originW[1]);

      if (vpO) {
        // Anchor crosshair hit-test when Anchor tool (`Y`) is active (or Alt-drag center)
        if (this.app.activeTool === 'anchor' && Math.hypot(vpO[0] - vx, vpO[1] - vy) <= 16) {
          return this._makeAnchorDragState(layer, cx, cy, t, comp, cam);
        }

        if (layer.threeD) {
          const axisLen = 95 / Math.max(0.35, this.zoom);
          const axes = [
            { axis: 0, dirW: Vec3.norm(Mat4.transformDir(worldM, [1, 0, 0])), name: 'X' },
            { axis: 1, dirW: Vec3.norm(Mat4.transformDir(worldM, [0, 1, 0])), name: 'Y' },
            { axis: 2, dirW: Vec3.norm(Mat4.transformDir(worldM, [0, 0, 1])), name: 'Z' }
          ];
          for (const ax of axes) {
            const tipW = Vec3.addScaled(originW, ax.dirW, axisLen);
            const vpTip = this.worldToViewport(tipW, cam, comp);
            if (!vpTip) continue;
            // Distance from (vx, vy) to segment vpO -> vpTip
            const seg = Vec2.sub(vpTip, vpO);
            const l2 = seg[0] * seg[0] + seg[1] * seg[1];
            if (l2 > 16) {
              const u = clamp(Vec2.dot(Vec2.sub([vx, vy], vpO), seg) / l2, 0.15, 1.08);
              const closest = Vec2.lerp(vpO, vpTip, u);
              if (Vec2.dist([vx, vy], closest) <= 9) {
                const parentM = Anim.getParentWorldMatrix(layer, t, comp, this.app.project);
                const invParent = Mat4.invert(parentM);
                const startLocalVals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
                const startPosW = Mat4.transformPoint(parentM, startLocalVals.position);
                return {
                  kind: 'drag3DAxis',
                  label: `沿 ${ax.name} 轴移动三维图层`,
                  layer,
                  dirW: ax.dirW,
                  startMouseV: [vx, vy],
                  screenAxisDir: Vec2.norm(seg),
                  pxPerWorldUnit: Math.sqrt(l2) / axisLen,
                  startPosW,
                  invParent
                };
              }
            }
          }
        }

        // E. 2D / 3D Bounding Box Corner Scale & Rotation Ring Handles!
        const bounds = this._getLayerLocalBounds2D(layer, t, comp);
        const corners = [
          [bounds.minX, bounds.minY, 0],
          [bounds.maxX, bounds.minY, 0],
          [bounds.maxX, bounds.maxY, 0],
          [bounds.minX, bounds.maxY, 0]
        ];
        for (const cn of corners) {
          const vpC = this.layerPointToViewport(layer, cn, t, comp, cam);
          if (vpC && Math.hypot(vpC[0] - vx, vpC[1] - vy) <= 9) {
            const vals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
            return {
              kind: 'scaleLayer',
              label: '缩放图层',
              layer,
              centerV: [vpO[0], vpO[1]],
              startDist: Math.max(8, Math.hypot(vx - vpO[0], vy - vpO[1])),
              startScale: [...vals.scale],
              uniform: !e.altKey
            };
          }
        }
        // Rotation handle 26px above top-mid of bounding box
        const topMid = [0.5 * (bounds.minX + bounds.maxX), bounds.minY - 28 / Math.max(0.4, this.zoom), 0];
        const vpRot = this.layerPointToViewport(layer, topMid, t, comp, cam);
        if (vpRot && Math.hypot(vpRot[0] - vx, vpRot[1] - vy) <= 11) {
          return this._makeRotateDragState(layer, vx, vy, t, comp, cam);
        }
      }

      return null;
    }

    _makeTranslateDragState(layers, cx, cy, t, comp, cam) {
      const entries = layers.filter((l) => !l.locked).map((l) => {
        const parentM = Anim.getParentWorldMatrix(l, t, comp, this.app.project);
        const invParent = Mat4.invert(parentM);
        const vals = Anim.evalLayerLocalTransformValues(l, t, comp, this.app.project);
        const posW = Mat4.transformPoint(parentM, vals.position);
        const camFwd = Vec3.norm(Vec3.sub(cam.target, cam.eye));
        const startHitW = l.threeD
          ? this.compPointToWorldPlane(cx, cy, posW, camFwd, cam, comp)
          : [cx, cy, 0];
        return { layer: l, parentM, invParent, startPosW: posW, startHitW, camFwd };
      });
      return { kind: 'translateLayers', entries, cam, comp };
    }

    _makeRotateDragState(layer, vx, vy, t, comp, cam) {
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const originW = Mat4.transformPoint(worldM, [0, 0, 0]);
      const vpO = layer.threeD ? this.worldToViewport(originW, cam, comp) : this.compToViewport(originW[0], originW[1]);
      const vals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
      return {
        kind: 'rotateLayer',
        layer,
        centerV: vpO ? [vpO[0], vpO[1]] : [vx, vy],
        startAngle: Math.atan2(vy - (vpO ? vpO[1] : 0), vx - (vpO ? vpO[0] : 0)),
        startRotZ: vals.rotation[2]
      };
    }

    _makeAnchorDragState(layer, cx, cy, t, comp, cam) {
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const invWorld = Mat4.invert(worldM);
      const vals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
      const planeOrigin = Mat4.transformPoint(worldM, [0, 0, 0]);
      const planeNormal = layer.threeD ? Vec3.norm(Mat4.transformDir(worldM, [0, 0, -1])) : [0, 0, -1];
      const startW = layer.threeD
        ? this.compPointToWorldPlane(cx, cy, planeOrigin, planeNormal, cam, comp)
        : [cx, cy, 0];
      return {
        kind: 'dragAnchor',
        layer,
        startW,
        planeOrigin,
        planeNormal,
        invWorldAtStart: invWorld,
        startAnchor: [...vals.anchor],
        cam
      };
    }

    _onPointerMove(e) {
      if (!this.dragState) return;
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const t = this.app.currentTime;
      const [cx, cy, vx, vy] = this.clientToComp(e.clientX, e.clientY);
      const ds = this.dragState;

      if (ds.kind === 'pan') {
        this.panX = ds.origPanX + (e.clientX - ds.startClientX);
        this.panY = ds.origPanY + (e.clientY - ds.startClientY);
        this.autoFit = false;
        this._applyStageLayout();
        this.renderGizmos();
        return;
      }

      if (ds.kind === 'orbitCamera') {
        const dx = e.clientX - ds.startClientX;
        const dy = e.clientY - ds.startClientY;
        if (ds.camLayer) {
          const parentM = Anim.getParentWorldMatrix(ds.camLayer, t, comp, this.app.project);
          const invP = Mat4.invert(parentM);
          if (ds.altPan) {
            const ne = [ds.startEye[0] - dx * 1.5, ds.startEye[1] - dy * 1.5, ds.startEye[2]];
            const nt = [ds.startTarget[0] - dx * 1.5, ds.startTarget[1] - dy * 1.5, ds.startTarget[2]];
            Anim.setPropValueAtTime(ds.camLayer.transform.position, Mat4.transformPoint(invP, ne), t);
            Anim.setPropValueAtTime(ds.camLayer.camera.target, Mat4.transformPoint(invP, nt), t);
          } else {
            const rel = Vec3.sub(ds.startEye, ds.startTarget);
            const r = Vec3.len(rel);
            const yaw = Math.atan2(rel[0], -rel[2]) + dx * 0.007;
            const pitch = clamp(Math.asin(clamp(-rel[1] / Math.max(1, r), -1, 1)) + dy * 0.006, -1.4, 1.4);
            const newEyeW = [
              ds.startTarget[0] + Math.sin(yaw) * Math.cos(pitch) * r,
              ds.startTarget[1] - Math.sin(pitch) * r,
              ds.startTarget[2] - Math.cos(yaw) * Math.cos(pitch) * r
            ];
            Anim.setPropValueAtTime(ds.camLayer.transform.position, Mat4.transformPoint(invP, newEyeW), t);
          }
        } else {
          this.customView.enabled = true;
          this.customView.orbitYaw += dx * 0.35;
          this.customView.orbitPitch = clamp(this.customView.orbitPitch + dy * 0.3, -82, 82);
          ds.startClientX = e.clientX;
          ds.startClientY = e.clientY;
          this._updateCustomOrbitEye();
        }
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'translateLayers') {
        for (const ent of ds.entries) {
          const curHitW = ent.layer.threeD
            ? this.compPointToWorldPlane(cx, cy, ent.startPosW, ent.camFwd, ds.cam, comp)
            : [cx, cy, 0];
          const deltaW = Vec3.sub(curHitW, ent.startHitW);
          const newPosW = Vec3.add(ent.startPosW, deltaW);
          const newLocalPos = Mat4.transformPoint(ent.invParent, newPosW);
          Anim.setPropValueAtTime(
            ent.layer.transform.position,
            ent.layer.threeD ? newLocalPos : [newLocalPos[0], newLocalPos[1], 0],
            t
          );
        }
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'drag3DAxis') {
        const mouseDelta = Vec2.sub([vx, vy], ds.startMouseV);
        const screenDist = Vec2.dot(mouseDelta, ds.screenAxisDir);
        const worldUnits = screenDist / Math.max(0.05, ds.pxPerWorldUnit);
        const newPosW = Vec3.addScaled(ds.startPosW, ds.dirW, worldUnits);
        const newLocalPos = Mat4.transformPoint(ds.invParent, newPosW);
        Anim.setPropValueAtTime(ds.layer.transform.position, newLocalPos, t);
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'scaleLayer') {
        const curDist = Math.max(4, Math.hypot(vx - ds.centerV[0], vy - ds.centerV[1]));
        const ratio = curDist / ds.startDist;
        const ns = [
          ds.startScale[0] * ratio,
          ds.startScale[1] * ratio,
          ds.layer.threeD ? ds.startScale[2] * ratio : 100
        ];
        Anim.setPropValueAtTime(ds.layer.transform.scale, ns, t);
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'rotateLayer') {
        const curAng = Math.atan2(vy - ds.centerV[1], vx - ds.centerV[0]);
        const deltaDeg = (curAng - ds.startAngle) * RAD2DEG;
        Anim.setPropValueAtTime(ds.layer.transform.rotationZ, ds.startRotZ + deltaDeg, t);
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'dragAnchor') {
        const curW = ds.layer.threeD
          ? this.compPointToWorldPlane(cx, cy, ds.planeOrigin, ds.planeNormal, ds.cam, comp)
          : [cx, cy, 0];
        const localPt = Mat4.transformPoint(ds.invWorldAtStart, curW);
        // Remember local (0,0,0) in worldM was at startAnchor, wait: worldM = T(P)*R*S*T(-A), so worldM * [A] = P (where anchor crosshair sits)!
        // Let's double check: in `worldM * p`, `p` is in layer local content coordinates! The anchor sits at `p = startAnchor`!
        Scene.getLayerLocalMesh3D; // keep ref
        Anim.setAnchorPreservingVisual(comp, ds.layer, localPt, t, this.app.project);
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'drawParametricShape') {
        const lp = Mat4.transformPoint(ds.invM, [cx, cy, 0]);
        const center = [0.5 * (ds.startLocal[0] + lp[0]), 0.5 * (ds.startLocal[1] + lp[1])];
        let w = Math.max(4, Math.abs(lp[0] - ds.startLocal[0]));
        let h = Math.max(4, Math.abs(lp[1] - ds.startLocal[1]));
        if (e.shiftKey) { const m = Math.max(w, h); w = m; h = m; }
        Anim.setPropValueAtTime(ds.item.position, center, t);
        Anim.setPropValueAtTime(ds.item.size, [w, h], t);
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'dragBezierVertex') {
        const lp = Mat4.transformPoint(ds.invM, [cx, cy, 0]);
        const contours = Geo2D.cloneContours(Anim.evalProp(ds.prop, t, { project: this.app.project, comp, layer: ds.layer }));
        const v = contours[ds.ci]?.vertices[ds.vi];
        if (v) {
          if (ds.subPart === 'point') {
            v.p = [lp[0], lp[1]];
          } else if (ds.subPart === 'bothSymmetricOut') {
            const dx = lp[0] - v.p[0], dy = lp[1] - v.p[1];
            v.out = [dx, dy];
            v.in = [-dx, -dy];
          } else if (ds.subPart === 'outHandle') {
            const dx = lp[0] - v.p[0], dy = lp[1] - v.p[1];
            v.out = [dx, dy];
            if (!ds.breakTangent && !e.altKey) {
              const inLen = Math.hypot(v.in[0], v.in[1]);
              const outLen = Math.hypot(dx, dy);
              if (outLen > 1e-3 && inLen > 1e-3) {
                v.in = [(-dx / outLen) * inLen, (-dy / outLen) * inLen];
              }
            }
          } else if (ds.subPart === 'inHandle') {
            const dx = lp[0] - v.p[0], dy = lp[1] - v.p[1];
            v.in = [dx, dy];
            if (!ds.breakTangent && !e.altKey) {
              const outLen = Math.hypot(v.out[0], v.out[1]);
              const inLen = Math.hypot(dx, dy);
              if (inLen > 1e-3 && outLen > 1e-3) {
                v.out = [(-dx / inLen) * outLen, (-dy / inLen) * outLen];
              }
            }
          }
          Anim.setPropValueAtTime(ds.prop, contours, t);
          Particles.invalidateAllParticleCaches();
          this.app.refreshCanvasAndProps();
        }
        return;
      }

      if (ds.kind === 'dragPin') {
        const cam = Scene.getActiveCameraState(comp, t, this.app.project, this.customView);
        const wMat = Anim.getLayerWorldMatrix(ds.layer, t, comp, this.app.project);
        const lp = ds.layer.threeD
          ? Mat4.transformPoint(ds.invM, this.compPointToWorldPlane(cx, cy, Mat4.transformPoint(wMat, [0, 0, 0]), Vec3.norm(Mat4.transformDir(wMat, [0, 0, -1])), cam, comp))
          : Mat4.transformPoint(ds.invM, [cx, cy, 0]);
        Anim.setPropValueAtTime(ds.pin.position, [lp[0], lp[1]], t);
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
        return;
      }

      if (ds.kind === 'dragMotionKf' || ds.kind === 'dragMotionHandle') {
        const kfWorld = Mat4.transformPoint(ds.parentM, ds.kf.value);
        const camFwd = Vec3.norm(Vec3.sub(ds.cam.target, ds.cam.eye));
        const hitW = ds.layer.threeD
          ? this.compPointToWorldPlane(cx, cy, kfWorld, camFwd, ds.cam, comp)
          : [cx, cy, 0];
        const hitParentSpace = Mat4.transformPoint(ds.invParent, hitW);
        if (!ds.layer.threeD) hitParentSpace[2] = 0;

        if (ds.kind === 'dragMotionKf') {
          ds.kf.value = hitParentSpace;
          if (!ds.kf.spatialCustom) Anim.recomputeSmoothSpatialTangents(ds.posProp);
        } else {
          ds.kf.spatialCustom = true;
          const rel = Vec3.sub(hitParentSpace, ds.kf.value);
          if (ds.breakCorner || e.altKey) ds.kf.spatialMode = 'corner';
          if (ds.side === 'out') {
            ds.kf.spatialOut = rel;
            if (ds.kf.spatialMode !== 'corner') {
              const inLen = Vec3.len(ds.kf.spatialIn || [0, 0, 0]);
              const outLen = Vec3.len(rel);
              if (outLen > 1e-3 && inLen > 1e-3) {
                ds.kf.spatialIn = Vec3.scale(rel, -inLen / outLen);
              }
            }
          } else {
            ds.kf.spatialIn = rel;
            if (ds.kf.spatialMode !== 'corner') {
              const outLen = Vec3.len(ds.kf.spatialOut || [0, 0, 0]);
              const inLen = Vec3.len(rel);
              if (inLen > 1e-3 && outLen > 1e-3) {
                ds.kf.spatialOut = Vec3.scale(rel, -outLen / inLen);
              }
            }
          }
        }
        Particles.invalidateAllParticleCaches();
        this.app.refreshCanvasAndProps();
      }
    }

    _onPointerUp() {
      if (!this.dragState) return;
      const kind = this.dragState.kind;
      this.dragState = null;
      if (kind !== 'pan') {
        this.app.history.commitTransaction(this.app.project);
        this.app.refreshAll();
      }
    }

    _getLayerLocalBounds2D(layer, t, comp) {
      if (layer.type === 'shape') {
        const { contours } = Scene.evalShapeLayerContours(layer, t, comp, this.app.project);
        if (contours.length > 0) return Geo2D.computeContoursBounds(contours);
      } else if (layer.type === 'text') {
        const { contours } = Scene.evalTextLayerContours(layer, t, comp, this.app.project);
        if (contours.length > 0) return Geo2D.computeContoursBounds(contours);
      } else if (layer.type === 'solid3d' || layer.type === 'nodeGeo') {
        const m = Scene.getLayerLocalMesh3D(layer, t, comp, this.app.project);
        if (m && m.bounds) {
          return { minX: m.bounds.min[0], minY: m.bounds.min[1], maxX: m.bounds.max[0], maxY: m.bounds.max[1] };
        }
      } else if (layer.type === 'precomp') {
        return { minX: 0, minY: 0, maxX: comp.width, maxY: comp.height };
      }
      return { minX: -50, minY: -50, maxX: 50, maxY: 50 };
    }

    // =========================================================================
    // RENDER PRECISION GIZMOS ON `#gizmo-canvas`
    // =========================================================================
    renderGizmos() {
      this._applyStageLayout();
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vw = this.gizmoCanvas.width / dpr;
      const vh = this.gizmoCanvas.height / dpr;
      ctx.clearRect(0, 0, vw, vh);

      const comp = this.app.getActiveComp();
      if (!comp) {
        // Empty project presentation on canvas!
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 15px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('当前工程暂无活动合成 — 点击左侧「+ 新建合成」开始创作', vw * 0.5, vh * 0.5);
        return;
      }

      // Draw crisp Composition Frame Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.panX - 0.5, this.panY - 0.5, comp.width * this.zoom + 1, comp.height * this.zoom + 1);

      const t = this.app.currentTime;
      const cam = Scene.getActiveCameraState(comp, t, this.app.project, this.customView);

      // 1. Optional Composition Grid (`网格`)
      if (this.helpers.grid) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.panX, this.panY, comp.width * this.zoom, comp.height * this.zoom);
        ctx.clip();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1;
        const step = 80;
        for (let x = 0; x <= comp.width; x += step) {
          const [vx] = this.compToViewport(x, 0);
          ctx.beginPath(); ctx.moveTo(vx, this.panY); ctx.lineTo(vx, this.panY + comp.height * this.zoom); ctx.stroke();
        }
        for (let y = 0; y <= comp.height; y += step) {
          const [, vy] = this.compToViewport(0, y);
          ctx.beginPath(); ctx.moveTo(this.panX, vy); ctx.lineTo(this.panX + comp.width * this.zoom, vy); ctx.stroke();
        }
        ctx.restore();
      }

      if (!this.helpers.handles || this.app.exportMode) return;

      const selectedIds = new Set(this.app.selectedLayerIds);

      // 2. Scene Helper Gizmos: Spatial Fields (`场范围`), Lights (`光源`), Camera (`摄像机`)
      for (const l of (comp.layers || [])) {
        if (l.visible === false && !selectedIds.has(l.id)) continue;
        const isSel = selectedIds.has(l.id);

        if (l.type === 'field' && (this.helpers.fields && (isSel || this.app.showAllFieldGizmos))) {
          const fo = Nodes.evalFieldLayerObject(l, t, comp, this.app.project);
          if (fo) this._drawFieldGizmo(ctx, fo, cam, comp, isSel);
        } else if (l.type === 'light' && this.helpers.lightsCam && isSel) {
          this._drawLightGizmo(ctx, l, t, cam, comp);
        } else if (l.type === 'camera' && this.helpers.lightsCam && (isSel || this.customView.enabled)) {
          this._drawCameraGizmo(ctx, l, t, cam, comp);
        }
      }

      // 3. Selected Layers: Selection Bounding Boxes, Motion Paths, 3D Axes, Bezier Knots & Puppet Pins!
      const selLayers = this.app.getSelectedLayers();
      for (const layer of selLayers) {
        this._drawLayerSelectionGizmo(ctx, layer, t, comp, cam, selLayers.length === 1);
      }
    }

    _drawFieldGizmo(ctx, fo, cam, comp, isSel) {
      const c = fo.center;
      const vpC = this.worldToViewport(c, cam, comp);
      if (!vpC) return;

      const draw3DRing = (radius, axisIdx, dashed, color) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSel ? 1.6 : 1.0;
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        const segs = 36;
        let started = false;
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          let pt;
          if (axisIdx === 0) pt = [c[0] + Math.cos(a) * radius, c[1] + Math.sin(a) * radius, c[2]];
          else if (axisIdx === 1) pt = [c[0] + Math.cos(a) * radius, c[1], c[2] + Math.sin(a) * radius];
          else pt = [c[0], c[1] + Math.cos(a) * radius, c[2] + Math.sin(a) * radius];
          const vp = this.worldToViewport(pt, cam, comp);
          if (!vp) continue;
          if (!started) { ctx.moveTo(vp[0], vp[1]); started = true; }
          else ctx.lineTo(vp[0], vp[1]);
        }
        ctx.stroke();
        ctx.restore();
      };

      draw3DRing(fo.innerRadius, 0, false, 'rgba(249, 115, 22, 0.82)');
      draw3DRing(fo.outerRadius, 0, true, 'rgba(249, 115, 22, 0.42)');
      draw3DRing(fo.outerRadius, 1, true, 'rgba(249, 115, 22, 0.25)');

      // Center badge
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(vpC[0], vpC[1], 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(`${fo.name} (${fo.fieldType})`, vpC[0] + 8, vpC[1] - 6);
    }

    _drawLightGizmo(ctx, layer, t, cam, comp) {
      const wMat = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const posW = Mat4.transformPoint(wMat, [0, 0, 0]);
      const vp = this.worldToViewport(posW, cam, comp);
      if (!vp) return;
      ctx.save();
      ctx.strokeStyle = '#fde047';
      ctx.fillStyle = '#fde047';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(vp[0], vp[1], 7, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(vp[0] + Math.cos(a) * 10, vp[1] + Math.sin(a) * 10);
        ctx.lineTo(vp[0] + Math.cos(a) * 15, vp[1] + Math.sin(a) * 15);
        ctx.stroke();
      }
      if (layer.light?.lightType === 'directional' && layer.light.target) {
        const tgt = Anim.evalProp(layer.light.target, t, { project: this.app.project, comp, layer });
        const vpT = this.worldToViewport(tgt, cam, comp);
        if (vpT) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(vp[0], vp[1]);
          ctx.lineTo(vpT[0], vpT[1]);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawCameraGizmo(ctx, layer, t, cam, comp) {
      const wMat = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const eyeW = Mat4.transformPoint(wMat, [0, 0, 0]);
      const tgtW = layer.camera?.target
        ? Mat4.transformPoint(Anim.getParentWorldMatrix(layer, t, comp, this.app.project), Anim.evalProp(layer.camera.target, t, { project: this.app.project, comp, layer }))
        : Vec3.add(eyeW, [0, 0, 400]);
      const vpE = this.worldToViewport(eyeW, cam, comp);
      const vpT = this.worldToViewport(tgtW, cam, comp);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      if (vpT) {
        ctx.beginPath();
        ctx.arc(vpT[0], vpT[1], 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (vpE && vpT) {
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(vpE[0], vpE[1]);
        ctx.lineTo(vpT[0], vpT[1]);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawLayerSelectionGizmo(ctx, layer, t, comp, cam, isSingle) {
      // 1. Spatial Motion Path (`运动路径` + speed dots + spatial Bezier handles!)
      const posProp = layer.transform.position;
      if (this.helpers.motionPath && posProp && posProp.animated && posProp.keyframes.length >= 2) {
        const parentM = Anim.getParentWorldMatrix(layer, t, comp, this.app.project);
        const projParent = (pt) => {
          const wp = Mat4.transformPoint(parentM, [pt[0] || 0, pt[1] || 0, layer.threeD ? (pt[2] || 0) : 0]);
          return layer.threeD ? this.worldToViewport(wp, cam, comp) : this.compToViewport(wp[0], wp[1]);
        };

        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const kfs = posProp.keyframes;
        for (let i = 0; i < kfs.length - 1; i++) {
          const lut = Anim.getSpatialSegmentLUT(kfs[i], kfs[i + 1]);
          const steps = 28;
          for (let s = 0; s <= steps; s++) {
            const pt = Anim.sampleSpatialLUTAtFraction(lut, s / steps);
            const vp = projParent(pt);
            if (!vp) continue;
            if (i === 0 && s === 0) ctx.moveTo(vp[0], vp[1]);
            else ctx.lineTo(vp[0], vp[1]);
          }
        }
        ctx.stroke();

        // Draw time-sampled speed dots along the motion path!
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        const tMin = kfs[0].time, tMax = kfs[kfs.length - 1].time;
        const dtTick = 1 / Math.min(20, comp.fps || 30);
        for (let ts = tMin; ts <= tMax; ts += dtTick) {
          const pv = Anim.evalKeyframesAtTime(posProp, ts);
          const vp = projParent(pv);
          if (vp) ctx.fillRect(vp[0] - 1, vp[1] - 1, 2, 2);
        }

        // Draw Keyframe squares & Spatial Bezier tangent handles
        for (const kf of kfs) {
          const vpK = projParent(kf.value);
          if (!vpK) continue;

          if (isSingle) {
            const pIn = Vec3.add(kf.value, kf.spatialIn || [0, 0, 0]);
            const pOut = Vec3.add(kf.value, kf.spatialOut || [0, 0, 0]);
            const vpIn = projParent(pIn);
            const vpOut = projParent(pOut);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.fillStyle = '#f59e0b';
            if (vpIn && Vec3.dist(pIn, kf.value) > 1) {
              ctx.beginPath(); ctx.moveTo(vpK[0], vpK[1]); ctx.lineTo(vpIn[0], vpIn[1]); ctx.stroke();
              ctx.beginPath(); ctx.arc(vpIn[0], vpIn[1], 3.5, 0, Math.PI * 2); ctx.fill();
            }
            if (vpOut && Vec3.dist(pOut, kf.value) > 1) {
              ctx.beginPath(); ctx.moveTo(vpK[0], vpK[1]); ctx.lineTo(vpOut[0], vpOut[1]); ctx.stroke();
              ctx.beginPath(); ctx.arc(vpOut[0], vpOut[1], 3.5, 0, Math.PI * 2); ctx.fill();
            }
          }

          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.2;
          ctx.fillRect(vpK[0] - 4, vpK[1] - 4, 8, 8);
          ctx.strokeRect(vpK[0] - 4, vpK[1] - 4, 8, 8);
        }
        ctx.restore();
      }

      // 2. Bounding Box & Corner Scale/Rotate Handles
      const b = this._getLayerLocalBounds2D(layer, t, comp);
      const cPts = [
        [b.minX, b.minY, 0],
        [b.maxX, b.minY, 0],
        [b.maxX, b.maxY, 0],
        [b.minX, b.maxY, 0]
      ].map((p) => this.layerPointToViewport(layer, p, t, comp, cam));

      if (cPts.every(Boolean)) {
        ctx.save();
        ctx.strokeStyle = isSingle ? '#38bdf8' : '#a855f7';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cPts[0][0], cPts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(cPts[i][0], cPts[i][1]);
        ctx.closePath();
        ctx.stroke();

        for (const cp of cPts) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0284c7';
          ctx.fillRect(cp[0] - 3.5, cp[1] - 3.5, 7, 7);
          ctx.strokeRect(cp[0] - 3.5, cp[1] - 3.5, 7, 7);
        }

        if (isSingle) {
          const topMid = this.layerPointToViewport(layer, [0.5 * (b.minX + b.maxX), b.minY, 0], t, comp, cam);
          const rotHandle = this.layerPointToViewport(layer, [0.5 * (b.minX + b.maxX), b.minY - 28 / Math.max(0.4, this.zoom), 0], t, comp, cam);
          if (topMid && rotHandle) {
            ctx.beginPath(); ctx.moveTo(topMid[0], topMid[1]); ctx.lineTo(rotHandle[0], rotHandle[1]); ctx.stroke();
            ctx.beginPath(); ctx.arc(rotHandle[0], rotHandle[1], 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3. Anchor Point Crosshair & 3D XYZ Gimbal Arrows
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, this.app.project);
      const vals = Anim.evalLayerLocalTransformValues(layer, t, comp, this.app.project);
      const anchorW = Mat4.transformPoint(worldM, vals.anchor);
      const vpAnc = layer.threeD ? this.worldToViewport(anchorW, cam, comp) : this.compToViewport(anchorW[0], anchorW[1]);
      if (vpAnc) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vpAnc[0], vpAnc[1], 6, 0, Math.PI * 2);
        ctx.moveTo(vpAnc[0] - 9, vpAnc[1]); ctx.lineTo(vpAnc[0] + 9, vpAnc[1]);
        ctx.moveTo(vpAnc[0], vpAnc[1] - 9); ctx.lineTo(vpAnc[0], vpAnc[1] + 9);
        ctx.stroke();
        ctx.restore();

        if (isSingle && layer.threeD) {
          const axisLen = 95 / Math.max(0.35, this.zoom);
          const axisDefs = [
            { dir: [1, 0, 0], col: '#ef4444', label: 'X' },
            { dir: [0, 1, 0], col: '#22c55e', label: 'Y' },
            { dir: [0, 0, 1], col: '#3b82f6', label: 'Z' }
          ];
          for (const ad of axisDefs) {
            const dirW = Vec3.norm(Mat4.transformDir(worldM, ad.dir));
            const tipW = Vec3.addScaled(anchorW, dirW, axisLen);
            const vpTip = this.worldToViewport(tipW, cam, comp);
            if (!vpTip) continue;
            ctx.save();
            ctx.strokeStyle = ad.col;
            ctx.fillStyle = ad.col;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(vpAnc[0], vpAnc[1]);
            ctx.lineTo(vpTip[0], vpTip[1]);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(vpTip[0], vpTip[1], 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(ad.label, vpTip[0] + 6, vpTip[1] + 4);
            ctx.restore();
          }
        }
      }

      // 4. Bezier Path & Mask Knots / Tangents (when single layer selected)
      if (isSingle) {
        const drawPathKnots = (prop, color) => {
          const contours = Anim.evalProp(prop, t, { project: this.app.project, comp, layer }) || [];
          ctx.save();
          for (const c of contours) {
            // Draw mask outline if mask
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            const flat = Geo2D.flattenContour(c, 1.5);
            if (flat.length >= 2) {
              ctx.beginPath();
              flat.forEach((pt, idx) => {
                const vp = this.layerPointToViewport(layer, [pt[0], pt[1], 0], t, comp, cam);
                if (!vp) return;
                if (idx === 0) ctx.moveTo(vp[0], vp[1]); else ctx.lineTo(vp[0], vp[1]);
              });
              if (c.closed) ctx.closePath();
              ctx.stroke();
            }

            for (const v of c.vertices) {
              const vpP = this.layerPointToViewport(layer, [v.p[0], v.p[1], 0], t, comp, cam);
              if (!vpP) continue;
              const vpIn = this.layerPointToViewport(layer, [v.p[0] + (v.in?.[0] || 0), v.p[1] + (v.in?.[1] || 0), 0], t, comp, cam);
              const vpOut = this.layerPointToViewport(layer, [v.p[0] + (v.out?.[0] || 0), v.p[1] + (v.out?.[1] || 0), 0], t, comp, cam);

              ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
              ctx.fillStyle = '#facc15';
              if (vpIn && Math.hypot(v.in?.[0] || 0, v.in?.[1] || 0) > 0.5) {
                ctx.beginPath(); ctx.moveTo(vpP[0], vpP[1]); ctx.lineTo(vpIn[0], vpIn[1]); ctx.stroke();
                ctx.beginPath(); ctx.arc(vpIn[0], vpIn[1], 3, 0, Math.PI * 2); ctx.fill();
              }
              if (vpOut && Math.hypot(v.out?.[0] || 0, v.out?.[1] || 0) > 0.5) {
                ctx.beginPath(); ctx.moveTo(vpP[0], vpP[1]); ctx.lineTo(vpOut[0], vpOut[1]); ctx.stroke();
                ctx.beginPath(); ctx.arc(vpOut[0], vpOut[1], 3, 0, Math.PI * 2); ctx.fill();
              }
              ctx.fillStyle = color;
              ctx.fillRect(vpP[0] - 3.5, vpP[1] - 3.5, 7, 7);
            }
          }
          ctx.restore();
        };

        if (layer.type === 'shape' && layer.shapeData) {
          for (const it of layer.shapeData.items) {
            if (it.kind === 'path' && it.path) drawPathKnots(it.path, '#38bdf8');
          }
        }
        for (const mk of (layer.masks || [])) {
          if (mk.enabled !== false && mk.path) drawPathKnots(mk.path, '#ec4899');
        }

        // 5. Puppet Pins (`图钉`)
        if (layer.puppetPins && layer.puppetPins.length > 0) {
          for (const pin of layer.puppetPins) {
            const pv = Anim.evalProp(pin.position, t, { project: this.app.project, comp, layer });
            const vp = this.layerPointToViewport(layer, [pv[0], pv[1], 0], t, comp, cam);
            if (!vp) continue;
            ctx.save();
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(vp[0], vp[1], 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#111827';
            ctx.beginPath();
            ctx.arc(vp[0], vp[1], 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }
  }

  Forge.CanvasOverlay = {
    CanvasOverlayController
  };
})();
