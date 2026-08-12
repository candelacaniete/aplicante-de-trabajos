import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getRootDir } from "./paths";

export function loadEnv(): void {
  const rootEnv = path.join(getRootDir(), ".env");
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  } else {
    dotenv.config();
  }
}
