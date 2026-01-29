import fs from "fs"
import path from "path"
import { safeDelete } from "../utils/cleanup.js"
import { updateParams } from "../services/params.service.js"
import {
  makeSnapshot,
  runOptimizer,
  runForecast,
} from "../services/python.service.js"

export const runOptimization = async (req, res) => {
  const snapshotPath = path.resolve("python/data/merged_prices_snapshot.csv")

  const outputFiles = [
    path.resolve("python/optimization_results/results_trades_and_reserves.csv"),
    path.resolve("python/optimization_results/results_battery.csv"),
    path.resolve("python/optimization_results/results_pnl_by_product.csv"),
  ]

  const forecastOutput = path.resolve(
    "python/optimization_results/mpc_forecast_results.csv"
  )

  try {
    const body = req.body
    const hasCSV = !!req.files?.merged
    const forecasting = body.forecasting === "true" || body.forecasting === true

    let config = body.config
    if (typeof config === "string") {
      config = JSON.parse(config)
    }

    updateParams({
      dataMode: hasCSV ? "snapshot" : "live",
      startDate: body.startDate,
      endDate: body.endDate,
      ...config,
    })

    // 1️⃣ Handle input data
    if (hasCSV) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
      fs.renameSync(req.files.merged[0].path, snapshotPath)
    } else {
      await makeSnapshot()
    }

    // 2️⃣ Forecast (optional)
    if (forecasting) {
      await runForecast()
      outputFiles.push(forecastOutput)
    }

    // 3️⃣ Optimization
    await runOptimizer()

    res.json({
      message: "Optimization completed",
      outputs: outputFiles.map((f) => path.basename(f)),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    Object.values(req.files || {})
      .flat()
      .forEach((f) => safeDelete(f.path))

    safeDelete(snapshotPath)
    outputFiles.forEach(safeDelete)
  }
}