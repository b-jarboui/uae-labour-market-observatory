# UAE Labour Market Observatory — integrated 2021+ benchmark

Run `./start.ps1` in PowerShell, or `node serve.mjs`, then open http://127.0.0.1:8767/ . This is a static site suitable for GitHub Pages. Use HTTP rather than opening index.html directly.

## Dashboard

UAE remains the main market. The new collection provides US, UK and Global benchmarks. Compare the percentage of ads mentioning each skill and the percentage-point gap; ad volumes provide sample context.

The visible Skill group control separates:
- Job-specific skills: technical skills, tools, methods and certifications. Choose an occupation to focus on a particular job.
- Soft skills: communication, attention to detail, teamwork and interpersonal/behavioural skills.
- Language skills.
- All skills.

The group applies to the UAE views and benchmark; type/context filters change mention numerators, never sample denominators. Search, table sorting, annual skill histories and contextual CSV exports are included. A short global collection note is at the bottom in English and Arabic.

## UAE preservation

All 157,266 existing UAE release records from January 2021 through September 2026 are retained, across Internet Archive, Common Crawl and Web Data Commons. After date filtering, the original record bytes, skill IDs, postings and qualification fields are preserved. Exact-label skill category corrections are documented in data/skill-group-overrides.json; these do not remove ads or mentions.

The original desktop folders and published GitHub site have not been overwritten by this local release. The original release source is C:/Users/basse/Desktop/claudews/uae_jobs/deploy_v2 .

## International data and units

Raw panel: D:/uae_jobs_wdc/survivor/panel/CC-MAIN-*.jsonl.gz . Twelve May/September snapshots cover 2021–2026. English observations are joined by hash to successful extractions in D:/uae_jobs_export/extract/{surv_p1,batch1,batch2,fix_trunc,fix_trunc2}/results . Successful repairs replace earlier records only for matching hashes; failed repairs never replace valid results.

The extraction union contains 1,041,675 successful hashes. Of these, 811,341 distinct texts occur in the eligible panel. The surv_p1 batch alone has 700,888 records, 695,761 successful. Extraction texts, URL-based ads and repeated snapshot observations are different counting units.

Every retained observation's country was independently reconciled to the raw source. The final full-period benchmark denominators are:

| Benchmark | Distinct market-texts | Companies present |
|---|---:|---:|
| US | 399,881 | 558 |
| UK | 191,514 | 510 |
| Global excluding UAE | 808,704 | 1,942 |

The earlier US count of 761,965 described repeated observations across snapshots/URLs. Final benchmark numerators and denominators count each text once per market within the selected period. Annual histories deduplicate within each year, so annual counts need not sum to the pooled count. Text reused across countries contributes once in each country's sample. Global is ad-weighted over all non-UAE benchmark markets, including US and UK.

All available successful extractions are used. No detector-score filter, research held-out restriction, hidden company cap or vocabulary cap is applied. The original planned US/UK 500-company draw remains available in the pack for sensitivity checks. Site-level ownership and job-board exclusions follow panel eligibility. The research cache g2r_cache.pkl is not used as the dashboard corpus.

## Skill alignment

The original reviewed UAE canonicalization pipeline is shared: normalization, synonym map, reviewed families and non-skill exclusions. Legacy IDs stay fixed; new canonical names append. The international pack has 1,233,357 canonical names and uint32 skill IDs, with no 65,000-name truncation.

Archive comparisons use skills measured in the released UAE vocabulary. An international-only dictionary entry is not interpreted as zero UAE mentions. Existing type IDs are retained except for the reviewed functional-skill corrections in data/skill-group-overrides.json. New labels use their modal extractor type. Job-specific is a category grouping, not a claim that a skill is unique to one occupation.

A nine-bit uint16 flag preserves required/preferred/unknown status and duties/requirements/unknown location. Each canonical skill counts once per sample text. Mention counts 1–9 and corresponding shares/gaps are suppressed in the main comparison.

International occupations use exact matches to the reviewed normalized-title ISCO dictionary. Unknown occupations remain in all-occupation totals, with classification coverage shown. Clear an industry/emirate filter to use international comparisons; no equivalent reviewed international labels are available. Missing international months are missing snapshots, not zero demand; the benchmark uses annual histories rather than the UAE monthly forecast model.

## Rebuild and validate

Python 3.12+ and Node.js; the Python scripts use the standard library. Source paths above must be available. Intermediate hash/SQLite files stay in this task's work/ folder, outside the published site.

```
python scripts/build_integration.py
python scripts/build_ad_identity.py
python scripts/validate_data.py
python scripts/validate_text_counts.py
node --max-old-space-size=4096 scripts/validate_workers.mjs
```

scripts/shared_rules.py and canonical-map.json preserve the original canonicalization rules. No raw ad text, employer names, URLs, credentials, pickles or raw panel files are published.

Validation files:
- validation-data.json: exact retained UAE record/posting preservation, binary integrity and three independent raw-snapshot recounts.
- validation-identity.json: raw country reconciliation for every row and separate observation/ad/text totals.
- validation-text-counts.json: independent distinct-text denominators and communication numerators.
- validation-workers.json: actual worker execution, archive parity, US/UK/Global totals, type-denominator invariance, requirement/context filtering, empty samples and status-mask fixtures.
- data/international/coverage.csv and country-totals.csv: country/snapshot extraction coverage and counting-unit reconciliation.

The existing Evidence section's extraction validation references concern the original UAE review. Benchmark collection documentation appears in the small footer note and files above.

Original project: https://github.com/b-jarboui/uae-labour-market-observatory . Archives: Internet Archive, Common Crawl and Web Data Commons. Original extraction: Qwen3-30B-A3B with vLLM. Charts: Apache ECharts; fonts: IBM Plex. The existing English/Arabic dashboard and UAE analytical modules are preserved.
