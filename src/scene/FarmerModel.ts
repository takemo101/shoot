import * as THREE from 'three';
import { ActionType } from '../types';

export type FarmerPose =
  | 'standby'        // 朝のメニュー待機（右側で待機）
  | 'work'           // 選択したアクションに応じた固有モーション
  | 'hidden_in_house'// 夜間や寝込み中（家の中）
  | 'contest_win'    // 品評会合格（表彰台の上でくわとトロフィーを掲げる）
  | 'contest_lose';  // 品評会不合格（地面に膝をついてうなだれ、手前にくわが転がる）

interface ActionParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  noGravity?: boolean;
}

export class FarmerModel {
  public root: THREE.Group;
  private bodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private rightArmPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private leftLegPivot: THREE.Group;

  // 各アクション用の小道具（プロップ）
  private hoeInHand: THREE.Group;
  private hoeOnGround: THREE.Group;
  private trophyInHand: THREE.Group;
  private wateringCan: THREE.Group;
  private seedBasket: THREE.Group;
  private fertilizerBarrel: THREE.Group;
  private fertilizerShovel: THREE.Group;
  private thinningShearsLeft: THREE.Mesh;
  private thinningShearsRight: THREE.Mesh;
  private thinningShearsGroup: THREE.Group;
  private harvestedSpinachGiant: THREE.Group;
  private restMatMesh: THREE.Mesh;

  // 作業エフェクト用パーティクル（ワールド基準ではなくroot直下に配置し回転の影響を受けないグループも用意）
  private particleGroup: THREE.Group;
  private particles: ActionParticle[] = [];
  private lastSpawnTime = 0;

  private currentPose: FarmerPose = 'standby';
  private currentAction: ActionType = 'plow';
  private workStartTime = 0;

  constructor() {
    this.root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    this.headGroup = new THREE.Group();
    this.rightArmPivot = new THREE.Group();
    this.leftArmPivot = new THREE.Group();
    this.rightLegPivot = new THREE.Group();
    this.leftLegPivot = new THREE.Group();

    this.hoeInHand = this.createHoeMesh();
    this.hoeOnGround = this.createHoeMesh();
    this.trophyInHand = this.createTrophyMesh();
    this.wateringCan = this.createWateringCanMesh();
    this.seedBasket = this.createSeedBasketMesh();
    this.fertilizerBarrel = this.createFertilizerBarrelMesh();
    this.fertilizerShovel = this.createShovelMesh();

    const shears = this.createShearsMesh();
    this.thinningShearsGroup = shears.group;
    this.thinningShearsLeft = shears.bladeL;
    this.thinningShearsRight = shears.bladeR;

    this.harvestedSpinachGiant = this.createHarvestedSpinachMesh();
    this.restMatMesh = this.createRestMatMesh();

    this.particleGroup = new THREE.Group();
    this.root.add(this.particleGroup);

    this.buildCharacter();
  }

  private mat(color: number): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ color, flatShading: true });
  }

  private buildCharacter(): void {
    const skinMat = this.mat(0xfdba74);
    const shirtMat = this.mat(0xfef9c3);
    const overallMat = this.mat(0x2563eb);
    const pocketMat = this.mat(0x1d4ed8);
    const bootMat = this.mat(0x422006);
    const hatMat = this.mat(0xfacc15);
    const hatBandMat = this.mat(0x991b1b);
    const mustacheMat = this.mat(0x451a03);

    // --- 胴体（小太りのおっさん・オーバーオール） ---
    const torsoGeo = new THREE.CylinderGeometry(0.56, 0.66, 1.25, 8);
    const torsoMesh = new THREE.Mesh(torsoGeo, overallMat);
    torsoMesh.position.y = 1.45;
    torsoMesh.castShadow = true;
    this.bodyGroup.add(torsoMesh);

    // 胸元のU字インナー（白シャツが見える部分）
    const bibNeckGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.45, 7);
    const bibNeckMesh = new THREE.Mesh(bibNeckGeo, shirtMat);
    bibNeckMesh.position.set(0, 1.88, 0.34);
    this.bodyGroup.add(bibNeckMesh);

    // お腹の半円ポケット (Sketch 1)
    const pocketGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8, 1, false, 0, Math.PI);
    const pocketMesh = new THREE.Mesh(pocketGeo, pocketMat);
    pocketMesh.rotation.x = Math.PI / 2;
    pocketMesh.rotation.z = Math.PI;
    pocketMesh.position.set(0, 1.32, 0.58);
    this.bodyGroup.add(pocketMesh);

    // --- 頭部 + ちょび髭 + 麦わら帽子 (Sketch 1) ---
    this.headGroup.position.set(0, 2.52, 0);
    this.bodyGroup.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.54, 8, 7);
    headGeo.scale(1.05, 0.96, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // 顔中央の特徴的なひげ
    const mustacheGroup = new THREE.Group();
    mustacheGroup.position.set(0, -0.06, 0.52);
    for (let i = -2; i <= 2; i++) {
      const segGeo = new THREE.BoxGeometry(0.08, 0.16, 0.1);
      const seg = new THREE.Mesh(segGeo, mustacheMat);
      seg.position.x = i * 0.07;
      seg.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.18;
      mustacheGroup.add(seg);
    }
    this.headGroup.add(mustacheGroup);

    // 麦わら帽子
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.38, 0);
    this.headGroup.add(hatGroup);

    const brimGeo = new THREE.CylinderGeometry(1.28, 1.38, 0.08, 10);
    const brimMesh = new THREE.Mesh(brimGeo, hatMat);
    brimMesh.castShadow = true;
    hatGroup.add(brimMesh);

    const bandGeo = new THREE.CylinderGeometry(0.58, 0.62, 0.16, 8);
    const bandMesh = new THREE.Mesh(bandGeo, hatBandMat);
    bandMesh.position.y = 0.1;
    hatGroup.add(bandMesh);

    const crownGeo = new THREE.CylinderGeometry(0.46, 0.58, 0.45, 8);
    const crownMesh = new THREE.Mesh(crownGeo, hatMat);
    crownMesh.position.y = 0.38;
    crownMesh.castShadow = true;
    hatGroup.add(crownMesh);

    // --- 右腕（帽子のつばの外までしっかり見える長さ） ---
    this.rightArmPivot.position.set(-0.64, 1.92, 0);
    this.bodyGroup.add(this.rightArmPivot);

    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.52, 6), shirtMat);
    rUpperArm.position.set(-0.26, -0.18, 0);
    rUpperArm.rotation.z = -0.55;
    this.rightArmPivot.add(rUpperArm);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 7), skinMat);
    rHand.position.set(-0.56, -0.42, 0.1);
    this.rightArmPivot.add(rHand);

    // くわ・スコップは右手に配置
    this.hoeInHand.position.set(-0.56, -0.35, 0.25);
    this.rightArmPivot.add(this.hoeInHand);

    this.fertilizerShovel.position.set(-0.56, -0.35, 0.35);
    this.fertilizerShovel.visible = false;
    this.rightArmPivot.add(this.fertilizerShovel);

    // --- 左腕（横向き時にカメラ手前側になる腕） ---
    this.leftArmPivot.position.set(0.64, 1.92, 0);
    this.bodyGroup.add(this.leftArmPivot);

    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.52, 6), shirtMat);
    lUpperArm.position.set(0.26, -0.18, 0);
    lUpperArm.rotation.z = 0.55;
    this.leftArmPivot.add(lUpperArm);

    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 7), skinMat);
    lHand.position.set(0.56, -0.42, 0.1);
    this.leftArmPivot.add(lHand);

    // トロフィーは左手
    this.trophyInHand.position.set(0.56, 0.15, 0.1);
    this.trophyInHand.visible = false;
    this.leftArmPivot.add(this.trophyInHand);

    // --- 胴体正面・足元に配置する各アクション専用プロップ ---
    // 水やり用の特大ジョウロ（カメラ側からよく見える位置）
    this.wateringCan.position.set(0.35, 1.35, 0.85);
    this.wateringCan.visible = false;
    this.bodyGroup.add(this.wateringCan);

    // 種まき用の黄色い種カゴ（お腹の前に抱える）
    this.seedBasket.position.set(0, 1.35, 0.78);
    this.seedBasket.visible = false;
    this.bodyGroup.add(this.seedBasket);

    // 間引き用の大きな園芸バサミ（正面手前に構える）
    this.thinningShearsGroup.position.set(0, 1.35, 0.95);
    this.thinningShearsGroup.visible = false;
    this.bodyGroup.add(this.thinningShearsGroup);

    // 収穫用の特大ほうれん草株
    this.harvestedSpinachGiant.position.set(0, 2.8, 0.55);
    this.harvestedSpinachGiant.visible = false;
    this.bodyGroup.add(this.harvestedSpinachGiant);

    // 追肥用の肥やし樽（足元に置く）
    this.fertilizerBarrel.position.set(0.85, 0.45, 0.65);
    this.fertilizerBarrel.visible = false;
    this.root.add(this.fertilizerBarrel);

    // 休暇用のゴザ（家の前に敷く）
    this.restMatMesh.position.set(0, 0.04, 0);
    this.restMatMesh.visible = false;
    this.root.add(this.restMatMesh);

    // --- 右脚・左脚（オーバーオール裾 + 長靴） ---
    this.rightLegPivot.position.set(-0.28, 0.85, 0);
    this.bodyGroup.add(this.rightLegPivot);
    this.buildLeg(this.rightLegPivot, overallMat, bootMat);

    this.leftLegPivot.position.set(0.28, 0.85, 0);
    this.bodyGroup.add(this.leftLegPivot);
    this.buildLeg(this.leftLegPivot, overallMat, bootMat);

    // --- 不合格時に地面に転がる「くわ」 (Sketch 10) ---
    this.hoeOnGround.visible = false;
    this.root.add(this.hoeOnGround);
  }

  private buildLeg(
    legPivot: THREE.Group,
    overallMat: THREE.Material,
    bootMat: THREE.Material
  ): void {
    const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.22, 0.38, 6), overallMat);
    upperLeg.position.y = -0.18;
    legPivot.add(upperLeg);

    const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.48, 6), bootMat);
    bootShaft.position.y = -0.58;
    bootShaft.castShadow = true;
    legPivot.add(bootShaft);

    const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.56), bootMat);
    bootFoot.position.set(0, -0.76, 0.12);
    bootFoot.castShadow = true;
    legPivot.add(bootFoot);
  }

  private createHoeMesh(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = this.mat(0x8b5a2b);
    const ironMat = this.mat(0xe4e4e7);

    const handleGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.75, 6);
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = 0.35;
    handle.castShadow = true;
    group.add(handle);

    // くわの刃（前向きにも横向きにもはっきり見える大型ブレード）
    const bladeGeo = new THREE.BoxGeometry(0.75, 0.3, 0.65);
    const blade = new THREE.Mesh(bladeGeo, ironMat);
    blade.position.set(-0.2, 1.62, 0.22);
    blade.castShadow = true;
    group.add(blade);

    return group;
  }

  private createTrophyMesh(): THREE.Group {
    const group = new THREE.Group();
    const goldMat = this.mat(0xfacc15);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.2, 7), goldMat);
    group.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.36, 6), goldMat);
    stem.position.y = 0.25;
    group.add(stem);

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.16, 0.46, 8), goldMat);
    cup.position.y = 0.62;
    group.add(cup);

    return group;
  }

  private createWateringCanMesh(): THREE.Group {
    const group = new THREE.Group();
    const canMat = this.mat(0x0ea5e9);
    const nozzleMat = this.mat(0xe0f2fe);

    // 大きく見やすいジョウロ本体
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.65, 8), canMat);
    group.add(body);

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.85, 6), canMat);
    spout.position.set(0, 0.12, 0.58);
    spout.rotation.x = Math.PI / 3;
    group.add(spout);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 7), nozzleMat);
    head.position.set(0, 0.32, 0.96);
    head.rotation.x = -Math.PI / 6;
    group.add(head);

    return group;
  }

  private createSeedBasketMesh(): THREE.Group {
    const group = new THREE.Group();
    const basketMat = this.mat(0xd97706);
    const seedMat = this.mat(0xfef08a);

    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.42, 8), basketMat);
    group.add(basket);

    const seedsInside = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 5), seedMat);
    seedsInside.scale.set(1, 0.35, 1);
    seedsInside.position.y = 0.18;
    group.add(seedsInside);

    return group;
  }

  private createFertilizerBarrelMesh(): THREE.Group {
    const group = new THREE.Group();
    const barrelMat = this.mat(0x78350f);
    const compostMat = this.mat(0xf59e0b);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.85, 8), barrelMat);
    group.add(barrel);

    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 6), compostMat);
    mound.scale.set(1, 0.5, 1);
    mound.position.y = 0.42;
    group.add(mound);

    return group;
  }

  private createShovelMesh(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = this.mat(0x92400e);
    const headMat = this.mat(0xf59e0b);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), woodMat);
    shaft.position.y = 0.3;
    group.add(shaft);

    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.18), headMat);
    scoop.position.set(0, 1.25, 0.1);
    group.add(scoop);

    return group;
  }

  private createShearsMesh(): {
    group: THREE.Group;
    bladeL: THREE.Mesh;
    bladeR: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const metalMat = this.mat(0xe2e8f0);
    const gripMat = this.mat(0xdc2626);

    const bladeGeo = new THREE.BoxGeometry(0.14, 0.95, 0.08);
    bladeGeo.translate(0, 0.4, 0);

    const bladeL = new THREE.Mesh(bladeGeo, metalMat);
    const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.12), gripMat);
    gripL.position.y = -0.15;
    bladeL.add(gripL);

    const bladeR = new THREE.Mesh(bladeGeo, metalMat);
    const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.12), gripMat);
    gripR.position.y = -0.15;
    bladeR.add(gripR);

    group.add(bladeL, bladeR);
    group.rotation.x = Math.PI / 3;
    return { group, bladeL, bladeR };
  }

  private createHarvestedSpinachMesh(): THREE.Group {
    const group = new THREE.Group();
    const leafMat = this.mat(0x16a34a);
    const rootMat = this.mat(0xe11d48);

    const rootBulb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.38, 6), rootMat);
    group.add(rootBulb);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = angle;
      const leafGeo = new THREE.ConeGeometry(0.36, 1.35, 5);
      leafGeo.translate(0, 0.65, 0);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.z = 0.45;
      pivot.add(leaf);
      group.add(pivot);
    }

    return group;
  }

  private createRestMatMesh(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(2.8, 0.08, 1.6);
    const mat = this.mat(0x84cc16);
    return new THREE.Mesh(geo, mat);
  }

  private clearParticles(): void {
    this.particles.forEach((p) => {
      this.particleGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
    this.particles = [];
  }

  private spawnParticle(
    color: number,
    size: [number, number, number],
    localPos: THREE.Vector3,
    vel: THREE.Vector3,
    maxLife = 0.65,
    noGravity = false
  ): void {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = this.mat(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(localPos);
    this.particleGroup.add(mesh);
    this.particles.push({ mesh, vel, life: 0, maxLife, noGravity });
  }

  public setPose(pose: FarmerPose, action: ActionType = 'plow'): void {
    // すでに同じ作業ポーズ中なら workStartTime やパーティクルを消さずに継続する
    const isSameWork = this.currentPose === 'work' && pose === 'work' && this.currentAction === action;
    this.currentPose = pose;
    this.currentAction = action;

    if (!isSameWork) {
      this.clearParticles();
      this.workStartTime = performance.now() / 1000;
    }

    // 初期化リセット
    this.root.visible = pose !== 'hidden_in_house';
    this.root.rotation.set(0, 0, 0);
    this.bodyGroup.position.set(0, 0, 0);
    this.bodyGroup.rotation.set(0, 0, 0);
    this.bodyGroup.scale.set(1, 1, 1);
    this.headGroup.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
    this.leftLegPivot.rotation.set(0, 0, 0);

    // すべての小道具を一旦非表示
    this.hoeInHand.visible = false;
    this.hoeOnGround.visible = false;
    this.trophyInHand.visible = false;
    this.wateringCan.visible = false;
    this.seedBasket.visible = false;
    this.fertilizerBarrel.visible = false;
    this.fertilizerShovel.visible = false;
    this.thinningShearsGroup.visible = false;
    this.harvestedSpinachGiant.visible = false;
    this.restMatMesh.visible = false;

    this.hoeInHand.rotation.set(0, 0, 0);
    this.hoeInHand.position.set(-0.56, -0.35, 0.25);

    if (pose === 'standby') {
      // Sketch 3: 画面右側で正面を向いてくわを右手に持って立つ
      this.root.position.set(3.2, 0.15, 2.2);
      this.root.rotation.y = -0.18;
      this.hoeInHand.visible = true;
    } else if (pose === 'work') {
      switch (action) {
        case 'plow':
          // 【田おこし】: ウネの右側に立ち、左を向いて巨大なくわを頭上から地面へ豪快に叩きつける
          this.root.position.set(0.65, 0.0, 2.0);
          this.root.rotation.y = -Math.PI * 0.45;
          this.hoeInHand.visible = true;
          this.hoeInHand.rotation.x = 0.7;
          break;

        case 'sow':
          // 【種まき】: お腹に黄色い種カゴを抱え、ウネの上を右から左へ移動しながらクルクル回転して種を全方位に撒く
          this.root.position.set(0.5, 0.0, 1.8);
          this.seedBasket.visible = true;
          break;

        case 'water':
          // 【水やり】: 特大の水色ジョウロを抱え、ウネの手前を左右に歩きながら大量の水アーチを放出する
          this.root.position.set(0.4, 0.0, 2.2);
          this.root.rotation.y = -0.55;
          this.wateringCan.visible = true;
          break;

        case 'fertilize':
          // 【追肥】: 足元に肥やし樽を置き、スコップで肥やしをすくって豪快な横スイングで畑へ投げ撒く
          this.root.position.set(0.5, 0.0, 2.0);
          this.root.rotation.y = -0.35;
          this.fertilizerBarrel.visible = true;
          this.fertilizerShovel.visible = true;
          break;

        case 'weed':
          // 【草取り】: 90度前傾姿勢になり、畑の周囲を高速ダッシュで駆け回りながら雑草の束を宙へ放り投げる
          this.root.position.set(-1.5, -0.15, 2.5);
          break;

        case 'thin':
          // 【間引】: ウネの真ん中に立ち、カメラ正面を向いて大きな銀色のハサミをチョキチョキ動かしながら左右に体を揺らす
          this.root.position.set(-1.8, 0.1, 1.6);
          this.root.rotation.y = 0;
          this.thinningShearsGroup.visible = true;
          break;

        case 'harvest':
          // 【収穫】: 前半は後ろへ大きくのけぞって「うんとこしょ！」と引っ張り、後半は正面を向いて特大ほうれん草を頭上に掲げて大ジャンプ！
          this.root.position.set(-1.2, 0.0, 2.0);
          this.harvestedSpinachGiant.visible = true;
          break;

        case 'rest':
          // 【休暇】: 家の前に緑のゴザを敷き、完全に仰向けにゴロンと寝転がって昼寝する（Zzzバブルが浮かぶ）
          this.root.position.set(2.9, 0.22, 1.9);
          this.restMatMesh.visible = true;
          break;
      }
    } else if (pose === 'contest_win') {
      // Sketch 9: 表彰台の中央頂点に立ち、両腕を上げて右手に「くわ」、左手に「トロフィー」
      this.root.position.set(0, 1.55, 1.5);
      this.root.rotation.y = 0;

      this.hoeInHand.visible = true;
      this.hoeInHand.position.set(-0.52, 0.1, 0);
      this.hoeInHand.rotation.z = 0.15;

      this.trophyInHand.visible = true;
      this.rightArmPivot.rotation.z = -0.85;
      this.leftArmPivot.rotation.z = 0.85;
    } else if (pose === 'contest_lose') {
      // Sketch 10: 不合格のうなだれた様子（orz姿勢で左を向き、手前の地面にくわが転がる）
      this.root.position.set(0.4, 0.0, 1.6);
      this.root.rotation.y = -Math.PI / 2;

      this.bodyGroup.position.set(0, -0.45, 0);
      this.bodyGroup.rotation.x = 1.25;
      this.headGroup.rotation.x = 0.45;

      this.rightArmPivot.rotation.x = -1.1;
      this.leftArmPivot.rotation.x = -1.1;

      this.rightLegPivot.rotation.x = -1.35;
      this.leftLegPivot.rotation.x = -1.35;

      this.hoeOnGround.visible = true;
      this.hoeOnGround.position.set(0.1, 0.14, 0.9);
      this.hoeOnGround.rotation.set(0, Math.PI / 2, Math.PI / 2);
    }
  }

  public update(timeSeconds: number): void {
    const dt = 0.016;
    this.updateParticles(dt);

    if (!this.root.visible) return;

    if (this.currentPose === 'standby') {
      this.bodyGroup.position.y = Math.sin(timeSeconds * 3) * 0.04;
      return;
    }

    if (this.currentPose === 'contest_win') {
      this.bodyGroup.position.y = Math.abs(Math.sin(timeSeconds * 5)) * 0.14;
      this.rightArmPivot.rotation.z = -0.85 - Math.sin(timeSeconds * 5) * 0.12;
      this.leftArmPivot.rotation.z = 0.85 + Math.sin(timeSeconds * 5) * 0.12;
      return;
    }

    if (this.currentPose === 'contest_lose') {
      this.bodyGroup.position.y = -0.45 + Math.sin(timeSeconds * 4) * 0.025;
      return;
    }

    if (this.currentPose === 'work') {
      this.updateWorkAnimation(timeSeconds);
    }
  }

  /**
   * 8つのアクションがひと目で全く違う動きに見える専用フルボディアニメーション
   */
  private updateWorkAnimation(t: number): void {
    const elapsedWork = Math.max(0, performance.now() / 1000 - this.workStartTime);

    switch (this.currentAction) {
      case 'plow': {
        // 【1. 田おこし】: ジャンプして頭上から地面へ140度くわを振り下ろす豪快なスラム動作！
        const cycle = (t * 1.9) % 1;
        this.root.position.z = 1.6 + Math.sin(t * 1.5) * 0.85;

        if (cycle < 0.55) {
          // 大きく振りかぶって少しジャンプ
          const p = cycle / 0.55;
          this.bodyGroup.position.y = Math.sin(p * Math.PI) * 0.45;
          this.bodyGroup.rotation.x = THREE.MathUtils.lerp(0.4, -0.55, p);
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(0.3, -1.8, p);
          this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(0.3, -1.8, p);
        } else if (cycle < 0.75) {
          // 地面へ一気に叩きつける！
          const p = (cycle - 0.55) / 0.2;
          this.bodyGroup.position.y = 0;
          this.bodyGroup.rotation.x = THREE.MathUtils.lerp(-0.55, 0.85, p);
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-1.8, 0.55, p);
          this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(-1.8, 0.55, p);
        } else {
          this.bodyGroup.position.y = 0;
          this.bodyGroup.rotation.x = 0.85;
          this.rightArmPivot.rotation.x = 0.55;
          this.leftArmPivot.rotation.x = 0.55;
        }

        // 叩きつけた瞬間に大きな土塊が跳ね上がる
        if (cycle >= 0.7 && cycle <= 0.8 && t - this.lastSpawnTime > 0.25) {
          this.lastSpawnTime = t;
          for (let i = 0; i < 6; i++) {
            this.spawnParticle(
              0x5c3a21,
              [0.22, 0.22, 0.22],
              new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.35, 1.8),
              new THREE.Vector3((Math.random() - 0.5) * 3.0, 3.2 + Math.random() * 2.0, 1.2 + Math.random())
            );
          }
        }
        break;
      }

      case 'sow': {
        // 【2. 種まき】: 両腕を水平に広げてクルクル回転しながら、畑の右端から左端まで横断して黄色い種を全方位に飛ばす！
        this.root.position.x = THREE.MathUtils.lerp(0.6, -3.8, (Math.sin(elapsedWork * 1.8 - Math.PI / 2) + 1) / 2);
        this.root.position.z = 1.7;

        // フィギュアスケートのようにクルクル回転しながら種を撒く
        this.bodyGroup.rotation.y = t * 9.5;
        this.bodyGroup.position.y = Math.abs(Math.sin(t * 9.5)) * 0.2;

        // 両腕を横に大きく広げて上下に羽ばたく
        this.rightArmPivot.rotation.z = -1.1 + Math.sin(t * 14) * 0.35;
        this.leftArmPivot.rotation.z = 1.1 - Math.sin(t * 14) * 0.35;
        this.rightLegPivot.rotation.x = Math.sin(t * 10) * 0.5;
        this.leftLegPivot.rotation.x = -Math.sin(t * 10) * 0.5;

        // 黄色い大粒の種が周囲へ飛び散る
        if (t - this.lastSpawnTime > 0.06) {
          this.lastSpawnTime = t;
          const angle = Math.random() * Math.PI * 2;
          this.spawnParticle(
            0xfacc15,
            [0.16, 0.16, 0.16],
            new THREE.Vector3(0, 1.5, 0),
            new THREE.Vector3(Math.cos(angle) * 3.2, 2.2 + Math.random(), Math.sin(angle) * 2.5)
          );
        }
        break;
      }

      case 'water': {
        // 【3. 水やり】: 特大の水色ジョウロを抱えてウネの前を左右に歩き、高く弧を描く大量の水しぶきシャワーを放つ！
        this.root.position.x = -1.4 + Math.sin(t * 2.2) * 1.9;
        this.root.position.z = 2.2;
        this.root.rotation.y = -0.65 + Math.cos(t * 2.2) * 0.25;

        // ジョウロを上下に揺らして水を撒く
        const pump = Math.sin(t * 7.0);
        this.bodyGroup.rotation.x = 0.15 + pump * 0.18;
        this.wateringCan.rotation.x = pump * 0.28;
        this.rightArmPivot.rotation.x = -0.9 + pump * 0.25;
        this.leftArmPivot.rotation.x = -0.9 + pump * 0.25;
        this.rightLegPivot.rotation.x = Math.sin(t * 7.0) * 0.45;
        this.leftLegPivot.rotation.x = -Math.sin(t * 7.0) * 0.45;

        // 鮮やかな水色のシャワーが放物線を描いてウネへ降り注ぐ
        if (t - this.lastSpawnTime > 0.035) {
          this.lastSpawnTime = t;
          for (let i = 0; i < 3; i++) {
            this.spawnParticle(
              0x38bdf8,
              [0.15, 0.15, 0.15],
              new THREE.Vector3(0.35, 1.65, 1.5),
              new THREE.Vector3(-1.5 + (Math.random() - 0.5) * 1.5, 2.4 + Math.random() * 1.2, 2.6 + Math.random())
            );
          }
        }
        break;
      }

      case 'fertilize': {
        // 【4. 追肥】: 肥やし樽の横で、野球のフルスイングのように体を大きく左右にひねってスコップから黄金の肥やしを放り投げる！
        const swing = Math.sin(t * 6.5);
        // 胴体を左右に大きく90度ひねる横スイング！
        this.bodyGroup.rotation.y = swing * 1.15;
        this.bodyGroup.rotation.z = swing * 0.2;
        this.rightArmPivot.rotation.x = -1.1;
        this.rightArmPivot.rotation.z = -0.6 + swing * 0.7;
        this.leftArmPivot.rotation.x = -0.9;

        // 足腰を踏ん張る動き
        this.bodyGroup.position.y = Math.abs(swing) * 0.15;
        this.rightLegPivot.rotation.z = -0.2;
        this.leftLegPivot.rotation.z = 0.2;

        // オレンジ・黄金色の肥料塊が大きく飛んでいく
        if (swing > 0.2 && t - this.lastSpawnTime > 0.07) {
          this.lastSpawnTime = t;
          for (let i = 0; i < 2; i++) {
            this.spawnParticle(
              Math.random() > 0.5 ? 0xf59e0b : 0xb45309,
              [0.2, 0.2, 0.2],
              new THREE.Vector3(-0.4, 1.8, 0.8),
              new THREE.Vector3(-3.2 - Math.random() * 2.0, 2.6 + Math.random() * 1.5, (Math.random() - 0.5) * 2.2)
            );
          }
        }
        break;
      }

      case 'weed': {
        // 【5. 草取り】: 体を90度前に倒して頭を地面に近づけ、畑の周りを超高速ダッシュで左右に駆け回りながら雑草の塊を宙へ放り投げる！
        const dashX = Math.sin(t * 5.2) * 2.4 - 1.6;
        const dashZ = 2.3 + Math.cos(t * 3.4) * 0.55;
        this.root.position.set(dashX, -0.2, dashZ);
        // 走る方向へ向きを変える
        this.root.rotation.y = Math.cos(t * 5.2) > 0 ? Math.PI * 0.35 : -Math.PI * 0.35;

        // 地面すれすれまで前傾してワシワシ草を抜く
        this.bodyGroup.rotation.x = 1.25;
        this.headGroup.rotation.x = -0.5;
        const fastPull = Math.sin(t * 22.0);
        this.rightArmPivot.rotation.x = -1.3 + fastPull * 0.85;
        this.leftArmPivot.rotation.x = -1.3 - fastPull * 0.85;
        this.rightLegPivot.rotation.x = fastPull * 0.7;
        this.leftLegPivot.rotation.x = -fastPull * 0.7;

        // 抜いた大きな緑の雑草が頭上高く舞い上がる
        if (t - this.lastSpawnTime > 0.08) {
          this.lastSpawnTime = t;
          this.spawnParticle(
            0x4d7c0f,
            [0.14, 0.45, 0.14],
            new THREE.Vector3(0, 0.6, 0.8),
            new THREE.Vector3((Math.random() - 0.5) * 2.5, 3.8 + Math.random() * 1.5, -1.5)
          );
        }
        break;
      }

      case 'thin': {
        // 【6. 間引】: ウネの真ん中でカメラ正面を向き、メトロノームのように体を左右に大きく傾けながら、巨大な園芸バサミをチョキチョキ開閉させる！
        this.root.position.x = -1.8 + Math.sin(t * 2.5) * 1.1;
        this.root.rotation.y = 0; // カメラ正面を向く

        // 左右にゴロンゴロンと体を傾けるユニークな動き
        const tilt = Math.sin(t * 6.0);
        this.bodyGroup.rotation.z = tilt * 0.38;
        this.bodyGroup.position.y = Math.abs(tilt) * 0.12;
        this.rightArmPivot.rotation.x = -0.9;
        this.leftArmPivot.rotation.x = -0.9;

        // 巨大ハサミの刃が高速でチョキチョキ開閉する！
        const snip = Math.abs(Math.sin(t * 14.0)) * 0.55;
        this.thinningShearsLeft.rotation.z = snip;
        this.thinningShearsRight.rotation.z = -snip;

        // 間引いた双葉が左右にポンポン飛び出す
        if (t - this.lastSpawnTime > 0.14) {
          this.lastSpawnTime = t;
          const dir = Math.random() > 0.5 ? 1 : -1;
          this.spawnParticle(
            0x22c55e,
            [0.18, 0.35, 0.18],
            new THREE.Vector3(0, 1.4, 1.1),
            new THREE.Vector3(dir * (2.2 + Math.random()), 2.8 + Math.random(), 0.5)
          );
        }
        break;
      }

      case 'harvest': {
        // 【7. 収穫】: 前半は後ろへ45度大きくのけぞって「うんとこしょ！」と引っ張り、後半は正面を向いて特大ほうれん草を頭上に掲げて連続大ジャンプ＆スピン！
        if (elapsedWork < 1.1) {
          // 前半：左を向いて「うんとこしょ、どっこいしょ！」と後ろへ大きくのけぞる綱引きモーション
          this.root.rotation.y = -Math.PI * 0.42;
          const tug = Math.sin(t * 12.0);
          this.bodyGroup.rotation.x = -0.65 + tug * 0.25; // 後ろへのけぞる！
          this.rightArmPivot.rotation.x = -1.2;
          this.leftArmPivot.rotation.x = -1.2;
          this.harvestedSpinachGiant.position.set(0, 0.9, 1.1);
          this.harvestedSpinachGiant.scale.set(0.6, 0.6, 0.6);
        } else {
          // 後半：ズボッと抜けて、カメラ正面を向いて頭上に特大ほうれん草を掲げて大ジャンプ！
          this.root.rotation.y = Math.sin(t * 5.0) * 0.45;
          const jump = Math.abs(Math.sin(t * 8.5));
          this.bodyGroup.position.y = jump * 0.75; // 大ジャンプ！
          this.bodyGroup.rotation.x = 0;
          this.rightArmPivot.rotation.z = -2.4; // 両腕バンザイ
          this.leftArmPivot.rotation.z = 2.4;
          this.rightLegPivot.rotation.z = -0.35 * jump;
          this.leftLegPivot.rotation.z = 0.35 * jump;
          this.harvestedSpinachGiant.position.set(0, 3.35, 0.2);
          this.harvestedSpinachGiant.scale.set(1.15, 1.15, 1.15);
        }
        break;
      }

      case 'rest': {
        // 【8. 休暇】: 家の前のゴザの上に完全に真横（仰向け）にゴロンと寝転がり、お腹を上下させながら昼寝する！
        // 体を90度横に倒してゴザの上に仰向けに寝かせる
        this.bodyGroup.position.set(1.1, 0.58, 0);
        this.bodyGroup.rotation.z = Math.PI / 2;
        this.bodyGroup.rotation.y = 0.25;

        // 呼吸でお腹（体全体）がゆっくり上下する
        const breath = Math.sin(t * 3.2);
        this.bodyGroup.scale.set(1 + breath * 0.06, 1, 1 + breath * 0.06);
        this.rightArmPivot.rotation.z = -0.4;
        this.leftArmPivot.rotation.z = 0.4;

        // 頭から大きな白い居眠りバブル（Zzz）がぷかぷか浮かび上がる
        if (t - this.lastSpawnTime > 0.35) {
          this.lastSpawnTime = t;
          this.spawnParticle(
            0xffffff,
            [0.24, 0.24, 0.24],
            new THREE.Vector3(-1.3, 0.9, 0.3),
            new THREE.Vector3(-0.3, 1.4, 0),
            1.1,
            true
          );
        }
        break;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      if (!p.noGravity) {
        p.vel.y -= 7.5 * dt;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += 4 * dt;
      p.mesh.rotation.y += 3 * dt;
    }
  }
}
