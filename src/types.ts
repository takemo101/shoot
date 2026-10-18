export type ActionType =
  | 'plow'      // 田おこし
  | 'sow'       // 種まき
  | 'water'     // 水やり
  | 'fertilize' // 追肥
  | 'weed'      // 草取り
  | 'thin'      // 間引
  | 'harvest'   // 収穫（品評会へ）
  | 'rest';     // 休暇

export type WeatherType = 'sunny' | 'rainy';

export type DayPhase = 'morning_menu' | 'working' | 'night' | 'bedridden' | 'contest';

export interface ActionDefinition {
  id: ActionType;
  label: string;
  staminaCost: number; // 負の値は回復（休暇: -50）
  description: string;
}

export interface ContestResult {
  score: number;
  growthScore: number;
  qualityScore: number;
  passed: boolean; // 80点以上で1位合格
  reason: string;
}

export interface GameStateData {
  day: number;            // 1 〜 30
  maxDays: number;        // 30
  stamina: number;        // 0 〜 100
  maxStamina: number;     // 100
  bedriddenDaysLeft: number; // 過労で寝込んでいる残り日数（最大3日）

  weather: WeatherType;
  phase: DayPhase;
  currentAction: ActionType | null;

  // 畑・ほうれん草の状態
  plowCount: number;      // 0: 未耕, 1: 1回耕した, 2: 2回耕した（ふかふか）
  isSown: boolean;        // 種まき済みか
  moisture: number;       // 水分量 0 〜 100 (適正 40〜85)
  nutrition: number;      // 栄養度 0 〜 100 (適正 40〜100)
  weedLevel: number;      // 雑草レベル 0 〜 5
  isThinned: boolean;     // 間引き済みか
  growth: number;         // 成長度 0 〜 100
  overgrownDays: number;  // 成長度100到達後に放置した日数（とう立ち判定）
  quality: number;        // 品質評価値 0 〜 100
}
