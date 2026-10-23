import re,json,pathlib
_CANON=json.loads((pathlib.Path(__file__).parent/'canonical-map.json').read_text(encoding='utf8'))
def norm_skill(s):
    s = str(s or "").strip().lower().replace("&", " and ")
    s = re.sub(r"(?<=[a-z])[-_](?=[a-z])", " ", s)          # problem-solving == problem solving
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"^(?:knowledge of|experience (?:in|with)|ability to|proficiency in|strong|excellent|good|basic)\s+", "", s)
    s = re.sub(r"\s+(?:skills?|knowledge|abilities|ability)$", "", s)
    return s.strip(" .,;:-")[:80]

def canon_skill(s):
    """norm_skill, then the synonym grouping from skill_canon.py when it exists"""
    global _CANON
    if _CANON is None:
        p = os.path.join(HERE, "skill_canon.json")
        _CANON = json.load(open(p, encoding="utf-8"))["map"] if os.path.exists(p) else {}
    n = norm_skill(s)
    n = _CANON.get(n, n)
    for rx, to in FAMILY:
        if rx.fullmatch(n):
            return to
    return "" if n in NOT_SKILL or ROLE.search(n) else n

FAMILY = [(re.compile(p), to) for p, to in [
    (r"(?:fluent |fluency in |good |strong |excellent |proficiency in |business |written and spoken |spoken and written |verbal and written |written |spoken |verbal )?english(?: language| communication| proficiency| fluency| speaking| writing| skills)?", "english"),
    (r"(?:fluent |fluency in |written |spoken )?arabic(?: language| communication| proficiency| fluency| speaking| writing)?", "arabic"),
    (r"(?:valid |uae |gcc )?(?:uae |gcc )?driving licen[cs]e(?: \(uae\)| uae)?|(?:valid )?driver'?s licen[cs]e|(?:light vehicle |lmv )?driving licen[cs]e", "driving license"),
    (r"dbas check|enhanced dbs check|dbs clearance", "dbs check"),
    (r"html5", "html"), (r"css3", "css"), (r"ms excel|microsoft excel|advanced excel|excel", "microsoft excel"),
    (r"ms word|word", "microsoft word"), (r"ms office|microsoft office|ms office suite|microsoft office suite", "microsoft office"),
    # audit 2: misspellings of FIDIC, product/credential variants that are the same requirement
    (r"fid(?:ic|el|elic)(?: contracts?| conditions(?: of contract)?| red book| forms? of contract)?", "fidic"),
    (r"crm(?: software| systems?| tools?| platforms?)?", "crm"), (r"primavera(?: p6)?|p6", "primavera p6"),
    (r"dbs|disclosure and barring services? check", "dbs check"),
    (r"first aid(?: training| certification| certificate| certified)?", "first aid"),
    (r"certified public accountant", "cpa"), (r"chartered financial analyst", "cfa"),
    (r"ca|chartered accountant(?:cy)?", "chartered accountant"),
    (r"rera(?: licen[cs]e| certification| certificate| card)?", "rera certification"),
]] + [(re.compile(rf"{a}(?: licen[cs]e[ds]?| licensing| certification| certificate| eligibility| registration)?"), f"{a} license")
      for a in ("haad", "dha", "doh", "moh", "sira")] + [
    (re.compile(rf"{a}(?: v\d)?(?: foundation)?(?: certification| certificate| certified| qualification| credential| membership|"
                rf" standards| guidelines| compliance)?"), a)
    for a in ("itil prince2 leed bls acls pals acsl cipd iosh oshad haccp nebosh cams cisa cism cissp ccna ccnp ccie pmp acca "
              "cma cpa cfa frm cima mcse mcsa crisc ceh oscp togaf cobit shrm cips celta tefl pgce").split()]

NOT_SKILL = {"cv", "visa", "computer", "product", "people", "it support", "experience", "degree", "bachelor", "diploma",
             "salary", "uae", "dubai", "abu dhabi", "freshers", "fresher", "graduate", "male", "female", "full time",
             "part time", "immediate joiner", "passport", "photo", "resume", "references", "work", "job", "staff",
             # job-board names are not skills (and the public site must not name the boards)
             "dubizzle", "gulf talent", "gulftalent", "indeed", "bayt", "bayt.com", "naukri", "naukrigulf", "monster",
             "monster gulf", "foundit", "drjob", "glassdoor"}

ROLE = re.compile(r"^(?:senior |junior |assistant |sales |marketing |it |hr |account |project |area |store |office )?"
                  r"(?:executive|manager|engineer|officer|coordinator|supervisor|director|representative|technician|"
                  r"assistant|associate|consultant|specialist|administrator|receptionist|accountant|driver|cashier)$")
