const { spawn } = require("child_process");
const path = require("path");

function getLaunchConfig(argv = process.argv.slice(2), sourceEnv = process.env) {
  const env = { ...sourceEnv };
  delete env.ELECTRON_RUN_AS_NODE;

  return {
    projectRoot: path.join(__dirname, ".."),
    env,
    electronArgs: argv.length > 0 ? argv : ["."],
  };
}

function launchElectron(
  argv = process.argv.slice(2),
  sourceEnv = process.env,
  spawnImpl = spawn,
  electronBinary = require("electron"),
) {
  const { projectRoot, env, electronArgs } = getLaunchConfig(argv, sourceEnv);

  const child = spawnImpl(electronBinary, electronArgs, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(
      "Failed to launch Electron:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });

  return child;
}

if (require.main === module) {
  launchElectron();
}

module.exports = {
  getLaunchConfig,
  launchElectron,
};
