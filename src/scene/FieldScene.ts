import * as THREE from 'three';
import { GameStateData } from '../types';
import { FarmerModel } from './FarmerModel';

export class FieldScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  public farmer: FarmerModel;

  // フィールドグループと品評会ステージグループ
  private farmWorldGroup: THREE.Group;
  private contestStageGroup: THREE.Group;
  private podiumMesh: THREE.Group;

  // 天体・天候
  private sunGroup: THREE.Group;
  private moonSprite: THREE.Sprite;
  private moonCanvas: HTMLCanvasElement;
  private cloudGroup: THREE.Group;
  private rainGroup: THREE.Group;
  private rainLines: THREE.Mesh[] = [];

  // 照明・環境カラー
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private groundMaterial: THREE.MeshLambertMaterial;

  // 家と畑
  private houseWindowMat: THREE.MeshBasicMaterial;
  private flatSoilMesh: THREE.Mesh;
  private ridgesGroup: THREE.Group;
  private ridgeMaterial: THREE.MeshLambertMaterial;

  // ほうれん草と雑草
  private spinachSlots: {
    group: THREE.Group;
    isSubSlot: boolean;
    leaves: THREE.Mesh[];
  }[] = [];
  private spinachLeafMat: THREE.MeshLambertMaterial;
  private weedClusters: THREE.Group[] = [];

  private clock = new THREE.Clock();
  private dayProgress = 0.12;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // PS1風のフラットでローレゾ感のあるレンダラー設定
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 4.1, 11.8);
    this.camera.lookAt(0, 1.8, 0);

    // ライト
    this.ambientLight = new THREE.AmbientLight(0xfffbeb, 0.78);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.15);
    this.dirLight.position.set(5, 8, 6);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    this.farmWorldGroup = new THREE.Group();
    this.scene.add(this.farmWorldGroup);

    this.contestStageGroup = new THREE.Group();
    this.contestStageGroup.visible = false;
    this.scene.add(this.contestStageGroup);

    this.groundMaterial = new THREE.MeshLambertMaterial({ color: 0x65a30d, flatShading: true });
    this.houseWindowMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    this.ridgeMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4226, flatShading: true });
    this.spinachLeafMat = new THREE.MeshLambertMaterial({ color: 0x16a34a, flatShading: true });

    this.flatSoilMesh = new THREE.Mesh();
    this.ridgesGroup = new THREE.Group();
    this.cloudGroup = new THREE.Group();
    this.rainGroup = new THREE.Group();
    this.podiumMesh = new THREE.Group();

    this.sunGroup = this.createSun();
    this.moonCanvas = document.createElement('canvas');
    this.moonCanvas.width = 128;
    this.moonCanvas.height = 128;
    this.moonSprite = this.createMoon();

    this.buildTerrainAndHouse();
    this.buildFieldAndRidges();
    this.buildSpinachAndWeeds();
    this.buildWeatherEffects();
    this.buildContestPodium();

    // おっさんキャラクター
    this.farmer = new FarmerModel();
    this.scene.add(this.farmer.root);

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // PS1風のレトロな低解像度レンダリング
    const pixelScale = 0.55;
    this.renderer.setSize(Math.floor(w * pixelScale), Math.floor(h * pixelScale), false);
  }

  private createSun(): THREE.Group {
    // 自然な暖かみのある太陽（明るい黄金色のコア + オレンジのコロナ）
    const group = new THREE.Group();
    const coreGeo = new THREE.SphereGeometry(0.95, 10, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const glowGeo = new THREE.SphereGeometry(1.22, 10, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.45,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    group.add(glowMesh);

    this.farmWorldGroup.add(group);
    return group;
  }

  private createMoon(): THREE.Sprite {
    const texture = new THREE.CanvasTexture(this.moonCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.3, 2.3, 1);
    sprite.position.set(-0.3, 5.4, -4.5);
    sprite.visible = false;
    this.farmWorldGroup.add(sprite);
    return sprite;
  }

  /**
   * 月の満ち欠け（黒い輪郭線をなくし、自然な淡い月光カラーで描画）
   */
  private updateMoonPhaseTexture(day: number): void {
    const ctx = this.moonCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.moonCanvas.width;
    const h = this.moonCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 46;

    ctx.clearRect(0, 0, w, h);

    const phase = ((day + 3) % 30) / 30;

    ctx.save();
    // 淡い発光グラデーションの月面
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fef9c3';
    ctx.fill();

    // 月の模様（うっすらとしたクレーター陰影）
    ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 10, 10, 0, Math.PI * 2);
    ctx.arc(cx + 14, cy + 8, 13, 0, Math.PI * 2);
    ctx.arc(cx - 4, cy + 18, 7, 0, Math.PI * 2);
    ctx.fill();

    // 満ち欠けの影マスク
    ctx.globalCompositeOperation = 'destination-out';
    if (phase < 0.42 || phase > 0.58) {
      const dist = Math.abs(phase - 0.5) * 2;
      const shadowOffset = (phase < 0.5 ? -1 : 1) * (1 - dist * 1.35) * r;
      ctx.beginPath();
      ctx.arc(cx + shadowOffset, cy, r * 0.98, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const mat = this.moonSprite.material as THREE.SpriteMaterial;
    if (mat.map) {
      mat.map.needsUpdate = true;
    }
  }

  private buildTerrainAndHouse(): void {
    // 黒いラインは使わず、草原の傾斜大地と奥のなだらかな丘陵が空と接することで自然な「地平線」を表現
    const groundGeo = new THREE.BoxGeometry(30, 5, 18);
    const ground = new THREE.Mesh(groundGeo, this.groundMaterial);
    ground.position.set(0, -2.35, 0);
    ground.rotation.z = 0.12; // 左から右へ緩やかに上がる丘の地平線
    ground.receiveShadow = true;
    this.farmWorldGroup.add(ground);

    // 遠景のなだらかなローポリ緑丘陵（地平線の奥行き感）
    const hillMat1 = new THREE.MeshLambertMaterial({ color: 0x4d7c0f, flatShading: true });
    const hillLeft = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3.2, 7), hillMat1);
    hillLeft.position.set(-6.5, 0.2, -6.8);
    hillLeft.scale.set(1.4, 0.65, 0.8);
    this.farmWorldGroup.add(hillLeft);

    const hillMat2 = new THREE.MeshLambertMaterial({ color: 0x3f6212, flatShading: true });
    const hillCenter = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3.8, 7), hillMat2);
    hillCenter.position.set(1.2, 0.8, -7.5);
    hillCenter.scale.set(1.5, 0.7, 0.8);
    this.farmWorldGroup.add(hillCenter);

    // 家から畑へ続くあたたかみのある土の小道
    const pathGeo = new THREE.BoxGeometry(5.5, 0.08, 2.2);
    const pathMat = new THREE.MeshLambertMaterial({ color: 0xc29b61, flatShading: true });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.set(2.2, 0.02, 1.5);
    pathMesh.rotation.z = 0.12;
    pathMesh.receiveShadow = true;
    this.farmWorldGroup.add(pathMesh);

    // 画面右側の「家」（自然な木造・クリーム壁・赤茶色の三角屋根・木の格子窓）
    const houseGroup = new THREE.Group();
    houseGroup.position.set(4.55, 0.58, -0.4);
    this.farmWorldGroup.add(houseGroup);

    // 家の壁（あたたかいクリーム色の漆喰壁）
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7, flatShading: true });
    const wallGeo = new THREE.BoxGeometry(2.5, 2.2, 2.2);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.y = 1.1;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    houseGroup.add(wallMesh);

    // 木の基礎・柱アクセント
    const woodTrimMat = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: true });
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.3), woodTrimMat);
    basePlinth.position.y = 0.12;
    houseGroup.add(basePlinth);

    // 三角屋根（自然なテラコッタ・赤茶色）
    const roofGeo = new THREE.ConeGeometry(2.2, 1.68, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: true });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = 3.0;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    houseGroup.add(roofMesh);

    // 田の字の木の格子窓
    const winGroup = new THREE.Group();
    winGroup.position.set(0, 1.15, 1.12);
    houseGroup.add(winGroup);

    const paneGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const paneMesh = new THREE.Mesh(paneGeo, this.houseWindowMat);
    winGroup.add(paneMesh);

    const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.05), woodTrimMat);
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.05), woodTrimMat);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.09, 0.06), woodTrimMat);
    topBar.position.y = 0.48;
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.11, 0.09), woodTrimMat);
    botBar.position.y = -0.48;
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.04, 0.06), woodTrimMat);
    leftBar.position.x = -0.48;
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.04, 0.06), woodTrimMat);
    rightBar.position.x = 0.48;
    winGroup.add(hBar, vBar, topBar, botBar, leftBar, rightBar);
  }

  private buildFieldAndRidges(): void {
    // 田おこし前の平らな土エリア
    const flatGeo = new THREE.BoxGeometry(5.2, 0.18, 3.6);
    const flatMat = new THREE.MeshLambertMaterial({ color: 0x9c7248, flatShading: true });
    this.flatSoilMesh = new THREE.Mesh(flatGeo, flatMat);
    this.flatSoilMesh.position.set(-2.1, -0.15, 1.4);
    this.flatSoilMesh.rotation.z = 0.12;
    this.flatSoilMesh.receiveShadow = true;
    this.farmWorldGroup.add(this.flatSoilMesh);

    // 田おこし後に出現する3本のウネ（畝）
    this.ridgesGroup.position.set(-2.1, -0.05, 1.4);
    this.ridgesGroup.rotation.z = 0.12;
    this.farmWorldGroup.add(this.ridgesGroup);

    const ridgeOffsetsZ = [-1.05, 0.0, 1.05];
    ridgeOffsetsZ.forEach((zPos, rowIdx) => {
      const ridgeRow = new THREE.Group();
      ridgeRow.position.z = zPos;
      const segments = 7;
      for (let i = 0; i < segments; i++) {
        const segGeo = new THREE.CylinderGeometry(0.32, 0.52, 0.78, 6);
        const segMesh = new THREE.Mesh(segGeo, this.ridgeMaterial);
        segMesh.rotation.z = Math.PI / 2;
        const xOffset = (i - (segments - 1) / 2) * 0.68;
        const waveZ = Math.sin(i * 1.2 + rowIdx) * 0.14;
        const waveY = Math.cos(i * 1.1 + rowIdx) * 0.05;
        segMesh.position.set(xOffset, 0.16 + waveY, waveZ);
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        ridgeRow.add(segMesh);
      }
      this.ridgesGroup.add(ridgeRow);
    });
  }

  private buildSpinachAndWeeds(): void {
    const ridgeOffsetsZ = [-1.05, 0.0, 1.05];
    ridgeOffsetsZ.forEach((zPos, rowIdx) => {
      const count = 9;
      for (let i = 0; i < count; i++) {
        const slotGroup = new THREE.Group();
        const xOffset = (i - (count - 1) / 2) * 0.48;
        const waveZ = Math.sin(i * 0.9 + rowIdx) * 0.1;
        slotGroup.position.set(xOffset, 0.36, zPos + waveZ);

        const leaves: THREE.Mesh[] = [];
        const leafCount = 5;
        for (let l = 0; l < leafCount; l++) {
          const angle = (l / leafCount) * Math.PI * 2 + (i % 2) * 0.4;
          const leafPivot = new THREE.Group();
          leafPivot.rotation.y = angle;

          const leafGeo = new THREE.ConeGeometry(0.16, 0.62, 4);
          leafGeo.translate(0, 0.31, 0);
          const leafMesh = new THREE.Mesh(leafGeo, this.spinachLeafMat);
          leafMesh.rotation.z = 0.48;
          leafMesh.castShadow = true;
          leafPivot.add(leafMesh);
          slotGroup.add(leafPivot);
          leaves.push(leafMesh);
        }

        this.ridgesGroup.add(slotGroup);
        this.spinachSlots.push({
          group: slotGroup,
          isSubSlot: i % 2 === 1,
          leaves,
        });
      }
    });

    // ウネの周りに生えてくる雑草（自然な黄緑〜草色）
    const weedMat = new THREE.MeshLambertMaterial({ color: 0x84cc16, flatShading: true });
    const weedPositions: [number, number, number][][] = [
      [
        [-4.6, -0.5, 0.8],
        [-3.2, 0.15, -0.8],
        [0.8, 0.2, 2.3],
      ],
      [
        [-4.8, -0.4, 2.4],
        [-1.8, 0.25, -1.0],
        [1.4, 0.4, 0.4],
      ],
      [
        [-3.9, -0.5, 3.2],
        [-0.4, 0.35, -0.9],
        [1.6, 0.3, 1.8],
      ],
      [
        [-4.4, -0.2, -0.4],
        [-2.2, -0.35, 3.3],
        [1.1, 0.45, -0.6],
      ],
      [
        [-5.1, -0.55, 1.6],
        [-0.8, -0.25, 3.2],
        [2.0, 0.45, 1.1],
      ],
    ];

    weedPositions.forEach((coords) => {
      const cluster = new THREE.Group();
      coords.forEach(([wx, wy, wz]) => {
        const tuft = new THREE.Group();
        tuft.position.set(wx, wy, wz);
        for (let b = 0; b < 3; b++) {
          const bladeGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
          const blade = new THREE.Mesh(bladeGeo, weedMat);
          blade.position.set((b - 1) * 0.1, 0.22, 0);
          blade.rotation.z = (b - 1) * 0.28;
          tuft.add(blade);
        }
        cluster.add(tuft);
      });
      cluster.visible = false;
      this.farmWorldGroup.add(cluster);
      this.weedClusters.push(cluster);
    });
  }

  private buildWeatherEffects(): void {
    // 空の上部に浮かぶ雲と、自然な半透明水色の雨粒エフェクト
    this.farmWorldGroup.add(this.cloudGroup);
    this.farmWorldGroup.add(this.rainGroup);

    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9, flatShading: true });
    const cloudConfigs = [
      { x: -3.2, y: 5.5, z: -2.0, sx: 2.1, sy: 0.65 },
      { x: 0.2, y: 5.7, z: -2.2, sx: 1.5, sy: 0.52 },
      { x: 3.1, y: 5.1, z: -2.0, sx: 1.45, sy: 0.5 },
    ];

    cloudConfigs.forEach((cfg) => {
      const geo = new THREE.SphereGeometry(1, 9, 7);
      geo.scale(cfg.sx, cfg.sy, 0.8);
      const mesh = new THREE.Mesh(geo, cloudMat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      this.cloudGroup.add(mesh);
    });

    // 雨のストリーク（黒ではなく透き通った水色〜シルバーブルー）
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 32; i++) {
      const lineGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.45, 4);
      const line = new THREE.Mesh(lineGeo, rainMat);
      line.position.set((Math.random() - 0.5) * 9.5 - 0.5, Math.random() * 5.2, (Math.random() - 0.5) * 3.0);
      line.rotation.z = -0.12;
      this.rainGroup.add(line);
      this.rainLines.push(line);
    }
  }

  private buildContestPodium(): void {
    // 品評会ステージ（真っ白・真っ黒ではなく、芝生広場と温かみのある木製＆赤絨毯・金装飾の表彰台）
    const stageFloorGeo = new THREE.PlaneGeometry(30, 20);
    const stageFloorMat = new THREE.MeshLambertMaterial({ color: 0x65a30d });
    const stageFloor = new THREE.Mesh(stageFloorGeo, stageFloorMat);
    stageFloor.rotation.x = -Math.PI / 2;
    stageFloor.position.y = -0.02;
    this.contestStageGroup.add(stageFloor);

    const podiumBodyMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7, flatShading: true });
    const carpetMat = new THREE.MeshLambertMaterial({ color: 0xdc2626, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });

    // 下段ベース
    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.85, 1.8), podiumBodyMat);
    baseBlock.position.set(0, 0.425, 1.5);
    this.podiumMesh.add(baseBlock);

    const baseCarpet = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.1, 1.84), carpetMat);
    baseCarpet.position.set(0, 0.86, 1.5);
    this.podiumMesh.add(baseCarpet);

    // 中央1位の段
    const topBlock = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.95, 1.8), podiumBodyMat);
    topBlock.position.set(0, 1.2, 1.5);
    this.podiumMesh.add(topBlock);

    const topCarpet = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.86), carpetMat);
    topCarpet.position.set(0, 1.68, 1.5);
    this.podiumMesh.add(topCarpet);

    // 正面の金エンブレム
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8), goldMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 1.18, 2.42);
    this.podiumMesh.add(emblem);

    this.contestStageGroup.add(this.podiumMesh);
  }

  public syncState(state: GameStateData): void {
    if (state.phase === 'contest') {
      return;
    }

    this.farmWorldGroup.visible = true;
    this.contestStageGroup.visible = false;

    // 1. 田おこし状態
    this.flatSoilMesh.visible = state.plowCount === 0;
    this.ridgesGroup.visible = state.plowCount >= 1;
    if (state.plowCount === 1) {
      this.ridgesGroup.scale.set(1, 0.78, 1);
    } else if (state.plowCount >= 2) {
      this.ridgesGroup.scale.set(1, 1.12, 1);
    }

    // 2. 水分量に応じたウネの土の色変化（自然な土色）
    if (state.moisture <= 35) {
      this.ridgeMaterial.color.setHex(0xc2956b); // 乾燥した明るい黄土色
    } else if (state.moisture >= 88) {
      this.ridgeMaterial.color.setHex(0x3e2412); // 水分過多の濃い泥色
    } else {
      this.ridgeMaterial.color.setHex(0x6b4226); // 適度に潤った肥沃な茶色
    }

    // 3. 栄養度に応じたほうれん草の葉の色変化
    if (state.nutrition <= 32) {
      this.spinachLeafMat.color.setHex(0xa3b835); // 栄養不足の黄色っぽい緑
    } else if (state.nutrition >= 70) {
      this.spinachLeafMat.color.setHex(0x15803d); // 栄養満点の瑞々しい濃緑
    } else {
      this.spinachLeafMat.color.setHex(0x22c55e); // 通常の鮮やかな緑
    }

    // 4. ほうれん草の成長段階と間引き状態の反映
    const showPlants = state.isSown && state.growth >= 8;
    const normalizedGrowth = Math.max(0.12, state.growth / 100);

    this.spinachSlots.forEach((slot) => {
      if (!showPlants) {
        slot.group.visible = false;
        return;
      }
      if (slot.isSubSlot) {
        slot.group.visible = !state.isThinned && state.growth >= 28;
        const subScale = Math.min(0.65, normalizedGrowth * 0.9);
        slot.group.scale.set(subScale, subScale, subScale);
      } else {
        slot.group.visible = true;
        const mainBoost = state.isThinned ? 1.28 : 0.92;
        const s = normalizedGrowth * mainBoost;
        slot.group.scale.set(s, s, s);
      }
    });

    // 5. 雑草レベルの反映 (0〜5)
    this.weedClusters.forEach((cluster, idx) => {
      cluster.visible = idx < state.weedLevel;
    });

    // 6. 天候（雨の日エフェクト）
    const isRainy = state.weather === 'rainy';
    this.cloudGroup.visible = isRainy;
    this.rainGroup.visible = isRainy;

    // 7. 時間帯（昼・夜）と太陽・月の切り替え
    const isNight = state.phase === 'night';
    if (isNight) {
      this.sunGroup.visible = false;
      this.moonSprite.visible = !isRainy;
      this.updateMoonPhaseTexture(state.day);
      this.scene.background = new THREE.Color(0x1e293b);
      this.ambientLight.intensity = 0.42;
      this.dirLight.intensity = 0.48;
      this.houseWindowMat.color.setHex(0xfde047); // 夜は窓にあたたかい明かりが灯る
      this.farmer.setPose('hidden_in_house');
    } else {
      this.sunGroup.visible = !isRainy;
      this.moonSprite.visible = false;
      this.houseWindowMat.color.setHex(0x7dd3fc); // 昼は空を映す水色の窓ガラス

      if (state.phase === 'morning_menu') {
        this.setDaySunPosition(0.12, isRainy);
        this.farmer.setPose('standby');
      } else if (state.phase === 'bedridden') {
        this.farmer.setPose('hidden_in_house');
      }
    }
  }

  public setDaySunPosition(progress: number, isRainy: boolean): void {
    this.dayProgress = THREE.MathUtils.clamp(progress, 0, 1);

    const x = THREE.MathUtils.lerp(5.4, -5.6, this.dayProgress);
    const arc = Math.sin(this.dayProgress * Math.PI);
    const y = THREE.MathUtils.lerp(3.1, 2.1, this.dayProgress) + arc * 3.1;

    this.sunGroup.position.set(x, y, -4.5);
    this.dirLight.position.set(x, y + 2, 5);

    if (isRainy) {
      this.scene.background = new THREE.Color(0x64748b);
      this.ambientLight.intensity = 0.65;
      this.dirLight.intensity = 0.55;
      return;
    }

    // 朝・昼・夕方の自然な空色グラデーション
    if (this.dayProgress < 0.25) {
      this.scene.background = new THREE.Color(0x93c5fd);
      this.ambientLight.intensity = 0.78;
      this.dirLight.intensity = 1.05;
    } else if (this.dayProgress < 0.72) {
      this.scene.background = new THREE.Color(0x38bdf8);
      this.ambientLight.intensity = 0.88;
      this.dirLight.intensity = 1.2;
    } else {
      this.scene.background = new THREE.Color(0xfb923c);
      this.ambientLight.intensity = 0.72;
      this.dirLight.intensity = 0.9;
    }
  }

  public showContestScene(passed: boolean): void {
    this.farmWorldGroup.visible = false;
    this.contestStageGroup.visible = true;
    // 合格時は晴天の青空、不合格時は夕暮れ〜曇り空の哀愁ある背景色
    this.scene.background = new THREE.Color(passed ? 0x38bdf8 : 0x64748b);
    this.ambientLight.intensity = passed ? 0.92 : 0.65;
    this.dirLight.intensity = passed ? 1.15 : 0.75;
    this.dirLight.position.set(3, 8, 6);

    if (passed) {
      this.podiumMesh.visible = true;
      this.farmer.setPose('contest_win');
    } else {
      this.podiumMesh.visible = false;
      this.farmer.setPose('contest_lose');
    }
  }

  public startRenderLoop(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      const elapsed = this.clock.getElapsedTime();

      this.farmer.update(elapsed);

      if (this.rainGroup.visible) {
        this.rainLines.forEach((line) => {
          line.position.y -= 0.16;
          line.position.x -= 0.02;
          if (line.position.y < 0.2) {
            line.position.y = 5.2;
            line.position.x = (Math.random() - 0.5) * 9.5 - 0.5;
          }
        });
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
