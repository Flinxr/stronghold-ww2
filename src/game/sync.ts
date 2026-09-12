import { UnitInstance, BuildingInstance } from '../types';

/**
 * Computes a deterministic 32-bit FNV-1a checksum of the game world simulation state.
 * This covers all living units (id, type, player, HP, state, quantized position, target)
 * and active buildings (id, type, grid position, player, HP, construction state).
 */
export function computeWorldChecksum(
  units: UnitInstance[],
  buildings: BuildingInstance[]
): number {
  const aliveUnits = units
    .filter((u) => u.hp > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const aliveBuildings = buildings
    .filter((b) => b.hp > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let hash = 2166136261; // FNV-1a 32-bit offset basis

  const updateHashStr = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  };

  const updateHashNum = (num: number) => {
    hash ^= (num | 0);
    hash = Math.imul(hash, 16777619);
  };

  // 1. Units state hashing
  updateHashNum(aliveUnits.length);
  for (const u of aliveUnits) {
    updateHashStr(u.id);
    updateHashStr(u.type);
    updateHashNum(u.playerId || (u.isEnemy ? 2 : 1));
    updateHashNum(Math.round(u.hp));
    updateHashStr(u.state || 'idle');
    if (u.targetEntityId) {
      updateHashStr(u.targetEntityId);
    }
    // Quantize position to 0.1 grid precision (1 decimal) to eliminate floating-point jitter
    updateHashNum(Math.round(u.x * 10));
    updateHashNum(Math.round(u.z * 10));
  }

  // 2. Buildings state hashing
  updateHashNum(aliveBuildings.length);
  for (const b of aliveBuildings) {
    updateHashStr(b.id);
    updateHashStr(b.type);
    updateHashNum(b.gridX);
    updateHashNum(b.gridZ);
    updateHashNum(b.playerId || (b.isEnemy ? 2 : 1));
    updateHashNum(Math.round(b.hp));
    updateHashNum(b.isConstructed ? 1 : 0);
    updateHashNum(b.repairing ? 1 : 0);
  }

  return (hash >>> 0); // Return unsigned 32-bit integer
}

/**
 * Format 32-bit checksum to 8-character hex string (e.g. "A4F19C20")
 */
export function formatChecksum(checksum: number): string {
  return checksum.toString(16).toUpperCase().padStart(8, '0');
}
