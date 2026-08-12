import "dotenv/config";
import { readBaseResume } from "../shared/store";
import { generateAllResumes } from "./generate";

async function main() {
  const resume = readBaseResume();
  if (!resume.personal.full_name) {
    console.error("base_resume.json está vacío. Completá el wizard en /setup.");
    process.exit(1);
  }
  const results = await generateAllResumes(resume);
  for (const r of results) {
    console.log(`OK ${r.profileId} → ${r.path} (${r.verify.pageCount} pág.)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
