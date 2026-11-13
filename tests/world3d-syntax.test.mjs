import test from "node:test";
import { execFileSync } from "node:child_process";
import path from "node:path";

test("3D world module parses with Node's JavaScript syntax checker", () => {
  execFileSync(process.execPath, ["--check", path.resolve("world3d.js")], {
    stdio: "pipe"
  });
});
