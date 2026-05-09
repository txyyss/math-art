import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createFinalModel,
  createIntroModel,
  createSkeletonModel,
  createSolidSmallStellatedModel,
  createTipPrototypeModel,
  estimateMinPrintableThickness,
} from "./ssd-geometry.js";

class ModelViewer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8f5ee);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
    this.camera.position.set(32, 26, 34);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xf8f5ee, 1);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomSpeed = 0.8;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x776f64, 2.8));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(6, 9, 10);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xc8e4ff, 1.4);
    rim.position.set(-9, 4, -6);
    this.scene.add(rim);

    this.model = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    const safeHeight = Math.max(1, height);
    this.camera.aspect = Math.max(1, width) / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(1, width), safeHeight, false);
  }

  setModel(model, { fit = true } = {}) {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject(this.model);
    }
    this.model = model;
    this.scene.add(model);
    if (fit) {
      this.fitCamera(model);
    }
  }

  disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.dispose();
        }
      }
    });
  }

  fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.64 || 10;
    const direction = new THREE.Vector3(0.85, 0.58, 0.72).normalize();

    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, radius * 2.25);
    this.camera.near = Math.max(0.01, radius / 100);
    this.camera.far = radius * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

function setupStaticViewers() {
  const builders = {
    intro: () => createIntroModel({ scale: 10 }),
    "solid-ssd": () => createSolidSmallStellatedModel({ scale: 10 }),
    skeleton: () => createSkeletonModel({ scale: 10, radius: 0.022 }),
    tip: () => createTipPrototypeModel({ scale: 10, width: 0.1 }),
    final: (element) => createFinalModel({ scale: 10, width: Number(element.dataset.width ?? 0.16) }),
  };

  for (const element of document.querySelectorAll(".viewer[data-viewer]:not([data-viewer='interactive-final'])")) {
    const type = element.dataset.viewer;
    const viewer = new ModelViewer(element);
    viewer.setModel(builders[type](element));
  }
}

function setupInteractiveFinal() {
  const container = document.querySelector(".viewer[data-viewer='interactive-final']");
  const slider = document.getElementById("width-slider");
  const output = document.getElementById("width-value");
  if (!container || !slider || !output) {
    return;
  }

  const viewer = new ModelViewer(container);
  let pending = false;
  let hasModel = false;

  function updateModel() {
    pending = false;
    const width = Number(slider.value);
    output.value = width.toFixed(2);
    output.textContent = width.toFixed(2);
    output.title = `scale=10 时最窄处约 ${estimateMinPrintableThickness(width, 10).toFixed(2)} mm`;
    viewer.setModel(createFinalModel({ scale: 10, width }), { fit: !hasModel });
    hasModel = true;
  }

  slider.addEventListener("input", () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(updateModel);
    }
  });
  updateModel();
}

setupStaticViewers();
setupInteractiveFinal();
