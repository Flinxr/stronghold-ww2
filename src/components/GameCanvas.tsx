import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameRenderer, stringToSeed } from '../game/renderer';
import { BuildingInstance, UnitInstance, Projectile, ParticleEffect, BuildingType } from '../types';
import { BUILDINGS_CONFIG, MAP_SIZE } from '../game/constants';
import { soundManager } from '../game/audio';
import { ZoomIn, ZoomOut, Home, RotateCcw, Smartphone, Maximize, Crosshair, Swords, Users, X, Square } from 'lucide-react';

interface GameCanvasProps {
  buildings: BuildingInstance[];
  units: UnitInstance[];
  projectiles: Projectile[];
  particles: ParticleEffect[];
  selectedUnitIds: Set<string>;
  setSelectedUnitIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedBuilding: BuildingInstance | null;
  setSelectedBuilding: (building: BuildingInstance | null) => void;
  activeBuildType: BuildingType | null;
  checkPlacementValid?: (type: BuildingType, gridX: number, gridZ: number) => boolean;
  onPlaceBuilding: (gridX: number, gridZ: number) => void;
  onCommandUnits: (targetX: number, targetZ: number, targetUnitId?: string) => void;
  cameraPos: { x: number; z: number };
  setCameraPos: React.Dispatch<React.SetStateAction<{ x: number; z: number }>>;
  selfPlayerId?: number;
  mapSeed?: string | number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  buildings,
  units,
  projectiles,
  particles,
  selectedUnitIds,
  setSelectedUnitIds,
  selectedBuilding,
  setSelectedBuilding,
  activeBuildType,
  checkPlacementValid,
  onPlaceBuilding,
  onCommandUnits,
  cameraPos,
  setCameraPos,
  selfPlayerId = 1,
  mapSeed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);

  // Player affiliation helpers (supports 1v1, 1vAI, and 4-player online matches)
  const isMineUnit = (u: UnitInstance) => (u.playerId || (u.isEnemy ? 2 : 1)) === selfPlayerId;
  const isEnemyUnit = (u: UnitInstance) => (u.playerId || (u.isEnemy ? 2 : 1)) !== selfPlayerId;
  const isMineBuilding = (b: BuildingInstance) => (b.playerId || (b.isEnemy ? 2 : 1)) === selfPlayerId;
  const isEnemyBuilding = (b: BuildingInstance) => (b.playerId || (b.isEnemy ? 2 : 1)) !== selfPlayerId;

  const [mouseGridPos, setMouseGridPos] = useState<{ x: number; z: number } | null>(null);

  // Box Drag Selection State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  // Camera Pan Mouse Drag State
  const [isPanDragging, setIsPanDragging] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const cameraPosRef = useRef(cameraPos);

  // Orientation warning on mobile devices
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 850 || 'ontouchstart' in window;
      const isPort = isMobile && window.innerHeight > window.innerWidth;
      setIsPortrait(isPort);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Sync cameraPosRef when cameraPos prop changes externally
  useEffect(() => {
    cameraPosRef.current = cameraPos;
    if (rendererRef.current) {
      rendererRef.current.cameraPos = cameraPos;
      rendererRef.current.updateCameraPosition();
    }
  }, [cameraPos]);

  // Click Move Indicator Ring
  const [clickIndicator, setClickIndicator] = useState<{ x: number; z: number; isAttack: boolean } | null>(null);

  // Initialize Three.js GameRenderer
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any previous canvas child elements to prevent duplicate stacked canvases
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    const seedVal = stringToSeed(mapSeed);
    const renderer = new GameRenderer(containerRef.current, seedVal);
    rendererRef.current = renderer;

    const handleResize = () => {
      if (containerRef.current && rendererRef.current) {
        rendererRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [mapSeed]);

  // Safety listener: Release camera pan drag on window mouseup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanDragging(false);
      lastMousePosRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Continuous 60 FPS requestAnimationFrame loop for ultra-smooth rendering, zoom, pan, and projectile flights
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const projectilesRef = useRef(projectiles);
  projectilesRef.current = projectiles;
  const particlesRef = useRef(particles);
  particlesRef.current = particles;
  const selectedUnitIdsRef = useRef(selectedUnitIds);
  selectedUnitIdsRef.current = selectedUnitIds;
  const activeBuildTypeRef = useRef(activeBuildType);
  activeBuildTypeRef.current = activeBuildType;
  const mouseGridPosRef = useRef(mouseGridPos);
  mouseGridPosRef.current = mouseGridPos;
  const selectedBuildingRef = useRef(selectedBuilding);
  selectedBuildingRef.current = selectedBuilding;

  useEffect(() => {
    let animId: number;
    const animate = () => {
      if (rendererRef.current) {
        const isValid = (activeBuildTypeRef.current && mouseGridPosRef.current && checkPlacementValid)
          ? checkPlacementValid(activeBuildTypeRef.current, mouseGridPosRef.current.x, mouseGridPosRef.current.z)
          : true;

        rendererRef.current.update(
          buildingsRef.current,
          unitsRef.current,
          projectilesRef.current,
          particlesRef.current,
          selectedUnitIdsRef.current,
          activeBuildTypeRef.current,
          mouseGridPosRef.current,
          isValid,
          selectedBuildingRef.current?.id
        );
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [checkPlacementValid]);

  // Mouse Wheel Zoom Listener
  const handleWheel = (e: React.WheelEvent) => {
    if (!rendererRef.current) return;
    const zoomDelta = e.deltaY > 0 ? 1.0 : -1.0;
    rendererRef.current.setZoom(zoomDelta);
  };

  // Zoom Helpers for UI Buttons
  const handleZoomIn = () => {
    if (rendererRef.current) {
      rendererRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (rendererRef.current) {
      rendererRef.current.zoomOut();
    }
  };

  const centerOnCastle = () => {
    const keepB = buildings.find((b) => isMineBuilding(b) && b.type === 'keep') || buildings.find((b) => isMineBuilding(b));
    const targetPos = keepB ? { x: keepB.gridX + 1.5, z: keepB.gridZ + 1.5 } : { x: 10, z: 10 };
    cameraPosRef.current = targetPos;
    if (rendererRef.current) {
      rendererRef.current.cameraPos = targetPos;
      rendererRef.current.updateCameraPosition();
    }
    setCameraPos(targetPos);
    soundManager.playClick();
  };

  // Track mouse down pos to differentiate tap from drag
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null);

  // Touch Gesture Refs
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);

  // Handle Touch Start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
      touchMovedRef.current = false;

      if (rendererRef.current) {
        const gridPos = rendererRef.current.raycastGround(touch.clientX, touch.clientY);
        if (gridPos) setMouseGridPos(gridPos);
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      if (rendererRef.current) {
        initialPinchZoomRef.current = rendererRef.current.getZoom();
      }
      lastTouchPosRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    }
  };

  // Handle Touch Move (1-finger pan & 2-finger pinch zoom + pan)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!rendererRef.current) return;

    if (e.touches.length === 1 && lastTouchPosRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchPosRef.current.x;
      const dy = touch.clientY - lastTouchPosRef.current.y;

      if (Math.hypot(dx, dy) > 4) {
        touchMovedRef.current = true;
      }

      lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };

      const zoom = rendererRef.current.getZoom();
      const containerH = containerRef.current?.clientHeight || window.innerHeight || 800;
      const sensitivity = (zoom * 2.2) / containerH;

      const isoDx = (-dx * 0.7071 - dy * 0.7071) * sensitivity;
      const isoDz = (dx * 0.7071 - dy * 0.7071) * sensitivity;

      const newX = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.x + isoDx));
      const newZ = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.z + isoDz));

      cameraPosRef.current = { x: newX, z: newZ };
      rendererRef.current.targetCameraPos = cameraPosRef.current;
      setCameraPos(cameraPosRef.current);

      const gridPos = rendererRef.current.raycastGround(touch.clientX, touch.clientY);
      if (gridPos) setMouseGridPos(gridPos);
    } else if (e.touches.length === 2 && initialPinchDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const distDiff = (initialPinchDistRef.current - currentDist) * 0.08;

      rendererRef.current.setZoom(distDiff);
      initialPinchDistRef.current = currentDist;

      const currentCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      if (lastTouchPosRef.current) {
        const dx = currentCenter.x - lastTouchPosRef.current.x;
        const dy = currentCenter.y - lastTouchPosRef.current.y;

        const zoom = rendererRef.current.getZoom();
        const containerH = containerRef.current?.clientHeight || window.innerHeight || 800;
        const sensitivity = (zoom * 2.2) / containerH;

        const isoDx = (-dx * 0.7071 - dy * 0.7071) * sensitivity;
        const isoDz = (dx * 0.7071 - dy * 0.7071) * sensitivity;

        const newX = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.x + isoDx));
        const newZ = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.z + isoDz));

        cameraPosRef.current = { x: newX, z: newZ };
        rendererRef.current.targetCameraPos = cameraPosRef.current;
        setCameraPos(cameraPosRef.current);
      }
      lastTouchPosRef.current = currentCenter;
    }
  };

  // Handle Touch End
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      initialPinchDistRef.current = null;
      initialPinchZoomRef.current = null;

      if (!touchMovedRef.current && touchStartPosRef.current && rendererRef.current) {
        const touchX = touchStartPosRef.current.x;
        const touchY = touchStartPosRef.current.y;
        const now = Date.now();
        const timeDiff = now - lastTapTimeRef.current;

        let isDoubleTap = false;
        if (
          timeDiff < 320 &&
          lastTapPosRef.current &&
          Math.hypot(touchX - lastTapPosRef.current.x, touchY - lastTapPosRef.current.y) < 30
        ) {
          isDoubleTap = true;
        }

        const gridPos = rendererRef.current.raycastGround(touchX, touchY);

        if (isDoubleTap) {
          // Double Tap -> Move / Attack command
          if (gridPos && selectedUnitIds.size > 0) {
            const enemyUnitTarget = units.find(
              (u) => isEnemyUnit(u) && u.hp > 0 && Math.hypot(u.x - (gridPos.x + 0.5), u.z - (gridPos.z + 0.5)) < 1.8
            );
            const enemyBuildingTarget = buildings.find((b) => {
              if (!isEnemyBuilding(b) || b.hp <= 0) return false;
              const bSizeX = BUILDINGS_CONFIG[b.type].sizeX;
              const bSizeZ = BUILDINGS_CONFIG[b.type].sizeZ;
              return (
                gridPos.x >= b.gridX - 0.5 &&
                gridPos.x < b.gridX + bSizeX + 0.5 &&
                gridPos.z >= b.gridZ - 0.5 &&
                gridPos.z < b.gridZ + bSizeZ + 0.5
              );
            });

            const targetX = gridPos.x + 0.5;
            const targetZ = gridPos.z + 0.5;
            const targetEntityId = enemyUnitTarget?.id || enemyBuildingTarget?.id;

            onCommandUnits(targetX, targetZ, targetEntityId);
            soundManager.playClick();

            setClickIndicator({
              x: targetX,
              z: targetZ,
              isAttack: !!targetEntityId,
            });
            setTimeout(() => setClickIndicator(null), 800);
          }
          lastTapTimeRef.current = 0;
          lastTapPosRef.current = null;
        } else {
          // Single Tap
          lastTapTimeRef.current = now;
          lastTapPosRef.current = { x: touchX, y: touchY };

          if (activeBuildType && gridPos) {
            onPlaceBuilding(gridPos.x, gridPos.z);
          } else if (gridPos) {
            // Check if tapping on an allied unit (radius 1.8 tiles for touch ease)
            const touchedAllyUnit = units.find(
              (u) => isMineUnit(u) && u.hp > 0 && Math.hypot(u.x - (gridPos.x + 0.5), u.z - (gridPos.z + 0.5)) < 1.8
            );

            // Check if tapping on an allied building
            const touchedAllyBuilding = buildings.find((b) => {
              if (!isMineBuilding(b) || b.hp <= 0) return false;
              const bSizeX = BUILDINGS_CONFIG[b.type].sizeX;
              const bSizeZ = BUILDINGS_CONFIG[b.type].sizeZ;
              return (
                gridPos.x >= b.gridX &&
                gridPos.x < b.gridX + bSizeX &&
                gridPos.z >= b.gridZ &&
                gridPos.z < b.gridZ + bSizeZ
              );
            });

            if (selectedUnitIds.size > 0) {
              // If user already has units selected:
              if (touchedAllyUnit) {
                // Tapping on another allied unit selects that unit
                setSelectedUnitIds(new Set([touchedAllyUnit.id]));
                setSelectedBuilding(null);
                soundManager.playClick();
              } else if (touchedAllyBuilding) {
                // Tapping on an allied building selects that building
                setSelectedBuilding(touchedAllyBuilding);
                setSelectedUnitIds(new Set());
                soundManager.playClick();
              } else {
                // Tapping anywhere else (ground or enemy) ISSUES COMMAND to selected units!
                const enemyUnitTarget = units.find(
                  (u) => isEnemyUnit(u) && u.hp > 0 && Math.hypot(u.x - (gridPos.x + 0.5), u.z - (gridPos.z + 0.5)) < 2.0
                );
                const enemyBuildingTarget = buildings.find((b) => {
                  if (!isEnemyBuilding(b) || b.hp <= 0) return false;
                  const bSizeX = BUILDINGS_CONFIG[b.type].sizeX;
                  const bSizeZ = BUILDINGS_CONFIG[b.type].sizeZ;
                  return (
                    gridPos.x >= b.gridX - 0.5 &&
                    gridPos.x < b.gridX + bSizeX + 0.5 &&
                    gridPos.z >= b.gridZ - 0.5 &&
                    gridPos.z < b.gridZ + bSizeZ + 0.5
                  );
                });

                const targetX = gridPos.x + 0.5;
                const targetZ = gridPos.z + 0.5;
                const targetEntityId = enemyUnitTarget?.id || enemyBuildingTarget?.id;

                onCommandUnits(targetX, targetZ, targetEntityId);
                soundManager.playClick();

                setClickIndicator({
                  x: targetX,
                  z: targetZ,
                  isAttack: !!targetEntityId,
                });
                setTimeout(() => setClickIndicator(null), 800);
              }
            } else {
              // No units currently selected -> Perform selection
              if (touchedAllyUnit) {
                setSelectedUnitIds(new Set([touchedAllyUnit.id]));
                setSelectedBuilding(null);
                soundManager.playClick();
              } else if (touchedAllyBuilding) {
                setSelectedBuilding(touchedAllyBuilding);
                setSelectedUnitIds(new Set());
                soundManager.playClick();
              } else {
                setSelectedUnitIds(new Set());
                setSelectedBuilding(null);
              }
            }
          }
        }
      }
    }
  };

  // Handle Mouse Hover Grid Position & Camera Pan Drag / Selection Box Drag
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    if (e.buttons === 1 && mouseDownPosRef.current && !isPanDragging) {
      const dist = Math.hypot(e.clientX - mouseDownPosRef.current.x, e.clientY - mouseDownPosRef.current.y);
      if (dist > 6) {
        if (!isDragging) {
          setIsDragging(true);
          setDragStart(mouseDownPosRef.current);
        }
        setDragEnd({ x: e.clientX, y: e.clientY });
      }
    }

    if (isPanDragging && !isDragging && lastMousePosRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (dx !== 0 || dy !== 0) {
        const zoom = rendererRef.current.getZoom();
        const containerH = containerRef.current?.clientHeight || window.innerHeight || 800;
        const sensitivity = (zoom * 2.0) / containerH;

        const isoDx = (-dx * 0.7071 - dy * 0.7071) * sensitivity;
        const isoDz = (dx * 0.7071 - dy * 0.7071) * sensitivity;

        const newX = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.x + isoDx));
        const newZ = Math.max(4, Math.min(MAP_SIZE - 4, cameraPosRef.current.z + isoDz));

        cameraPosRef.current = { x: newX, z: newZ };

        rendererRef.current.targetCameraPos = cameraPosRef.current;
        setCameraPos(cameraPosRef.current);
      }
    }

    const gridPos = rendererRef.current.raycastGround(e.clientX, e.clientY);
    if (gridPos) {
      setMouseGridPos(gridPos);
    }
  };

  // Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

    if (e.button === 2 || e.button === 1) {
      rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      setIsPanDragging(true);
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    } else if (e.button === 0) {
      setIsPanDragging(false);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragEnd({ x: e.clientX, y: e.clientY });
    }
  };

  // Select building or unit under cursor
  const performSelectionAtGrid = () => {
    if (!mouseGridPos) return;

    const clickedUnit = units.find(
      (u) => Math.hypot(u.x - (mouseGridPos.x + 0.5), u.z - (mouseGridPos.z + 0.5)) < 1.0
    );
    if (clickedUnit) {
      if (isMineUnit(clickedUnit)) {
        setSelectedUnitIds(new Set([clickedUnit.id]));
        setSelectedBuilding(null);
        soundManager.playClick();
      }
    } else {
      const clickedB = buildings.find((b) => {
        const bSize = BUILDINGS_CONFIG[b.type].sizeX;
        return (
          mouseGridPos.x >= b.gridX &&
          mouseGridPos.x < b.gridX + bSize &&
          mouseGridPos.z >= b.gridZ &&
          mouseGridPos.z < b.gridZ + bSize
        );
      });
      if (clickedB) {
        setSelectedBuilding(clickedB);
        setSelectedUnitIds(new Set());
        soundManager.playClick();
      } else {
        setSelectedUnitIds(new Set());
        setSelectedBuilding(null);
      }
    }
  };

  // Handle Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanDragging(false);

    let draggedDist = 0;
    if (mouseDownPosRef.current) {
      draggedDist = Math.hypot(e.clientX - mouseDownPosRef.current.x, e.clientY - mouseDownPosRef.current.y);
    }
    mouseDownPosRef.current = null;
    lastMousePosRef.current = null;

    if (e.button !== 0 || !rendererRef.current) return;

    if (isDragging && dragStart && dragEnd && draggedDist > 6) {
      const minX = Math.min(dragStart.x, dragEnd.x);
      const maxX = Math.max(dragStart.x, dragEnd.x);
      const minY = Math.min(dragStart.y, dragEnd.y);
      const maxY = Math.max(dragStart.y, dragEnd.y);

      const newSelected = new Set<string>();

      units.forEach((u) => {
        if (isMineUnit(u) && u.hp > 0) {
          const screenPos = rendererRef.current!.projectUnitToScreen(u.x, u.z);
          if (
            screenPos.x >= minX - 10 &&
            screenPos.x <= maxX + 10 &&
            screenPos.y >= minY - 10 &&
            screenPos.y <= maxY + 10
          ) {
            newSelected.add(u.id);
          }
        }
      });

      if (newSelected.size > 0) {
        setSelectedUnitIds(newSelected);
        setSelectedBuilding(null);
        soundManager.playClick();
      }
    } else if (draggedDist < 6) {
      if (activeBuildType && mouseGridPos) {
        onPlaceBuilding(mouseGridPos.x, mouseGridPos.z);
      } else {
        performSelectionAtGrid();
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Handle Double Click
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeBuildType && mouseGridPos) {
      onPlaceBuilding(mouseGridPos.x, mouseGridPos.z);
    } else {
      performSelectionAtGrid();
    }
  };

  // Handle Right Click (Command Units to Move or Attack)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!rendererRef.current) return;

    if (rightClickStartRef.current) {
      const dist = Math.hypot(e.clientX - rightClickStartRef.current.x, e.clientY - rightClickStartRef.current.y);
      if (dist > 8) {
        rightClickStartRef.current = null;
        return;
      }
    }
    rightClickStartRef.current = null;

    const gridPos = rendererRef.current.raycastGround(e.clientX, e.clientY);
    if (!gridPos) return;

    if (selectedUnitIds.size > 0) {
      const enemyUnitTarget = units.find(
        (u) => isEnemyUnit(u) && u.hp > 0 && Math.hypot(u.x - (gridPos.x + 0.5), u.z - (gridPos.z + 0.5)) < 1.4
      );

      const enemyBuildingTarget = buildings.find((b) => {
        if (!isEnemyBuilding(b) || b.hp <= 0) return false;
        const bSizeX = BUILDINGS_CONFIG[b.type].sizeX;
        const bSizeZ = BUILDINGS_CONFIG[b.type].sizeZ;
        return (
          gridPos.x >= b.gridX &&
          gridPos.x < b.gridX + bSizeX &&
          gridPos.z >= b.gridZ &&
          gridPos.z < b.gridZ + bSizeZ
        );
      });

      const targetX = gridPos.x + 0.5;
      const targetZ = gridPos.z + 0.5;
      const targetEntityId = enemyUnitTarget?.id || enemyBuildingTarget?.id;

      onCommandUnits(targetX, targetZ, targetEntityId);

      soundManager.playClick();

      setClickIndicator({
        x: targetX,
        z: targetZ,
        isAttack: !!targetEntityId,
      });

      setTimeout(() => setClickIndicator(null), 800);
    }
  };

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const step = 2.0;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setCameraPos((prev) => ({ ...prev, z: Math.max(4, prev.z - step), x: Math.max(4, prev.x - step) }));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setCameraPos((prev) => ({ ...prev, z: Math.min(MAP_SIZE - 4, prev.z + step), x: Math.min(MAP_SIZE - 4, prev.x + step) }));
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setCameraPos((prev) => ({ ...prev, x: Math.max(4, prev.x - step), z: Math.min(MAP_SIZE - 4, prev.z + step) }));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setCameraPos((prev) => ({ ...prev, x: Math.min(MAP_SIZE - 4, prev.x + step), z: Math.max(4, prev.z - step) }));
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case 'Escape':
          setSelectedUnitIds(new Set());
          setSelectedBuilding(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCameraPos, setSelectedUnitIds, setSelectedBuilding]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full relative overflow-hidden select-none cursor-crosshair touch-none"
    >
      {/* Mobile Portrait Orientation Overlay Alert */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-white dir-rtl pointer-events-auto">
          <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
            <RotateCcw className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-amber-300 mb-2">
            گوشی را به حالت افقی (Landscape) بچرخانید 🔄
          </h3>
          <p className="text-sm text-slate-300 max-w-xs leading-relaxed mb-6">
            برای تجربه کامل میدان نبرد استراتژیک، پیمایش مپ و کنترل تاچ سربازان، گوشی خود را به حالت افقی قرار دهید.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
            >
              <Maximize className="w-4 h-4" />
              ورود به حالت تمام‌صفحه (Fullscreen)
            </button>
            <button
              onClick={() => setIsPortrait(false)}
              className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold hover:text-white transition-colors"
            >
              ادامه در حالت عمودی
            </button>
          </div>
        </div>
      )}

      {/* Selection Box Overlay */}
      {isDragging && dragStart && dragEnd && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none z-20 rounded-md"
          style={{
            left: Math.min(dragStart.x, dragEnd.x),
            top: Math.min(dragStart.y, dragEnd.y),
            width: Math.abs(dragEnd.x - dragStart.x),
            height: Math.abs(dragEnd.y - dragStart.y),
          }}
        />
      )}

      {/* Mobile Quick Action Floating Command Bar */}
      {selectedUnitIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto bg-slate-950/90 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl dir-rtl max-sm:bottom-2 max-sm:p-1.5 max-sm:scale-95 animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center gap-1 px-2 border-l border-slate-700 text-amber-400 font-bold text-xs max-sm:text-[11px]">
            <Swords className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{selectedUnitIds.size} سرباز</span>
          </div>

          <button
            onClick={() => {
              const enemyB = buildings.find((b) => isEnemyBuilding(b) && b.hp > 0 && b.type === 'keep') ||
                buildings.find((b) => isEnemyBuilding(b) && b.hp > 0);
              if (enemyB) {
                onCommandUnits(enemyB.gridX + 1.5, enemyB.gridZ + 1.5, enemyB.id);
                soundManager.playClick();
                setClickIndicator({
                  x: enemyB.gridX + 1.5,
                  z: enemyB.gridZ + 1.5,
                  isAttack: true,
                });
                setTimeout(() => setClickIndicator(null), 800);
              }
            }}
            className="px-3 py-1.5 bg-red-600/30 border border-red-500/50 hover:bg-red-600/50 text-red-200 font-bold text-xs rounded-xl flex items-center gap-1 transition active:scale-95 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]"
            title="حمله مستقیم به دژ دشمن"
          >
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            <span>حمله به دشمن</span>
          </button>

          <button
            onClick={() => {
              const myUnitIds = new Set(units.filter((u) => isMineUnit(u) && u.hp > 0).map((u) => u.id));
              setSelectedUnitIds(myUnitIds);
              soundManager.playClick();
            }}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1 transition active:scale-95 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]"
            title="انتخاب همه نیروها"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>همه</span>
          </button>

          <button
            onClick={() => {
              setSelectedUnitIds(new Set());
              soundManager.playClick();
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition active:scale-95"
            title="لغو انتخاب"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
