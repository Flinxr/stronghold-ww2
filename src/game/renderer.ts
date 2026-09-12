import * as THREE from 'three';
import { BuildingInstance, UnitInstance, Projectile, ParticleEffect, BuildingType, UnitType } from '../types';
import { MAP_SIZE, BUILDINGS_CONFIG, UNITS_CONFIG, PLAYERS_CONFIG } from './constants';
import { distance2D } from './pathfinding';

export function createSeededRng(seedVal: string | number = 777777) {
  let seed = 0;
  if (typeof seedVal === 'number') {
    seed = seedVal;
  } else if (typeof seedVal === 'string') {
    for (let i = 0; i < seedVal.length; i++) {
      seed = (seed << 5) - seed + seedVal.charCodeAt(i);
      seed |= 0;
    }
  }
  return function rng(): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 8), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringToSeed(str: string | number | undefined): number {
  if (typeof str === 'number') return str;
  if (!str) return 777777;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 777777;
}

export function getHpColor(pct: number): number {
  const p = Math.max(0, Math.min(1, pct));
  let r = 0;
  let g = 0;
  let b = 0;
  if (p > 0.5) {
    // Green (0x22, 0xc5, 0x5e) to Yellow (0xea, 0xb3, 0x08)
    const factor = (1 - p) * 2;
    r = Math.round(0x22 + (0xea - 0x22) * factor);
    g = Math.round(0xc5 + (0xb3 - 0xc5) * factor);
    b = Math.round(0x5e + (0x08 - 0x5e) * factor);
  } else {
    // Yellow (0xea, 0xb3, 0x08) to Red (0xef, 0x44, 0x44)
    const factor = (0.5 - p) * 2;
    r = Math.round(0xea + (0xef - 0xea) * factor);
    g = Math.round(0xb3 + (0x44 - 0xb3) * factor);
    b = Math.round(0x08 + (0x44 - 0x08) * factor);
  }
  return (r << 16) | (g << 8) | b;
}

export class GameRenderer {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;

  private buildingMeshes: Map<string, THREE.Group> = new Map();
  private unitMeshes: Map<string, THREE.Group> = new Map();
  private projectileMeshes: Map<string, THREE.Mesh> = new Map();
  private particleGroups: Map<string, THREE.Group> = new Map();
  private environmentMeshes: THREE.Group = new THREE.Group();

  private ghostBuildingMesh: THREE.Group | null = null;
  private selectionRings: Map<string, THREE.Mesh> = new Map();
  private gridHelperGroup: THREE.Group = new THREE.Group();

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // Camera Controls
  public cameraPos: { x: number; z: number } = { x: MAP_SIZE / 2, z: MAP_SIZE / 2 };
  public targetCameraPos: { x: number; z: number } = { x: MAP_SIZE / 2, z: MAP_SIZE / 2 };
  private aspect: number = 1;
  private zoomLevel: number = 17;
  private targetZoomLevel: number = 17;

  public rng: () => number;

  constructor(container: HTMLElement, seed: number = 777777) {
    this.container = container;
    this.rng = createSeededRng(seed);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x22331c); // Natural medieval grass/horizon tint
    this.scene.fog = new THREE.FogExp2(0x22331c, 0.003);

    this.aspect = container.clientWidth / container.clientHeight;
    const d = this.zoomLevel;
    this.camera = new THREE.OrthographicCamera(-d * this.aspect, d * this.aspect, d, -d, 1, 1000);

    // Dota 2 / Stronghold Isometric Angle: 45 deg yaw, 45 deg pitch
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.outline = 'none';

    container.appendChild(this.renderer.domElement);

    this.setupLights();
    this.buildTerrain();

    this.scene.add(this.environmentMeshes);
    this.scene.add(this.gridHelperGroup);
  }

  public updateCameraPosition() {
    const isoAngleX = Math.PI / 4; // 45 deg pitch
    const isoAngleY = Math.PI / 4; // 45 deg yaw
    const distance = 80;

    const cx = this.cameraPos.x + Math.sin(isoAngleY) * Math.cos(isoAngleX) * distance;
    const cy = Math.sin(isoAngleX) * distance;
    const cz = this.cameraPos.z + Math.cos(isoAngleY) * Math.cos(isoAngleX) * distance;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.cameraPos.x, 0, this.cameraPos.z);
    this.camera.updateMatrixWorld();
    this.updateCameraProjection();
  }

  public updateCameraProjection() {
    const d = this.zoomLevel;
    this.camera.left = -d * this.aspect;
    this.camera.right = d * this.aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
  }

  public setZoom(zoomDelta: number) {
    this.targetZoomLevel = Math.max(9, Math.min(26, this.targetZoomLevel + zoomDelta));
  }

  public zoomIn() {
    this.setZoom(-2.5);
  }

  public zoomOut() {
    this.setZoom(2.5);
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  public projectUnitToScreen(unitX: number, unitZ: number): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const vec = new THREE.Vector3(unitX, 0.5, unitZ);
    vec.project(this.camera);

    const rect = this.container.getBoundingClientRect();
    const screenX = ((vec.x + 1) / 2) * rect.width + rect.left;
    const screenY = ((-vec.y + 1) / 2) * rect.height + rect.top;

    return { x: screenX, y: screenY };
  }

  public resize(width: number, height: number) {
    this.aspect = width / height;
    const d = this.zoomLevel;
    this.camera.left = -d * this.aspect;
    this.camera.right = d * this.aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(40, 60, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 150;
    const shadowSize = 45;
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    dirLight.shadow.bias = -0.0005;

    this.scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2e4a2e, 0.5);
    this.scene.add(hemiLight);
  }

  private buildTerrain() {
    // 1. Massive Outer Base Grass Ground (300x300) so the entire horizon is filled with green terrain
    const outerGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    outerGeo.rotateX(-Math.PI / 2);

    const outerPos = outerGeo.attributes.position;
    for (let i = 0; i < outerPos.count; i++) {
      const x = outerPos.getX(i);
      const z = outerPos.getZ(i);
      const noise = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.4;
      outerPos.setY(i, noise - 0.05);
    }
    outerGeo.computeVertexNormals();

    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x1f2e1a,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    const outerGround = new THREE.Mesh(outerGeo, outerMat);
    outerGround.position.set(MAP_SIZE / 2, -0.05, MAP_SIZE / 2);
    outerGround.receiveShadow = true;
    outerGround.name = 'outer_ground';
    this.scene.add(outerGround);

    // 2. Playable Castle Ground (40x40)
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2b3b22,
      roughness: 0.85,
      metalness: 0.1,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    // Uniform grid lines overlay in natural subtle dark green
    const gridHelper = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, 0x142211, 0x182815);
    gridHelper.position.set(MAP_SIZE / 2, 0.005, MAP_SIZE / 2);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.5;
    this.gridHelperGroup.add(gridHelper);

    // Decorative Environment: Pine Trees, Rocks, Gold Nodes around map border & inside
    for (let i = 0; i < 140; i++) {
      const tx = Math.floor(this.rng() * (MAP_SIZE - 6)) + 3;
      const tz = Math.floor(this.rng() * (MAP_SIZE - 6)) + 3;
      
      // Keep area around 4 bases clear
      const nearBase1 = distance2D(tx, tz, 12, 64) < 10; // Player 1 (SW)
      const nearBase2 = distance2D(tx, tz, 64, 12) < 10; // Player 2 (NE)
      const nearBase3 = distance2D(tx, tz, 12, 12) < 10; // Player 3 (NW)
      const nearBase4 = distance2D(tx, tz, 64, 64) < 10; // Player 4 (SE)

      if (!nearBase1 && !nearBase2 && !nearBase3 && !nearBase4) {
        if (this.rng() > 0.35) {
          const tree = this.createTreeMesh();
          tree.position.set(tx + 0.5, 0, tz + 0.5);
          this.environmentMeshes.add(tree);
        } else {
          const rock = this.createRockMesh();
          rock.position.set(tx + 0.5, 0, tz + 0.5);
          this.environmentMeshes.add(rock);
        }
      }
    }
  }

  private createTreeMesh(): THREE.Group {
    const group = new THREE.Group();
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage (Conical Layers)
    const folMat = new THREE.MeshStandardMaterial({ color: 0x225522, roughness: 0.8, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const coneGeo = new THREE.ConeGeometry(0.85 - i * 0.18, 1.1, 5);
      const cone = new THREE.Mesh(coneGeo, folMat);
      cone.position.y = 1.3 + i * 0.65;
      cone.castShadow = true;
      group.add(cone);
    }
    const s = 0.8 + this.rng() * 0.4;
    group.scale.set(s, s, s);
    return group;
  }

  private createRockMesh(): THREE.Group {
    const group = new THREE.Group();
    const isGold = this.rng() > 0.6;

    if (isGold) {
      // --- GOLD ORE NODE (Irregular angular golden ore cluster embedded in ground) ---
      const baseGeo = new THREE.DodecahedronGeometry(0.48 + this.rng() * 0.15, 0);
      const posAttr = baseGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setX(i, posAttr.getX(i) * (0.8 + this.rng() * 0.4));
        posAttr.setY(i, posAttr.getY(i) * (0.5 + this.rng() * 0.35)); // Squished height
        posAttr.setZ(i, posAttr.getZ(i) * (0.8 + this.rng() * 0.4));
      }
      baseGeo.computeVertexNormals();

      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x3d372e,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.08; // Partially underground
      baseMesh.rotation.set(this.rng() * 0.4, this.rng() * Math.PI * 2, this.rng() * 0.4);
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // Shiny golden ore crystals/boulders protruding from the base
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xeeb827,
        roughness: 0.25,
        metalness: 0.85,
        flatShading: true,
      });

      const crystalCount = 2 + Math.floor(this.rng() * 3);
      for (let c = 0; c < crystalCount; c++) {
        const cGeo = new THREE.IcosahedronGeometry(0.22 + this.rng() * 0.12, 0);
        const crystal = new THREE.Mesh(cGeo, goldMat);
        crystal.scale.set(
          0.7 + this.rng() * 0.5,
          1.1 + this.rng() * 0.5,
          0.7 + this.rng() * 0.5
        );
        crystal.position.set(
          (this.rng() - 0.5) * 0.32,
          0.12 + this.rng() * 0.12,
          (this.rng() - 0.5) * 0.32
        );
        crystal.rotation.set(
          (this.rng() - 0.5) * 0.7,
          this.rng() * Math.PI,
          (this.rng() - 0.5) * 0.7
        );
        crystal.castShadow = true;
        group.add(crystal);
      }
    } else {
      // --- JAGGED STONE BOULDER (Irregular slate rock buried in earth) ---
      const boulderCount = 1 + (this.rng() > 0.4 ? 1 : 0);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x556066,
        roughness: 0.85,
        metalness: 0.15,
        flatShading: true,
      });

      for (let b = 0; b < boulderCount; b++) {
        const geo = new THREE.DodecahedronGeometry(0.44 + this.rng() * 0.2, 0);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, pos.getX(i) * (0.8 + this.rng() * 0.5));
          pos.setY(i, pos.getY(i) * (0.45 + this.rng() * 0.35)); // Squished height -> embedded in ground
          pos.setZ(i, pos.getZ(i) * (0.8 + this.rng() * 0.5));
        }
        geo.computeVertexNormals();

        const rockMesh = new THREE.Mesh(geo, stoneMat);
        rockMesh.position.set(
          b * 0.22 * (this.rng() > 0.5 ? 1 : -1),
          0.09 + this.rng() * 0.06, // Embedded partially in Y=0 ground
          b * 0.22 * (this.rng() > 0.5 ? 1 : -1)
        );
        rockMesh.rotation.set(
          this.rng() * 0.5,
          this.rng() * Math.PI * 2,
          this.rng() * 0.5
        );
        rockMesh.castShadow = true;
        group.add(rockMesh);
      }
    }

    return group;
  }

  // --- Procedural 3D Building Generator ---
  private createBuildingMesh(type: BuildingType, isEnemy: boolean, isConstructed: boolean = true, playerId: number = 1): THREE.Group {
    const group = new THREE.Group();
    const pConfig = PLAYERS_CONFIG[playerId] || PLAYERS_CONFIG[isEnemy ? 2 : 1];
    const primaryColor = pConfig ? pConfig.colorHex : (isEnemy ? 0xef4444 : 0x2563eb);

    // WWII & Tactical Strategy Minimalist Palette
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a6578, roughness: 0.85, flatShading: true });
    const darkConcreteMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.9, flatShading: true });
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x475437, roughness: 0.75, flatShading: true }); // WWII Olive Drab
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x9b907a, roughness: 0.95, flatShading: true }); // Field Sandbag
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35, flatShading: true });
    const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, flatShading: true });
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x825b3e, roughness: 0.85 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x8c826c, roughness: 0.9, flatShading: true });
    const teamMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.45, metalness: 0.25, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25, flatShading: true });
    const cropMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9, flatShading: true });
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.7 });

    switch (type) {
      case 'keep': {
        // --- WWII Supreme Command Citadel Fortress (3x3 footprint) ---
        // 1. Reinforced Concrete Bastion Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 2.8), concreteMat);
        base.position.y = 0.55;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // 4 Corner Pillbox Bastions with Team Caps & Defense Barrels
        const cornerCoords = [
          [-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]
        ];
        cornerCoords.forEach(([cx, cz]) => {
          const pillbox = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.5, 8), darkConcreteMat);
          pillbox.position.set(cx, 0.75, cz);
          pillbox.castShadow = true;
          group.add(pillbox);

          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 8), teamMat);
          cap.position.set(cx, 1.55, cz);
          group.add(cap);

          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), steelMat);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(cx, 1.4, cz + (cz > 0 ? 0.35 : -0.35));
          group.add(barrel);
        });

        // 2. Central Elevated Command Observation Bridge
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 1.6), darkConcreteMat);
        bridge.position.y = 1.5;
        bridge.castShadow = true;
        group.add(bridge);

        const slit = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.16, 1.64), beaconMat);
        slit.position.y = 1.55;
        group.add(slit);

        // 3. Top Communications Mast & WWII Curved Radar Array
        const radMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), steelMat);
        radMast.position.set(0, 2.55, 0);
        group.add(radMast);

        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 12), teamMat);
        dish.rotation.x = Math.PI / 3;
        dish.position.set(0, 3.1, 0.1);
        dish.castShadow = true;
        group.add(dish);

        // Supreme Commander Banner
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.03), teamMat);
        flag.position.set(0.45, 3.4, 0);
        group.add(flag);

        // Front Armored Blast Doors
        const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.1), steelMat);
        blastDoor.position.set(0, 0.5, 1.42);
        group.add(blastDoor);
        break;
      }

      case 'barracks': {
        // --- WWII Quonset / Nissen Military Barracks & Outpost Garrison (3x3 footprint) ---
        // 1. Concrete Foundation Slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 2.7), darkConcreteMat);
        slab.position.y = 0.09;
        slab.receiveShadow = true;
        group.add(slab);

        // 2. Corrugated Half-Cylinder Quonset Arch
        const archGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16, 1, false, 0, Math.PI);
        const archMesh = new THREE.Mesh(archGeo, oliveMat);
        archMesh.rotation.x = -Math.PI / 2;
        archMesh.position.set(-0.15, 0.18, 0);
        archMesh.castShadow = true;
        group.add(archMesh);

        // Team Stripe along the ridge of the Quonset arch
        const stripeGeo = new THREE.BoxGeometry(0.32, 0.04, 2.22);
        const stripe = new THREE.Mesh(stripeGeo, teamMat);
        stripe.position.set(-0.15, 1.3, 0);
        group.add(stripe);

        // 3. Front & Back Bulkhead Flat End Walls
        [-1.1, 1.1].forEach((zPos, idx) => {
          const wallGeo = new THREE.CylinderGeometry(1.08, 1.08, 0.06, 16, 1, false, 0, Math.PI);
          const wall = new THREE.Mesh(wallGeo, darkConcreteMat);
          wall.rotation.x = -Math.PI / 2;
          wall.position.set(-0.15, 0.18, zPos);
          group.add(wall);

          if (idx === 1) {
            // Front Entrance with Reinforced Steel Blast Door
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.08), steelMat);
            door.position.set(-0.15, 0.55, zPos + 0.03);
            group.add(door);

            // Door Visor / Cowl
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.25), steelMat);
            visor.position.set(-0.15, 1.02, zPos + 0.12);
            group.add(visor);

            // Glowing entrance beacon
            const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), beaconMat);
            beacon.position.set(-0.15, 1.12, zPos + 0.05);
            group.add(beacon);
          }
        });

        // 4. Sandbag Defensive Embankment flanking the door
        [-0.7, 0.4].forEach((xPos) => {
          const sbag1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.35), sandbagMat);
          sbag1.position.set(xPos, 0.25, 1.15);
          sbag1.castShadow = true;
          group.add(sbag1);

          const sbag2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.3), sandbagMat);
          sbag2.position.set(xPos, 0.42, 1.15);
          sbag2.castShadow = true;
          group.add(sbag2);
        });

        // 5. Tall WWII Military Radio Mast with Cross-Dipole Antenna
        const mastBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), steelMat);
        mastBase.position.set(1.05, 0.25, -0.85);
        group.add(mastBase);

        const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.5, 6), steelMat);
        mastPole.position.set(1.05, 1.5, -0.85);
        mastPole.castShadow = true;
        group.add(mastPole);

        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.03), steelMat);
        cross1.position.set(1.05, 2.7, -0.85);
        group.add(cross1);

        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.65), steelMat);
        cross2.position.set(1.05, 2.5, -0.85);
        group.add(cross2);

        // Military Pennant Flag on mast
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.02), teamMat);
        flag.position.set(1.3, 2.4, -0.85);
        group.add(flag);

        // 6. Stacked Ammo Crates & Fuel Drum
        const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.32), woodMat);
        crate1.position.set(1.05, 0.28, 0.2);
        crate1.rotation.y = 0.2;
        crate1.castShadow = true;
        group.add(crate1);

        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.28), oliveMat);
        crate2.position.set(1.05, 0.5, 0.2);
        crate2.rotation.y = -0.15;
        crate2.castShadow = true;
        group.add(crate2);

        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 8), gunmetalMat);
        drum.position.set(1.05, 0.35, 0.7);
        drum.castShadow = true;
        group.add(drum);
        break;
      }

      case 'tower': {
        // --- WWII Elevated Watchtower & Flak Bunker ---
        // 1. Sturdy 4-Pylon Outpost Tower Frame
        const legGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6);
        const legOffsets = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];
        legOffsets.forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, woodMat);
          leg.position.set(lx, 1.3, lz);
          leg.rotation.x = lz > 0 ? -0.1 : 0.1;
          leg.rotation.z = lx > 0 ? 0.1 : -0.1;
          leg.castShadow = true;
          group.add(leg);
        });

        // Cross-bracing ring
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 1.25), woodMat);
        brace.position.y = 1.3;
        group.add(brace);

        // 2. Elevated Armored Watch Cabin
        const platform = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.4), darkConcreteMat);
        platform.position.y = 2.6;
        platform.castShadow = true;
        group.add(platform);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), darkConcreteMat);
        cabin.position.y = 3.0;
        cabin.castShadow = true;
        group.add(cabin);

        const cabinSlit = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 1.14), beaconMat);
        cabinSlit.position.y = 3.05;
        group.add(cabinSlit);

        // Protective Armored Roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 4), teamMat);
        roof.position.y = 3.65;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Searchlight
        const searchlight = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 8), steelMat);
        searchlight.rotation.x = Math.PI / 2;
        searchlight.position.set(0.4, 3.45, 0.6);
        group.add(searchlight);

        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), beaconMat);
        lens.position.set(0.4, 3.45, 0.73);
        group.add(lens);

        // Dual AA / sniper defense barrels
        [-0.06, 0.06].forEach((xOff) => {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), steelMat);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(-0.3 + xOff, 2.9, 0.75);
          group.add(barrel);
        });
        break;
      }

      case 'wall': {
        // --- WWII Reinforced Concrete Blast Wall & Tank Obstacle (1x1) ---
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.45), concreteMat);
        wall.position.y = 0.55;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const sandbagRow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.35), sandbagMat);
        sandbagRow.position.set(0, 1.2, 0);
        sandbagRow.castShadow = true;
        group.add(sandbagRow);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.46), teamMat);
        strip.position.y = 1.05;
        group.add(strip);

        // Dragon's Tooth Concrete Obstacles in front
        const tooth1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), darkConcreteMat);
        tooth1.position.set(-0.25, 0.17, 0.35);
        tooth1.rotation.y = Math.PI / 4;
        group.add(tooth1);

        const tooth2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), darkConcreteMat);
        tooth2.position.set(0.25, 0.17, 0.35);
        tooth2.rotation.y = Math.PI / 4;
        group.add(tooth2);
        break;
      }

      case 'house': {
        // --- WWII Troop Personnel Quarters & Field Officer Cabin (2x2) ---
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 1.4), darkConcreteMat);
        base.position.y = 0.09;
        group.add(base);

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.3), woodMat);
        body.position.y = 0.58;
        body.castShadow = true;
        group.add(body);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.65, 4), oliveMat);
        roof.position.y = 1.3;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        const stovepipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 6), steelMat);
        stovepipe.position.set(0.45, 1.5, 0.35);
        group.add(stovepipe);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 6), steelMat);
        cap.position.set(0.45, 1.92, 0.35);
        group.add(cap);

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.06), darkConcreteMat);
        door.position.set(0, 0.48, 0.66);
        group.add(door);

        const teamInsignia = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.04), teamMat);
        teamInsignia.position.set(0, 0.88, 0.66);
        group.add(teamInsignia);
        break;
      }

      case 'farm': {
        // --- WWII Supply & Ration Depot with Metal Silo (2x2) ---
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 12), steelMat);
        silo.position.set(-0.45, 0.75, -0.45);
        silo.castShadow = true;
        group.add(silo);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), teamMat);
        dome.position.set(-0.45, 1.45, -0.45);
        group.add(dome);

        const shed = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.85), woodMat);
        shed.position.set(0.4, 0.4, -0.4);
        shed.castShadow = true;
        group.add(shed);

        const shedRoof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 4), canvasMat);
        shedRoof.position.set(0.4, 0.95, -0.4);
        shedRoof.rotation.y = Math.PI / 4;
        group.add(shedRoof);

        for (let i = 0; i < 3; i++) {
          const plot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.28), cropMat);
          plot.position.set(0, 0.06, 0.2 + i * 0.35);
          group.add(plot);
        }

        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), oliveMat);
        crate.position.set(0.5, 0.15, 0.2);
        group.add(crate);
        break;
      }

      case 'woodcutter': {
        // --- WWII Military Sawmill & Fortification Lumber Workshop (2x2) ---
        const posts = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];
        posts.forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), woodMat);
          post.position.set(px, 0.6, pz);
          post.castShadow = true;
          group.add(post);
        });

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.5), steelMat);
        roof.position.set(0, 1.25, 0);
        roof.rotation.x = 0.1;
        roof.castShadow = true;
        group.add(roof);

        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), darkConcreteMat);
        bench.position.set(-0.2, 0.25, 0);
        group.add(bench);

        const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), steelMat);
        blade.rotation.z = Math.PI / 2;
        blade.position.set(-0.2, 0.58, 0);
        group.add(blade);

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8), plankMat);
            log.rotation.x = Math.PI / 2;
            log.position.set(0.45 + col * 0.18, 0.12 + row * 0.18, -0.1);
            log.castShadow = true;
            group.add(log);
          }
        }

        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.02), teamMat);
        flag.position.set(-0.6, 1.45, -0.6);
        group.add(flag);
        break;
      }

      case 'quarry': {
        // --- Heavy Masonry & Concrete Excavation with Crane (2x2) ---
        const basePit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), darkConcreteMat);
        basePit.position.y = 0.08;
        group.add(basePit);

        const slabPositions = [
          [-0.4, 0.22, -0.3],
          [0.2, 0.22, -0.4],
          [-0.3, 0.22, 0.3],
        ];
        slabPositions.forEach(([sx, sy, sz]) => {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), concreteMat);
          slab.position.set(sx, sy, sz);
          slab.castShadow = true;
          group.add(slab);
        });

        const craneBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.28), steelMat);
        craneBase.position.set(0.55, 0.25, 0.45);
        group.add(craneBase);

        const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), teamMat);
        craneBoom.position.set(0.35, 1.0, 0.35);
        craneBoom.rotation.z = -0.35;
        craneBoom.castShadow = true;
        group.add(craneBoom);

        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), steelMat);
        cable.position.set(0.05, 1.3, 0.35);
        group.add(cable);

        const hookedStone = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.32), concreteMat);
        hookedStone.position.set(0.05, 0.8, 0.35);
        hookedStone.castShadow = true;
        group.add(hookedStone);
        break;
      }

      case 'goldmine': {
        // --- Fortified Mine Shaft with Headframe Derrick & Minecart (2x2) ---
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 1.2), darkConcreteMat);
        shaft.position.set(0, 0.48, -0.3);
        shaft.castShadow = true;
        group.add(shaft);

        const portalFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.15), woodMat);
        portalFrame.position.set(0, 0.45, 0.35);
        group.add(portalFrame);

        const derrickLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), woodMat);
        derrickLeg1.position.set(-0.4, 0.9, -0.3);
        derrickLeg1.rotation.z = -0.15;
        group.add(derrickLeg1);

        const derrickLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), woodMat);
        derrickLeg2.position.set(0.4, 0.9, -0.3);
        derrickLeg2.rotation.z = 0.15;
        group.add(derrickLeg2);

        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), teamMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(0, 1.75, -0.3);
        group.add(wheel);

        const cart = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.35), gunmetalMat);
        cart.position.set(0, 0.22, 0.55);
        cart.castShadow = true;
        group.add(cart);

        const goldOre1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), goldMat);
        goldOre1.position.set(0, 0.38, 0.55);
        group.add(goldOre1);

        const goldOre2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), goldMat);
        goldOre2.position.set(-0.35, 0.12, 0.5);
        group.add(goldOre2);

        const goldOre3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), goldMat);
        goldOre3.position.set(0.35, 0.1, 0.45);
        group.add(goldOre3);
        break;
      }

      case 'market': {
        // --- WWII Quartermaster Field Exchange & Armory Depot (2x2) ---
        const platform = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.6), woodMat);
        platform.position.y = 0.08;
        group.add(platform);

        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.4), darkConcreteMat);
        counter.position.set(0, 0.38, 0);
        counter.castShadow = true;
        group.add(counter);

        const posts = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
        posts.forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), steelMat);
          post.position.set(px, 0.7, pz);
          group.add(post);
        });

        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.4, 4), teamMat);
        canopy.position.set(0, 1.5, 0);
        canopy.rotation.y = Math.PI / 4;
        canopy.castShadow = true;
        group.add(canopy);

        const strongbox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.22), goldMat);
        strongbox.position.set(0.2, 0.75, 0);
        group.add(strongbox);

        const drum1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 8), gunmetalMat);
        drum1.position.set(-0.5, 0.32, -0.4);
        drum1.castShadow = true;
        group.add(drum1);

        const drum2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 8), oliveMat);
        drum2.position.set(-0.25, 0.32, -0.5);
        drum2.castShadow = true;
        group.add(drum2);
        break;
      }
    }

    if (!isConstructed) {
      // Scaffolding / Semi-transparent build frame
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xc8aa6e,
            wireframe: true,
            transparent: true,
            opacity: 0.65,
          });
        }
      });
    }

    return group;
  }

  // --- Procedural 3D Unit (Soldier) Generator ---
  private createUnitMesh(type: UnitType, isEnemy: boolean, playerId: number = 1): THREE.Group {
    const pConfig = PLAYERS_CONFIG[playerId] || PLAYERS_CONFIG[isEnemy ? 2 : 1];
    const armorColor = pConfig ? pConfig.colorHex : (isEnemy ? 0xef4444 : 0x2563eb);

    // --- Special 3D Tanks ---
    if (type === 'tank' || type === 'artillery_tank') {
      const isArtillery = type === 'artillery_tank';
      const tankGroup = new THREE.Group();

      const bodyWidth = isArtillery ? 0.65 : 0.85;
      const bodyHeight = isArtillery ? 0.35 : 0.42;
      const bodyLength = isArtillery ? 0.85 : 1.05;

      // Dark Metallic Tracks / Treads
      const treadMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8, metalness: 0.8 });
      const trackGeo = new THREE.BoxGeometry(0.18, bodyHeight, bodyLength + 0.1);

      const leftTrack = new THREE.Mesh(trackGeo, treadMat);
      leftTrack.position.set(-bodyWidth / 2 - 0.08, bodyHeight / 2 + 0.05, 0);
      leftTrack.castShadow = true;
      leftTrack.name = 'leftTread';
      tankGroup.add(leftTrack);

      const rightTrack = new THREE.Mesh(trackGeo, treadMat);
      rightTrack.position.set(bodyWidth / 2 + 0.08, bodyHeight / 2 + 0.05, 0);
      rightTrack.castShadow = true;
      rightTrack.name = 'rightTread';
      tankGroup.add(rightTrack);

      // Tank Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 });
      for (let w = -0.3; w <= 0.3; w += 0.3) {
        const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8);
        const wL = new THREE.Mesh(wheelGeo, wheelMat);
        wL.rotation.z = Math.PI / 2;
        wL.position.set(-bodyWidth / 2 - 0.08, 0.14, w);
        tankGroup.add(wL);

        const wR = new THREE.Mesh(wheelGeo, wheelMat);
        wR.rotation.z = Math.PI / 2;
        wR.position.set(bodyWidth / 2 + 0.08, 0.14, w);
        tankGroup.add(wR);
      }

      // Main Hull
      const hullGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
      const hullMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.4, metalness: 0.6 });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = bodyHeight / 2 + 0.12;
      hull.castShadow = true;
      tankGroup.add(hull);

      // Glacis Plate
      const glacisGeo = new THREE.BoxGeometry(bodyWidth, 0.08, 0.28);
      const glacis = new THREE.Mesh(glacisGeo, hullMat);
      glacis.position.set(0, bodyHeight / 2 + 0.16, bodyLength / 2 - 0.05);
      glacis.rotation.x = -Math.PI / 6;
      tankGroup.add(glacis);

      // Turret Group
      const turretGroup = new THREE.Group();
      turretGroup.name = 'tankTurret';
      turretGroup.position.set(0, bodyHeight + 0.12, isArtillery ? -0.1 : 0);

      const turretWidth = isArtillery ? 0.42 : 0.58;
      const turretHeight = isArtillery ? 0.26 : 0.3;
      const turretGeo = new THREE.CylinderGeometry(turretWidth / 2, turretWidth / 2 + 0.05, turretHeight, 8);
      const turretMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.3, metalness: 0.7 });
      const turretMesh = new THREE.Mesh(turretGeo, turretMat);
      turretMesh.position.y = turretHeight / 2;
      turretMesh.castShadow = true;
      turretGroup.add(turretMesh);

      // Barrel
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.2 });
      if (isArtillery) {
        // High-angled Mortar Barrel
        const mortarBarrelGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8);
        const mortarBarrel = new THREE.Mesh(mortarBarrelGeo, barrelMat);
        mortarBarrel.rotation.x = -Math.PI / 3;
        mortarBarrel.position.set(0, 0.32, 0.22);
        mortarBarrel.castShadow = true;
        mortarBarrel.name = 'cannonBarrel';
        turretGroup.add(mortarBarrel);

        const muzzleGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = -Math.PI / 3;
        muzzle.position.set(0, 0.6, 0.38);
        turretGroup.add(muzzle);
      } else {
        // Straight Heavy Cannon
        const cannonGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8);
        const cannon = new THREE.Mesh(cannonGeo, barrelMat);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(0, 0.15, 0.45);
        cannon.castShadow = true;
        cannon.name = 'cannonBarrel';
        turretGroup.add(cannon);

        const brakeGeo = new THREE.BoxGeometry(0.14, 0.1, 0.12);
        const brake = new THREE.Mesh(brakeGeo, barrelMat);
        brake.position.set(0, 0.15, 0.88);
        turretGroup.add(brake);
      }

      // Team Flag
      const flagPoleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.55);
      const flagPole = new THREE.Mesh(flagPoleGeo, barrelMat);
      flagPole.position.set(turretWidth / 2 - 0.05, 0.4, -turretWidth / 2 + 0.05);
      turretGroup.add(flagPole);

      const flagGeo = new THREE.BoxGeometry(0.22, 0.15, 0.02);
      const flagMat = new THREE.MeshStandardMaterial({ color: armorColor });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(turretWidth / 2 + 0.08, 0.52, -turretWidth / 2 + 0.05);
      turretGroup.add(flag);

      tankGroup.add(turretGroup);

      // Selection Ring
      const ringGeo = new THREE.RingGeometry(0.65, 0.75, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: armorColor, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'selectionRing';
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      tankGroup.add(ring);

      // Health Bar
      const hpBgGeo = new THREE.PlaneGeometry(0.8, 0.12);
      const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
      hpBg.name = 'hpBg';
      hpBg.position.y = bodyHeight + 0.85;

      const hpFillGeo = new THREE.PlaneGeometry(0.76, 0.08);
      const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
      const hpFill = new THREE.Mesh(hpFillGeo, hpFillMat);
      hpFill.name = 'hpFill';
      hpFill.position.z = 0.01;
      hpBg.add(hpFill);
      hpBg.visible = false;
      tankGroup.add(hpBg);

      return tankGroup;
    }

    const group = new THREE.Group();
    const skinColor = 0xe0ac69;
    const weaponColor = 0xc0c0c0;

    const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.5, metalness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
    const weaponMat = new THREE.MeshStandardMaterial({ color: weaponColor, roughness: 0.3, metalness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });

    // Body Torso
    const torsoGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 0.65;
    torso.castShadow = true;
    group.add(torso);

    // Head + Helmet
    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.05;
    head.castShadow = true;
    group.add(head);

    const helmGeo = new THREE.ConeGeometry(0.2, 0.2, 8);
    const helm = new THREE.Mesh(helmGeo, armorMat);
    helm.position.y = 1.2;
    group.add(helm);

    // Legs (Pivot groups for walking animation!)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6);
    
    const leftLegGroup = new THREE.Group();
    leftLegGroup.name = 'leftLeg';
    leftLegGroup.position.set(-0.12, 0.45, 0);
    const leftLeg = new THREE.Mesh(legGeo, armorMat);
    leftLeg.position.y = -0.22;
    leftLeg.castShadow = true;
    leftLegGroup.add(leftLeg);
    group.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.name = 'rightLeg';
    rightLegGroup.position.set(0.12, 0.45, 0);
    const rightLeg = new THREE.Mesh(legGeo, armorMat);
    rightLeg.position.y = -0.22;
    rightLeg.castShadow = true;
    rightLegGroup.add(rightLeg);
    group.add(rightLegGroup);

    // Arms & Weapons
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6);
    
    const rightArmGroup = new THREE.Group();
    rightArmGroup.name = 'rightArm';
    rightArmGroup.position.set(0.24, 0.8, 0);
    const rightArm = new THREE.Mesh(armGeo, armorMat);
    rightArm.position.y = -0.2;
    rightArmGroup.add(rightArm);

    // Specific Weapons based on UnitType
    if (type === 'archer' || type === 'enemy_archer') {
      // Bow
      const bowGeo = new THREE.TorusGeometry(0.3, 0.03, 6, 12, Math.PI);
      const bow = new THREE.Mesh(bowGeo, woodMat);
      bow.rotation.y = Math.PI / 2;
      bow.position.set(0, -0.2, 0.2);
      rightArmGroup.add(bow);
    } else if (type === 'spearman') {
      // Long Spear
      const spearGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6);
      const spear = new THREE.Mesh(spearGeo, woodMat);
      spear.position.set(0, 0.2, 0.2);
      spear.rotation.x = Math.PI / 4;
      rightArmGroup.add(spear);

      const tipGeo = new THREE.ConeGeometry(0.06, 0.25, 4);
      const tip = new THREE.Mesh(tipGeo, weaponMat);
      tip.position.set(0, 0.9, 0.2);
      tip.rotation.x = Math.PI / 4;
      rightArmGroup.add(tip);
    } else if (type === 'knight' || type === 'swordsman' || type === 'enemy_grunt') {
      // Sword & Shield
      const swordGeo = new THREE.BoxGeometry(0.08, 0.7, 0.03);
      const sword = new THREE.Mesh(swordGeo, weaponMat);
      sword.position.set(0, -0.2, 0.2);
      rightArmGroup.add(sword);

      // Shield on left arm
      const leftArmGroup = new THREE.Group();
      leftArmGroup.name = 'leftArm';
      leftArmGroup.position.set(-0.24, 0.8, 0);
      const leftArm = new THREE.Mesh(armGeo, armorMat);
      leftArm.position.y = -0.2;
      leftArmGroup.add(leftArm);

      const shieldGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 6);
      const shieldMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x992222 : 0x3366aa });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.rotation.x = Math.PI / 2;
      shield.position.set(-0.05, -0.2, 0.1);
      leftArmGroup.add(shield);
      group.add(leftArmGroup);
    } else if (type === 'enemy_boss') {
      // Big Boss Greataxe + Heavy Scale
      group.scale.set(1.4, 1.4, 1.4);
      const axeGeo = new THREE.BoxGeometry(0.1, 1.1, 0.05);
      const axe = new THREE.Mesh(axeGeo, weaponMat);
      axe.position.set(0, 0, 0.3);
      rightArmGroup.add(axe);

      const bladeGeo = new THREE.BoxGeometry(0.4, 0.35, 0.05);
      const blade = new THREE.Mesh(bladeGeo, weaponMat);
      blade.position.set(0.15, 0.4, 0.3);
      rightArmGroup.add(blade);
    }

    group.add(rightArmGroup);

    // Selection Circle under unit
    const ringGeo = new THREE.RingGeometry(0.42, 0.52, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isEnemy ? 0xef4444 : 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.03;
    ring.name = 'selectionRing';
    group.add(ring);

    // Slim Health Bar for Unit
    const barY = type === 'enemy_boss' ? 2.1 : 1.5;
    const hpBgGeo = new THREE.PlaneGeometry(0.8, 0.12);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.set(0, barY, 0);
    hpBg.name = 'hpBg';
    hpBg.visible = false;

    const hpFillGeo = new THREE.PlaneGeometry(0.76, 0.09);
    const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
    const hpFill = new THREE.Mesh(hpFillGeo, hpFillMat);
    hpFill.position.set(0, 0, 0.001);
    hpFill.name = 'hpFill';
    hpBg.add(hpFill);

    group.add(hpBg);

    return group;
  }

  // Helper to create building selection highlight ring
  private createBuildingSelectionRing(sizeX: number, sizeZ: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(Math.max(sizeX, sizeZ) * 0.5 + 0.1, Math.max(sizeX, sizeZ) * 0.5 + 0.35, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.y = 0.05;
    ring.name = 'bSelectionRing';
    return ring;
  }

  // --- Update Loop ---
  public update(
    buildings: BuildingInstance[],
    units: UnitInstance[],
    projectiles: Projectile[],
    particles: ParticleEffect[],
    selectedUnitIds: Set<string>,
    activeBuildType: BuildingType | null,
    mouseGridPos: { x: number; z: number } | null,
    isPlacementValid: boolean = true,
    selectedBuildingId?: string | null
  ) {
    const time = performance.now() * 0.003;

    // Smooth Camera Zoom Interpolation (60 FPS Butter Smooth)
    if (Math.abs(this.targetZoomLevel - this.zoomLevel) > 0.01) {
      this.zoomLevel += (this.targetZoomLevel - this.zoomLevel) * 0.18;
      this.updateCameraProjection();
    }

    // Smooth Camera Pan Position Interpolation
    const dxCam = this.targetCameraPos.x - this.cameraPos.x;
    const dzCam = this.targetCameraPos.z - this.cameraPos.z;
    if (Math.abs(dxCam) > 0.001 || Math.abs(dzCam) > 0.001) {
      this.cameraPos.x += dxCam * 0.22;
      this.cameraPos.z += dzCam * 0.22;
      this.updateCameraPosition();
    }

    // 1. Sync Buildings
    const currentBuildingIds = new Set<string>();
    buildings.forEach((b) => {
      currentBuildingIds.add(b.id);
      let mesh = this.buildingMeshes.get(b.id);
      const bConfig = BUILDINGS_CONFIG[b.type];
      const sizeX = bConfig ? bConfig.sizeX : 2;
      const sizeZ = bConfig ? bConfig.sizeZ : 2;

      if (!mesh) {
        mesh = this.createBuildingMesh(b.type, b.isEnemy, b.isConstructed, b.playerId || (b.isEnemy ? 2 : 1));
        mesh.position.set(b.gridX + (sizeX / 2), 0, b.gridZ + (sizeZ / 2));
        
        // Add building selection ring & health bar
        const selRing = this.createBuildingSelectionRing(sizeX, sizeZ);
        selRing.visible = false;
        mesh.add(selRing);

        const bHpBgGeo = new THREE.PlaneGeometry(sizeX * 0.8, 0.15);
        const bHpBgMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
        const bHpBg = new THREE.Mesh(bHpBgGeo, bHpBgMat);
        bHpBg.position.set(0, (sizeX + sizeZ) * 0.7 + 0.5, 0);
        bHpBg.name = 'bHpBg';
        bHpBg.visible = false;

        const bHpFillGeo = new THREE.PlaneGeometry(sizeX * 0.76, 0.11);
        const bHpFillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
        const bHpFill = new THREE.Mesh(bHpFillGeo, bHpFillMat);
        bHpFill.position.set(0, 0, 0.001);
        bHpFill.name = 'bHpFill';
        bHpBg.add(bHpFill);

        mesh.add(bHpBg);

        this.scene.add(mesh);
        this.buildingMeshes.set(b.id, mesh);
      } else {
        mesh.position.set(b.gridX + (sizeX / 2), 0, b.gridZ + (sizeZ / 2));
      }

      // Building Selection Highlight
      const isSelected = selectedBuildingId === b.id;
      const bRing = mesh.getObjectByName('bSelectionRing') as THREE.Mesh;
      if (bRing) {
        bRing.visible = isSelected;
      }

      // Building Health Bar
      const bHpBg = mesh.getObjectByName('bHpBg') as THREE.Mesh;
      const bHpFill = mesh.getObjectByName('bHpFill') as THREE.Mesh;
      if (bHpBg && bHpFill) {
        bHpBg.quaternion.copy(this.camera.quaternion); // Billboarding health bar
        if (b.hp < b.maxHp || isSelected || b.isEnemy) {
          bHpBg.visible = true;
          const pct = Math.max(0, b.hp / b.maxHp);
          bHpFill.scale.set(pct, 1, 1);
          bHpFill.position.x = -(1 - pct) * (sizeX * 0.76 * 0.5);
          if (bHpFill.material instanceof THREE.MeshBasicMaterial) {
            bHpFill.material.color.setHex(getHpColor(pct));
          }
        } else {
          bHpBg.visible = false;
        }
      }
    });

    // Remove deleted buildings
    this.buildingMeshes.forEach((mesh, id) => {
      if (!currentBuildingIds.has(id)) {
        this.scene.remove(mesh);
        this.buildingMeshes.delete(id);
      }
    });

    // 2. Sync Units
    const currentUnitIds = new Set<string>();
    units.forEach((u) => {
      currentUnitIds.add(u.id);
      let mesh = this.unitMeshes.get(u.id);
      if (!mesh) {
        mesh = this.createUnitMesh(u.type, u.isEnemy, u.playerId || (u.isEnemy ? 2 : 1));
        this.scene.add(mesh);
        this.unitMeshes.set(u.id, mesh);
      }

      // Smooth position & rotation update
      mesh.position.set(u.x, 0, u.z);
      mesh.rotation.y = u.rotation;

      // Selection / Target Ring
      const isSelected = selectedUnitIds.has(u.id);
      const ring = mesh.getObjectByName('selectionRing') as THREE.Mesh;
      if (ring && ring.material instanceof THREE.MeshBasicMaterial) {
        if (u.isEnemy) {
          const isTargetedByPlayer = units.some((pu) => !pu.isEnemy && selectedUnitIds.has(pu.id) && pu.targetEntityId === u.id);
          ring.material.opacity = isTargetedByPlayer ? 0.95 : u.hp < u.maxHp ? 0.5 : 0;
        } else {
          ring.material.opacity = isSelected ? 0.95 : 0;
        }
      }

      // Unit Health Bar
      const hpBg = mesh.getObjectByName('hpBg') as THREE.Mesh;
      const hpFill = mesh.getObjectByName('hpFill') as THREE.Mesh;
      if (hpBg && hpFill) {
        hpBg.quaternion.copy(this.camera.quaternion); // Billboard facing camera
        if (u.hp < u.maxHp || isSelected || u.isEnemy) {
          hpBg.visible = u.hp < u.maxHp || isSelected;
          const pct = Math.max(0, u.hp / u.maxHp);
          hpFill.scale.set(pct, 1, 1);
          hpFill.position.x = -(1 - pct) * (0.76 * 0.5);
          if (hpFill.material instanceof THREE.MeshBasicMaterial) {
            hpFill.material.color.setHex(getHpColor(pct));
          }
        } else {
          hpBg.visible = false;
        }
      }

      // Walking Animation
      const leftLeg = mesh.getObjectByName('leftLeg');
      const rightLeg = mesh.getObjectByName('rightLeg');
      if (leftLeg && rightLeg) {
        if (u.state === 'moving') {
          const moveSpeed = UNITS_CONFIG[u.type].moveSpeed;
          const walkCycle = Math.sin(time * moveSpeed * 6);
          leftLeg.rotation.x = walkCycle * 0.6;
          rightLeg.rotation.x = -walkCycle * 0.6;
        } else {
          leftLeg.rotation.x = 0;
          rightLeg.rotation.x = 0;
        }
      }

      // Attack Animation
      const rightArm = mesh.getObjectByName('rightArm');
      if (rightArm) {
        if (u.state === 'attacking') {
          rightArm.rotation.x = -Math.sin(time * 12) * 0.8;
        } else {
          rightArm.rotation.x = 0;
        }
      }
    });

    // Remove dead units
    this.unitMeshes.forEach((mesh, id) => {
      if (!currentUnitIds.has(id)) {
        this.scene.remove(mesh);
        this.unitMeshes.delete(id);
      }
    });

    // 3. Sync Projectiles (Flying Arrows, Cannonballs, Mortar Shells)
    const currentProjIds = new Set<string>();
    projectiles.forEach((p) => {
      currentProjIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        if (p.type === 'mortar') {
          // Fiery Mortar Shell
          const group = new THREE.Group();
          const sphereGeo = new THREE.SphereGeometry(0.22, 8, 8);
          const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          group.add(sphere);

          const coreGeo = new THREE.SphereGeometry(0.12, 6, 6);
          const coreMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
          const core = new THREE.Mesh(coreGeo, coreMat);
          group.add(core);

          mesh = group as unknown as THREE.Mesh;
        } else if (p.type === 'cannon') {
          // Heavy Cannonball
          const cannonGeo = new THREE.SphereGeometry(0.16, 8, 8);
          const cannonMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
          mesh = new THREE.Mesh(cannonGeo, cannonMat);
        } else {
          // Standard Arrow
          const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
          const arrowMat = new THREE.MeshBasicMaterial({ color: p.isEnemy ? 0xff4444 : 0xffff00 });
          mesh = new THREE.Mesh(arrowGeo, arrowMat);
          mesh.rotation.x = Math.PI / 2;
        }
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }

      const currX = THREE.MathUtils.lerp(p.startX, p.targetX, p.progress);
      const currZ = THREE.MathUtils.lerp(p.startZ, p.targetZ, p.progress);
      
      const arcH = p.arcHeight !== undefined ? p.arcHeight : 1.5;
      const currY = THREE.MathUtils.lerp(p.startY + 1.0, p.targetY + 0.5, p.progress) + Math.sin(p.progress * Math.PI) * arcH;

      mesh.position.set(currX, currY, currZ);
      if (p.type !== 'mortar') {
        mesh.lookAt(p.targetX, p.targetY + 0.5, p.targetZ);
      }
    });

    this.projectileMeshes.forEach((mesh, id) => {
      if (!currentProjIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    });

    // 4. Ghost Building Preview (Clash of Clans style Red/Green)
    if (activeBuildType && mouseGridPos) {
      if (this.ghostBuildingMesh && this.ghostBuildingMesh.name !== `ghost_${activeBuildType}`) {
        this.scene.remove(this.ghostBuildingMesh);
        this.ghostBuildingMesh = null;
      }
      if (!this.ghostBuildingMesh) {
        this.ghostBuildingMesh = this.createBuildingMesh(activeBuildType, false, true);
        this.ghostBuildingMesh.name = `ghost_${activeBuildType}`;
        this.scene.add(this.ghostBuildingMesh);
      }

      // Tint ghost building green (valid) or red (invalid)
      const targetColor = isPlacementValid ? 0x22c55e : 0xef4444;
      this.ghostBuildingMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: targetColor,
            transparent: true,
            opacity: 0.65,
            wireframe: false,
          });
        }
      });

      const bConfig = BUILDINGS_CONFIG[activeBuildType];
      this.ghostBuildingMesh.position.set(
        mouseGridPos.x + bConfig.sizeX / 2,
        0,
        mouseGridPos.z + bConfig.sizeZ / 2
      );
      this.ghostBuildingMesh.visible = true;
    } else if (this.ghostBuildingMesh) {
      this.ghostBuildingMesh.visible = false;
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  // Ground Raycast for Mouse Grid Position & Clicking
  public raycastGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.container.getBoundingClientRect();
    this.mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const ground = this.scene.getObjectByName('ground') || this.scene.getObjectByName('outer_ground');
    if (!ground) return null;

    const intersects = this.raycaster.intersectObject(ground);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      const gx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(pt.x)));
      const gz = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(pt.z)));
      return { x: gx, z: gz };
    }
    return null;
  }

  // Cleanup renderer and DOM elements
  public destroy() {
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
