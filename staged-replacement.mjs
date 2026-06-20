/**
 * Reusable idea:
 * Treat edits to an active workflow as a transaction. Clone only editable
 * content into a draft, leave the live run untouched, then activate the draft
 * with fresh IDs and reset progress after explicit confirmation.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const normalize = value => value.trim().replace(/\s+/g, " ");

export function stageForEditing(activeWorkflow) {
  return {
    id: randomUUID(),
    status: "draft",
    steps: activeWorkflow.steps.map((step, index) => ({
      id: randomUUID(),
      category: step.category,
      minutes: step.minutes,
      action: step.action,
      context: step.context,
      status: index === 0 ? "active" : "pending",
      elapsedMs: 0
    }))
  };
}

export function editableContentMatches(left, right) {
  if (left.steps.length !== right.steps.length) return false;
  return left.steps.every((step, index) => {
    const other = right.steps[index];
    return step.category === other.category
      && step.minutes === other.minutes
      && normalize(step.action).toLocaleLowerCase() === normalize(other.action).toLocaleLowerCase()
      && normalize(step.context) === normalize(other.context);
  });
}

export function validateDraft(draft) {
  return draft.steps.length > 0 && draft.steps.every(step =>
    step.minutes >= 5
    && step.minutes <= 480
    && Boolean(normalize(step.action))
    && Boolean(normalize(step.context))
  );
}

export function activateReplacement(draft) {
  if (!validateDraft(draft)) throw new Error("Cannot activate an incomplete draft");
  return {
    id: randomUUID(),
    status: "active",
    steps: draft.steps.map((step, index) => ({
      ...step,
      id: randomUUID(),
      context: normalize(step.context),
      status: index === 0 ? "active" : "pending",
      elapsedMs: 0,
      startedAt: undefined
    }))
  };
}

function demo() {
  const live = {
    id: "live-run",
    status: "active",
    steps: [
      { id: "old-a", category: "focus", minutes: 45, action: "Draft", context: "the brief", status: "completed", elapsedMs: 42_000 },
      { id: "old-b", category: "chore", minutes: 15, action: "Tidy", context: "the desk", status: "active", elapsedMs: 8_000 }
    ]
  };

  const draft = stageForEditing(live);
  assert.equal(editableContentMatches(draft, live), true);
  assert.equal(live.steps[0].status, "completed", "staging must not alter the live workflow");

  draft.steps[0].context = "the revised brief";
  assert.equal(editableContentMatches(draft, live), false);

  const replacement = activateReplacement(draft);
  assert.notEqual(replacement.id, live.id);
  assert.deepEqual(replacement.steps.map(step => step.status), ["active", "pending"]);
  assert.deepEqual(replacement.steps.map(step => step.elapsedMs), [0, 0]);
  assert.equal(live.steps[0].context, "the brief");
  console.log("Activated replacement:", replacement);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();

