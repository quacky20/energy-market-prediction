import fs from "fs"

export const safeDelete = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    console.warn("Cleanup failed:", filePath, err.message)
  }
}
