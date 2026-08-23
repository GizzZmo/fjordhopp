import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:8080/";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Start" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/playing.png" });

const probe = await page.evaluate(() => {
  const t = window.__controlsTest;
  if (!t) return { ok: false, reason: "no probe" };
  return { ok: true, x: t.getX(), vx: t.getVx(), facing: t.getFacing(), grounded: t.getGrounded() };
});

if (!probe.ok) {
  console.log(JSON.stringify({ ok: false, probe, errors }, null, 2));
  await browser.close();
  process.exit(1);
}

await page.evaluate(() => window.__controlsTest.setKeys(["KeyD"]));
await page.waitForTimeout(500);
const afterD = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { x: t.getX(), vx: t.getVx(), facing: t.getFacing() };
});

await page.evaluate(() => window.__controlsTest.setKeys(["KeyA"]));
await page.waitForTimeout(500);
const afterA = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { x: t.getX(), vx: t.getVx(), facing: t.getFacing() };
});

await page.evaluate(() => window.__controlsTest.setKeys([]));
await page.screenshot({ path: "/workspace/screenshots/after-move.png" });

const dMovesRight = afterD.x > probe.x + 8 && afterD.facing === 1;
const aMovesLeft = afterA.x < afterD.x - 8 && afterA.facing === -1;

const result = {
  ok: dMovesRight && aMovesLeft && errors.length === 0,
  start: probe,
  afterD,
  afterA,
  dMovesRight,
  aMovesLeft,
  errors,
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
