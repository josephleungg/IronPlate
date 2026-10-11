import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

/**
 * A <button> inside a <form> submits it unless it says type="button". That once made the
 * "Lose / Maintain / Gain" tabs skip the rest of onboarding. Every <button> must name its type.
 */
describe("buttons", () => {
  it("every <button> declares a type", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles("src")) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/<button\b/g)) {
        if (!src.slice(m.index!, m.index! + 60).includes("type=")) {
          const line = src.slice(0, m.index!).split("\n").length;
          offenders.push(`${file}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
