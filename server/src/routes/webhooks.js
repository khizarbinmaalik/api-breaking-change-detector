import { Router } from "express";
import crypto from "crypto";
import Repository from "../models/Repository.js";
import { decrypt } from "../utils/crypto.js";

const router = Router();

function isValidSignature(secret, rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  // timingSafeEqual throws if the lengths differ, so check first
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/github", async (req, res, next) => {
  try {
    const event = req.get("X-GitHub-Event");
    const signature = req.get("X-Hub-Signature-256");

    // 1. Find which repo this is for.
    const githubRepoId = req.body?.repository?.id;
    if (!githubRepoId)
      return res.status(400).json({ message: "Missing repository" });

    const repo = await Repository.findOne({ githubRepoId }).select(
      "+webhookSecret",
    );
    if (!repo || !repo.webhookSecret) {
      return res.status(404).json({ message: "Unknown repository" });
    }

    // 2. Verify the signature
    const secret = decrypt(repo.webhookSecret);
    if (!isValidSignature(secret, req.rawBody, signature)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    // 3. Handle the event
    console.log(`[webhook] ${event} received for ${repo.fullName}`);

    if (event === "ping") return res.status(200).json({ message: "pong" });
    if (event === "push")
      return res.status(202).json({ message: "Push received" }); 
    return res.status(200).json({ message: "Event ignored" });
  } catch (err) {
    next(err);
  }
});

export default router;
