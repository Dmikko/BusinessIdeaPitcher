const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { getLaunchConfig, launchElectron } = require("../electron/launch");

test("getLaunchConfig strips ELECTRON_RUN_AS_NODE and defaults to opening the app", () => {
  const config = getLaunchConfig([], {
    ELECTRON_RUN_AS_NODE: "1",
    PATH: "test-path",
  });

  assert.deepEqual(config.electronArgs, ["."]);
  assert.equal(config.env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(config.env.PATH, "test-path");
  assert.equal(config.projectRoot, path.join(__dirname, ".."));
});

test("launchElectron forwards args and uses the cleaned environment", () => {
  const calls = [];
  const fakeChild = {
    on() {
      return fakeChild;
    },
  };

  launchElectron(
    ["--version"],
    {
      ELECTRON_RUN_AS_NODE: "1",
      HOME: "test-home",
    },
    (...args) => {
      calls.push(args);
      return fakeChild;
    },
    "/fake/electron",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/fake/electron");
  assert.deepEqual(calls[0][1], ["--version"]);
  assert.equal(calls[0][2].env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(calls[0][2].env.HOME, "test-home");
  assert.equal(calls[0][2].cwd, path.join(__dirname, ".."));
  assert.equal(calls[0][2].stdio, "inherit");
});
