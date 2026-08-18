import path from "path";
import fs from "fs";
import { describe, test, expect } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run";
import { cartDeliveryOptionsDiscountsGenerateRun } from "../src/cart_delivery_options_discounts_generate_run";

/**
 * Runs the same fixtures as default.test.js, but calls the exported functions
 * directly instead of going through the compiled wasm.
 *
 * default.test.js spawns `shopify` without shell: true, which can't resolve
 * shopify.cmd on Windows, so it can't run here. This covers the branching logic
 * — which tier wins, which lines get targeted, which class gates which branch —
 * and runs on any platform. It does NOT validate the fixtures against the input
 * query or exercise the wasm; default.test.js still owns that.
 */

const RUNNERS = {
  "cart.lines.discounts.generate.run": cartLinesDiscountsGenerateRun,
  "cart.delivery-options.discounts.generate.run": cartDeliveryOptionsDiscountsGenerateRun,
};

const fixturesDir = path.join(__dirname, "fixtures");

describe("run logic", () => {
  fs.readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .forEach((file) => {
      test(file, () => {
        const { payload } = JSON.parse(
          fs.readFileSync(path.join(fixturesDir, file), "utf8"),
        );
        const run = RUNNERS[payload.target];
        expect(run, `no runner for target ${payload.target}`).toBeDefined();
        expect(run(payload.input)).toEqual(payload.output);
      });
    });
});
