import cors from "cors";
import express from "express";
import apiRouter from "./routes/api.js";
import { initDatabase } from "./db.js";

initDatabase();

const app = express();
app.use(cors());
app.use(express.json());

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use("/api", apiRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;


