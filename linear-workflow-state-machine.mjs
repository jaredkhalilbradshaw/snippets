/**
 * Reusable idea:
 * Model a sequential workflow as immutable transitions with at most one current
 * item. Completing or deferring advances to the next pending item; holding does
 * not. This works for tasks, lessons, workouts, checklists, and onboarding.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const CURRENT_STATUSES = new Set(["active", "on_hold"]);

export function currentItemIndex(items) {
  return items.findIndex(item => CURRENT_STATUSES.has(item.status));
}

export function transitionWorkflow(workflow, event) {
  const items = workflow.items.map(item => ({ ...item }));
  const current = currentItemIndex(items);
  if (current < 0) return workflow;

  if (event.type === "TOGGLE_HOLD") {
    items[current].status = items[current].status === "on_hold" ? "active" : "on_hold";
    return { ...workflow, items };
  }

  if (event.type !== "COMPLETE" && event.type !== "DEFER") return workflow;
  items[current].status = event.type === "COMPLETE" ? "completed" : "deferred";

  const next = items.findIndex((item, index) => index > current && item.status === "pending");
  if (next >= 0) items[next].status = "active";

  return {
    ...workflow,
    status: next >= 0 ? "active" : "completed",
    items
  };
}

export function validateWorkflow(workflow) {
  const currentCount = workflow.items.filter(item => CURRENT_STATUSES.has(item.status)).length;
  if (workflow.status === "active" && currentCount !== 1) {
    throw new Error("An active workflow must have exactly one current item");
  }
  if (workflow.status === "completed" && currentCount !== 0) {
    throw new Error("A completed workflow cannot have a current item");
  }
  return workflow;
}

function demo() {
  const initial = validateWorkflow({
    status: "active",
    items: [
      { id: "a", title: "Collect input", status: "active" },
      { id: "b", title: "Draft output", status: "pending" },
      { id: "c", title: "Review", status: "pending" }
    ]
  });

  const held = validateWorkflow(transitionWorkflow(initial, { type: "TOGGLE_HOLD" }));
  assert.equal(held.items[0].status, "on_hold");
  assert.equal(initial.items[0].status, "active", "the reducer must not mutate its input");

  const resumed = validateWorkflow(transitionWorkflow(held, { type: "TOGGLE_HOLD" }));
  const advanced = validateWorkflow(transitionWorkflow(resumed, { type: "COMPLETE" }));
  assert.deepEqual(advanced.items.map(item => item.status), ["completed", "active", "pending"]);

  const deferred = validateWorkflow(transitionWorkflow(advanced, { type: "DEFER" }));
  assert.deepEqual(deferred.items.map(item => item.status), ["completed", "deferred", "active"]);

  const finished = validateWorkflow(transitionWorkflow(deferred, { type: "COMPLETE" }));
  assert.equal(finished.status, "completed");
  console.log("Linear workflow:", finished);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();

