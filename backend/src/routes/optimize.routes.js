import express from "express"
import fs from "fs"
import path from "path"
import { runOptimization } from "../controllers/optimize.controller.js"
import { uploadMergedCSV } from "../middlewares/middleware.js"

const optimizeRoutes = express.Router()


optimizeRoutes.post("/", uploadMergedCSV, runOptimization)


export default optimizeRoutes