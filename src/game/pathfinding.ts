import { MAP_SIZE, BUILDINGS_CONFIG } from './constants';
import { BuildingInstance } from '../types';

// Grid obstacle map builder
export function createObstacleGrid(buildings: BuildingInstance[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: MAP_SIZE }, () =>
    Array(MAP_SIZE).fill(false)
  );

  buildings.forEach((b) => {
    const config = BUILDINGS_CONFIG[b.type];
    const sizeX = config ? config.sizeX : 2;
    const sizeZ = config ? config.sizeZ : 2;

    for (let dx = 0; dx < sizeX; dx++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const gx = Math.floor(b.gridX + dx);
        const gz = Math.floor(b.gridZ + dz);
        if (gx >= 0 && gx < MAP_SIZE && gz >= 0 && gz < MAP_SIZE) {
          grid[gx][gz] = true;
        }
      }
    }
  });

  return grid;
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

// Calculate shortest distance from a 2D point (unit) to a building bounding box
export function getDistanceToBuilding(
  unitX: number,
  unitZ: number,
  building: BuildingInstance
): number {
  const config = BUILDINGS_CONFIG[building.type];
  const sizeX = config ? config.sizeX : 2;
  const sizeZ = config ? config.sizeZ : 2;

  const minX = building.gridX;
  const maxX = building.gridX + sizeX;
  const minZ = building.gridZ;
  const maxZ = building.gridZ + sizeZ;

  const dx = Math.max(minX - unitX, 0, unitX - maxX);
  const dz = Math.max(minZ - unitZ, 0, unitZ - maxZ);

  return Math.sqrt(dx * dx + dz * dz);
}

export function getBuildingCenter(building: BuildingInstance): { x: number; z: number } {
  const config = BUILDINGS_CONFIG[building.type];
  const sizeX = config ? config.sizeX : 2;
  const sizeZ = config ? config.sizeZ : 2;
  return {
    x: building.gridX + sizeX / 2,
    z: building.gridZ + sizeZ / 2,
  };
}

// Get closest perimeter point on building bounding box for unit movement destination
export function getBuildingPerimeterPoint(
  unitX: number,
  unitZ: number,
  building: BuildingInstance
): { x: number; z: number } {
  const config = BUILDINGS_CONFIG[building.type];
  const sizeX = config ? config.sizeX : 2;
  const sizeZ = config ? config.sizeZ : 2;

  const minX = building.gridX - 0.3;
  const maxX = building.gridX + sizeX + 0.3;
  const minZ = building.gridZ - 0.3;
  const maxZ = building.gridZ + sizeZ + 0.3;

  const clampX = Math.max(minX, Math.min(maxX, unitX));
  const clampZ = Math.max(minZ, Math.min(maxZ, unitZ));

  return { x: clampX, z: clampZ };
}

// Steering movement towards target position with basic obstacle avoidance & anti-stuck
export function calculateNextPosition(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  speed: number,
  deltaTime: number,
  obstacleGrid?: boolean[][]
): { x: number; z: number; arrived: boolean; angle: number } {
  if (isNaN(currentX) || isNaN(currentZ) || isNaN(targetX) || isNaN(targetZ)) {
    return { x: isNaN(currentX) ? 10 : currentX, z: isNaN(currentZ) ? 10 : currentZ, arrived: true, angle: 0 };
  }

  const dt = Math.min(0.1, Math.max(0.001, deltaTime || 0.033));
  const dist = distance2D(currentX, currentZ, targetX, targetZ);
  const step = (speed || 2.0) * dt;

  if (dist <= step || dist < 0.2) {
    const angle = dist > 0.001 ? Math.atan2(targetZ - currentZ, targetX - currentX) : 0;
    return { x: targetX, z: targetZ, arrived: true, angle };
  }

  // 1. Check if unit is currently trapped inside an obstacle tile (e.g. spawned there)
  if (obstacleGrid) {
    const currGx = Math.floor(currentX);
    const currGz = Math.floor(currentZ);
    if (currGx >= 0 && currGx < MAP_SIZE && currGz >= 0 && currGz < MAP_SIZE && obstacleGrid[currGx]?.[currGz]) {
      // Find nearest free adjacent tile to push unit out of building
      const neighbors = [
        { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
        { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: -1 }
      ];
      for (const n of neighbors) {
        const nx = currGx + n.x;
        const nz = currGz + n.z;
        if (nx >= 0 && nx < MAP_SIZE && nz >= 0 && nz < MAP_SIZE && !obstacleGrid[nx]?.[nz]) {
          const pushX = nx + 0.5;
          const pushZ = nz + 0.5;
          const angle = Math.atan2(pushZ - currentZ, pushX - currentX);
          const nextClampedX = Math.max(0.5, Math.min(MAP_SIZE - 0.5, currentX + Math.cos(angle) * step));
          const nextClampedZ = Math.max(0.5, Math.min(MAP_SIZE - 0.5, currentZ + Math.sin(angle) * step));
          return { x: nextClampedX, z: nextClampedZ, arrived: false, angle };
        }
      }
    }
  }

  let dirX = (targetX - currentX) / (dist || 1);
  let dirZ = (targetZ - currentZ) / (dist || 1);

  let nextX = currentX + dirX * step;
  let nextZ = currentZ + dirZ * step;

  // 2. Obstacle avoidance check
  if (obstacleGrid) {
    const gx = Math.floor(nextX);
    const gz = Math.floor(nextZ);

    if (gx >= 0 && gx < MAP_SIZE && gz >= 0 && gz < MAP_SIZE && obstacleGrid[gx]?.[gz]) {
      // Try steering angled steps around obstacle
      const altAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
      let moved = false;

      for (const offset of altAngles) {
        const currentAngle = Math.atan2(dirZ, dirX);
        const newAngle = currentAngle + offset;
        const testX = currentX + Math.cos(newAngle) * step;
        const testZ = currentZ + Math.sin(newAngle) * step;
        const tgx = Math.floor(testX);
        const tgz = Math.floor(testZ);

        if (tgx >= 0 && tgx < MAP_SIZE && tgz >= 0 && tgz < MAP_SIZE && !obstacleGrid[tgx]?.[tgz]) {
          nextX = testX;
          nextZ = testZ;
          moved = true;
          dirX = Math.cos(newAngle);
          dirZ = Math.sin(newAngle);
          break;
        }
      }
      if (!moved) {
        // Slide along wall
        const currentAngle = Math.atan2(dirZ, dirX);
        nextX = currentX + Math.cos(currentAngle + Math.PI / 2) * (step * 0.5);
        nextZ = currentZ + Math.sin(currentAngle + Math.PI / 2) * (step * 0.5);
      }
    }
  }

  // Ensure within boundary
  nextX = Math.max(0.5, Math.min(MAP_SIZE - 0.5, nextX));
  nextZ = Math.max(0.5, Math.min(MAP_SIZE - 0.5, nextZ));

  const angle = Math.atan2(dirZ, dirX);
  return { x: nextX, z: nextZ, arrived: false, angle };
}

