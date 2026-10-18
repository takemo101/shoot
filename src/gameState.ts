import { ActionDefinition, ActionType, ContestResult, GameStateData, WeatherType } from './types';

export const ACTIONS: ActionDefinition[] = [
  {
    id: 'plow',
    label: '田おこし',
    staminaCost: 25,
    description: '畑を耕してウネを作ります（種まき前に1〜2回実施。2回で土がふかふかになり品質UP）',
  },
  {
    id: 'sow',
    label: '種まき',
    staminaCost: 15,
    description: '耕したウネにほうれん草の種をまきます（栽培スタート）',
  },
  {
    id: 'water',
    label: '水やり',
    staminaCost: 15,
    description: '乾いた畑に水をやります（雨の日は自動で潤うため不要）',
  },
  {
    id: 'fertilize',
    label: '追肥',
    staminaCost: 20,
    description: '肥やしをやって栄養を補給し、ほうれん草の葉を濃く立派に育てます',
  },
  {
    id: 'weed',
    label: '草取り',
    staminaCost: 20,
    description: 'ウネの周りに生えた雑草をすべて抜き取ります（放置すると栄養・水分が奪われます）',
  },
  {
    id: 'thin',
    label: '間引',
    staminaCost: 15,
    description: '中盤に密集した芽を間引いて間隔を整え、株が大きく育つようにします',
  },
  {
    id: 'harvest',
    label: '収穫',
    staminaCost: 10,
    description: '育てたほうれん草を収穫し、品評会へ出品します（1位を目指して審査へ！）',
  },
  {
    id: 'rest',
    label: '休暇',
    staminaCost: -50,
    description: '1日家で休んで体力を回復します（体力が尽きると3日間寝込むので注意！）',
  },
];

export class GameState {
  public data: GameStateData;

  constructor() {
    this.data = this.createInitialState();
  }

  public createInitialState(): GameStateData {
    return {
      day: 1,
      maxDays: 30,
      stamina: 100,
      maxStamina: 100,
      bedriddenDaysLeft: 0,
      weather: 'sunny',
      phase: 'morning_menu',
      currentAction: null,
      plowCount: 0,
      isSown: false,
      moisture: 55,
      nutrition: 65,
      weedLevel: 0,
      isThinned: false,
      growth: 0,
      overgrownDays: 0,
      quality: 55,
    };
  }

  public reset(): void {
    this.data = this.createInitialState();
  }

  private rollNextWeather(day: number): WeatherType {
    // 1日目は必ず晴れ、以降は25%程度の確率で雨の日が発生
    if (day <= 1) return 'sunny';
    return Math.random() < 0.26 ? 'rainy' : 'sunny';
  }

  /**
   * そのアクションが現在選択可能かどうかと、推奨マークの有無を返す
   */
  public getActionAvailability(actionId: ActionType): {
    enabled: boolean;
    recommended: boolean;
    reason?: string;
  } {
    const d = this.data;

    // 体力が25以下なら休暇を強く推奨
    const lowStamina = d.stamina <= 25;

    switch (actionId) {
      case 'plow':
        if (d.isSown) {
          return { enabled: false, recommended: false, reason: 'すでに種まき済みです' };
        }
        if (d.plowCount >= 2) {
          return { enabled: false, recommended: false, reason: 'すでに十分（2回）耕しています' };
        }
        return {
          enabled: true,
          recommended: d.plowCount === 0 && !lowStamina,
        };

      case 'sow':
        if (d.plowCount === 0) {
          return { enabled: false, recommended: false, reason: '先に「田おこし」をしてウネを作ってください' };
        }
        if (d.isSown) {
          return { enabled: false, recommended: false, reason: 'すでに種まき済みです' };
        }
        return {
          enabled: true,
          recommended: d.plowCount >= 1 && !lowStamina,
        };

      case 'water':
        if (!d.isSown) {
          return { enabled: false, recommended: false, reason: '先に「種まき」をしてください' };
        }
        return {
          enabled: true,
          recommended: d.weather === 'sunny' && d.moisture <= 42 && !lowStamina,
        };

      case 'fertilize':
        if (!d.isSown) {
          return { enabled: false, recommended: false, reason: '先に「種まき」をしてください' };
        }
        return {
          enabled: true,
          recommended: d.nutrition <= 45 && !lowStamina,
        };

      case 'weed':
        if (d.weedLevel === 0) {
          return { enabled: false, recommended: false, reason: '今は周りに雑草が生えていません' };
        }
        return {
          enabled: true,
          recommended: d.weedLevel >= 2 && !lowStamina,
        };

      case 'thin':
        if (!d.isSown || d.growth < 30) {
          return { enabled: false, recommended: false, reason: '芽が育って密集してから行えます' };
        }
        if (d.isThinned) {
          return { enabled: false, recommended: false, reason: 'すでに間引き済みです' };
        }
        return {
          enabled: true,
          recommended: !d.isThinned && d.growth >= 30 && !lowStamina,
        };

      case 'harvest':
        if (!d.isSown || d.growth < 15) {
          return { enabled: false, recommended: false, reason: 'まだ収穫できるほど育っていません' };
        }
        return {
          enabled: true,
          recommended: d.growth >= 92 || d.day >= d.maxDays,
        };

      case 'rest':
        return {
          enabled: true,
          recommended: lowStamina || (d.weather === 'rainy' && d.stamina <= 65),
        };
    }
  }

  /**
   * プレイヤーへの視覚ヒントメッセージを生成
   */
  public getFieldHint(): string {
    const d = this.data;
    if (d.bedriddenDaysLeft > 0) {
      return `⚠️ 過労で寝込み中（残り${d.bedriddenDaysLeft}日）`;
    }
    if (d.day === d.maxDays) {
      return '🚨 最終日（30日目）です！今日「収穫」しないとゲームオーバー！';
    }
    if (!d.isSown) {
      if (d.plowCount === 0) return 'まずは「田おこし」で畑にウネを作ろう';
      if (d.plowCount === 1) return 'もう1回「田おこし」で土をふかふかにするか、「種まき」をしよう';
      return 'ふかふかのウネができた！「種まき」をしよう';
    }
    if (d.stamina <= 25) {
      return '💦 体力が危険！倒れて3日寝込む前に「休暇」をとろう';
    }
    if (d.growth >= 95) {
      return '✨ ほうれん草が立派に育った！「収穫」して品評会に出そう！';
    }
    if (!d.isThinned && d.growth >= 35) {
      return '🌱 ウネの芽が密集してきた！「間引」をして株を大きく育てよう';
    }
    if (d.weedLevel >= 2) {
      return '🌿 周りに雑草が目立ってきた！「草取り」をしよう';
    }
    if (d.moisture <= 38 && d.weather === 'sunny') {
      return '☀️ 土が白っぽく乾いている。「水やり」をしよう';
    }
    if (d.nutrition <= 40) {
      return '🍂 葉の色が薄くなってきた。「追肥」で栄養をやろう';
    }
    if (d.weather === 'rainy') {
      return '🌧️ 雨で畑が自然に潤っている。他の作業や「休暇」のチャンス！';
    }
    return '🌱 ほうれん草は順調に育っているぞ';
  }

  /**
   * 昼の作業を実行し、パラメータを更新する
   * @returns 作業時のメッセージ
   */
  public applyDayAction(actionId: ActionType): string {
    const d = this.data;
    d.currentAction = actionId;
    const def = ACTIONS.find((a) => a.id === actionId)!;

    // 体力消費または回復
    if (def.staminaCost > 0) {
      d.stamina = Math.max(0, d.stamina - def.staminaCost);
    } else {
      d.stamina = Math.min(d.maxStamina, d.stamina - def.staminaCost);
    }

    let msg = '';

    switch (actionId) {
      case 'plow':
        d.plowCount = Math.min(2, d.plowCount + 1);
        if (d.plowCount === 1) {
          d.quality = Math.min(100, d.quality + 5);
          msg = 'くわを振るって畑を耕し、ウネを作った！';
        } else {
          d.quality = Math.min(100, d.quality + 12);
          msg = 'さらに丁寧に田おこしをして、ふかふかの極上ウネになった！';
        }
        break;

      case 'sow':
        d.isSown = true;
        d.growth = 5;
        msg = 'ウネにほうれん草の種をまいた！';
        break;

      case 'water':
        d.moisture = Math.min(100, d.moisture + 45);
        if (d.weather === 'rainy' || d.moisture > 92) {
          d.quality = Math.max(0, d.quality - 6);
          msg = '水をやったが、土が水浸しになってしまった…';
        } else {
          d.quality = Math.min(100, d.quality + 3);
          msg = '畑にたっぷり水をやった！土がしっとり潤った。';
        }
        break;

      case 'fertilize':
        d.nutrition = Math.min(100, d.nutrition + 45);
        d.quality = Math.min(100, d.quality + 6);
        msg = '畑に肥やしをやった！土の栄養が豊かになった。';
        break;

      case 'weed':
        d.weedLevel = 0;
        d.quality = Math.min(100, d.quality + 4);
        msg = 'ウネの周りの雑草をきれいに抜き取った！';
        break;

      case 'thin':
        d.isThinned = true;
        d.quality = Math.min(100, d.quality + 12);
        msg = '密集していた芽を間引いた！残った株にしっかり栄養が行き渡るぞ。';
        break;

      case 'harvest':
        msg = '育て上げたほうれん草を収穫した！いざ品評会へ！';
        break;

      case 'rest':
        msg = '家でゆっくり休養して体力が回復した！';
        break;
    }

    // 作業後に体力が0になった場合、翌日から3日間寝込む予約
    if (d.stamina <= 0 && actionId !== 'harvest') {
      d.bedriddenDaysLeft = 3;
      msg += ' …しかし体力が尽きて倒れてしまった！（翌日から3日間寝込みます）';
    }

    return msg;
  }

  /**
   * 夜の経過処理（水分・栄養変化、雑草発生、ほうれん草の成長、翌日への移行）
   */
  public processNight(): {
    growthDelta: number;
    nightSummary: string;
    isTimeUp: boolean;
  } {
    const d = this.data;
    let growthDelta = 0;
    const notes: string[] = [];

    // 天候による水分変化
    if (d.weather === 'rainy') {
      d.moisture = Math.min(100, d.moisture + 35);
      notes.push('雨の恵みで畑が潤った');
    } else {
      d.moisture = Math.max(0, d.moisture - 18);
    }

    // 雑草による水分・栄養の横取り
    if (d.weedLevel > 0) {
      d.moisture = Math.max(0, d.moisture - d.weedLevel * 3);
      d.nutrition = Math.max(0, d.nutrition - d.weedLevel * 3);
      if (d.weedLevel >= 3) {
        d.quality = Math.max(0, d.quality - 4);
        notes.push('雑草に栄養を奪われている…');
      }
    }

    // 種まき後の成長処理
    if (d.isSown) {
      d.nutrition = Math.max(0, d.nutrition - 9);

      // 基本成長量
      let delta = 5.5;

      // 水分ボーナス / ペナルティ
      if (d.moisture >= 40 && d.moisture <= 85) {
        delta += 1.8;
        d.quality = Math.min(100, d.quality + 1.5);
      } else if (d.moisture < 25) {
        delta *= 0.35;
        d.quality = Math.max(0, d.quality - 6);
        notes.push('水不足で成長が鈍い…');
      } else if (d.moisture > 92) {
        delta *= 0.7;
        d.quality = Math.max(0, d.quality - 4);
      }

      // 栄養ボーナス / ペナルティ
      if (d.nutrition >= 45) {
        delta += 1.5;
        d.quality = Math.min(100, d.quality + 1.5);
      } else if (d.nutrition < 25) {
        delta *= 0.5;
        d.quality = Math.max(0, d.quality - 5);
        notes.push('栄養不足で葉の色が薄い…');
      }

      // 2回田おこしボーナス
      if (d.plowCount >= 2) {
        delta += 0.7;
      }

      // 間引き判定（成長度40以降は間引きしていないと密集して伸び悩む）
      if (d.growth >= 42 && !d.isThinned) {
        delta *= 0.45;
        d.quality = Math.max(0, d.quality - 3);
        notes.push('株が密集して窮屈そうだ（「間引」が必要）');
      } else if (d.isThinned) {
        delta += 1.2;
      }

      const prevGrowth = d.growth;
      if (prevGrowth >= 100) {
        d.overgrownDays += 1;
        if (d.overgrownDays >= 3) {
          d.quality = Math.max(0, d.quality - 6);
          notes.push('収穫時期を過ぎて葉が硬くなってきた…');
        }
      } else {
        d.growth = Math.min(100, Math.round((d.growth + delta) * 10) / 10);
      }
      growthDelta = Math.max(0, d.growth - prevGrowth);
      if (growthDelta > 0 && notes.length === 0) {
        notes.push('ウネからほうれん草がすくすく成長した！');
      }
    } else {
      notes.push('静かな夜が更けていく…');
    }

    // 雑草の自然発生（雨の日の夜は特に生えやすい）
    const weedChance = d.weather === 'rainy' ? 0.65 : 0.42;
    if (d.day >= 2 && Math.random() < weedChance && d.weedLevel < 5) {
      d.weedLevel += 1;
    }

    // 30日目の夜が終わった時点で未収穫なら時間切れゲームオーバー
    if (d.day >= d.maxDays) {
      return {
        growthDelta,
        nightSummary: '1ヶ月（30日）が経過してしまった…！',
        isTimeUp: true,
      };
    }

    // 翌日へ進める
    d.day += 1;
    d.weather = this.rollNextWeather(d.day);
    d.currentAction = null;

    return {
      growthDelta,
      nightSummary: notes[0] || '夜が更けていく…',
      isTimeUp: false,
    };
  }

  /**
   * 寝込み日の1日経過処理
   */
  public applyBedriddenDay(): string {
    const d = this.data;
    d.bedriddenDaysLeft = Math.max(0, d.bedriddenDaysLeft - 1);
    d.stamina = Math.min(d.maxStamina, d.stamina + 20);
    if (d.bedriddenDaysLeft === 0) {
      return '3日間寝込んでようやく体調が戻った…（明日から作業再開）';
    }
    return `過労で寝込んでいる…（あと${d.bedriddenDaysLeft}日動けない）`;
  }

  /**
   * 品評会の採点計算（100点満点、80点以上で1位合格）
   */
  public evaluateContest(isTimeOut = false): ContestResult {
    const d = this.data;

    if (isTimeOut) {
      return {
        score: 0,
        growthScore: 0,
        qualityScore: 0,
        passed: false,
        reason: '1ヶ月（30日）以内に収穫できなかったため失格（ゲームオーバー）',
      };
    }

    // 成長点（最大50点）
    let growthScore = Math.round((d.growth / 100) * 50);
    if (d.growth < 60) {
      growthScore = Math.round(growthScore * 0.5);
    }

    // 品質点（最大50点）
    let qualityScore = Math.round((d.quality / 100) * 50);
    if (!d.isThinned) {
      qualityScore = Math.max(0, qualityScore - 10);
    }
    if (d.weedLevel >= 3) {
      qualityScore = Math.max(0, qualityScore - 8);
    }

    const total = Math.max(5, Math.min(100, growthScore + qualityScore));
    const passed = total >= 80;

    let reason = '';
    if (passed) {
      reason = '色ツヤ・大きさともに文句なしの極上ほうれん草！見事、品評会で【第1位】に輝きました！';
    } else if (d.growth < 80) {
      reason = 'まだ株が小さく成長不足でした。もう少し育ててから収穫しよう！';
    } else if (!d.isThinned) {
      reason = '「間引」をしなかったため、株が細く伸び悩んでしまいました。';
    } else {
      reason = '水やり・追肥・草取りのバランスをもう少し丁寧にして1位（80点以上）を目指そう！';
    }

    return {
      score: total,
      growthScore,
      qualityScore,
      passed,
      reason,
    };
  }
}
