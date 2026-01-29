import { exec } from "child_process"
import path from "path"

const PYTHON_DIR = path.resolve("python")

const runCmd = (command) =>
  new Promise((resolve, reject) => {
    exec(command, { cwd: PYTHON_DIR }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message)
      resolve(stdout)
    })
  })

export const makeSnapshot = async () => {
  await runCmd("python pull_prices.py --make-snapshot")
}

export const runOptimizer = async () => {
  await runCmd("python Cooptimization.py")
}

export const runForecast = async () => {
  await runCmd(`
python -m scripts.run_mpc_granite \
  --start-index 1000 --end-index 1100 --horizon 42 \
  --blend --clip --as-discount 0.6 \
  --anchor-first-hour --log-components --export
`)
}