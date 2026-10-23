You are grouping skill names extracted from job advertisements, for a public labour-market dashboard.
Readers must not see two lines that mean the same requirement (for example "cpr" and "cpr certificate").

Input: the TSV file named below (columns: skill, type, uae_mentions, intl_mentions). Read all of it.

Task: find names that a reader would treat as the SAME requirement and map each variant to one standard name.
Merge when the difference is only:
- spelling, case, punctuation, plural/singular, word order, hyphenation, typos;
- a credential/skill word added: "X certificate", "X certification", "X certified", "X training", "X license", "X course",
  "X card", "knowledge of X", "X skills", "X experience", "proficiency in X", "basic/advanced X", "valid X";
- acronym vs full form ("cpr" = "cardiopulmonary resuscitation"), product version or vendor prefix
  ("ms excel 2016" = "microsoft excel"), or obvious synonyms of the same requirement.
Do NOT merge different requirements: a narrower or different skill stays separate
("financial reporting" vs "financial analysis", "bls" vs "acls", "python" vs "django", "sql" vs "sql server",
"project management" vs "pmp"). When unsure, do not merge.

Standard name: lowercase; prefer the most common form in the file (highest uae_mentions + intl_mentions), unless a clearer
common form exists; keep widely used acronyms as acronyms (cpr, pmp, haccp, sql); never invent a new skill.

Output: ONLY lines of JSON, one per merged variant, nothing else (no prose, no code fences):
{"from": "<variant exactly as in the file>", "to": "<standard name>"}
Skip names that stay unchanged. Every "from" must be a name from the file, copied exactly.
