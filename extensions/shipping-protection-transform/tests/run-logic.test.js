import path from "path";
import fs from "fs";
import { describe, test, expect } from "vitest";
import { cartTransformRun } from "../src/cart_transform_run";

/**
 * Runs the same fixtures as default.test.js, but calls the exported function
 * directly instead of going through the compiled wasm.
 *
 * default.test.js spawns `shopify` without shell: true, which can't resolve
 * shopify.cmd on Windows, so it can't run here. This covers the pricing logic
 * and runs on any platform. It does NOT validate the fixtures against the
 * input query or exercise the wasm; default.test.js still owns that.
 */

const fixturesDir = path.join(__dirname, "fixtures");

describe("run logic", () => {
  fs.readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .forEach((file) => {
      test(file, () => {
        const { payload } = JSON.parse(
          fs.readFileSync(path.join(fixturesDir, file), "utf8"),
        );
        expect(cartTransformRun(payload.input)).toEqual(payload.output);
      });
    });
});
