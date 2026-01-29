import fs from "fs"
import path from "path"

const PARAMS_PATH = path.resolve("python/params.py")

/**
 * Replace a single-line python variable assignment
 * Example: mcp = 10.0
 */
const replaceValue = (content, key, value) => {
  const regex = new RegExp(`^${key}\\s*=.*$`, "m")
  return content.replace(regex, `${key} = ${value}`)
}

/**
 * Convert JS numeric input to Python-safe value
 */
const toPythonValue = (value) => {
  if (value === null || value === undefined || value === "" || isNaN(value)) {
    return "float('nan')"
  }
  return Number(value)
}

/**
 * Convert JS boolean to Python boolean
 */
const toPythonBool = (value) => {
  if (value === true) return "True"
  if (value === false) return "False"
  return "False"
}

/**
 * Validate required numeric parameters
 */
const validateParams = (params) => {
  const required = [
    "mcp",
    "mdp",
    "roundTripEfficiency",
    "fee",
    "initialSoc",
    "degradationCost",
    "asDuration",
  ]

  const missing = required.filter((key) => {
    const val = params[key]
    return val === null || val === undefined || val === "" || isNaN(val)
  })

  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(", ")}`)
  }
}

/**
 * Main updater
 */
export const updateParams = ({
  dataMode,
  startDate,
  endDate,
  mcp,
  mdp,
  roundTripEfficiency,
  fee,
  initialSoc,
  degradationCost,
  asDuration,
  reserveRamp,
  forecasting,
}) => {
  // Validate required parameters
  validateParams({
    mcp,
    mdp,
    roundTripEfficiency,
    fee,
    initialSoc,
    degradationCost,
    asDuration,
  })

  let content = fs.readFileSync(PARAMS_PATH, "utf-8")

  // Core data settings
  content = replaceValue(content, "DATA_MODE", `"${dataMode}"`)
  content = replaceValue(content, "start_date", `"${startDate}"`)
  content = replaceValue(content, "end_date", `"${endDate}"`)

  // Battery & economics
  content = replaceValue(content, "mcp", toPythonValue(mcp))
  content = replaceValue(content, "mdp", toPythonValue(mdp))
  content = replaceValue(
    content,
    "round_trip_efficiency",
    toPythonValue(roundTripEfficiency)
  )
  content = replaceValue(content, "fee", toPythonValue(fee))
  content = replaceValue(content, "initial_soc", toPythonValue(initialSoc))
  content = replaceValue(
    content,
    "degradation_cost_per_mwh",
    toPythonValue(degradationCost)
  )
  content = replaceValue(
    content,
    "as_duration_hours",
    toPythonValue(asDuration)
  )

  // Optional reserve ramp
  if (reserveRamp === "" || reserveRamp === null || reserveRamp === undefined) {
    content = replaceValue(content, "reserve_ramp_mw_per_hour", "None")
  } else {
    content = replaceValue(
      content,
      "reserve_ramp_mw_per_hour",
      toPythonValue(reserveRamp)
    )
  }

  // Forecasting flag
  // content = replaceValue(
  //   content,
  //   "forecasting",
  //   toPythonBool(forecasting)
  // )

  fs.writeFileSync(PARAMS_PATH, content)
}