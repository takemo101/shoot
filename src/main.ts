import { ACTIONS, GameState } from './gameState';
import { FieldScene } from './scene/FieldScene';
import { sound } from './sound';
import { ActionType } from './types';

class GameController {
  private gameState: GameState;
  private fieldScene: FieldScene;

  // DOM要素
  private staminaFillEl: HTMLElement;
  private staminaValueEl: HTMLElement;
  private dayDisplayEl: HTMLElement;
  private weatherDisplayEl: HTMLElement;
  private phaseDisplayEl: HTMLElement;
  private fieldHintEl: HTMLElement;

  private morningMenuEl: HTMLElement;
  private actionListEl: HTMLElement;
  private actionDescEl: HTMLElement;

  private statusBannerEl: HTMLElement;
  private statusBannerTextEl: HTMLElement;

  private contestOverlayEl: HTMLElement;
  private contestScoreEl: HTMLElement;
  private contestRankEl: HTMLElement;
  private contestDetailsEl: HTMLElement;
  private retryButtonEl: HTMLElement;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.gameState = new GameState();
    this.fieldScene = new FieldScene(canvas);

    this.staminaFillEl = document.getElementById('stamina-bar-fill')!;
    this.staminaValueEl = document.getElementById('stamina-value')!;
    this.dayDisplayEl = document.getElementById('day-display')!;
    this.weatherDisplayEl = document.getElementById('weather-display')!;
    this.phaseDisplayEl = document.getElementById('phase-display')!;
    this.fieldHintEl = document.getElementById('field-hint')!;

    this.morningMenuEl = document.getElementById('morning-menu')!;
    this.actionListEl = document.getElementById('action-list')!;
    this.actionDescEl = document.getElementById('action-desc')!;

    this.statusBannerEl = document.getElementById('status-banner')!;
    this.statusBannerTextEl = document.getElementById('status-banner-text')!;

    this.contestOverlayEl = document.getElementById('contest-overlay')!;
    this.contestScoreEl = document.getElementById('contest-score')!;
    this.contestRankEl = document.getElementById('contest-rank')!;
    this.contestDetailsEl = document.getElementById('contest-details')!;
    this.retryButtonEl = document.getElementById('retry-button')!;

    this.retryButtonEl.addEventListener('click', () => {
      sound.playSelect();
      this.restartGame();
    });

    this.fieldScene.startRenderLoop();
    this.startMorning();
  }

  private restartGame(): void {
    this.contestOverlayEl.classList.add('hidden');
    document.getElementById('hud-stamina')!.classList.remove('hidden');
    document.getElementById('hud-info')!.classList.remove('hidden');
    this.gameState.reset();
    this.startMorning();
  }

  private updateHUD(): void {
    const d = this.gameState.data;

    // 左上の縦型体力ゲージ更新
    const pct = Math.max(0, Math.min(100, (d.stamina / d.maxStamina) * 100));
    this.staminaFillEl.style.height = `${pct}%`;
    this.staminaFillEl.classList.remove('warning', 'danger');
    if (d.stamina <= 25) {
      this.staminaFillEl.classList.add('danger');
    } else if (d.stamina <= 45) {
      this.staminaFillEl.classList.add('warning');
    }
    this.staminaValueEl.textContent = `${d.stamina}`;

    // 右上の情報表示更新
    this.dayDisplayEl.textContent = `${d.day}日目 / ${d.maxDays}日`;
    this.weatherDisplayEl.textContent = d.weather === 'rainy' ? '🌧️ 雨' : '☀️ 晴れ';

    if (d.phase === 'morning_menu') {
      this.phaseDisplayEl.textContent = '🌅 朝（作業選択）';
    } else if (d.phase === 'working') {
      this.phaseDisplayEl.textContent = '☀️ 昼（作業中）';
    } else if (d.phase === 'bedridden') {
      this.phaseDisplayEl.textContent = '🛌 寝込み中';
    } else if (d.phase === 'night') {
      const moonNames = ['🌑 新月', '🌒 三日月', '🌓 上弦の月', '🌔 十三夜', '🌕 満月', '🌖 十六夜', '🌗 下弦の月', '🌘 二十六夜'];
      const moonIdx = Math.floor(((d.day - 1) / d.maxDays) * moonNames.length) % moonNames.length;
      this.phaseDisplayEl.textContent = `🌙 夜（${moonNames[moonIdx]}）`;
    }

    this.fieldHintEl.textContent = this.gameState.getFieldHint();
  }

  private showBanner(text: string): void {
    this.statusBannerTextEl.textContent = text;
    this.statusBannerEl.classList.remove('hidden');
  }

  private hideBanner(): void {
    this.statusBannerEl.classList.add('hidden');
  }

  private startMorning(): void {
    const d = this.gameState.data;

    // 過労で寝込んでいる場合はメニューを出さずに自動で1日経過する
    if (d.bedriddenDaysLeft > 0) {
      d.phase = 'bedridden';
      this.morningMenuEl.classList.add('hidden');
      this.fieldScene.syncState(d);
      this.updateHUD();
      this.runBedriddenDay();
      return;
    }

    d.phase = 'morning_menu';
    this.hideBanner();
    this.fieldScene.syncState(d);
    this.updateHUD();
    this.renderMorningMenu();
    this.morningMenuEl.classList.remove('hidden');
  }

  private renderMorningMenu(): void {
    this.actionListEl.innerHTML = '';
    this.actionDescEl.textContent = '今日の作業を1つ選んでください（★は現在の畑状態におすすめの作業）';

    ACTIONS.forEach((action) => {
      const avail = this.gameState.getActionAvailability(action.id);
      const li = document.createElement('li');
      li.className = 'action-item';
      if (!avail.enabled) li.classList.add('disabled');
      if (avail.recommended) li.classList.add('recommended');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'action-name';
      nameSpan.textContent = action.label;

      const costSpan = document.createElement('span');
      costSpan.className = 'action-cost';
      costSpan.textContent =
        action.staminaCost > 0 ? `体力-${action.staminaCost}` : `体力+${Math.abs(action.staminaCost)}`;

      li.appendChild(nameSpan);
      li.appendChild(costSpan);

      li.addEventListener('mouseenter', () => {
        if (!avail.enabled && avail.reason) {
          this.actionDescEl.textContent = `【選択不可】${avail.reason}`;
        } else {
          this.actionDescEl.textContent = action.description;
        }
      });

      li.addEventListener('click', () => {
        if (!avail.enabled) {
          if (avail.reason) {
            this.actionDescEl.textContent = `【選択不可】${avail.reason}`;
          }
          return;
        }
        sound.playSelect();
        this.executeDayWork(action.id);
      });

      this.actionListEl.appendChild(li);
    });
  }

  /**
   * 選択したアクションを朝から夕方まで実行（太陽が右→上→左へ移動）
   */
  private executeDayWork(actionId: ActionType): void {
    const d = this.gameState.data;
    d.phase = 'working';
    d.currentAction = actionId;
    this.morningMenuEl.classList.add('hidden');
    this.updateHUD();

    const actionDef = ACTIONS.find((a) => a.id === actionId)!;
    this.showBanner(`【${actionDef.label}】を作業中…`);

    this.fieldScene.farmer.setPose('work', actionId);

    const durationMs = 2400;
    const startTime = performance.now();
    let effectApplied = false;
    let lastSoundTick = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // 太陽を 0.12 (朝) から 0.95 (夕方) まで移動
      const sunProgress = 0.12 + t * 0.83;
      this.fieldScene.setDaySunPosition(sunProgress, d.weather === 'rainy');

      // 作業効果音
      if (now - lastSoundTick > 480 && t < 0.9) {
        lastSoundTick = now;
        sound.playWorkHit(actionId);
      }

      // 昼過ぎ（t >= 0.55）で実際の畑パラメータ変化と体力変化を反映し、見た目も即座に更新
      if (!effectApplied && t >= 0.55) {
        effectApplied = true;
        const resultMsg = this.gameState.applyDayAction(actionId);
        this.showBanner(resultMsg);
        this.fieldScene.syncState(d);
        // syncStateでポーズがリセットされないようアクション固有の作業姿勢を維持
        this.fieldScene.farmer.setPose('work', actionId);
        this.updateHUD();
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // 収穫を選んだ場合は品評会へ移行
        if (actionId === 'harvest') {
          setTimeout(() => this.showContestResult(false), 600);
        } else {
          this.runNightScene();
        }
      }
    };

    requestAnimationFrame(step);
  }

  /**
   * 過労で寝込んでいる日の昼経過アニメーション
   */
  private runBedriddenDay(): void {
    const d = this.gameState.data;
    const msg = this.gameState.applyBedriddenDay();
    this.showBanner(`🛌 ${msg}`);
    this.updateHUD();

    const durationMs = 1500;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const sunProgress = 0.12 + t * 0.83;
      this.fieldScene.setDaySunPosition(sunProgress, d.weather === 'rainy');

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.runNightScene();
      }
    };

    requestAnimationFrame(step);
  }

  /**
   * 夜の植物成長・月の満ち欠けシーン (Sketch 6 & 8)
   */
  private runNightScene(): void {
    const d = this.gameState.data;
    d.phase = 'night';

    const nightOutcome = this.gameState.processNight();
    this.fieldScene.syncState(d);
    this.updateHUD();

    if (nightOutcome.growthDelta > 0) {
      sound.playNightGrowth();
    }

    this.showBanner(`🌙 ${nightOutcome.nightSummary}`);

    setTimeout(() => {
      if (nightOutcome.isTimeUp) {
        this.showContestResult(true);
      } else {
        this.startMorning();
      }
    }, 1850);
  }

  /**
   * 品評会（結果発表）シーンの表示 (Sketch 9 & 10)
   */
  private showContestResult(isTimeOut: boolean): void {
    const d = this.gameState.data;
    d.phase = 'contest';
    this.hideBanner();
    this.morningMenuEl.classList.add('hidden');
    document.getElementById('hud-stamina')!.classList.add('hidden');
    document.getElementById('hud-info')!.classList.add('hidden');

    const result = this.gameState.evaluateContest(isTimeOut);
    this.fieldScene.showContestScene(result.passed);

    if (result.passed) {
      sound.playFanfare();
    } else {
      sound.playFail();
    }

    // 全角数字にしてスケッチの「８０点」「１０点」の雰囲気を再現
    const fullWidthScore = String(result.score).replace(/[0-9]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0xfee0)
    );
    this.contestScoreEl.textContent = `${fullWidthScore}点`;

    if (result.passed) {
      this.contestRankEl.textContent = '🏆 品評会 第1位（合格・ゲームクリア！）';
    } else if (isTimeOut) {
      this.contestRankEl.textContent = '💀 時間切れ（1ヶ月以内に収穫できずゲームオーバー）';
    } else {
      this.contestRankEl.textContent = '💦 品評会 不合格（80点以上で1位合格）';
    }

    this.contestDetailsEl.innerHTML = `
      <div><strong>【内訳】</strong> 大きさ・成長点: ${result.growthScore} / 50点 ｜ 品質・手入れ点: ${result.qualityScore} / 50点</div>
      <div style="margin-top: 6px;">${result.reason}</div>
    `;

    this.contestOverlayEl.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
