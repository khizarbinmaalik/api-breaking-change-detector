import { Octokit } from "octokit";
import User from "../models/User.js";
import { decrypt } from "../utils/crypto.js";
import crypto from "crypto";
import { webhookBaseUrl } from "../config/env.js";

// Builds a GitHub client that acts as the given user.
export async function getOctokitForUser(userId) {
  const user = await User.findById(userId).select("+githubAccessToken");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  return new Octokit({ auth: decrypt(user.githubAccessToken) });
}

export async function createRepoWebhook(octokit, owner, repoName) {
  // Random per-repo secret: 32 bytes -> 64 hex characters
  const secret = crypto.randomBytes(32).toString("hex");

  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo: repoName,
    config: {
      url: `${webhookBaseUrl}/api/webhooks/github`,
      content_type: "json",
      secret,
    },
    events: ["push"],
    active: true,
  });

  // The caller encrypts the secret before saving it
  return { webhookId: data.id, secret };
}
