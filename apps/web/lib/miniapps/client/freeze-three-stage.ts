/**
 * The studio's WebGL stage — split out of freeze-studio.tsx so `three` (~660
 * KB bundled) only ships when the 3D viewport actually mounts
 * (R-PERF-07). Loaded lazily via `import("./freeze-three-stage")` from
 * StageCanvas; falls back to the flat 2D projection when WebGL or the
 * chunk is unavailable.
 */
import * as THREE from "three";
import { DEG, clamp, poseAt } from "./freeze-studio";
import type { CameraKeyframe } from "./freeze-studio";

/* ---------------------------------------------------------- 3D viewport */

/**
 * The studio viewport is a real 3D scene (the reference editor's look): the
 * photo stands as a plane at the origin over a floor grid, the trajectory
 * sweeps around it as a tube, and the shot camera glyph rides the scrub
 * time. `poseToWorld` maps the render contract's spherical pose — azimuth
 * around Y, elevation off the horizon, distance as a radius multiplier —
 * into editor space. Fallback below is the original flat projection when
 * WebGL isn't available.
 */
const SUBJECT_Y = 0.95;
const ORBIT_RADIUS = 2.3;

function poseToWorld(
  pose: CameraKeyframe,
  out: THREE.Vector3
): THREE.Vector3 {
  const az = pose.azimuth * DEG;
  const el = pose.elevation * DEG;
  const d = ORBIT_RADIUS * pose.distance;
  out.set(
    Math.sin(az) * Math.cos(el) * d,
    SUBJECT_Y + Math.sin(el) * d,
    Math.cos(az) * Math.cos(el) * d
  );
  return out;
}

export interface ThreeStage {
  setImage(img: HTMLImageElement | null): void;
  update(
    frames: CameraKeyframe[],
    scrubT: number,
    selected: number | null
  ): void;
  pick(x: number, y: number): number | null;
  /** px deltas → view orbit (grab-the-world: the scene follows the finger) */
  orbit(dx: number, dy: number): void;
  /** pinch scale factor (>1 = fingers apart = closer) */
  zoom(scale: number): void;
  viewDirty(): boolean;
  resetView(): boolean;
  dispose(): void;
}

/** Flat MeshBasicMaterial everywhere — no lights, matches the pixel shell. */
export function createThreeStage(host: HTMLDivElement): ThreeStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const scene = new THREE.Scene();
  // Grid + path fade into the stage ink at distance — reads as depth even
  // on unlit basic materials.
  scene.fog = new THREE.Fog(0x0b1011, 6.5, 16);
  const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 80);

  // The view is an orbitable rig around a fixed target on the subject: yaw /
  // pitch / dist recompose the camera, so look-mode and two-finger gestures
  // just retune these three numbers.
  const VIEW_TARGET = new THREE.Vector3(0, 1.12, 0);
  const viewHome = { yaw: 0.52, pitch: 0.19, dist: 5.2 };
  const view = { ...viewHome };
  const applyView = () => {
    const cp = Math.cos(view.pitch);
    camera.position.set(
      VIEW_TARGET.x + Math.sin(view.yaw) * cp * view.dist,
      VIEW_TARGET.y + Math.sin(view.pitch) * view.dist,
      VIEW_TARGET.z + Math.cos(view.yaw) * cp * view.dist
    );
    camera.lookAt(VIEW_TARGET);
  };
  applyView();

  const grid = track(new THREE.GridHelper(14, 28, 0x46635c, 0x243430));
  scene.add(grid);

  // The equator guide marks the el=0 orbit plane at subject height; the
  // post + foot ring ground the floating billboard.
  const guideMat = track(
    new THREE.LineDashedMaterial({
      color: 0x44645c,
      dashSize: 0.16,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.55,
    })
  );
  const guidePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    guidePts.push(
      new THREE.Vector3(
        Math.sin(a) * ORBIT_RADIUS,
        SUBJECT_Y,
        Math.cos(a) * ORBIT_RADIUS
      )
    );
  }
  const guide = new THREE.Line(
    track(new THREE.BufferGeometry().setFromPoints(guidePts)),
    guideMat
  );
  guide.computeLineDistances();
  scene.add(guide);
  const postGeo = track(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(0, SUBJECT_Y, 0),
    ])
  );
  scene.add(
    new THREE.Line(
      postGeo,
      track(
        new THREE.LineBasicMaterial({
          color: 0x3d5a52,
          transparent: true,
          opacity: 0.6,
        })
      )
    )
  );
  const footPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    footPts.push(
      new THREE.Vector3(Math.sin(a) * 0.55, 0.02, Math.cos(a) * 0.55)
    );
  }
  scene.add(
    new THREE.Line(
      track(new THREE.BufferGeometry().setFromPoints(footPts)),
      track(
        new THREE.LineBasicMaterial({
          color: 0x3d5a52,
          transparent: true,
          opacity: 0.7,
        })
      )
    )
  );

  // photo billboard: backing plate + image plane + border edge
  const photoW = 1.9;
  const photoH = photoW * 0.72;
  const frame = new THREE.Mesh(
    track(new THREE.PlaneGeometry(photoW * 1.07, photoH * 1.1)),
    track(
      new THREE.MeshBasicMaterial({ color: 0x0d181b, side: THREE.DoubleSide })
    )
  );
  frame.position.set(0, SUBJECT_Y, 0);
  // Double-sided so the subject stays visible when the viewport orbits
  // behind the billboard.
  const photoMat = track(
    new THREE.MeshBasicMaterial({ color: 0x4a6159, side: THREE.DoubleSide })
  );
  const photoGeo = track(new THREE.PlaneGeometry(photoW, photoH));
  const photo = new THREE.Mesh(photoGeo, photoMat);
  photo.position.set(0, SUBJECT_Y, 0.001);
  // The backing plate occludes the photo from behind — a mirrored twin on
  // the -Z face keeps the subject visible through a full orbit.
  const photoBack = new THREE.Mesh(photoGeo, photoMat);
  photoBack.position.set(0, SUBJECT_Y, -0.001);
  photoBack.rotation.y = Math.PI;
  const border = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(photoGeo)),
    track(new THREE.LineBasicMaterial({ color: 0x7fa89b }))
  );
  border.position.copy(photo.position);
  scene.add(frame, photo, photoBack, border);

  const tubeMat = track(
    new THREE.MeshBasicMaterial({ color: 0x8fd4bd })
  );
  let tube: THREE.Mesh | null = null;

  // The path's floor shadow — reading a 3D curve against a flat plane is
  // hard, so a dashed projection onto the grid shows the shape in plan.
  const shadowGeo = track(new THREE.BufferGeometry());
  const shadow = new THREE.Line(
    shadowGeo,
    track(
      new THREE.LineDashedMaterial({
        color: 0x8fd4bd,
        dashSize: 0.12,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.28,
      })
    )
  );
  shadow.visible = false;
  scene.add(shadow);

  const kfGroup = new THREE.Group();
  scene.add(kfGroup);
  const kfGeo = track(new THREE.SphereGeometry(0.066, 16, 12));
  const kfMat = track(new THREE.MeshBasicMaterial({ color: 0x8fd4bd }));
  const kfSelMat = track(new THREE.MeshBasicMaterial({ color: 0xf0f5f4 }));

  // shot-camera glyph: gold body + nose cone aimed at the subject
  const glyphMat = track(
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
  );
  const glyph = new THREE.Group();
  glyph.add(
    new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 18, 14)), glyphMat)
  );
  const nose = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.062, 0.22, 12)),
    glyphMat
  );
  nose.rotation.x = Math.PI / 2; // cone axis +Y → +Z so lookAt aims the tip
  nose.position.z = 0.18;
  glyph.add(nose);
  scene.add(glyph);

  const sightGeo = track(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, SUBJECT_Y, 0),
    ])
  );
  const sight = new THREE.Line(
    sightGeo,
    track(
      new THREE.LineDashedMaterial({
        color: 0xffd166,
        dashSize: 0.09,
        gapSize: 0.09,
        transparent: true,
        opacity: 0.45,
      })
    )
  );
  sight.computeLineDistances();
  scene.add(sight);

  const tmp = new THREE.Vector3();
  const subject = new THREE.Vector3(0, SUBJECT_Y, 0);
  let lastFrames: CameraKeyframe[] = [];
  let lastSelected: number | null = null;
  let lastPose: CameraKeyframe = {
    time: 0,
    azimuth: 0,
    elevation: 0,
    distance: 1,
  };

  /** Behind-the-photo dimming is viewer-relative: the viewer orbits at
   * view.yaw, so the glyph dims when its azimuth sits opposite the view —
   * same hemisphere split the 2D projection draws. */
  const updateGlyphDepth = () => {
    glyphMat.opacity =
      Math.cos(lastPose.azimuth * DEG - view.yaw) < -0.05 ? 0.45 : 1;
  };

  const render = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(render);
  observer.observe(host);

  let photoTex: THREE.Texture | null = null;

  return {
    setImage(img) {
      // A re-signed URL re-uploads the same still — dispose the previous
      // texture or a polling render leaks GPU memory until the WebView OOMs.
      photoTex?.dispose();
      if (img) {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        photoTex = tex;
        photoMat.map = tex;
        photoMat.color.set(0xffffff);
      } else {
        photoTex = null;
        photoMat.map = null;
        photoMat.color.set(0x4a6159);
      }
      photoMat.needsUpdate = true;
      render();
    },
    update(frames, scrubT, selected) {
      // Scrub moves the glyph every tick — the tube, shadow, and dots only
      // depend on the trajectory/selection, so static geometry rebuilds
      // solely when those actually changed (keyframes always arrive as a
      // fresh array reference).
      const framesChanged = frames !== lastFrames;
      const selectedChanged = selected !== lastSelected;
      lastFrames = frames;
      lastSelected = selected;
      if (framesChanged) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
          const p = poseToWorld(poseAt(frames, i / 96), new THREE.Vector3());
          const prev = pts[pts.length - 1];
          // Consecutive identical points make CatmullRom tangents NaN — a
          // flat run in the trajectory must not take the tube down.
          if (prev && p.distanceToSquared(prev) < 1e-8) continue;
          pts.push(p);
        }
        if (pts.length >= 2) {
          const curve = new THREE.CatmullRomCurve3(pts);
          const geo = new THREE.TubeGeometry(curve, 120, 0.03, 8, false);
          const next = new THREE.Mesh(geo, tubeMat);
          if (tube) {
            scene.remove(tube);
            tube.geometry.dispose();
          }
          tube = next;
          scene.add(tube);
          shadowGeo.setFromPoints(
            pts.map((p) => new THREE.Vector3(p.x, 0.02, p.z))
          );
          // setFromPoints reuses an oversized position attribute — without a
          // draw range a shorter path keeps drawing the old one's tail.
          shadowGeo.setDrawRange(0, pts.length);
          shadow.computeLineDistances();
          shadow.visible = true;
        } else if (tube) {
          scene.remove(tube);
          tube.geometry.dispose();
          tube = null;
          shadow.visible = false;
        }
      }
      if (framesChanged || selectedChanged) {
        kfGroup.clear();
        frames.forEach((kf, i) => {
          const dot = new THREE.Mesh(kfGeo, i === selected ? kfSelMat : kfMat);
          dot.position.copy(poseToWorld(kf, tmp));
          if (i === selected) dot.scale.setScalar(1.3);
          dot.userData["index"] = i;
          kfGroup.add(dot);
        });
      }
      lastPose = poseAt(frames, scrubT);
      glyph.position.copy(poseToWorld(lastPose, tmp));
      glyph.lookAt(subject);
      updateGlyphDepth();
      sightGeo.setFromPoints([glyph.position.clone(), subject.clone()]);
      sight.computeLineDistances();
      render();
    },
    orbit(dx, dy) {
      // Grab-the-world: content follows the fingertip — dragging right
      // brings the scene's left edge around, so the camera circles the
      // other way. Pitch clamps keep the floor in frame.
      view.yaw -= dx * 0.0075;
      view.pitch = clamp(view.pitch + dy * 0.006, -0.15, 1.35);
      applyView();
      // The depth cue is viewer-relative — orbiting changes which side of
      // the billboard the glyph rides, so it repaints with the view.
      updateGlyphDepth();
      render();
    },
    zoom(scale) {
      view.dist = clamp(view.dist / scale, 3.2, 10);
      applyView();
      render();
    },
    viewDirty() {
      return (
        Math.abs(view.yaw - viewHome.yaw) > 0.01 ||
        Math.abs(view.pitch - viewHome.pitch) > 0.01 ||
        Math.abs(view.dist - viewHome.dist) > 0.05
      );
    },
    resetView() {
      if (
        Math.abs(view.yaw - viewHome.yaw) <= 0.01 &&
        Math.abs(view.pitch - viewHome.pitch) <= 0.01 &&
        Math.abs(view.dist - viewHome.dist) <= 0.05
      ) {
        return false;
      }
      Object.assign(view, viewHome);
      applyView();
      updateGlyphDepth();
      render();
      return true;
    },
    pick(x, y) {
      const w = host.clientWidth;
      const h = host.clientHeight;
      let best: number | null = null;
      let bestD = 30;
      lastFrames.forEach((kf, i) => {
        poseToWorld(kf, tmp).project(camera);
        const sx = (tmp.x * 0.5 + 0.5) * w;
        const sy = (-tmp.y * 0.5 + 0.5) * h;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    },
    dispose() {
      observer.disconnect();
      photoTex?.dispose();
      disposables.forEach((d) => d.dispose());
      tube?.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
