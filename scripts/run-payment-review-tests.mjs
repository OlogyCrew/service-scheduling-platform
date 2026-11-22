import { spawn } from "node:child_process";

const scrubbedCredentialNames = [
  "DATABASE_URL",
  "STRIPE_DEV_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "JWT_SECRET",
  "AGENT_HANDOFF_SECRET",
  "BUILT_IN_FORGE_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "SENDGRID_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
];

const env = { ...process.env, NODE_ENV: "test", STRIPE_SECRET_KEY: "inert-no-credentials" };
for (const name of scrubbedCredentialNames) delete env[name];

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  pnpm,
  [
    "vitest",
    "run",
    "server/provider-payment-pause.test.ts",
    "server/subscription-review-router.test.ts",
  ],
  { env, stdio: "inherit" },
);

child.on("error", error => {
  console.error(`[payment-review-tests] failed to start Vitest: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[payment-review-tests] Vitest exited due to ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
