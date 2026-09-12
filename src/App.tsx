import React, { useState, useEffect, useRef } from 'react';
import {
  Resources,
  BuildingInstance,
  UnitInstance,
  Projectile,
  ParticleEffect,
  BuildingType,
  UnitType,
  WaveInfo,
  GameMode,
  GameStats,
  PublicLobbyInfo,
  LobbyRoomData,
  ChatMessage,
} from './types';
import {
  INITIAL_RESOURCES,
  BUILDINGS_CONFIG,
  UNITS_CONFIG,
  WAVE_SCHEDULE,
  MAP_SIZE,
  PLAYERS_CONFIG,
} from './game/constants';
import {
  calculateNextPosition,
  distance2D,
  createObstacleGrid,
  getBuildingPerimeterPoint,
  getDistanceToBuilding,
  getBuildingCenter,
} from './game/pathfinding';
import { computeWorldChecksum, formatChecksum } from './game/sync';
import { soundManager } from './game/audio';
import { getSocket } from './services/socket';

import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { GameGuideModal } from './components/GameGuideModal';
import { PhotoshopLeftSidebar } from './components/PhotoshopLeftSidebar';
import { PhotoshopRightInspector } from './components/PhotoshopRightInspector';
import { PlayerStatusHUD } from './components/PlayerStatusHUD';
import { TopBar } from './components/TopBar';

import { LobbyListModal } from './components/Lobby/LobbyListModal';
import { CreateLobbyModal } from './components/Lobby/CreateLobbyModal';
import { LobbyRoomModal } from './components/Lobby/LobbyRoomModal';
import { InGameChat } from './components/InGameChat';

function getUnitPlayerId(u: UnitInstance): number {
  return u.playerId || (u.isEnemy ? 2 : 1);
}
function getBuildingPlayerId(b: BuildingInstance): number {
  return b.playerId || (b.isEnemy ? 2 : 1);
}

// Helper to generate map world based on active player slots and startingGold
function generateInitialWorld(activeSlots: number[], startingGold: number, isOnline: boolean, selfPlayerId: number = 1) {
  const initialRes: Resources = {
    ...INITIAL_RESOURCES,
    gold: startingGold,
  };

  const initialBuildings: BuildingInstance[] = [];
  const initialUnits: UnitInstance[] = [];

  activeSlots.forEach((pId) => {
    const pConfig = PLAYERS_CONFIG[pId];
    if (!pConfig) return;

    // In offline mode, p2..p4 are AI enemies. In online mode, all bases belong to player slots.
    const isEnemy = pId !== selfPlayerId;

    const kX = pConfig.keepGridX;
    const kZ = pConfig.keepGridZ;

    const offsetX = kX > 40 ? -4 : 4;
    const offsetZ = kZ > 40 ? -4 : 4;

    initialBuildings.push(
      { id: `keep_p${pId}`, type: 'keep', gridX: kX, gridZ: kZ, hp: BUILDINGS_CONFIG.keep.hp, maxHp: BUILDINGS_CONFIG.keep.maxHp, isEnemy, playerId: pId, isConstructed: true, constructProgress: 1, createdAt: Date.now() },
      { id: `house_p${pId}`, type: 'house', gridX: kX + offsetX, gridZ: kZ, hp: BUILDINGS_CONFIG.house.hp, maxHp: BUILDINGS_CONFIG.house.maxHp, isEnemy, playerId: pId, isConstructed: true, constructProgress: 1, createdAt: Date.now() },
      { id: `barracks_p${pId}`, type: 'barracks', gridX: kX, gridZ: kZ + offsetZ, hp: BUILDINGS_CONFIG.barracks.hp, maxHp: BUILDINGS_CONFIG.barracks.maxHp, isEnemy, playerId: pId, isConstructed: true, constructProgress: 1, createdAt: Date.now() },
      { id: `tower_p${pId}`, type: 'tower', gridX: kX + offsetX, gridZ: kZ + offsetZ, hp: BUILDINGS_CONFIG.tower.hp, maxHp: BUILDINGS_CONFIG.tower.maxHp, isEnemy, playerId: pId, isConstructed: true, constructProgress: 1, createdAt: Date.now() }
    );

    // 5 Initial Soldiers per player (2 Swordsmen, 2 Spearmen, 1 Archer)
    const uType1: UnitType = isOnline ? 'swordsman' : (isEnemy ? 'enemy_grunt' : 'swordsman');
    const uType2: UnitType = isOnline ? 'spearman' : (isEnemy ? 'enemy_grunt' : 'spearman');
    const uType3: UnitType = isOnline ? 'archer' : (isEnemy ? 'enemy_archer' : 'archer');

    initialUnits.push(
      { id: `u_p${pId}_1`, type: uType1, isEnemy, playerId: pId, x: kX + 1.5, z: kZ + offsetZ + 1.5, hp: UNITS_CONFIG[uType1].hp, maxHp: UNITS_CONFIG[uType1].maxHp, state: 'idle', lastAttackTime: 0, rotation: 0, createdAt: Date.now() },
      { id: `u_p${pId}_2`, type: uType1, isEnemy, playerId: pId, x: kX + 2.5, z: kZ + offsetZ + 1.5, hp: UNITS_CONFIG[uType1].hp, maxHp: UNITS_CONFIG[uType1].maxHp, state: 'idle', lastAttackTime: 0, rotation: 0, createdAt: Date.now() },
      { id: `u_p${pId}_3`, type: uType2, isEnemy, playerId: pId, x: kX + offsetX + 1.5, z: kZ + 1.5, hp: UNITS_CONFIG[uType2].hp, maxHp: UNITS_CONFIG[uType2].maxHp, state: 'idle', lastAttackTime: 0, rotation: 0, createdAt: Date.now() },
      { id: `u_p${pId}_4`, type: uType2, isEnemy, playerId: pId, x: kX + offsetX + 2.5, z: kZ + 1.5, hp: UNITS_CONFIG[uType2].hp, maxHp: UNITS_CONFIG[uType2].maxHp, state: 'idle', lastAttackTime: 0, rotation: 0, createdAt: Date.now() },
      { id: `u_p${pId}_5`, type: uType3, isEnemy, playerId: pId, x: kX + 1.5, z: kZ + 1.5, hp: UNITS_CONFIG[uType3].hp, maxHp: UNITS_CONFIG[uType3].maxHp, state: 'idle', lastAttackTime: 0, rotation: 0, createdAt: Date.now() }
    );
  });

  return { initialRes, initialBuildings, initialUnits };
}

export default function App() {
  // --- Game State ---
  const [gameMode, setGameMode] = useState<GameMode>('lobby');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(false);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // --- Online Multiplayer & Lobby State ---
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('rts_commander_name') || `فرمانده ${Math.floor(Math.random() * 900 + 100)}`;
    } catch {
      return `فرمانده ${Math.floor(Math.random() * 900 + 100)}`;
    }
  });
  const [publicLobbies, setPublicLobbies] = useState<PublicLobbyInfo[]>([]);
  const [currentLobby, setCurrentLobby] = useState<LobbyRoomData | null>(null);
  const [selfPlayerId, setSelfPlayerId] = useState<number>(1);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [showLobbyListModal, setShowLobbyListModal] = useState<boolean>(true);
  const [showCreateLobbyModal, setShowCreateLobbyModal] = useState<boolean>(false);
  const [lobbyChatMessages, setLobbyChatMessages] = useState<ChatMessage[]>([]);
  const [inGameChatMessages, setInGameChatMessages] = useState<ChatMessage[]>([]);
  const [socketId, setSocketId] = useState<string>('');

  const [resources, setResources] = useState<Resources>(INITIAL_RESOURCES);

  // Initial Offline 2-Player Setup (Player 1 vs AI Player 2)
  const defaultOffline = generateInitialWorld([1, 2], 300, false);
  const [buildings, setBuildings] = useState<BuildingInstance[]>(defaultOffline.initialBuildings);
  const [units, setUnits] = useState<UnitInstance[]>(defaultOffline.initialUnits);

  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [particles, setParticles] = useState<ParticleEffect[]>([]);
  const [pingMs, setPingMs] = useState<number | null>(null);

  // Ping Measurement Loop
  useEffect(() => {
    const socket = getSocket();
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping', () => {
          setPingMs(Date.now() - start);
        });
      } else {
        setPingMs(null);
      }
    }, 2000);
    return () => clearInterval(pingInterval);
  }, []);

  // Waves Management
  const [currentWaveIndex, setCurrentWaveIndex] = useState<number>(0);
  const [waveTimerSec, setWaveTimerSec] = useState<number>(WAVE_SCHEDULE[0].timeToStartSec);
  const [waveActive, setWaveActive] = useState<boolean>(false);

  // Selection & Construction State
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInstance | null>(null);
  const [activeBuildType, setActiveBuildType] = useState<BuildingType | null>(null);

  // Camera Position State
  const [cameraPos, setCameraPos] = useState<{ x: number; z: number }>({ x: 13.5, z: 65.5 });

  // Game Stats
  const [stats, setStats] = useState<GameStats>({
    enemiesKilled: 0,
    buildingsConstructed: 1,
    unitsRecruited: 3,
    timeSurvivedSec: 0,
  });

  // State synchronization & deterministic hash checks
  const [checksumHex, setChecksumHex] = useState<string>('');
  const [isDesyncRecovering, setIsDesyncRecovering] = useState<boolean>(false);
  const lastSyncChecksumRef = useRef<number>(0);
  const desyncCountRef = useRef<number>(0);
  const lastSyncRequestTimeRef = useRef<number>(0);

  const lastTimeRef = useRef<number>(performance.now());
  const resourceTimerRef = useRef<number>(0);
  const syncTimerRef = useRef<number>(0);
  const buildingDamageQueueRef = useRef<Record<string, number>>({});
  const buildingsRef = useRef<BuildingInstance[]>(buildings);
  buildingsRef.current = buildings;
  const unitsRef = useRef<UnitInstance[]>(units);
  unitsRef.current = units;
  const currentLobbyRef = useRef<LobbyRoomData | null>(currentLobby);
  currentLobbyRef.current = currentLobby;
  const isOnlineRef = useRef<boolean>(isOnline);
  isOnlineRef.current = isOnline;
  const selfPlayerIdRef = useRef<number>(selfPlayerId);
  selfPlayerIdRef.current = selfPlayerId;

  // Auto-open right Photoshop inspector when selecting building or unit
  useEffect(() => {
    if (selectedBuilding || selectedUnitIds.size > 0) {
      setIsRightInspectorOpen(true);
    }
  }, [selectedBuilding, selectedUnitIds]);

  // Socket Connection & Real-Time Listeners Setup
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      setSocketId(socket.id || '');
      socket.emit('lobby:refresh');
    });

    socket.emit('lobby:refresh');

    socket.on('lobby:list', (list: PublicLobbyInfo[]) => {
      setPublicLobbies(list);
    });

    socket.on('lobby:joined', (data: { lobby: LobbyRoomData; selfPlayerId: number }) => {
      setCurrentLobby(data.lobby);
      setSelfPlayerId(data.selfPlayerId);
      setShowLobbyListModal(false);
      setShowCreateLobbyModal(false);
      setLobbyChatMessages([]);
    });

    socket.on('lobby:updated', (lobby: LobbyRoomData) => {
      setCurrentLobby(lobby);
      const myP = lobby.players.find((p) => p.id === socket.id);
      if (myP) {
        setSelfPlayerId(myP.playerId);
      }
    });

    socket.on('lobby:slot_changed', (data: { newSlot: number }) => {
      setSelfPlayerId(data.newSlot);
    });

    socket.on('lobby:chat_message', (msg: ChatMessage) => {
      setLobbyChatMessages((prev) => [...prev, msg]);
    });

    // START ONLINE GAME MATCH
    socket.on('game:start', (data: { lobby: LobbyRoomData }) => {
      const lobby = data.lobby;
      const mySlot = lobby.players.find((p) => p.id === socket.id)?.playerId || 1;

      setSelfPlayerId(mySlot);
      selfPlayerIdRef.current = mySlot;
      setIsOnline(true);
      isOnlineRef.current = true;
      setCurrentLobby(lobby);
      currentLobbyRef.current = lobby;

      // Generate initial map based on active player slots in lobby
      const activeSlots = lobby.players.map((p) => p.playerId);
      const world = generateInitialWorld(activeSlots, lobby.startingGold, true, mySlot);
      setResources(world.initialRes);
      setBuildings(world.initialBuildings);
      setUnits(world.initialUnits);

      // Set camera to player's castle slot position
      const pCfg = PLAYERS_CONFIG[mySlot] || PLAYERS_CONFIG[1];
      setCameraPos({ x: pCfg.keepGridX + 1.5, z: pCfg.keepGridZ + 1.5 });

      setProjectiles([]);
      setParticles([]);
      setSelectedUnitIds(new Set());
      setSelectedBuilding(null);
      setActiveBuildType(null);
      setGameMode('playing');
      setGameSpeed(1);
      setInGameChatMessages([]);
      setShowLobbyListModal(false);
      setShowCreateLobbyModal(false);
    });

    // REJOIN ONGOING ONLINE GAME MATCH
    socket.on('game:rejoined', (data: { lobby: LobbyRoomData; selfPlayerId: number; isHost: boolean }) => {
      const lobby = data.lobby;
      const mySlot = data.selfPlayerId || 1;

      setSelfPlayerId(mySlot);
      selfPlayerIdRef.current = mySlot;
      setIsOnline(true);
      isOnlineRef.current = true;
      setCurrentLobby(lobby);
      currentLobbyRef.current = lobby;

      // Ask host/peers to broadcast full fresh world state immediately
      socket.emit('game:request_sync', { lobbyId: lobby.id });

      const pCfg = PLAYERS_CONFIG[mySlot] || PLAYERS_CONFIG[1];
      setCameraPos({ x: pCfg.keepGridX + 1.5, z: pCfg.keepGridZ + 1.5 });

      setGameMode('playing');
      setGameSpeed(1);
      setShowLobbyListModal(false);
      setShowCreateLobbyModal(false);
    });

    socket.on('lobby:rejoin_failed', (data: { error: string }) => {
      alert(data.error || 'خطا در اتصال مجدد به لابی');
    });

    // Remote Real-Time Action Listeners
    socket.on('game:command', (command: { unitIds: string[]; targetX: number; targetZ: number; targetEntityId?: string; playerId: number }) => {
      setUnits((prevUnits) =>
        prevUnits.map((u) => {
          if (command.unitIds.includes(u.id)) {
            return {
              ...u,
              targetX: command.targetX,
              targetZ: command.targetZ,
              targetEntityId: command.targetEntityId,
              userMoveCommand: true,
              state: 'moving',
            };
          }
          return u;
        })
      );
    });

    socket.on('game:train_unit', (action: { id?: string; type: UnitType; playerId: number; spawnX?: number; spawnZ?: number }) => {
      const pId = action.playerId;
      const uId = action.id || `unit_${pId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      setUnits((prev) => {
        if (prev.some((u) => u.id === uId)) return prev;
        const barracksB = buildingsRef.current.find((b) => getBuildingPlayerId(b) === pId && b.type === 'barracks') || buildingsRef.current.find((b) => getBuildingPlayerId(b) === pId);
        const pCfg = PLAYERS_CONFIG[pId] || PLAYERS_CONFIG[1];
        const centerX = barracksB ? barracksB.gridX + 1.5 : pCfg.keepGridX + 1.5;
        const centerZ = barracksB ? barracksB.gridZ + 1.5 : pCfg.keepGridZ + 1.5;

        const totalPlayerUnits = prev.filter((u) => getUnitPlayerId(u) === pId).length;
        const radius = 2.4 + Math.floor(totalPlayerUnits / 10) * 0.4;
        const angle = (totalPlayerUnits * 0.62) % (Math.PI * 2);

        const spawnX = action.spawnX ?? Math.max(1, Math.min(MAP_SIZE - 2, centerX + Math.cos(angle) * radius));
        const spawnZ = action.spawnZ ?? Math.max(1, Math.min(MAP_SIZE - 2, centerZ + Math.sin(angle) * radius));

        const isEnemy = pId !== selfPlayerIdRef.current;
        const newUnit: UnitInstance = {
          id: uId,
          type: action.type,
          isEnemy,
          playerId: pId,
          x: spawnX,
          z: spawnZ,
          hp: UNITS_CONFIG[action.type]?.hp || 100,
          maxHp: UNITS_CONFIG[action.type]?.maxHp || 100,
          state: 'idle',
          lastAttackTime: 0,
          rotation: angle + Math.PI / 2,
          createdAt: Date.now(),
        };

        return [...prev, newUnit];
      });
    });

    socket.on('game:place_building', (action: { id?: string; type: BuildingType; gridX: number; gridZ: number; playerId: number }) => {
      const bConfig = BUILDINGS_CONFIG[action.type];
      const bId = action.id || `b_${action.playerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      setBuildings((prev) => {
        if (prev.some((b) => b.id === bId || (b.gridX === action.gridX && b.gridZ === action.gridZ))) return prev;
        const newB: BuildingInstance = {
          id: bId,
          type: action.type,
          gridX: action.gridX,
          gridZ: action.gridZ,
          hp: bConfig.hp,
          maxHp: bConfig.maxHp,
          isEnemy: action.playerId !== selfPlayerIdRef.current,
          playerId: action.playerId,
          isConstructed: true,
          constructProgress: 1,
          createdAt: Date.now(),
        };

        soundManager.playBuildSound();
        return [...prev, newB];
      });
    });

    socket.on('game:repair_building', (action: { buildingId: string; playerId: number }) => {
      setBuildings((prev) =>
        prev.map((item) => (item.id === action.buildingId ? { ...item, repairing: true } : item))
      );
    });

    socket.on(
      'game:sync_state',
      (remoteState: {
        checksum?: number;
        tick?: number;
        isFullSync?: boolean;
        units: UnitInstance[];
        buildings: BuildingInstance[];
      }) => {
        const sock = getSocket();
        const isHost = currentLobbyRef.current?.players.find((p) => p.id === sock.id)?.isHost;
        if (isHost) return; // Host is master simulation referee, ignore broadcast echo

        // If host sent an authoritative forced full sync (reconnection or desync resolution)
        if (remoteState.isFullSync) {
          if (remoteState.buildings) {
            setBuildings(
              remoteState.buildings.map((rb) => {
                const bPid = rb.playerId ?? 1;
                const bCfg = BUILDINGS_CONFIG[rb.type || 'keep'] || BUILDINGS_CONFIG.keep;
                return {
                  id: rb.id,
                  type: rb.type || 'keep',
                  gridX: rb.gridX,
                  gridZ: rb.gridZ,
                  hp: rb.hp,
                  maxHp: rb.maxHp || bCfg.maxHp,
                  isEnemy: bPid !== selfPlayerIdRef.current,
                  playerId: bPid,
                  isConstructed: rb.isConstructed ?? true,
                  constructProgress: rb.constructProgress ?? 1,
                  repairing: rb.repairing ?? false,
                  createdAt: Date.now(),
                };
              })
            );
          }

          if (remoteState.units) {
            setUnits(
              remoteState.units.map((ru) => {
                const uPid = ru.playerId ?? 1;
                const uCfg = UNITS_CONFIG[ru.type || 'swordsman'] || UNITS_CONFIG.swordsman;
                return {
                  id: ru.id,
                  type: ru.type || 'swordsman',
                  isEnemy: uPid !== selfPlayerIdRef.current,
                  playerId: uPid,
                  x: ru.x,
                  z: ru.z,
                  hp: ru.hp,
                  maxHp: ru.maxHp || uCfg.maxHp,
                  state: ru.state || 'idle',
                  lastAttackTime: 0,
                  rotation: ru.rotation || 0,
                  targetX: ru.targetX,
                  targetZ: ru.targetZ,
                  targetEntityId: ru.targetEntityId,
                  userMoveCommand: ru.userMoveCommand,
                  createdAt: Date.now(),
                };
              })
            );
          }

          if (remoteState.checksum !== undefined) {
            lastSyncChecksumRef.current = remoteState.checksum;
            setChecksumHex(formatChecksum(remoteState.checksum));
          }
          desyncCountRef.current = 0;
          setIsDesyncRecovering(false);
          return;
        }

        // Standard Continuous Sync with Deterministic Checksum Verification
        let nextBuildings: BuildingInstance[] = [];
        if (remoteState.buildings) {
          setBuildings((localB) => {
            const remoteBMap = new Map(remoteState.buildings.map((b) => [b.id, b]));
            const remoteBGridMap = new Map(remoteState.buildings.map((b) => [`${b.gridX}_${b.gridZ}`, b]));

            const updatedB = localB
              .filter((lb) => {
                if (remoteBMap.has(lb.id) || remoteBGridMap.has(`${lb.gridX}_${lb.gridZ}`)) return true;
                return Date.now() - (lb.createdAt || 0) < 3000;
              })
              .map((lb) => {
                const rb = remoteBMap.get(lb.id) || remoteBGridMap.get(`${lb.gridX}_${lb.gridZ}`);
                if (rb) {
                  const wasAlive = lb.hp > 0;
                  if (wasAlive && rb.hp <= 0) {
                    soundManager.playBuildingDestroyed();
                  }
                  const bPid = rb.playerId ?? lb.playerId ?? 1;
                  return {
                    ...lb,
                    id: rb.id,
                    type: rb.type || lb.type,
                    hp: rb.hp,
                    maxHp: rb.maxHp || lb.maxHp,
                    isEnemy: bPid !== selfPlayerIdRef.current,
                    playerId: bPid,
                    isConstructed: rb.isConstructed ?? lb.isConstructed,
                    constructProgress: rb.constructProgress ?? lb.constructProgress,
                    repairing: rb.repairing ?? lb.repairing,
                  };
                }
                return lb;
              });

            const existingIds = new Set(updatedB.map((b) => b.id));
            const existingGrids = new Set(updatedB.map((b) => `${b.gridX}_${b.gridZ}`));

            remoteState.buildings.forEach((rb) => {
              if (!existingIds.has(rb.id) && !existingGrids.has(`${rb.gridX}_${rb.gridZ}`) && rb.hp > 0) {
                const bCfg = BUILDINGS_CONFIG[rb.type || 'keep'] || BUILDINGS_CONFIG.keep;
                const bPid = rb.playerId ?? 1;
                updatedB.push({
                  id: rb.id,
                  type: rb.type || 'keep',
                  gridX: rb.gridX,
                  gridZ: rb.gridZ,
                  hp: rb.hp,
                  maxHp: rb.maxHp || bCfg.maxHp,
                  isEnemy: bPid !== selfPlayerIdRef.current,
                  playerId: bPid,
                  isConstructed: rb.isConstructed ?? true,
                  constructProgress: rb.constructProgress ?? 1,
                  repairing: rb.repairing ?? false,
                  createdAt: Date.now(),
                });
              }
            });

            nextBuildings = updatedB.filter((b) => b.hp > 0);
            return nextBuildings;
          });
        }

        if (remoteState.units) {
          setUnits((localUnits) => {
            const remoteUnitMap = new Map(remoteState.units.map((u) => [u.id, u]));

            const updatedUnits = localUnits
              .filter((lu) => {
                const ru = remoteUnitMap.get(lu.id);
                if (ru && ru.hp <= 0) return false;
                if (remoteUnitMap.has(lu.id)) return true;
                return Date.now() - (lu.createdAt || 0) < 3000;
              })
              .map((lu) => {
                const ru = remoteUnitMap.get(lu.id);
                if (ru) {
                  const dist = Math.hypot(lu.x - ru.x, lu.z - ru.z);
                  const lerpX = dist > 2.0 ? ru.x : lu.x * 0.35 + ru.x * 0.65;
                  const lerpZ = dist > 2.0 ? ru.z : lu.z * 0.35 + ru.z * 0.65;
                  const uPid = ru.playerId ?? lu.playerId ?? 1;
                  return {
                    ...lu,
                    x: lerpX,
                    z: lerpZ,
                    hp: ru.hp,
                    maxHp: ru.maxHp || lu.maxHp,
                    isEnemy: uPid !== selfPlayerIdRef.current,
                    playerId: uPid,
                    state: ru.state || lu.state,
                    rotation: ru.rotation ?? lu.rotation,
                    targetX: ru.targetX,
                    targetZ: ru.targetZ,
                    targetEntityId: ru.targetEntityId,
                    userMoveCommand: ru.userMoveCommand ?? lu.userMoveCommand,
                  };
                }
                return lu;
              });

            const existingUnitIds = new Set(updatedUnits.map((u) => u.id));
            remoteState.units.forEach((ru) => {
              if (!existingUnitIds.has(ru.id) && ru.hp > 0) {
                const uCfg = UNITS_CONFIG[ru.type || 'swordsman'] || UNITS_CONFIG.swordsman;
                const uPid = ru.playerId ?? 1;
                updatedUnits.push({
                  id: ru.id,
                  type: ru.type || 'swordsman',
                  isEnemy: uPid !== selfPlayerIdRef.current,
                  playerId: uPid,
                  x: ru.x,
                  z: ru.z,
                  hp: ru.hp,
                  maxHp: ru.maxHp || uCfg.maxHp,
                  state: ru.state || 'idle',
                  lastAttackTime: 0,
                  rotation: ru.rotation || 0,
                  targetX: ru.targetX,
                  targetZ: ru.targetZ,
                  targetEntityId: ru.targetEntityId,
                  createdAt: Date.now(),
                });
              }
            });

            const nextLivingUnits = updatedUnits.filter((u) => u.hp > 0);
            return nextLivingUnits;
          });
        }
      }
    );

    // Projectile Synchronization across online players
    socket.on('game:projectile', (proj: Projectile) => {
      setProjectiles((prev) => {
        if (prev.some((p) => p.id === proj.id)) return prev;
        return [...prev, proj];
      });

      if (proj.type === 'mortar' || proj.type === 'cannon' || proj.type === 'rpg') {
        soundManager.playExplosion();
      } else {
        soundManager.playBowShot();
      }
    });

    // Reconnection / Sync state recovery with deterministic hash
    socket.on('game:request_sync', () => {
      const sock = getSocket();
      const isHost = currentLobbyRef.current?.players.find((p) => p.id === sock.id)?.isHost;
      if (isHost && currentLobbyRef.current) {
        const aliveU = unitsRef.current.filter((u) => u.hp > 0);
        const aliveB = buildingsRef.current.filter((b) => b.hp > 0);
        const checksum = computeWorldChecksum(aliveU, aliveB);

        sock.emit('game:sync_state', {
          lobbyId: currentLobbyRef.current.id,
          state: {
            isFullSync: true,
            checksum,
            tick: Date.now(),
            units: aliveU.map((u) => ({
              id: u.id,
              type: u.type,
              x: Math.round(u.x * 100) / 100,
              z: Math.round(u.z * 100) / 100,
              hp: Math.round(u.hp),
              maxHp: u.maxHp,
              state: u.state,
              playerId: u.playerId,
              isEnemy: u.isEnemy,
              targetX: u.targetX !== undefined ? Math.round(u.targetX * 100) / 100 : undefined,
              targetZ: u.targetZ !== undefined ? Math.round(u.targetZ * 100) / 100 : undefined,
              targetEntityId: u.targetEntityId,
              userMoveCommand: u.userMoveCommand,
              rotation: Math.round(u.rotation * 100) / 100,
            })),
            buildings: aliveB.map((b) => ({
              id: b.id,
              type: b.type,
              gridX: b.gridX,
              gridZ: b.gridZ,
              hp: Math.round(b.hp),
              maxHp: b.maxHp,
              playerId: b.playerId,
              isEnemy: b.isEnemy,
              isConstructed: b.isConstructed,
              constructProgress: b.constructProgress,
              repairing: b.repairing,
            })),
          },
        });
      }
    });

    // Handle Player Defeat
    socket.on('game:player_defeat', (data: { defeatedPlayerId: number; defeatedName: string }) => {
      setInGameChatMessages((prev) => [
        ...prev,
        {
          sender: 'سیستم تاکتیکال',
          message: `قلعه فرمانده ${data.defeatedName} با خاک یکسان شد!`,
          playerId: 0,
          time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    });

    // Handle Player Left Match
    socket.on('game:player_left', (data: { playerId: number; name: string; isHost: boolean }) => {
      setInGameChatMessages((prev) => [
        ...prev,
        {
          sender: 'سیستم تاکتیکال',
          message: `فرمانده ${data.name} از میدان نبرد عقب‌نشینی کرد.`,
          playerId: 0,
          time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    });

    // Host Migration when host disconnects
    socket.on('game:host_migrated', (data: { newHostId: string; newHostPlayerId: number; newHostName: string }) => {
      const isMe = data.newHostId === getSocket().id;
      setInGameChatMessages((prev) => [
        ...prev,
        {
          sender: 'سیستم تاکتیکال',
          message: isMe
            ? '⚠️ شما اکنون میزبان اصلی نبرد شدید. شبیه‌سازی سرور به دستگاه شما منتقل شد.'
            : `سرور بازی به فرمانده ${data.newHostName} منتقل شد.`,
          playerId: 0,
          time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    });

    // Automatic re-sync on socket reconnection
    const handleConnect = () => {
      if (isOnlineRef.current && currentLobbyRef.current) {
        socket.emit('game:request_sync', { lobbyId: currentLobbyRef.current.id });
      }
    };
    socket.on('connect', handleConnect);

    socket.on('game:chat_message', (msg: ChatMessage) => {
      setInGameChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby:list');
      socket.off('lobby:joined');
      socket.off('lobby:updated');
      socket.off('lobby:slot_changed');
      socket.off('lobby:chat_message');
      socket.off('game:start');
      socket.off('game:command');
      socket.off('game:train_unit');
      socket.off('game:place_building');
      socket.off('game:repair_building');
      socket.off('game:sync_state');
      socket.off('game:projectile');
      socket.off('game:request_sync');
      socket.off('game:player_defeat');
      socket.off('game:player_left');
      socket.off('game:host_migrated');
      socket.off('game:rejoined');
      socket.off('lobby:rejoin_failed');
      socket.off('game:chat_message');
    };
  }, []);

  // Reset / Restart Game
  const handleRestartGame = () => {
    setIsOnline(false);
    setCurrentLobby(null);
    setSelfPlayerId(1);

    const world = generateInitialWorld([1, 2], 300, false);
    setResources(world.initialRes);
    setBuildings(world.initialBuildings);
    setUnits(world.initialUnits);
    setProjectiles([]);
    setParticles([]);
    setCurrentWaveIndex(0);
    setWaveTimerSec(WAVE_SCHEDULE[0].timeToStartSec);
    setWaveActive(false);
    setSelectedUnitIds(new Set());
    setSelectedBuilding(null);
    setActiveBuildType(null);
    setCameraPos({ x: 13.5, z: 65.5 });
    setGameMode('playing');
    setGameSpeed(1);
    setStats({
      enemiesKilled: 0,
      buildingsConstructed: 1,
      unitsRecruited: 3,
      timeSurvivedSec: 0,
    });
  };

  const handleLeaveOnlineGame = () => {
    if (isOnline && currentLobby) {
      getSocket().emit('lobby:leave');
    }
    handleRestartGame();
  };

  // --- Wave Spawning Engine (Spawns attackers from all active AI bases in offline mode) ---
  const spawnWaveEnemies = (waveIdx: number) => {
    const wave = WAVE_SCHEDULE[waveIdx];
    if (!wave) return;

    soundManager.playWaveHorn();

    const newEnemies: UnitInstance[] = [];
    const activeAiKeeps = buildingsRef.current.filter(
      (b) => b.type === 'keep' && (b.playerId ? b.playerId !== selfPlayerId : b.isEnemy) && b.hp > 0
    );

    activeAiKeeps.forEach((keepB) => {
      const pId = keepB.playerId || 2;
      const spawnX = keepB.gridX + 1.5;
      const spawnZ = keepB.gridZ + 1.5;

      const targetKeep = buildingsRef.current.find((b) => b.playerId === selfPlayerId && b.type === 'keep');
      const targetX = targetKeep ? targetKeep.gridX + 1.5 : 13.5;
      const targetZ = targetKeep ? targetKeep.gridZ + 1.5 : 65.5;

      for (let i = 0; i < wave.grunts; i++) {
        newEnemies.push({
          id: `e_g_${pId}_${waveIdx}_${i}_${Date.now()}_${Math.random()}`,
          type: 'enemy_grunt',
          isEnemy: true,
          playerId: pId,
          x: spawnX + (Math.random() * 3 - 1.5),
          z: spawnZ + (Math.random() * 3 - 1.5),
          targetX,
          targetZ,
          hp: UNITS_CONFIG.enemy_grunt.hp,
          maxHp: UNITS_CONFIG.enemy_grunt.maxHp,
          state: 'moving',
          lastAttackTime: 0,
          rotation: 0,
        });
      }

      for (let i = 0; i < wave.archers; i++) {
        newEnemies.push({
          id: `e_a_${pId}_${waveIdx}_${i}_${Date.now()}_${Math.random()}`,
          type: 'enemy_archer',
          isEnemy: true,
          playerId: pId,
          x: spawnX + (Math.random() * 3 - 1.5),
          z: spawnZ + (Math.random() * 3 - 1.5),
          targetX,
          targetZ,
          hp: UNITS_CONFIG.enemy_archer.hp,
          maxHp: UNITS_CONFIG.enemy_archer.maxHp,
          state: 'moving',
          lastAttackTime: 0,
          rotation: 0,
        });
      }

      for (let i = 0; i < wave.bosses; i++) {
        newEnemies.push({
          id: `e_b_${pId}_${waveIdx}_${i}_${Date.now()}_${Math.random()}`,
          type: 'enemy_boss',
          isEnemy: true,
          playerId: pId,
          x: spawnX + (Math.random() * 2 - 1),
          z: spawnZ + (Math.random() * 2 - 1),
          targetX,
          targetZ,
          hp: UNITS_CONFIG.enemy_boss.hp,
          maxHp: UNITS_CONFIG.enemy_boss.maxHp,
          state: 'moving',
          lastAttackTime: 0,
          rotation: 0,
        });
      }
    });

    setUnits((prev) => [...prev, ...newEnemies]);
    setWaveActive(true);
  };

  // --- Main Tick Engine ---
  useEffect(() => {
    if (gameMode !== 'playing' || gameSpeed === 0) return;

    const interval = setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(0.1, (now - lastTimeRef.current) / 1000) * gameSpeed;
      lastTimeRef.current = now;

      // Update Time Survived Stats
      setStats((prev) => ({ ...prev, timeSurvivedSec: prev.timeSurvivedSec + dtSec }));

      // Optimized High-Precision Host State Broadcast (20 Hz / 50ms) in Online Mode
      const isMasterHost = !isOnlineRef.current || Boolean(currentLobbyRef.current?.players.find((p) => p.id === getSocket().id)?.isHost);

      if (isOnlineRef.current && currentLobbyRef.current && isMasterHost) {
        const socket = getSocket();
        syncTimerRef.current += dtSec;
        if (syncTimerRef.current >= 0.05) {
          syncTimerRef.current = 0;
          const aliveU = unitsRef.current.filter((u) => u.hp > 0);
          const aliveB = buildingsRef.current.filter((b) => b.hp > 0);
          const worldChecksum = computeWorldChecksum(aliveU, aliveB);
          lastSyncChecksumRef.current = worldChecksum;
          setChecksumHex(formatChecksum(worldChecksum));

          socket.emit('game:sync_state', {
            lobbyId: currentLobbyRef.current.id,
            state: {
              checksum: worldChecksum,
              tick: Math.floor(now),
              units: aliveU.map((u) => ({
                id: u.id,
                type: u.type,
                x: Math.round(u.x * 100) / 100,
                z: Math.round(u.z * 100) / 100,
                hp: Math.round(u.hp),
                maxHp: u.maxHp,
                state: u.state,
                playerId: u.playerId,
                isEnemy: u.isEnemy,
                targetX: u.targetX !== undefined ? Math.round(u.targetX * 100) / 100 : undefined,
                targetZ: u.targetZ !== undefined ? Math.round(u.targetZ * 100) / 100 : undefined,
                targetEntityId: u.targetEntityId,
                userMoveCommand: u.userMoveCommand,
                rotation: Math.round(u.rotation * 100) / 100,
              })),
              buildings: aliveB.map((b) => ({
                id: b.id,
                type: b.type,
                gridX: b.gridX,
                gridZ: b.gridZ,
                hp: Math.round(b.hp),
                maxHp: b.maxHp,
                playerId: b.playerId,
                isEnemy: b.isEnemy,
                isConstructed: b.isConstructed,
                constructProgress: b.constructProgress,
                repairing: b.repairing,
              })),
            },
          });
        }
      }

      // 1. Wave Countdown Timer (Offline Mode)
      if (!isOnlineRef.current) {
        setWaveTimerSec((prevTimer) => {
          if (prevTimer <= dtSec) {
            if (!waveActive) {
              spawnWaveEnemies(currentWaveIndex);
            }
            return 0;
          }
          return prevTimer - dtSec;
        });

        // Check Wave Completion
        setUnits((prevUnits) => {
          const enemiesAlive = prevUnits.filter((u) => u.isEnemy && u.hp > 0).length;
          if (waveActive && enemiesAlive === 0) {
            setWaveActive(false);
            if (currentWaveIndex + 1 < WAVE_SCHEDULE.length) {
              const nextIdx = currentWaveIndex + 1;
              setCurrentWaveIndex(nextIdx);
              setWaveTimerSec(WAVE_SCHEDULE[nextIdx].timeToStartSec);
            } else {
              setGameMode('victory');
              soundManager.playVictory();
            }
          }
          return prevUnits;
        });
      }

      // 2. Resource Tick Every 5 Seconds
      resourceTimerRef.current += dtSec;
      if (resourceTimerRef.current >= 5) {
        resourceTimerRef.current = 0;

        setBuildings((currentBuildings) => {
          let goldInc = 0;
          let woodInc = 0;
          let stoneInc = 0;
          let foodInc = 0;

          currentBuildings.forEach((b) => {
            const bPid = getBuildingPlayerId(b);
            if (bPid === selfPlayerId && b.isConstructed) {
              const prod = BUILDINGS_CONFIG[b.type].resourceProduction;
              if (prod) {
                if (prod.gold) goldInc += prod.gold;
                if (prod.wood) woodInc += prod.wood;
                if (prod.stone) stoneInc += prod.stone;
                if (prod.food) foodInc += prod.food;
              }
            }
          });

          if (goldInc > 0 || woodInc > 0 || stoneInc > 0 || foodInc > 0) {
            setResources((res) => ({
              ...res,
              gold: res.gold + goldInc,
              wood: res.wood + woodInc,
              stone: res.stone + stoneInc,
              food: res.food + foodInc,
            }));
          }

          return currentBuildings;
        });
      }

      // Guest clients in multiplayer: do not run local conflicting AI/simulation, only smooth projectiles & status
      if (!isMasterHost) {
        setProjectiles((currentProjs) => {
          return currentProjs
            .map((p) => {
              const dist = distance2D(p.startX, p.startZ, p.targetX, p.targetZ);
              const nextProg = p.progress + (p.speed * dtSec) / (dist || 1);
              return { ...p, progress: nextProg };
            })
            .filter((p) => p.progress < 1);
        });

        // Guest Keep Survival Evaluation
        const curB = buildingsRef.current;
        const myKeep = curB.find((b) => b.type === 'keep' && getBuildingPlayerId(b) === selfPlayerId);
        const enemyKeeps = curB.filter((b) => b.type === 'keep' && getBuildingPlayerId(b) !== selfPlayerId && b.hp > 0);

        if (myKeep && myKeep.hp <= 0) {
          setGameMode('gameover');
          soundManager.playDefeat();
          if (isOnlineRef.current && currentLobbyRef.current) {
            const me = currentLobbyRef.current.players.find((p) => p.id === getSocket().id);
            getSocket().emit('game:player_defeat', {
              lobbyId: currentLobbyRef.current.id,
              defeatedPlayerId: selfPlayerIdRef.current,
              defeatedName: me?.name || `فرمانده ${selfPlayerIdRef.current}`,
            });
          }
        } else if (enemyKeeps.length === 0 && curB.some((b) => b.type === 'keep' && getBuildingPlayerId(b) !== selfPlayerId)) {
          setGameMode('victory');
          soundManager.playVictory();
        }
        return;
      }

      // 3. Obstacle Grid for Unit Pathfinding
      const obstacleGrid = createObstacleGrid(buildingsRef.current);

      // 4. Update Units AI, Movement & Combat
      setUnits((currentUnits) => {
        const nextUnits = currentUnits.map((u) => ({ ...u }));

        nextUnits.forEach((u) => {
          if (u.hp <= 0) {
            u.state = 'dead';
            return;
          }

          const uConfig = UNITS_CONFIG[u.type];
          const uPid = getUnitPlayerId(u);

          // Target resolution
          let targetEntity: { x: number; z: number; id: string; isBuilding?: boolean } | null = null;

          if (u.targetEntityId) {
            const enemyUnitTarget = nextUnits.find((e) => e.id === u.targetEntityId && e.hp > 0);
            if (enemyUnitTarget) {
              targetEntity = { x: enemyUnitTarget.x, z: enemyUnitTarget.z, id: enemyUnitTarget.id };
            } else {
              const enemyBuildingTarget = buildingsRef.current.find((b) => b.id === u.targetEntityId && b.hp > 0);
              if (enemyBuildingTarget) {
                const edgePt = getBuildingPerimeterPoint(u.x, u.z, enemyBuildingTarget);
                targetEntity = {
                  x: edgePt.x,
                  z: edgePt.z,
                  id: enemyBuildingTarget.id,
                  isBuilding: true,
                };
              } else {
                u.targetEntityId = undefined;
              }
            }
          }

          // Smart Aggro Range Scan if no explicit target
          if (!targetEntity) {
            if (u.userMoveCommand && u.targetX !== undefined && u.targetZ !== undefined) {
              let selfDefenseDist = uConfig.attackRange + 0.3;
              nextUnits.forEach((other) => {
                if (getUnitPlayerId(other) !== uPid && other.hp > 0) {
                  const d = distance2D(u.x, u.z, other.x, other.z);
                  if (d < selfDefenseDist) {
                    selfDefenseDist = d;
                    targetEntity = { x: other.x, z: other.z, id: other.id };
                  }
                }
              });
            } else {
              let closestDist = 8.5; // Vision / Aggro Radius
              nextUnits.forEach((other) => {
                if (getUnitPlayerId(other) !== uPid && other.hp > 0) {
                  const d = distance2D(u.x, u.z, other.x, other.z);
                  if (d < closestDist) {
                    closestDist = d;
                    targetEntity = { x: other.x, z: other.z, id: other.id };
                  }
                }
              });

              if (!targetEntity) {
                let closestBDist = 18.0;
                buildingsRef.current.forEach((b) => {
                  if (getBuildingPlayerId(b) !== uPid && b.hp > 0) {
                    const dToB = getDistanceToBuilding(u.x, u.z, b);
                    if (dToB < closestBDist) {
                      closestBDist = dToB;
                      const edgePt = getBuildingPerimeterPoint(u.x, u.z, b);
                      targetEntity = { x: edgePt.x, z: edgePt.z, id: b.id, isBuilding: true };
                    }
                  }
                });
              }
            }
          }

          // Execute Movement or Attack Action
          if (targetEntity) {
            let inRange = false;
            let targetCenterPos = { x: targetEntity.x, z: targetEntity.z };

            if (targetEntity.isBuilding) {
              const targetB = buildingsRef.current.find((b) => b.id === targetEntity!.id && b.hp > 0);
              if (targetB) {
                const distToB = getDistanceToBuilding(u.x, u.z, targetB);
                inRange = distToB <= uConfig.attackRange + 0.35;
                targetCenterPos = getBuildingCenter(targetB);
              }
            } else {
              const distToUnit = distance2D(u.x, u.z, targetEntity.x, targetEntity.z);
              inRange = distToUnit <= uConfig.attackRange;
            }

            if (inRange) {
              u.state = 'attacking';
              u.rotation = Math.atan2(targetCenterPos.z - u.z, targetCenterPos.x - u.x);

              const timeSinceLastAttack = now / 1000 - u.lastAttackTime;
              if (timeSinceLastAttack >= 1.0 / uConfig.attackSpeed) {
                u.lastAttackTime = now / 1000;

                const appliedDmg = targetEntity.isBuilding
                  ? uConfig.damageToBuildings
                  : uConfig.damageToUnits;

                if (uConfig.isRanged) {
                  let pType: 'arrow' | 'cannon' | 'mortar' | 'bullet' | 'rpg' | 'sniper' = 'bullet';
                  let pSpeed = 42.0;
                  let pArc = 0.02;

                  if (u.type === 'artillery_tank' || u.type === 'knight') {
                    pType = 'mortar';
                    pSpeed = 12.0;
                    pArc = 4.5;
                  } else if (u.type === 'tank') {
                    pType = 'cannon';
                    pSpeed = 30.0;
                    pArc = 0.25;
                  } else if (u.type === 'spearman') {
                    pType = 'rpg';
                    pSpeed = 24.0;
                    pArc = 0.15;
                  } else if (u.type === 'archer') {
                    pType = 'sniper';
                    pSpeed = 55.0;
                    pArc = 0.01;
                  }

                  if (u.type === 'artillery_tank' || u.type === 'knight' || u.type === 'tank' || u.type === 'spearman') {
                    soundManager.playExplosion();
                  } else {
                    soundManager.playBowShot();
                  }

                  const newProj: Projectile = {
                    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    sourceUnitId: u.id,
                    sourcePlayerId: uPid,
                    startX: u.x,
                    startY: u.type === 'tank' || u.type === 'artillery_tank' ? 0.9 : 0.6,
                    startZ: u.z,
                    targetX: targetCenterPos.x,
                    targetY: 0.5,
                    targetZ: targetCenterPos.z,
                    targetUnitId: targetEntity!.isBuilding ? undefined : targetEntity!.id,
                    targetBuildingId: targetEntity!.isBuilding ? targetEntity!.id : undefined,
                    damage: appliedDmg,
                    speed: pSpeed,
                    progress: 0,
                    isEnemy: uPid !== selfPlayerIdRef.current,
                    type: pType,
                    arcHeight: pArc,
                  };

                  setProjectiles((projs) => [...projs, newProj]);

                  if (isOnlineRef.current && currentLobbyRef.current) {
                    getSocket().emit('game:projectile', {
                      lobbyId: currentLobbyRef.current.id,
                      projectile: newProj,
                    });
                  }
                } else {
                  soundManager.playSwordHit();

                  if (targetEntity.isBuilding) {
                    buildingDamageQueueRef.current[targetEntity.id] =
                      (buildingDamageQueueRef.current[targetEntity.id] || 0) + appliedDmg;
                  } else {
                    const victim = nextUnits.find((v) => v.id === targetEntity!.id);
                    if (victim) {
                      victim.hp -= appliedDmg;
                      // Unit Self-Defense Retaliation
                      if (victim.hp > 0 && !victim.targetEntityId && !victim.userMoveCommand) {
                        victim.targetEntityId = u.id;
                      }
                      if (victim.hp <= 0 && uPid === selfPlayerIdRef.current) {
                        setStats((s) => ({ ...s, enemiesKilled: s.enemiesKilled + 1 }));
                      }
                    }
                  }
                }
              }
            } else {
              u.state = 'moving';
              const nextPos = calculateNextPosition(
                u.x,
                u.z,
                targetEntity.x,
                targetEntity.z,
                uConfig.moveSpeed,
                dtSec,
                obstacleGrid
              );
              u.x = nextPos.x;
              u.z = nextPos.z;
              u.rotation = nextPos.angle;
            }
          } else if (u.targetX !== undefined && u.targetZ !== undefined) {
            u.state = 'moving';
            const nextPos = calculateNextPosition(
              u.x,
              u.z,
              u.targetX,
              u.targetZ,
              uConfig.moveSpeed,
              dtSec,
              obstacleGrid
            );
            u.x = nextPos.x;
            u.z = nextPos.z;
            u.rotation = nextPos.angle;

            if (nextPos.arrived) {
              u.state = 'idle';
              u.targetX = undefined;
              u.targetZ = undefined;
              u.userMoveCommand = false;
            }
          } else {
            u.state = 'idle';
          }
        });

        // Soft unit-to-unit separation
        for (let i = 0; i < nextUnits.length; i++) {
          for (let j = i + 1; j < nextUnits.length; j++) {
            const u1 = nextUnits[i];
            const u2 = nextUnits[j];
            if (u1.hp > 0 && u2.hp > 0) {
              const d = distance2D(u1.x, u1.z, u2.x, u2.z);
              const minDist = 0.55;
              if (d < minDist && d > 0.01) {
                const overlap = (minDist - d) * 0.5;
                const pushX = ((u1.x - u2.x) / d) * overlap;
                const pushZ = ((u1.z - u2.z) / d) * overlap;
                u1.x += pushX;
                u1.z += pushZ;
                u2.x -= pushX;
                u2.z -= pushZ;
              }
            }
          }
        }

        return nextUnits.filter((u) => u.hp > 0);
      });

      // 5. Update Projectiles
      setProjectiles((currentProjs) => {
        const remainingProjs: Projectile[] = [];

        currentProjs.forEach((p) => {
          const nextProg = p.progress + (p.speed * dtSec) / distance2D(p.startX, p.startZ, p.targetX, p.targetZ);

          if (nextProg >= 1) {
            const isMasterHost = !isOnlineRef.current || (currentLobbyRef.current && currentLobbyRef.current.players.find((p) => p.id === getSocket().id)?.isHost);
            if (isMasterHost) {
              if (p.targetUnitId) {
                setUnits((uList) =>
                  uList.map((u) => {
                    if (u.id === p.targetUnitId) {
                      const newHp = u.hp - p.damage;
                      if (newHp <= 0 && !p.isEnemy) {
                        setStats((s) => ({ ...s, enemiesKilled: s.enemiesKilled + 1 }));
                      }
                      const retaliateTargetId =
                        newHp > 0 && !u.targetEntityId && !u.userMoveCommand && p.sourceUnitId
                          ? p.sourceUnitId
                          : u.targetEntityId;
                      return { ...u, hp: newHp, targetEntityId: retaliateTargetId };
                    }
                    return u;
                  })
                );
              } else if (p.targetBuildingId) {
                buildingDamageQueueRef.current[p.targetBuildingId] =
                  (buildingDamageQueueRef.current[p.targetBuildingId] || 0) + p.damage;
              }
            }
          } else {
            remainingProjs.push({ ...p, progress: nextProg });
          }
        });

        return remainingProjs;
      });

      // 6. Watchtowers Auto-Attack Enemies in Range & Process Building Damage
      setBuildings((currentBuildings) => {
        const updatedB = currentBuildings.map((b) => ({ ...b }));

        updatedB.forEach((b) => {
          const bPid = getBuildingPlayerId(b);
          if (b.isConstructed && b.type === 'tower') {
            const towerConfig = BUILDINGS_CONFIG.tower;
            const nowSec = now / 1000;
            const lastAttack = b.lastAttackTime || 0;

            if (nowSec - lastAttack >= 1.4) {
              const bx = b.gridX + towerConfig.sizeX / 2;
              const bz = b.gridZ + towerConfig.sizeZ / 2;

              let closestEnemy: UnitInstance | null = null;
              let closestDist = towerConfig.attackRange || 7.5;

              unitsRef.current.forEach((u) => {
                if (getUnitPlayerId(u) !== bPid && u.hp > 0) {
                  const d = distance2D(bx, bz, u.x, u.z);
                  if (d < closestDist) {
                    closestDist = d;
                    closestEnemy = u;
                  }
                }
              });

              if (closestEnemy) {
                b.lastAttackTime = nowSec;

                soundManager.playBowShot();
                const newTowerProj: Projectile = {
                  id: `tower_proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  sourcePlayerId: bPid,
                  startX: bx,
                  startY: 2.5,
                  startZ: bz,
                  targetX: closestEnemy.x,
                  targetY: 0.5,
                  targetZ: closestEnemy.z,
                  targetUnitId: closestEnemy.id,
                  damage: towerConfig.attackDamage || 24,
                  speed: 38.0,
                  progress: 0,
                  isEnemy: bPid !== selfPlayerIdRef.current,
                  type: 'bullet',
                  arcHeight: 0.02,
                };

                setProjectiles((projs) => [...projs, newTowerProj]);

                if (isOnlineRef.current && currentLobbyRef.current) {
                  getSocket().emit('game:projectile', {
                    lobbyId: currentLobbyRef.current.id,
                    projectile: newTowerProj,
                  });
                }
              }
            }
          }
        });

        const pendingDamage = { ...buildingDamageQueueRef.current };
        buildingDamageQueueRef.current = {};
        const isMasterHost = !isOnlineRef.current || (currentLobbyRef.current && currentLobbyRef.current.players.find((p) => p.id === getSocket().id)?.isHost);

        const nextBList = updatedB.map((b) => {
          let currentHp = b.hp;
          let isRepairing = b.repairing;

          if (isRepairing) {
            const repairPerTick = b.maxHp / (20 * 30);
            currentHp = Math.min(b.maxHp, currentHp + repairPerTick);
            if (currentHp >= b.maxHp) {
              isRepairing = false;
            }
          }

          const dmg = isMasterHost ? (pendingDamage[b.id] || 0) : 0;
          if (dmg > 0) {
            const newHp = Math.max(0, currentHp - dmg);
            if (newHp <= 0 && currentHp > 0) {
              soundManager.playBuildingDestroyed();
              const bCenter = getBuildingCenter(b);
              setParticles((pts) => [
                ...pts,
                ...Array.from({ length: 14 }).map((_, i) => ({
                  id: `p_dest_${Date.now()}_${i}`,
                  x: bCenter.x + (Math.random() * 2 - 1),
                  y: 0.5 + Math.random() * 1.5,
                  z: bCenter.z + (Math.random() * 2 - 1),
                  vx: (Math.random() - 0.5) * 4,
                  vy: Math.random() * 5 + 2,
                  vz: (Math.random() - 0.5) * 4,
                  color: PLAYERS_CONFIG[getBuildingPlayerId(b)]?.colorCss || '#ef4444',
                  lifeSec: 1.2,
                  maxLifeSec: 1.2,
                  size: 0.25,
                })),
              ]);
            }
            return { ...b, hp: newHp, repairing: isRepairing };
          }
          return { ...b, hp: currentHp, repairing: isRepairing };
        });

        let myKeepAlive = false;
        let otherKeepsCount = 0;

        const aliveBuildings = nextBList.filter((b) => {
          if (b.hp > 0) {
            const pId = getBuildingPlayerId(b);
            if (b.type === 'keep') {
              if (pId === selfPlayerId) myKeepAlive = true;
              else otherKeepsCount++;
            }
            return true;
          }
          return false;
        });

        const destroyedIds = new Set(nextBList.filter((b) => b.hp <= 0).map((b) => b.id));

        if (destroyedIds.size > 0) {
          setUnits((uList) =>
            uList.map((u) => {
              if (u.targetEntityId && destroyedIds.has(u.targetEntityId)) {
                return { ...u, targetEntityId: undefined, state: 'idle' };
              }
              return u;
            })
          );
        }

        if (!myKeepAlive && currentBuildings.some((b) => b.type === 'keep' && getBuildingPlayerId(b) === selfPlayerId)) {
          setGameMode('gameover');
          soundManager.playDefeat();
          if (isOnlineRef.current && currentLobbyRef.current) {
            const me = currentLobbyRef.current.players.find((p) => p.id === getSocket().id);
            getSocket().emit('game:player_defeat', {
              lobbyId: currentLobbyRef.current.id,
              defeatedPlayerId: selfPlayerIdRef.current,
              defeatedName: me?.name || `فرمانده ${selfPlayerIdRef.current}`,
            });
          }
        } else if (otherKeepsCount === 0 && currentBuildings.some((b) => b.type === 'keep' && getBuildingPlayerId(b) !== selfPlayerId)) {
          setGameMode('victory');
          soundManager.playVictory();
        }

        return aliveBuildings;
      });
    }, 1000 / 30);

    return () => clearInterval(interval);
  }, [gameMode, gameSpeed, waveActive, currentWaveIndex, selfPlayerId, isOnline, currentLobby]);

  // Handle Unit Command (Move or Attack)
  const handleCommandUnits = (targetX: number, targetZ: number, targetUnitId?: string) => {
    const controlledUnitIds = Array.from(selectedUnitIds).filter((id) => {
      const u = units.find((item) => item.id === id);
      return u && getUnitPlayerId(u) === selfPlayerId;
    });

    if (controlledUnitIds.length === 0) return;

    if (isOnline && currentLobby) {
      getSocket().emit('game:command', {
        lobbyId: currentLobby.id,
        command: {
          unitIds: controlledUnitIds,
          targetX,
          targetZ,
          targetEntityId: targetUnitId,
          playerId: selfPlayerId,
        },
      });
    }

    setUnits((prevUnits) =>
      prevUnits.map((u) => {
        if (controlledUnitIds.includes(u.id)) {
          return {
            ...u,
            targetX,
            targetZ,
            targetEntityId: targetUnitId,
            userMoveCommand: true,
            state: 'moving',
          };
        }
        return u;
      })
    );
  };

  // Handle Train Unit in Barracks
  const handleTrainUnit = (type: UnitType) => {
    const cost = UNITS_CONFIG[type].cost;
    if (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone &&
      resources.food >= (cost.food || 0) &&
      resources.population + 1 <= resources.maxPopulation
    ) {
      setResources((res) => ({
        ...res,
        gold: res.gold - cost.gold,
        wood: res.wood - cost.wood,
        stone: res.stone - cost.stone,
        food: res.food - (cost.food || 0),
        population: res.population + 1,
      }));

      const barracksB = buildings.find((b) => getBuildingPlayerId(b) === selfPlayerId && b.type === 'barracks') || buildings.find((b) => getBuildingPlayerId(b) === selfPlayerId);
      const pCfg = PLAYERS_CONFIG[selfPlayerId] || PLAYERS_CONFIG[1];
      const centerX = barracksB ? barracksB.gridX + 1.5 : pCfg.keepGridX + 1.5;
      const centerZ = barracksB ? barracksB.gridZ + 1.5 : pCfg.keepGridZ + 1.5;

      const totalPlayerUnits = units.filter((u) => getUnitPlayerId(u) === selfPlayerId).length;
      const radius = 2.4 + Math.floor(totalPlayerUnits / 10) * 0.4;
      const angle = (totalPlayerUnits * 0.62) % (Math.PI * 2);

      const spawnX = Math.max(1, Math.min(MAP_SIZE - 2, centerX + Math.cos(angle) * radius));
      const spawnZ = Math.max(1, Math.min(MAP_SIZE - 2, centerZ + Math.sin(angle) * radius));

      const newUnitId = `unit_${selfPlayerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      if (isOnline && currentLobby) {
        getSocket().emit('game:train_unit', {
          lobbyId: currentLobby.id,
          action: { id: newUnitId, type, playerId: selfPlayerId, spawnX, spawnZ },
        });
      }

      const newUnit: UnitInstance = {
        id: newUnitId,
        type,
        isEnemy: false,
        playerId: selfPlayerId,
        x: spawnX,
        z: spawnZ,
        hp: UNITS_CONFIG[type].hp,
        maxHp: UNITS_CONFIG[type].maxHp,
        state: 'idle',
        lastAttackTime: 0,
        rotation: angle + Math.PI / 2,
      };

      setUnits((prev) => [...prev, newUnit]);
      setStats((prev) => ({ ...prev, unitsRecruited: prev.unitsRecruited + 1 }));
      soundManager.playClick();
    }
  };

  // Handle Resource Trading
  const handleTradeResource = (action: 'buy' | 'sell', resource: 'wood' | 'stone' | 'food', amount: number = 50) => {
    if (action === 'sell') {
      if (resources[resource] >= amount) {
        setResources((prev) => ({
          ...prev,
          [resource]: prev[resource] - amount,
          gold: prev.gold + Math.floor(amount * 0.75),
        }));
        soundManager.playClick();
      }
    } else {
      const goldCost = amount * 1.2;
      if (resources.gold >= goldCost) {
        setResources((prev) => ({
          ...prev,
          gold: prev.gold - goldCost,
          [resource]: prev[resource] + amount,
        }));
        soundManager.playClick();
      }
    }
  };

  // Handle Repair Building
  const handleRepairBuilding = (buildingId: string) => {
    const b = buildings.find((item) => item.id === buildingId);
    if (!b || b.hp >= b.maxHp || b.repairing) return;

    const stoneCost = 30;
    const woodCost = 30;

    if (resources.stone >= stoneCost && resources.wood >= woodCost) {
      setResources((prev) => ({
        ...prev,
        stone: prev.stone - stoneCost,
        wood: prev.wood - woodCost,
      }));

      if (isOnline && currentLobby) {
        getSocket().emit('game:repair_building', {
          lobbyId: currentLobby.id,
          action: { buildingId, playerId: selfPlayerId },
        });
      }

      setBuildings((prev) =>
        prev.map((item) => (item.id === buildingId ? { ...item, repairing: true } : item))
      );
      soundManager.playBuildSound();
    }
  };

  // Check placement validity for building previews
  const checkPlacementValid = (type: BuildingType, gridX: number, gridZ: number) => {
    const bConfig = BUILDINGS_CONFIG[type];
    if (!bConfig) return false;
    if (gridX < 1 || gridZ < 1 || gridX + bConfig.sizeX > MAP_SIZE - 1 || gridZ + bConfig.sizeZ > MAP_SIZE - 1) {
      return false;
    }
    const isOccupied = buildings.some((b) => {
      const exCfg = BUILDINGS_CONFIG[b.type];
      const exSizeX = exCfg ? exCfg.sizeX : 2;
      const exSizeZ = exCfg ? exCfg.sizeZ : 2;
      return (
        gridX < b.gridX + exSizeX &&
        gridX + bConfig.sizeX > b.gridX &&
        gridZ < b.gridZ + exSizeZ &&
        gridZ + bConfig.sizeZ > b.gridZ
      );
    });
    return !isOccupied;
  };

  // Handle Building Placement
  const handlePlaceBuilding = (gridX: number, gridZ: number) => {
    if (!activeBuildType) return;
    if (!checkPlacementValid(activeBuildType, gridX, gridZ)) return;
    const bConfig = BUILDINGS_CONFIG[activeBuildType];

    const cost = bConfig.cost;
    if (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone
    ) {
      setResources((res) => ({
        ...res,
        gold: res.gold - cost.gold,
        wood: res.wood - cost.wood,
        stone: res.stone - cost.stone,
        maxPopulation: res.maxPopulation + (bConfig.populationGranted || 0),
      }));

      const newBuildingId = `b_${selfPlayerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      if (isOnline && currentLobby) {
        getSocket().emit('game:place_building', {
          lobbyId: currentLobby.id,
          action: { id: newBuildingId, type: activeBuildType, gridX, gridZ, playerId: selfPlayerId },
        });
      }

      const newB: BuildingInstance = {
        id: newBuildingId,
        type: activeBuildType,
        gridX,
        gridZ,
        hp: bConfig.hp,
        maxHp: bConfig.maxHp,
        isEnemy: false,
        playerId: selfPlayerId,
        isConstructed: true,
        constructProgress: 1,
      };

      soundManager.playBuildSound();
      setBuildings((prev) => [...prev, newB]);
      setActiveBuildType(null);
      setStats((prev) => ({ ...prev, buildingsConstructed: prev.buildingsConstructed + 1 }));
    }
  };

  const handleSelectAllUnits = () => {
    const myUnits = new Set(units.filter((u) => getUnitPlayerId(u) === selfPlayerId).map((u) => u.id));
    setSelectedUnitIds(myUnits);
  };

  // --- Lobby Handlers ---
  const handleUpdatePlayerName = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setPlayerName(trimmed);
    try {
      localStorage.setItem('rts_commander_name', trimmed);
    } catch {
      // ignore
    }
    if (currentLobby) {
      getSocket().emit('lobby:update_player_name', { lobbyId: currentLobby.id, newName: trimmed });
    }
  };

  const handleCreateLobbySubmit = (data: { name: string; password?: string; maxPlayers: number; startingGold: number; hostName: string }) => {
    getSocket().emit('lobby:create', { ...data, hostName: playerName || data.hostName });
  };

  const handleJoinLobbySubmit = (lobbyId: string, password?: string) => {
    getSocket().emit('lobby:join', { lobbyId, password, playerName: playerName || `فرمانده ${Math.floor(Math.random() * 100)}` }, (res: { success: boolean; error?: string }) => {
      if (!res.success && res.error) {
        alert(res.error);
      }
    });
  };

  const handleRejoinLobby = (lobbyId: string) => {
    getSocket().emit('lobby:rejoin', {
      lobbyId,
      playerName: playerName || 'فرمانده',
      targetPlayerId: selfPlayerId,
    });
  };

  const handleUpdateLobbySettings = (settings: { name?: string; startingGold?: number; maxPlayers?: number }) => {
    if (currentLobby) {
      getSocket().emit('lobby:update_settings', { lobbyId: currentLobby.id, ...settings });
    }
  };

  const handleChangeLobbySlot = (newSlot: number) => {
    if (currentLobby) {
      getSocket().emit('lobby:change_slot', { lobbyId: currentLobby.id, newSlot });
    }
  };

  const handleToggleLobbyReady = () => {
    if (currentLobby) {
      getSocket().emit('lobby:toggle_ready', { lobbyId: currentLobby.id });
    }
  };

  const handleSendLobbyMessage = (message: string) => {
    if (currentLobby) {
      const selfP = currentLobby.players.find((p) => p.id === socketId);
      getSocket().emit('lobby:chat', { lobbyId: currentLobby.id, message, senderName: selfP?.name || playerName || 'فرمانده' });
    }
  };

  const handleStartLobbyGame = () => {
    if (currentLobby) {
      getSocket().emit('lobby:start_game', { lobbyId: currentLobby.id });
    }
  };

  const handleLeaveLobbyRoom = () => {
    if (currentLobby) {
      getSocket().emit('lobby:leave');
      setCurrentLobby(null);
      setIsOnline(false);
    }
  };

  const handleSendInGameChat = (message: string) => {
    if (currentLobby) {
      const selfP = currentLobby.players.find((p) => p.id === socketId);
      getSocket().emit('game:chat', {
        lobbyId: currentLobby.id,
        message,
        senderName: selfP?.name || playerName || `فرمانده ${selfPlayerId}`,
        playerId: selfPlayerId,
      });
    }
  };

  const waveInfo: WaveInfo = {
    waveNumber: currentWaveIndex + 1,
    totalWaves: WAVE_SCHEDULE.length,
    timeToNextWave: Math.max(0, Math.floor(waveTimerSec)),
    isWaveActive: waveActive,
    enemiesRemaining: units.filter((u) => u.isEnemy && u.hp > 0).length,
  };

  const selectedUnitsList = units.filter((u) => selectedUnitIds.has(u.id));

  return (
    <main className="w-screen h-screen bg-slate-950 overflow-hidden relative font-sans">
      {/* 3D Game Canvas Viewport */}
      <GameCanvas
        buildings={buildings}
        units={units}
        projectiles={projectiles}
        particles={particles}
        selectedUnitIds={selectedUnitIds}
        setSelectedUnitIds={setSelectedUnitIds}
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
        activeBuildType={activeBuildType}
        checkPlacementValid={checkPlacementValid}
        onPlaceBuilding={handlePlaceBuilding}
        onCommandUnits={handleCommandUnits}
        cameraPos={cameraPos}
        setCameraPos={setCameraPos}
        selfPlayerId={selfPlayerId}
        mapSeed={currentLobby?.id || 'default_map_777'}
        onCanvasInteraction={() => {
          setIsLeftSidebarOpen(false);
          setIsRightInspectorOpen(false);
        }}
      />

      {/* Unified Top HUD (Players Keep Status + Kingdom Resources) */}
      <TopBar
        resources={resources}
        buildings={buildings}
        selfPlayerId={selfPlayerId}
        currentLobby={currentLobby}
        isOnline={isOnline}
        pingMs={pingMs}
      />

      {/* Photoshop Style Collapsible Left Sidebar */}
      <PhotoshopLeftSidebar
        resources={resources}
        waveInfo={waveInfo}
        activeBuildType={activeBuildType}
        setActiveBuildType={setActiveBuildType}
        gameSpeed={gameSpeed}
        setGameSpeed={setGameSpeed}
        isOpen={isLeftSidebarOpen}
        onToggleOpen={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        onOpenGuide={() => setIsGuideOpen(true)}
        buildings={buildings}
        units={units}
        cameraPos={cameraPos}
        onMapClick={(x, z) => setCameraPos({ x, z })}
        onOpenLobby={() => {
          getSocket().emit('lobby:refresh');
          setShowLobbyListModal(true);
        }}
        onLeaveOnlineGame={handleLeaveOnlineGame}
        isOnline={isOnline}
        pingMs={pingMs}
      />

      {/* Photoshop Style Collapsible Right Inspector */}
      <PhotoshopRightInspector
        selectedBuilding={selectedBuilding}
        selectedUnits={selectedUnitsList}
        buildings={buildings}
        resources={resources}
        isOpen={isRightInspectorOpen}
        onToggleOpen={() => setIsRightInspectorOpen(!isRightInspectorOpen)}
        onTrainUnit={handleTrainUnit}
        onTradeResource={handleTradeResource}
        onRepairBuilding={handleRepairBuilding}
        onSelectAllUnits={handleSelectAllUnits}
      />

      {/* In-Game Online Chat Box */}
      {isOnline && (
        <InGameChat
          messages={inGameChatMessages}
          onSendMessage={handleSendInGameChat}
          selfPlayerId={selfPlayerId}
        />
      )}

      {/* Lobby List Modal */}
      <LobbyListModal
        isOpen={showLobbyListModal && !currentLobby}
        lobbies={publicLobbies}
        playerName={playerName}
        onUpdatePlayerName={handleUpdatePlayerName}
        onRefresh={() => getSocket().emit('lobby:refresh')}
        onCreateLobbyClick={() => {
          setShowLobbyListModal(false);
          setShowCreateLobbyModal(true);
        }}
        onJoinLobby={handleJoinLobbySubmit}
        onRejoinLobby={handleRejoinLobby}
        onPlayOffline={() => {
          setShowLobbyListModal(false);
          handleRestartGame();
        }}
      />

      {/* Create Lobby Modal */}
      <CreateLobbyModal
        isOpen={showCreateLobbyModal}
        onClose={() => {
          setShowCreateLobbyModal(false);
          setShowLobbyListModal(true);
        }}
        onCreate={handleCreateLobbySubmit}
      />

      {/* Lobby Room Modal (Inside Lobby) */}
      {currentLobby && gameMode !== 'playing' && (
        <LobbyRoomModal
          lobby={currentLobby}
          selfPlayerId={selfPlayerId}
          socketId={socketId}
          chatMessages={lobbyChatMessages}
          onUpdateSettings={handleUpdateLobbySettings}
          onUpdatePlayerName={handleUpdatePlayerName}
          onChangeSlot={handleChangeLobbySlot}
          onToggleReady={handleToggleLobbyReady}
          onSendMessage={handleSendLobbyMessage}
          onStartGame={handleStartLobbyGame}
          onLeaveLobby={handleLeaveLobbyRoom}
        />
      )}

      {/* Game Over / Victory Modal */}
      {(gameMode === 'victory' || gameMode === 'gameover') && (
        <GameOverModal
          isVictory={gameMode === 'victory'}
          stats={stats}
          onRestart={handleRestartGame}
        />
      )}

      {/* Game Tutorial Guide Modal */}
      <GameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </main>
  );
}
