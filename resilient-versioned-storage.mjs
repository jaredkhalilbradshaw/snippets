/**
 * Reusable idea:
 * Put migration and validation at the persistence boundary. Rename legacy
 * concepts consistently, salvage valid nested records, fill new defaults, and
 * quarantine raw data when the top-level snapshot is unrecoverable.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const CURRENT_VERSION = 3;
const VALID_CATEGORIES = new Set(["focus", "chore", "commute", "recovery"]);

function migrateCategory(value) {
  if (value === "environment") return "commute";
  return VALID_CATEGORIES.has(value) ? value : null;
}

function migrateStep(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const category = migrateCategory(candidate.category);
  if (!category || typeof candidate.action !== "string" || typeof candidate.context !== "string") return null;
  return {
    id: typeof candidate.id === "string" ? candidate.id : randomUUID(),
    category,
    action: candidate.action.trim(),
    context: candidate.context.trim(),
    status: candidate.status === "paused" ? "on_hold" : candidate.status,
    elapsedMs: Number.isFinite(candidate.elapsedMs) && candidate.elapsedMs >= 0 ? candidate.elapsedMs : 0
  };
}

export function migrateSnapshot(candidate) {
  if (!candidate || typeof candidate !== "object") throw new Error("Invalid snapshot");
  if (![1, 2, 3].includes(candidate.version)) throw new Error("Unsupported snapshot version");
  if (!Array.isArray(candidate.steps)) throw new Error("Missing steps");

  // Nested bad records are discarded rather than destroying an otherwise valid snapshot.
  const steps = candidate.steps.map(migrateStep).filter(Boolean);
  const placement = candidate.preferences?.commutePlacement
    ?? candidate.preferences?.environmentPlacement
    ?? "middle";
  const commutePlacement = ["early", "middle", "late"].includes(placement) ? placement : "middle";

  return {
    version: CURRENT_VERSION,
    steps,
    preferences: { commutePlacement },
    theme: ["system", "light", "dark"].includes(candidate.theme) ? candidate.theme : "system"
  };
}

export class SafeJsonRepository {
  constructor(storage, key = "app:state") {
    this.storage = storage;
    this.key = key;
    this.recoveryKey = `${key}:recovery`;
  }

  load(defaultState) {
    const raw = this.storage.getItem(this.key);
    if (!raw) return defaultState();
    try {
      return migrateSnapshot(JSON.parse(raw));
    } catch {
      this.storage.setItem(this.recoveryKey, raw);
      this.storage.removeItem(this.key);
      return defaultState();
    }
  }

  save(state) {
    this.storage.setItem(this.key, JSON.stringify(state));
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

function demo() {
  const migrated = migrateSnapshot({
    version: 2,
    theme: "dark",
    preferences: { environmentPlacement: "late" },
    steps: [
      { id: "a", category: "environment", action: "Move to", context: "the studio", status: "paused", elapsedMs: 9_000 },
      { id: "bad", category: "unknown", action: "Do", context: "something" }
    ]
  });
  assert.deepEqual(migrated.steps[0], {
    id: "a",
    category: "commute",
    action: "Move to",
    context: "the studio",
    status: "on_hold",
    elapsedMs: 9_000
  });
  assert.equal(migrated.steps.length, 1);
  assert.equal(migrated.preferences.commutePlacement, "late");

  const storage = memoryStorage();
  storage.setItem("app:state", "{broken json");
  const repository = new SafeJsonRepository(storage);
  const recovered = repository.load(() => ({ version: CURRENT_VERSION, steps: [] }));
  assert.deepEqual(recovered, { version: CURRENT_VERSION, steps: [] });
  assert.equal(storage.getItem("app:state:recovery"), "{broken json");
  console.log("Migrated snapshot:", migrated);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();
