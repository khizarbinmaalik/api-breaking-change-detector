import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { clientUrl } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import githubRoutes from './routes/github.js';
import repoRoutes from './routes/repos.js';
import webhooksRouter from './routes/webhooks.js';
const app = express();

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // exact bytes GitHub signed
    },
  })
);
app.use(cookieParser());
app.use(passport.initialize());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/webhooks', webhooksRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
