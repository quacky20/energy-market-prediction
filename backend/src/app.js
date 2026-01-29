import express from "express"
import cors from "cors"
import optimizeRoutes from "./routes/optimize.routes.js"

const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/optimize", optimizeRoutes)

export default app
