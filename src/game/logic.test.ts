import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wishDir, yawFromDir } from "./math.ts";
import { applyEvent, blankQuests, canPay, recipeReady, strikeDamage, xpToNext } from "./logic.ts";
import { terrainHeight } from "./world.ts";
import { QUESTS } from "./content.ts";

describe("camera-relative facing", () => {
  it("A while moving forward turns yaw left (positive)", () => {
    const wish = wishDir(0, -1, 1);
    const yaw = yawFromDir(wish.x, wish.z);
    assert.ok(yaw > 0.2, `expected left yaw, got ${yaw}`);
  });

  it("D while moving forward turns yaw right (negative)", () => {
    const wish = wishDir(0, 1, 1);
    const yaw = yawFromDir(wish.x, wish.z);
    assert.ok(yaw < -0.2, `expected right yaw, got ${yaw}`);
  });

  it("W faces world -Z and A strafes to -X", () => {
    const w = wishDir(0, 0, 1);
    const a = wishDir(0, -1, 0);
    assert.ok(w.z < -0.9);
    assert.ok(a.x < -0.9);
  });
});

describe("quests", () => {
  it("talking to Layla completes the waking quest and starts the market", () => {
    const quests = blankQuests();
    const adv = applyEvent(quests, { type: "talk", npc: "layla" }, {}, []);
    assert.equal(quests.q_awaken.status, "done");
    assert.ok(adv.started.includes("q_market"));
    assert.equal(quests.q_market.status, "active");
  });

  it("market quest needs three distinct raider defeats", () => {
    const quests = blankQuests();
    applyEvent(quests, { type: "talk", npc: "layla" }, {}, []);
    applyEvent(quests, { type: "defeat", tag: "market" }, {}, []);
    applyEvent(quests, { type: "defeat", tag: "market" }, {}, []);
    assert.equal(quests.q_market.status, "active");
    const done = applyEvent(quests, { type: "defeat", tag: "market" }, {}, []);
    assert.equal(quests.q_market.status, "done");
    assert.ok(done.started.includes("q_well"));
  });

  it("defines 24 quests and 8 main chapters", () => {
    assert.equal(QUESTS.length, 24);
    assert.equal(QUESTS.filter((q) => q.kind === "main").length, 8);
  });
});

describe("items and roads", () => {
  it("refuses a purchase without motes", () => {
    assert.equal(canPay(3, 8), false);
    assert.equal(canPay(8, 8), true);
  });

  it("gates a recipe on materials", () => {
    assert.equal(recipeReady({ herb: 1 }, { herb: 2 }), false);
    assert.equal(recipeReady({ herb: 2, dust: 1 }, { herb: 2 }), true);
  });

  it("keeps the frost road walkable", () => {
    let maxDiff = 0;
    for (let x = 42; x < 180; x += 2) {
      const d = Math.abs(terrainHeight(x, 14) - terrainHeight(x + 2, 14));
      if (d > maxDiff) maxDiff = d;
    }
    assert.ok(maxDiff < 1.6, `road step ${maxDiff}`);
  });

  it("scales a heavy hit above a light hit", () => {
    const light = strikeDamage({ kind: "light", combo: 0, weaponPower: 1, skill: 0, edge: 0, buff: false });
    const heavy = strikeDamage({ kind: "heavy", combo: 0, weaponPower: 1, skill: 0, edge: 0, buff: false });
    assert.ok(heavy > light);
    assert.ok(xpToNext(3) > xpToNext(1));
  });
});
