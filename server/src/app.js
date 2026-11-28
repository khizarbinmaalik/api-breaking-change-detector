import path from "path"; // NEW
import { fileURLToPath } from "url"; // NEW
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { clientUrl, isProd } from "./config/env.js"; 
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import githubRoutes from './routes/github.js';
import repoRoutes from './routes/repos.js';
import webhooksRouter from './routes/webhooks.js';
const app = express();

// NEW: where the built React app lives (server/src -> client/dist)
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

// NEW: hosts like Render put a proxy in front of the app
app.set("trust proxy", 1);

// CHANGED: same defaults as before, but GitHub avatars are allowed as images
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://avatars.githubusercontent.com"],
        "upgrade-insecure-requests": null,
      },
    },
  })
);
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

// serve the built React app
if (isProd) {
  app.use(express.static(clientDist));
  // Any other page (like /repos/123) is handled by React Router in the browser
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use(notFound);
app.use(errorHandler);

export default app;