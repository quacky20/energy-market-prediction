import multer from "multer"

const upload = multer({ dest: "temp/" })

export const uploadMergedCSV = upload.fields([
  { name: "merged", maxCount: 1 },
])
