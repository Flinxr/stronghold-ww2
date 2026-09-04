export type ResourceType = 'gold' | 'wood' | 'stone' | 'food';

export interface Resources {
  gold: number;
  wood: number;
  stone: number;
  food: number;
  population: number;
  maxPopulation: number;
}

export type BuildingType = 
  | 'keep'          // دژ اصلی
  | 'house'         // خانه (افزایش جمعیت)
  | 'farm'          // مزرعه (تولید غذا)
  | 'quarry'        // معدن سنگ
  | 'woodcutter'    // کارگاه چوب‌بری
  | 'goldmine'      // معدن طلا (استخراج طلا)
  | 'market'        // بازار (تولید طلا / مالیات و صرافی)
  | 'barracks'      // سربازخانه (آموزش نیرو)
  | 'tower'         // برج دیده‌بانی (تیرانداز خودکار)
  | 'wall';         // دیوار دفاعی

export interface BuildingCost {
  gold: number;
  wood: number;
  stone: number;
  food?: number;
}

export interface BuildingConfig {
  type: BuildingType;
  nameFa: string;
  nameEn: string;
  cost: BuildingCost;
  hp: number;
  maxHp: number;
  descriptionFa: string;
  icon: string;
  sizeX: number; // grid width
  sizeZ: number; // grid height
  populationGranted?: number;
  resourceProduction?: Partial<Resources>; // per 5 sec
  attackDamage?: number; // for tower
  attackRange?: number;  // for tower
}

export type UnitType = 
  | 'swordsman'     // شمشیرزن (نزدیک‌زن سبک)
  | 'spearman'      // نیزه‌دار (نزدیک‌زن سنگین / ضد زره)
  | 'archer'        // تیرانداز (دورزن)
  | 'knight'        // شوالیه (نزدیک‌زن سریع و قوی)
  | 'tank'          // تانک رزمی سنگین (توپخانه مستقیم)
  | 'artillery_tank' // تانک توپخانه دوربرد (خمپاره‌انداز با تیر قوس‌دار)
  | 'enemy_grunt'   // دشمن نزدیک‌زن
  | 'enemy_archer'  // دشمن دورزن
  | 'enemy_boss';   // غول دشمن

export interface UnitConfig {
  type: UnitType;
  nameFa: string;
  nameEn: string;
  isEnemy: boolean;
  cost: BuildingCost;
  hp: number;
  maxHp: number;
  damageToUnits: number;
  damageToBuildings: number;
  attackRange: number; // in world tiles
  attackSpeed: number; // attacks per sec
  moveSpeed: number;   // tiles per sec
  icon: string;
  descriptionFa: string;
  isRanged: boolean;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  gridX: number;
  gridZ: number;
  hp: number;
  maxHp: number;
  isEnemy: boolean;
  playerId?: number; // 1 (Blue), 2 (Red), 3 (Yellow), 4 (Purple)
  isConstructed: boolean;
  constructProgress: number; // 0 to 1
  lastProducedAt?: number;
  lastAttackTime?: number;
  repairing?: boolean;
  createdAt?: number;
}

export interface UnitInstance {
  id: string;
  type: UnitType;
  isEnemy: boolean;
  playerId?: number; // 1 (Blue), 2 (Red), 3 (Yellow), 4 (Purple)
  x: number;
  z: number;
  targetX?: number;
  targetZ?: number;
  targetEntityId?: string; // unit or building ID
  userMoveCommand?: boolean; // explicit ground move order from player
  hp: number;
  maxHp: number;
  state: 'idle' | 'moving' | 'attacking' | 'dead';
  lastAttackTime: number;
  rotation: number;
  selected?: boolean;
  createdAt?: number;
}

export interface Projectile {
  id: string;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetUnitId?: string;
  targetBuildingId?: string;
  damage: number;
  speed: number;
  progress: number; // 0 to 1
  isEnemy: boolean;
  type?: 'arrow' | 'cannon' | 'mortar' | 'bullet' | 'rpg' | 'sniper';
  arcHeight?: number;
}

export interface ParticleEffect {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'hit' | 'build' | 'explosion' | 'arrow_dust';
  life: number; // 0 to 1
  maxLife: number;
  color: string;
}

export interface WaveInfo {
  waveNumber: number;
  totalWaves: number;
  timeToNextWave: number; // seconds
  isWaveActive: boolean;
  enemiesRemaining: number;
}

export type GameMode = 'playing' | 'paused' | 'victory' | 'gameover' | 'lobby';

export interface GameStats {
  enemiesKilled: number;
  buildingsConstructed: number;
  unitsRecruited: number;
  timeSurvivedSec: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  playerId: number; // 1 (Blue), 2 (Red), 3 (Yellow), 4 (Purple)
  isHost: boolean;
  isReady: boolean;
}

export interface PublicLobbyInfo {
  id: string;
  name: string;
  hostName: string;
  maxPlayers: number;
  currentPlayers: number;
  hasPassword: boolean;
  startingGold: number;
  status: 'waiting' | 'in_game';
  createdAt: number;
}

export interface LobbyRoomData {
  id: string;
  name: string;
  hostId: string;
  password?: string;
  maxPlayers: number;
  startingGold: number;
  status: 'waiting' | 'in_game';
  players: LobbyPlayer[];
  createdAt: number;
}

export interface ChatMessage {
  sender: string;
  message: string;
  playerId?: number;
  time: string;
}
