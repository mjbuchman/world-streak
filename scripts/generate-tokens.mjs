// Regenerates src/app/tokens.css from the brand seed color. Run with `npm run tokens`.
// Node strips the TypeScript types from the imported modules at load time.
import { writeFileSync } from "node:fs";
import { BRAND_SEED_HEX } from "../src/config/theme.ts";
import { buildTokenCss } from "../src/lib/theme/tokens.ts";

const target = new URL("../src/app/tokens.css", import.meta.url);
writeFileSync(target, buildTokenCss(BRAND_SEED_HEX));
console.log(`Wrote ${target.pathname} from seed ${BRAND_SEED_HEX}`);
