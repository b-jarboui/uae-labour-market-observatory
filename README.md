# UAE Labour Market Observatory

What UAE employers asked for in job advertisements, 2018–2026: skills, qualifications and experience, by occupation
(ISCO-08), employer industry (ISIC Rev.4) and emirate. Research project.

**Live dashboard:** https://b-jarboui.github.io/uae-labour-market-observatory/ (English / العربية)

## Data sources
Advertisements were collected from publicly available sources, principally public research archives that permit download for research purposes:
- [Internet Archive, Wayback Machine](https://web.archive.org/): archived copies of public UAE job advertisements.
- [Common Crawl](https://commoncrawl.org/): open web crawl archive.
- [Web Data Commons](https://webdatacommons.org/structureddata/): schema.org JobPosting extractions, 2018–2024.

## What is published here
Only derived, aggregated results: for each advertisement a coded row (month, occupation group, industry, emirate,
archive, degree level, years of experience, normalised job title, list of skills). **No advertisement text, URL or
company name is reproduced.**

Cleaning: each archived page reduced to the advertisement; exact duplicates, the same vacancy in the same month, and
near-duplicates (job-specific text ≥80% similar, skills ≥60% overlap, dates ≤1 month apart) removed; reposts in later
months kept.

## Classifications, models and software
- [ISCO-08](https://www.ilo.org/public/english/bureau/stat/isco/isco08/) (ILO) occupations; ISIC Rev.4 (UN) industries.
- [Qwen3-30B-A3B GPTQ-Int4](https://huggingface.co/Qwen/Qwen3-30B-A3B-GPTQ-Int4) with [vLLM](https://github.com/vllm-project/vllm):
  skill / qualification / experience extraction and industry classification; validated on a hand-checked reference
  of 57 ads (93% recall, 96% precision on skills).
- [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) via [Ollama](https://ollama.com/):
  job title → ISCO matching, skill-synonym candidates.
- OpenAI GPT (Codex) and Anthropic Claude: skill-synonym review and plain-language skill explanations (EN/AR).
- [Apache ECharts](https://echarts.apache.org/) 5.5; [IBM Plex](https://github.com/IBM/plex) typefaces.

## Limits
Advertised demand, not employment or vacancies filled. Coverage varies by archive and year. COVID-19 and ChatGPT
markers show timing only, not causal effects.
