/**
 * `npm run content:validate` (docs/06 §12). Exits non-zero on any issue.
 */
import { defaultContentSource } from '../../src/content/registry';
import { validateContent } from '../../src/content/validate';

const issues = validateContent(defaultContentSource);
if (issues.length > 0) {
  for (const issue of issues) console.error(`✖ ${issue.where}: ${issue.message}`);
  console.error(`\ncontent:validate failed with ${issues.length} issue(s)`);
  process.exit(1);
}

const s = defaultContentSource;
console.log(
  `✔ content valid: ${s.brands.length} brand(s), ${s.species.length} species, ${s.sets.length} set(s), ` +
    `${s.cards.length} card(s), ${s.packConfigs.length} pack config(s), ${s.products.length} product(s)`,
);
