const CURRENT_YEAR = new Date().getUTCFullYear();

const SECTION_MARKERS = [
  ["SUMMARY:", "summary"],
  ["ACADEMICS:", "academics"],
  ["TECHNICAL SKILLS:", "technical"],
  ["PROFESSIONAL EXPERIENCE:", "professional"],
  ["RESPONSIBILITIES:", "responsibilities"],
  ["ENVIRONMENT:", "environment"],
];

const SENIORITY_LEVELS = {
  intern: 0,
  entry: 1,
  junior: 2,
  associate: 2,
  mid: 3,
  senior: 4,
  lead: 5,
  staff: 6,
  principal: 7,
  manager: 7,
  director: 8,
};

const SENIORITY_PATTERNS = [
  ["director", /\b(director|head of|vice president|vp|chief)\b/i],
  ["manager", /\b(manager|engineering manager|team manager)\b/i],
  ["principal", /\b(principal)\b/i],
  ["staff", /\b(staff)\b/i],
  ["lead", /\b(lead|tech lead|technical lead)\b/i],
  ["senior", /\b(senior|sr\.?)\b/i],
  ["mid", /\b(mid[-\s]?level|intermediate)\b/i],
  ["associate", /\bassociate\b/i],
  ["junior", /\b(junior|jr\.?)\b/i],
  ["entry", /\b(entry[-\s]?level|new grad|graduate program)\b/i],
  ["intern", /\b(intern|internship|apprentice|trainee)\b/i],
];

const DEGREE_RULES = [
  ["phd", /\b(ph\.?d|doctorate|doctoral)\b/i],
  ["masters", /\b(master'?s|master of|m\.s\.|m\.tech|mba)\b/i],
  ["bachelors", /\b(bachelor'?s|bachelor of|b\.s\.|b\.tech|b\.e\.|bsc)\b/i],
  ["associates", /\bassociate'?s\b/i],
];

const ROLE_SIGNALS = [
  "software engineer",
  "software developer",
  "frontend",
  "backend",
  "full stack",
  "fullstack",
  "business analyst",
  "functional consultant",
  "consultant",
  "database administrator",
  "dba",
  "web",
  "mobile",
  "ios",
  "android",
  "devops",
  "site reliability",
  "sre",
  "platform",
  "cloud",
  "data engineer",
  "data scientist",
  "machine learning",
  "ml",
  "ai",
  "qa",
  "test automation",
  "security",
  "product",
  "analytics",
  "salesforce",
  "sap",
];

const DOMAIN_RULES = [
  ["healthcare", /\b(healthcare|health care|clinical|ehr|emr|medtech|hospital|patient)\b/i],
  ["pharma", /\b(pharma|pharmaceutical|drug discovery|life sciences|biotech)\b/i],
  ["fintech", /\b(fintech|payments|banking|fraud|risk|trading|capital markets|insurance)\b/i],
  ["ecommerce", /\b(ecommerce|e-commerce|retail|marketplace|shopping cart)\b/i],
  ["security", /\b(security|cybersecurity|iam|identity|threat|siem|zero trust)\b/i],
  ["telecom", /\b(telecom|telecommunications|voice engineer|unified communications|call manager|teams phone|five9|cisco)\b/i],
  ["cloud", /\b(cloud|distributed systems|platform engineering|infrastructure)\b/i],
  ["data", /\b(data platform|data pipeline|analytics|business intelligence|etl|warehouse)\b/i],
  ["enterprise_apps", /\b(sap|salesforce|servicenow|s\/4hana|crm|erp|treasury management)\b/i],
  ["ai_ml", /\b(artificial intelligence|machine learning|mlops|llm|nlp|computer vision)\b/i],
];

const PLATFORM_SIGNAL_RULES = [
  {
    label: "distributed systems",
    jdPatterns: [/\bdistributed systems?\b/i],
    resumePatterns: [/\bdistributed systems?\b/i, /\bdistributed architecture\b/i],
  },
  {
    label: "observability",
    jdPatterns: [/\b(observability|prometheus|grafana)\b/i],
    resumePatterns: [/\bobservability\b/i, /\bprometheus\b/i, /\bgrafana\b/i, /\bmonitor(?:ing)?\b/i, /\btracing\b/i],
  },
  {
    label: "performance / reliability",
    jdPatterns: [/\b(performance|latency|reliability|scalability)\b/i],
    resumePatterns: [/\bperformance\b/i, /\blatency\b/i, /\breliability\b/i, /\bscalab(?:le|ility)\b/i],
  },
  {
    label: "production troubleshooting",
    jdPatterns: [/\b(troubleshoot(?:ing)?|production systems?|incident|on-call)\b/i],
    resumePatterns: [/\btroubleshoot(?:ing)?\b/i, /\bproduction systems?\b/i, /\bincident\b/i, /\bon-call\b/i],
  },
];

const SKILL_RULES = [
  { canonical: "javascript", patterns: [/\bjavascript\b/i, /\becmascript\b/i] },
  { canonical: "typescript", patterns: [/\btypescript\b/i] },
  { canonical: "node.js", patterns: [/\bnode\.?js\b/i, /\bnodejs\b/i] },
  { canonical: "react", patterns: [/\breact\b/i, /\breact\.js\b/i, /\breactjs\b/i] },
  { canonical: "next.js", patterns: [/\bnext\.?js\b/i, /\bnextjs\b/i] },
  { canonical: "vue", patterns: [/\bvue\b/i, /\bvue\.js\b/i, /\bvuejs\b/i] },
  { canonical: "angular", patterns: [/\bangular\b/i] },
  { canonical: "html", patterns: [/\bhtml5?\b/i] },
  { canonical: "css", patterns: [/\bcss3?\b/i, /\bscss\b/i, /\bsass\b/i] },
  { canonical: "tailwind", patterns: [/\btailwind\b/i] },
  { canonical: "redux", patterns: [/\bredux\b/i] },
  { canonical: "python", patterns: [/\bpython\b/i] },
  { canonical: "django", patterns: [/\bdjango\b/i] },
  { canonical: "flask", patterns: [/\bflask\b/i] },
  { canonical: "fastapi", patterns: [/\bfastapi\b/i] },
  { canonical: "java", patterns: [/\bjava\b/i] },
  { canonical: "spring", patterns: [/\bspring\b/i, /\bspring boot\b/i] },
  { canonical: "c#", patterns: [/\bc#\b/i, /\bc sharp\b/i] },
  { canonical: ".net", patterns: [/\b\.net\b/i, /\bdotnet\b/i, /\basp\.?net\b/i] },
  { canonical: "go", patterns: [/\bgolang\b/i, /\bgo language\b/i] },
  { canonical: "ruby", patterns: [/\bruby\b/i, /\brails\b/i] },
  { canonical: "php", patterns: [/\bphp\b/i, /\blaravel\b/i] },
  { canonical: "c++", patterns: [/\bc\+\+\b/i] },
  { canonical: "c", patterns: [/\bc language\b/i, /\bembedded c\b/i] },
  { canonical: "rust", patterns: [/\brust\b/i] },
  { canonical: "kotlin", patterns: [/\bkotlin\b/i] },
  { canonical: "swift", patterns: [/\bswift\b/i] },
  { canonical: "react native", patterns: [/\breact native\b/i] },
  { canonical: "flutter", patterns: [/\bflutter\b/i] },
  { canonical: "salesforce", patterns: [/\bsalesforce\b/i, /\bsfdc\b/i, /\bforce\.?com\b/i] },
  { canonical: "sales cloud", patterns: [/\bsales cloud\b/i] },
  { canonical: "service cloud", patterns: [/\bservice cloud\b/i] },
  { canonical: "marketing cloud", patterns: [/\bmarketing cloud\b/i] },
  { canonical: "experience cloud", patterns: [/\bexperience cloud\b/i, /\bcommunity cloud\b/i] },
  { canonical: "cpq", patterns: [/\bcpq\b/i, /\bsalesforce cpq\b/i] },
  { canonical: "sap", patterns: [/\bsap\b/i, /\bsap erp\b/i] },
  { canonical: "sap sd", patterns: [/\bsap sd\b/i, /\bsales and distribution\b/i] },
  { canonical: "sap mm", patterns: [/\bsap mm\b/i, /\bmaterials management\b/i] },
  { canonical: "sap fico", patterns: [/\bsap fico\b/i, /\bsap fi\/co\b/i, /\bsap fi\b/i, /\bsap co\b/i] },
  { canonical: "sap treasury", patterns: [/\bsap treasury\b/i, /\btreasury management\b/i, /\bsap trm\b/i] },
  { canonical: "s/4hana", patterns: [/\bs\/4hana\b/i, /\bs4hana\b/i] },
  { canonical: "abap", patterns: [/\babap\b/i] },
  { canonical: "otc", patterns: [/\botc\b/i, /\border to cash\b/i, /\border-to-cash\b/i] },
  { canonical: "sql", patterns: [/\bsql\b/i, /\bpostgresql\b/i, /\bmysql\b/i, /\boracle\b/i, /\bsql server\b/i] },
  { canonical: "oracle", patterns: [/\boracle\b/i, /\boracle db\b/i, /\boracle database\b/i] },
  { canonical: "sql server", patterns: [/\bsql server\b/i, /\bms sql\b/i, /\bmssql\b/i, /\bmicrosoft sql server\b/i] },
  { canonical: "dba", patterns: [/\bdba\b/i, /\bdatabase administrator\b/i, /\bdatabase administration\b/i] },
  { canonical: "rac", patterns: [/\boracle rac\b/i, /\brac\b/i, /\breal application clusters\b/i] },
  { canonical: "exadata", patterns: [/\bexadata\b/i, /\boracle exadata\b/i] },
  { canonical: "postgres", patterns: [/\bpostgres\b/i, /\bpostgresql\b/i] },
  { canonical: "mysql", patterns: [/\bmysql\b/i] },
  { canonical: "mongodb", patterns: [/\bmongodb\b/i, /\bmongo\b/i] },
  { canonical: "redis", patterns: [/\bredis\b/i] },
  { canonical: "elasticsearch", patterns: [/\belasticsearch\b/i, /\belastic search\b/i] },
  { canonical: "kafka", patterns: [/\bkafka\b/i] },
  { canonical: "rabbitmq", patterns: [/\brabbitmq\b/i] },
  { canonical: "aws", patterns: [/\baws\b/i, /\bamazon web services\b/i] },
  { canonical: "azure", patterns: [/\bazure\b/i] },
  { canonical: "gcp", patterns: [/\bgcp\b/i, /\bgoogle cloud\b/i] },
  { canonical: "docker", patterns: [/\bdocker\b/i] },
  { canonical: "kubernetes", patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { canonical: "terraform", patterns: [/\bterraform\b/i] },
  { canonical: "ansible", patterns: [/\bansible\b/i] },
  { canonical: "linux", patterns: [/\blinux\b/i, /\bunix\b/i] },
  { canonical: "git", patterns: [/\bgit\b/i, /\bgithub\b/i, /\bgitlab\b/i, /\bbitbucket\b/i] },
  { canonical: "ci/cd", patterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i, /\bcontinuous delivery\b/i] },
  { canonical: "github actions", patterns: [/\bgithub actions\b/i] },
  { canonical: "jenkins", patterns: [/\bjenkins\b/i] },
  { canonical: "prometheus", patterns: [/\bprometheus\b/i] },
  { canonical: "grafana", patterns: [/\bgrafana\b/i] },
  { canonical: "observability", patterns: [/\bobservability\b/i] },
  { canonical: "distributed systems", patterns: [/\bdistributed systems?\b/i, /\bdistributed architecture\b/i] },
  { canonical: "rest", patterns: [/\brest\b/i, /\brestful\b/i, /\brest api\b/i] },
  { canonical: "graphql", patterns: [/\bgraphql\b/i] },
  { canonical: "microservices", patterns: [/\bmicroservices?\b/i] },
  { canonical: "spark", patterns: [/\bspark\b/i, /\bapache spark\b/i] },
  { canonical: "hadoop", patterns: [/\bhadoop\b/i] },
  { canonical: "airflow", patterns: [/\bairflow\b/i] },
  { canonical: "snowflake", patterns: [/\bsnowflake\b/i] },
  { canonical: "dbt", patterns: [/\bdbt\b/i] },
  { canonical: "pandas", patterns: [/\bpandas\b/i] },
  { canonical: "numpy", patterns: [/\bnumpy\b/i] },
  { canonical: "pytorch", patterns: [/\bpytorch\b/i] },
  { canonical: "tensorflow", patterns: [/\btensorflow\b/i] },
  { canonical: "scikit-learn", patterns: [/\bscikit[-\s]?learn\b/i, /\bsklearn\b/i] },
  { canonical: "machine learning", patterns: [/\bmachine learning\b/i, /\bml\b/i] },
  { canonical: "artificial intelligence", patterns: [/\bartificial intelligence\b/i, /\bai\b/i] },
  { canonical: "llm", patterns: [/\bllm\b/i, /\blarge language models?\b/i, /\bgenerative ai\b/i] },
  { canonical: "nlp", patterns: [/\bnlp\b/i, /\bnatural language processing\b/i] },
  { canonical: "computer vision", patterns: [/\bcomputer vision\b/i] },
  { canonical: "selenium", patterns: [/\bselenium\b/i] },
  { canonical: "playwright", patterns: [/\bplaywright\b/i] },
  { canonical: "cypress", patterns: [/\bcypress\b/i] },
  { canonical: "pytest", patterns: [/\bpytest\b/i] },
  { canonical: "jest", patterns: [/\bjest\b/i] },
  { canonical: "junit", patterns: [/\bjunit\b/i] },
  { canonical: "agile", patterns: [/\bagile\b/i, /\bscrum\b/i, /\bkanban\b/i] },
  { canonical: "jira", patterns: [/\bjira\b/i] },
  { canonical: "servicenow", patterns: [/\bservicenow\b/i] },
];

const JD_DROP_PATTERNS = [
  /^(company|location)\s*:/i,
  /\b(equal opportunity|eeo|diversity and inclusion|reasonable accommodation)\b/i,
  /\bbenefits?\b/i,
  /\bhealth, dental,? and vision\b/i,
  /\b401\(k\)\b/i,
  /\bpaid time off\b/i,
  /\bwellness\b/i,
  /\bflexible work\b/i,
  /\bwork environment\b/i,
  /\bcompetitive salary\b/i,
  /\bprofessional development stipend\b/i,
  /\blearning and development opportunities\b/i,
  /\babout us\b/i,
  /\bcompany overview\b/i,
  /\bwho we are\b/i,
  /\bour mission\b/i,
  /\bapply now\b/i,
];

const AMBIGUOUS_ROLE_SIGNALS = new Set(["ai", "product", "analytics", "cloud", "web", "mobile", "platform"]);
const JD_SECTION_HEADING_RE =
  /\b(Company|Location|Overview|Responsibilities?|Requirements?|Qualifications?|Minimum Qualifications?|Basic Qualifications?|Preferred Qualifications?|Preferred Skills?|Nice to Have|Benefits?|About Us|Who We Are)\s*:/gi;
const JD_JOB_DESCRIPTION_RE =
  /\bJob Description\b(?=\s*(?:Company|Location|Overview|Responsibilities?|Requirements?|Qualifications?|Preferred|Benefits?|About Us|Who We Are|$))/gi;
const MONTH_NAME_PATTERN =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const EXPERIENCE_ENTRY_RANGE_RE = new RegExp(
  `\\b(?:(?:${MONTH_NAME_PATTERN})\\.?\\s+)?((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:(present|current|now)|(?:(?:${MONTH_NAME_PATTERN})\\.?\\s+)?((?:19|20)\\d{2}))\\b`,
  "ig"
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function average(values) {
  const numeric = (values || []).filter((value) => Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function splitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u2022/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function jdSectionKeyForHeading(label) {
  const source = String(label || "").toLowerCase();
  if (source.startsWith("company")) return "company";
  if (source.startsWith("location")) return "location";
  if (source.startsWith("overview")) return "overview";
  if (source.startsWith("responsibil")) return "responsibilities";
  if (
    source.startsWith("requirement") ||
    source.startsWith("qualification") ||
    source.startsWith("minimum qualification") ||
    source.startsWith("basic qualification")
  ) {
    return "requirements";
  }
  if (source.startsWith("preferred") || source.startsWith("nice to have")) {
    return "preferred";
  }
  if (source.startsWith("benefit")) return "benefits";
  if (source.startsWith("about us") || source.startsWith("who we are") || source.startsWith("job description")) {
    return "about";
  }
  return "other";
}

function extractJdSections(jobDescription) {
  const prepared = String(jobDescription || "")
    .replace(/\u2022/g, "\n- ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(JD_JOB_DESCRIPTION_RE, "\nJob Description:\n")
    .replace(JD_SECTION_HEADING_RE, "\n$1:\n")
    .replace(/\s*[-*•]\s+/g, "\n- ")
    .trim();

  const sections = {
    lead: [],
    overview: [],
    responsibilities: [],
    requirements: [],
    preferred: [],
    benefits: [],
    about: [],
    company: [],
    location: [],
    other: [],
  };

  let currentSection = "lead";
  for (const rawLine of splitLines(prepared)) {
    let line = normalizeText(rawLine).replace(/^[•*-]\s*/, "");
    if (!line) continue;

    const headingMatch = line.match(
      /^(Company|Location|Overview|Responsibilities?|Requirements?|Qualifications?|Minimum Qualifications?|Basic Qualifications?|Preferred Qualifications?|Preferred Skills?|Nice to Have|Benefits?|About Us|Who We Are|Job Description)\s*:?\s*(.*)$/i
    );
    if (headingMatch) {
      currentSection = jdSectionKeyForHeading(headingMatch[1]);
      line = normalizeText(headingMatch[2] || "").replace(/^[•*-]\s*/, "");
      if (!line) continue;
    }

    if (!sections[currentSection]) sections[currentSection] = [];
    sections[currentSection].push(line);
  }

  return sections;
}

function getJdSectionLines(sections, keys) {
  return unique(
    (keys || [])
      .flatMap((key) => (Array.isArray(sections?.[key]) ? sections[key] : []))
      .map((line) => normalizeText(line).replace(/^[•*-]\s*/, ""))
      .filter(Boolean)
  );
}

function isLikelyJdNoiseLine(line) {
  const normalizedLine = normalizeText(line);
  if (!normalizedLine) return true;
  if (JD_DROP_PATTERNS.some((pattern) => pattern.test(normalizedLine))) return true;
  if (/^(company|location|overview|benefits?|about us|who we are|job description)\s*:?\s*$/i.test(normalizedLine)) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z\s]+:\s*$/.test(normalizedLine)) return true;
  return false;
}

function extractTabnerSections(text) {
  const source = String(text || "");
  const sections = {};
  for (let i = 0; i < SECTION_MARKERS.length; i += 1) {
    const [marker, key] = SECTION_MARKERS[i];
    const start = source.indexOf(marker);
    if (start < 0) continue;
    const contentStart = start + marker.length;
    let end = source.length;
    for (let j = i + 1; j < SECTION_MARKERS.length; j += 1) {
      const nextMarker = SECTION_MARKERS[j][0];
      const nextIndex = source.indexOf(nextMarker, contentStart);
      if (nextIndex >= 0) {
        end = Math.min(end, nextIndex);
        break;
      }
    }
    sections[key] = source.slice(contentStart, end).trim();
  }
  return sections;
}

function matchPatterns(text, patterns) {
  return (patterns || []).some((pattern) => pattern.test(text));
}

function extractSkills(text) {
  const source = String(text || "");
  const found = [];
  for (const rule of SKILL_RULES) {
    if (matchPatterns(source, rule.patterns)) found.push(rule.canonical);
  }
  return unique(found);
}

function extractDomains(text) {
  const source = String(text || "");
  return DOMAIN_RULES.filter((rule) => rule[1].test(source)).map((rule) => rule[0]);
}

function extractDegrees(text) {
  const source = String(text || "");
  return DEGREE_RULES.filter((rule) => rule[1].test(source)).map((rule) => rule[0]);
}

function extractSeniority(text) {
  const source = String(text || "");
  for (const [label, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(source)) return label;
  }
  return null;
}

function seniorityValue(label) {
  return label == null ? null : SENIORITY_LEVELS[label] ?? null;
}

function extractRoleSignals(text) {
  const source = String(text || "").toLowerCase();
  return ROLE_SIGNALS.filter((signal) => source.includes(signal));
}

function extractPlatformSignalGroups(text) {
  const source = String(text || "");
  return PLATFORM_SIGNAL_RULES.filter((rule) => rule.jdPatterns.some((pattern) => pattern.test(source))).map((rule) => rule.label);
}

function evaluatePlatformSignalFit(requirements, profile) {
  const activeLabels = Array.isArray(requirements?.platformSignalGroups) ? requirements.platformSignalGroups.filter(Boolean) : [];
  if (!activeLabels.length) return null;

  const activeRules = PLATFORM_SIGNAL_RULES.filter((rule) => activeLabels.includes(rule.label));
  if (!activeRules.length) return null;

  const resumeText = [profile?.surfacedText, profile?.allText].filter(Boolean).join("\n\n");
  const matchedLabels = activeRules
    .filter((rule) => rule.resumePatterns.some((pattern) => pattern.test(resumeText)))
    .map((rule) => rule.label);

  return {
    activeLabels,
    matchedLabels,
    ratio: activeRules.length ? matchedLabels.length / activeRules.length : null,
  };
}

function extractExperienceRange(text) {
  const source = String(text || "").toLowerCase();
  const re = /(\d{1,2})\s*(?:\+|(?:-|–|—|to)\s*(\d{1,2}))?\s*(?:years?|yrs?)/g;
  let match;
  let min = null;
  let max = null;
  while ((match = re.exec(source)) !== null) {
    const a = Number(match[1]);
    const b = match[2] != null ? Number(match[2]) : null;
    if (!Number.isFinite(a)) continue;
    if (min == null || a > min) {
      min = a;
      if (b != null && Number.isFinite(b)) {
        max = b;
      } else if (source.slice(match.index, match.index + match[0].length).includes("+")) {
        max = null;
      } else {
        max = a;
      }
    } else if (a === min && b != null && Number.isFinite(b) && (max == null || b > max)) {
      max = b;
    }
  }
  if (min != null && max != null && max < min) max = null;
  return { min, max };
}

function inferSeniorityExperienceFloor(text) {
  const seniority = extractSeniority(text);
  const value = seniorityValue(seniority);
  if (value == null) return null;
  if (value >= SENIORITY_LEVELS.director) return 10;
  if (value >= SENIORITY_LEVELS.principal) return 8;
  if (value >= SENIORITY_LEVELS.staff) return 7;
  if (value >= SENIORITY_LEVELS.lead) return 6;
  if (value >= SENIORITY_LEVELS.senior) return 4;
  if (value >= SENIORITY_LEVELS.mid) return 2;
  return 0;
}

function extractLikelyTitle(text) {
  const normalized = normalizeText(text);
  const preamble = normalized
    .split(
      /\b(?:job description|company|location|overview|responsibilities?|requirements?|qualifications?|preferred qualifications?|preferred skills?|benefits?|about us|who we are)\s*:?\b/i
    )[0]
    ?.trim()
    .replace(/[-|:]+$/g, "")
    .trim();
  if (preamble && preamble.length <= 120) return preamble;

  const lines = splitLines(text).slice(0, 6);
  for (const line of lines) {
    if (line.length > 120) continue;
    const low = line.toLowerCase();
    if (ROLE_SIGNALS.some((signal) => low.includes(signal)) || /\b(engineer|developer|architect|scientist|analyst|manager)\b/i.test(line)) {
      return line.replace(/[-|:]+$/g, "").trim();
    }
  }
  return (lines[0] || "").replace(/[-|:]+$/g, "").trim();
}

function coverageRatio(expected, actual) {
  const need = Array.isArray(expected) ? expected.filter(Boolean) : [];
  const have = new Set(Array.isArray(actual) ? actual.filter(Boolean) : []);
  if (!need.length) return null;
  let hits = 0;
  for (const value of need) {
    if (have.has(value)) hits += 1;
  }
  return hits / need.length;
}

function flattenSkillGroups(groups) {
  return unique((groups || []).flatMap((group) => (Array.isArray(group) ? group : [])));
}

function groupCoverageRatio(groups, actual) {
  const normalizedGroups = Array.isArray(groups) ? groups.filter((group) => Array.isArray(group) && group.length) : [];
  const have = new Set(Array.isArray(actual) ? actual.filter(Boolean) : []);
  if (!normalizedGroups.length) return null;
  let hits = 0;
  for (const group of normalizedGroups) {
    if (group.some((skill) => have.has(skill))) hits += 1;
  }
  return hits / normalizedGroups.length;
}

function matchedGroups(groups, actual) {
  const have = new Set(Array.isArray(actual) ? actual.filter(Boolean) : []);
  return (groups || [])
    .filter((group) => Array.isArray(group) && group.length && group.some((skill) => have.has(skill)))
    .map((group) => group.filter((skill) => have.has(skill)))
    .map((group) => group.join(" / "));
}

function missingGroups(groups, actual) {
  const have = new Set(Array.isArray(actual) ? actual.filter(Boolean) : []);
  return (groups || [])
    .filter((group) => Array.isArray(group) && group.length && !group.some((skill) => have.has(skill)))
    .map((group) => group.join(" / "));
}

function intersect(expected, actual) {
  const have = new Set(Array.isArray(actual) ? actual : []);
  return unique((expected || []).filter((value) => have.has(value)));
}

function missing(expected, actual) {
  const have = new Set(Array.isArray(actual) ? actual : []);
  return unique((expected || []).filter((value) => !have.has(value)));
}

function countKeywordHits(text, keywords) {
  const source = String(text || "").toLowerCase();
  if (!source) return 0;
  let hits = 0;
  for (const keyword of keywords || []) {
    if (!keyword) continue;
    if (source.includes(String(keyword).toLowerCase())) hits += 1;
  }
  return hits;
}

function keywordSurfacingOpportunities(allText, surfacedText, keywords) {
  const haystack = String(allText || "").toLowerCase();
  const surfaced = String(surfacedText || "").toLowerCase();
  const hits = [];
  for (const keyword of keywords || []) {
    const needle = String(keyword || "").trim().toLowerCase();
    if (!needle) continue;
    if (haystack.includes(needle) && !surfaced.includes(needle)) hits.push(keyword);
  }
  return unique(hits);
}

function estimateResumeYears(sections) {
  const professional = String(sections.professional || "");
  const summary = String(sections.summary || "");
  const explicit = extractExperienceRange(`${summary}\n${professional}`).min;
  const years = [];
  const re = /\b(19|20)\d{2}\b/g;
  let match;
  while ((match = re.exec(professional)) !== null) {
    const value = Number(match[0]);
    if (value >= 1980 && value <= CURRENT_YEAR + 1) years.push(value);
  }
  const normalizedYears = unique(years).sort((a, b) => a - b);
  const earliest = normalizedYears[0] || null;
  let latest = normalizedYears[normalizedYears.length - 1] || null;
  if (latest != null && /\b(current|present)\b/i.test(professional)) {
    latest = CURRENT_YEAR;
  }
  const rangeYears =
    earliest != null && latest != null && latest >= earliest ? clamp(latest - earliest, 0, 40) : null;
  const estimate = Math.max(Number(explicit) || 0, Number(rangeYears) || 0);
  return estimate || null;
}

function classifyRequirementBucket(line) {
  const source = String(line || "").toLowerCase();
  if (
    /\b(preferred|nice to have|bonus|plus|desired|good to have|would be a plus|preferred qualifications?)\b/.test(source)
  ) {
    return "preferred";
  }
  if (
    /\b(required|requirements?|must have|must-have|minimum qualifications?|basic qualifications?|need to have|you have|must possess)\b/.test(
      source
    )
  ) {
    return "required";
  }
  return "general";
}

function extractJobRequirements(jobDescription) {
  const source = normalizeText(jobDescription);
  const jdSections = extractJdSections(jobDescription);
  const requirementLines = getJdSectionLines(jdSections, ["requirements"]);
  const preferredLines = getJdSectionLines(jdSections, ["preferred"]);
  const responsibilityLines = getJdSectionLines(jdSections, ["responsibilities"]);
  const overviewLines = getJdSectionLines(jdSections, ["overview"]);
  const fallbackLines = getJdSectionLines(jdSections, ["lead", "other"]);
  const title = extractLikelyTitle(source);
  const titleSignals = extractRoleSignals(title);
  const titleSkills = extractSkills(title);
  const requirementContext = requirementLines.concat(preferredLines).join("\n");
  const roleContext = [title]
    .concat(requirementLines, preferredLines, responsibilityLines, overviewLines)
    .join("\n");
  const extractionContext = roleContext || source;
  const allSkills = extractSkills(extractionContext || source);
  const domains = extractDomains(extractionContext || source);
  const platformSignalGroups = extractPlatformSignalGroups(extractionContext || source);
  const degrees = extractDegrees(requirementContext || extractionContext || source);
  const equivalentSource = requirementContext || extractionContext || source;
  const acceptsEquivalentExperience =
    /\b(or|and\/or)\s+equivalent experience\b/i.test(equivalentSource) || /\bequivalent experience\b/i.test(equivalentSource);
  const seniorityContext = [title, requirementContext, responsibilityLines.join("\n")].filter(Boolean).join("\n") || source;
  const seniority = extractSeniority(seniorityContext);
  const yearsRange = extractExperienceRange(requirementContext || extractionContext || source);
  const seniorityFloor = inferSeniorityExperienceFloor(seniorityContext);
  const requiredSkills = [];
  const preferredSkills = [];
  const requiredSkillGroups = [];
  const preferredSkillGroups = [];
  let currentBucket = "general";

  const structuredLines = []
    .concat(requirementLines.map((line) => ({ line, bucket: "required" })))
    .concat(preferredLines.map((line) => ({ line, bucket: "preferred" })))
    .concat(responsibilityLines.map((line) => ({ line, bucket: "general" })))
    .concat(overviewLines.map((line) => ({ line, bucket: "general" })));
  const fallbackStructuredLines = fallbackLines.flatMap((line) =>
    line
      .split(/(?<=[.;])\s+/)
      .map((piece) => piece.trim())
      .filter(Boolean)
      .map((piece) => ({ line: piece, bucket: "general" }))
  );
  const lines = structuredLines.length ? structuredLines : fallbackStructuredLines;

  for (const entry of lines) {
    let normalizedLine = String(entry?.line || "").trim();
    if (!normalizedLine || isLikelyJdNoiseLine(normalizedLine)) continue;
    currentBucket = entry?.bucket || currentBucket;

    const skills = extractSkills(normalizedLine);
    if (!skills.length) continue;
    const bucket = classifyRequirementBucket(normalizedLine);
    const effectiveBucket = bucket === "general" ? currentBucket : bucket;
    const isAlternativeGroup = /\bor\b/i.test(normalizedLine) && skills.length > 1;
    const groups = isAlternativeGroup ? [unique(skills)] : unique(skills).map((skill) => [skill]);
    if (effectiveBucket === "required") {
      requiredSkills.push(...skills);
      requiredSkillGroups.push(...groups);
    } else if (effectiveBucket === "preferred") {
      preferredSkills.push(...skills);
      preferredSkillGroups.push(...groups);
    }
  }

  const normalizedRequired = unique(requiredSkills.length ? requiredSkills : titleSkills.concat(allSkills.slice(0, 8)));
  const normalizedPreferred = unique(preferredSkills.filter((skill) => !normalizedRequired.includes(skill)));
  const normalizedRequiredGroups = requiredSkillGroups.length
    ? requiredSkillGroups
    : normalizedRequired.map((skill) => [skill]);
  const normalizedPreferredGroups = preferredSkillGroups.length
    ? preferredSkillGroups.filter((group) => group.some((skill) => !normalizedRequired.includes(skill)))
    : normalizedPreferred.map((skill) => [skill]);
  const contextualRoleSignals = extractRoleSignals(roleContext).filter(
    (signal) => !AMBIGUOUS_ROLE_SIGNALS.has(signal) || titleSignals.includes(signal)
  );
  const roleKeywords = unique(
    titleSignals.concat(
      contextualRoleSignals.length
        ? contextualRoleSignals
        : extractRoleSignals(requirementContext || extractionContext || source).filter(
            (signal) => !AMBIGUOUS_ROLE_SIGNALS.has(signal)
          )
    )
  );
  const coreKeywords = unique(
    normalizedRequired
      .concat(normalizedPreferred)
      .concat(roleKeywords)
      .concat(domains)
      .concat(platformSignalGroups)
      .slice(0, 16)
  );

  return {
    title,
    requiredSkills: normalizedRequired,
    preferredSkills: normalizedPreferred,
    requiredSkillGroups: normalizedRequiredGroups,
    preferredSkillGroups: normalizedPreferredGroups,
    allSkills,
    domains,
    degrees,
    acceptsEquivalentExperience,
    seniority,
    roleKeywords,
    platformSignalGroups,
    yearsRange,
    experienceFloor: Math.max(yearsRange.min == null ? 0 : yearsRange.min, seniorityFloor == null ? 0 : seniorityFloor) || null,
    keywordSet: coreKeywords,
  };
}

function extractRelevantJdLines(jobDescription, requirements) {
  const jdSections = extractJdSections(jobDescription);
  const prioritizedLines = []
    .concat(getJdSectionLines(jdSections, ["requirements"]))
    .concat(getJdSectionLines(jdSections, ["preferred"]))
    .concat(getJdSectionLines(jdSections, ["responsibilities"]))
    .concat(getJdSectionLines(jdSections, ["overview"]));
  const fallbackLines = prioritizedLines.length ? [] : getJdSectionLines(jdSections, ["lead", "other"]);
  const lines = prioritizedLines.length ? prioritizedLines : fallbackLines;
  const kept = [];
  const seen = new Set();
  const requiredSkillSet = new Set(flattenSkillGroups(requirements.requiredSkillGroups || []));
  const preferredSkillSet = new Set(flattenSkillGroups(requirements.preferredSkillGroups || []));
  const keywordSet = new Set(requirements.keywordSet || []);
  const roleSet = new Set(requirements.roleKeywords || []);
  const domainSet = new Set(requirements.domains || []);

  for (const line of lines) {
    const normalizedLine = String(line || "").trim();
    if (!normalizedLine) continue;
    if (normalizedLine.length < 6) continue;
    if (isLikelyJdNoiseLine(normalizedLine)) continue;

    const lineSkills = extractSkills(normalizedLine);
    const lineDomains = extractDomains(normalizedLine);
    const lineDegrees = extractDegrees(normalizedLine);
    const lineRoleSignals = extractRoleSignals(normalizedLine);
    const lineExperience = extractExperienceRange(normalizedLine);
    const lineSeniority = extractSeniority(normalizedLine);
    const looksRequirementLike =
      /\b(requirements?|qualifications?|must[- ]have|nice to have|preferred|skills?|experience|education|technologies?|tools?|proficiency|familiarity|knowledge|problem[- ]solving|communication|distributed systems?)\b/i.test(
        normalizedLine
      );
    const matchesKeywordSet =
      keywordSet.size > 0 &&
      Array.from(keywordSet).some((keyword) =>
        normalizedLine.toLowerCase().includes(String(keyword || "").toLowerCase())
      );

    const keep =
      looksRequirementLike ||
      lineSkills.some((skill) => requiredSkillSet.has(skill) || preferredSkillSet.has(skill)) ||
      lineDomains.some((domain) => domainSet.has(domain)) ||
      lineRoleSignals.some((signal) => roleSet.has(signal)) ||
      lineDegrees.length > 0 ||
      lineExperience.min != null ||
      lineSeniority != null ||
      matchesKeywordSet;

    if (!keep) continue;
    const dedupeKey = normalizedLine.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    kept.push(normalizedLine.replace(/^[•*-]\s*/, ""));
  }

  return kept;
}

function formatExperienceRequirement(requirements) {
  const range = requirements?.yearsRange || {};
  const min = Number(range.min);
  const max = Number(range.max);
  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    if (max === min) return `${min}+ years`;
    return `${min}-${max} years`;
  }
  if (Number.isFinite(min)) return `${min}+ years`;
  const floor = Number(requirements?.experienceFloor);
  if (Number.isFinite(floor)) return `${floor}+ years`;
  return null;
}

function buildNormalizedJobDescription(jobDescription) {
  const raw = normalizeText(jobDescription);
  const requirements = extractJobRequirements(raw);
  const lines = [];
  const title = String(requirements.title || "")
    .replace(/\bCompany\s*:.*$/i, "")
    .replace(/\bLocation\s*:.*$/i, "")
    .replace(/\bOverview\s*:.*$/i, "")
    .trim();

  if (title) lines.push(`TITLE: ${title}`);

  const experienceRequirement = formatExperienceRequirement(requirements);
  if (experienceRequirement) {
    lines.push(`EXPERIENCE: ${experienceRequirement}`);
  }

  if (requirements.seniority) {
    lines.push(`SENIORITY: ${requirements.seniority}`);
  }

  if (requirements.degrees.length) {
    lines.push(
      `EDUCATION: ${requirements.degrees.join(", ")}${
        requirements.acceptsEquivalentExperience ? " or equivalent experience" : ""
      }`
    );
  }

  if (requirements.requiredSkillGroups.length) {
    lines.push(
      `REQUIRED SKILLS: ${requirements.requiredSkillGroups.map((group) => group.join(" / ")).join("; ")}`
    );
  }

  if (requirements.preferredSkillGroups.length) {
    lines.push(
      `PREFERRED SKILLS: ${requirements.preferredSkillGroups.map((group) => group.join(" / ")).join("; ")}`
    );
  }

  if (requirements.domains.length) {
    lines.push(`DOMAINS: ${requirements.domains.join(", ")}`);
  }

  if (requirements.roleKeywords.length) {
    lines.push(`ROLE KEYWORDS: ${requirements.roleKeywords.join(", ")}`);
  }

  const contextLines = extractRelevantJdLines(raw, requirements).slice(0, 10);
  if (contextLines.length) {
    lines.push("MATCHING CONTEXT:");
    lines.push(...contextLines.map((line) => `- ${line}`));
  }

  return {
    normalizedText: lines.join("\n").trim() || raw,
    requirements,
  };
}

function extractResumeProfile(formattedResume) {
  const sections = extractTabnerSections(formattedResume);
  const summary = String(sections.summary || "");
  const technical = String(sections.technical || "");
  const professional = String(sections.professional || "");
  const academics = String(sections.academics || "");
  const environment = String(sections.environment || "");
  const hasStructuredSections = Boolean(summary || technical || professional || academics || environment);
  const rawText = normalizeText(String(formattedResume || ""));
  const allText = hasStructuredSections ? [summary, technical, professional, academics, environment].join("\n\n") : rawText;
  const surfacedText = hasStructuredSections ? [summary, technical, environment].join("\n\n") : rawText;
  return {
    sections,
    allText,
    surfacedText,
    allSkills: extractSkills(allText),
    surfacedSkills: extractSkills(surfacedText),
    domains: extractDomains(allText),
    degrees: extractDegrees(academics || allText),
    seniority: extractSeniority(`${summary}\n${professional}`),
    roleKeywords: unique(extractRoleSignals(`${summary}\n${professional}`)),
    estimatedYears: estimateResumeYears(sections),
  };
}

function upsertSkillEvidence(recencyBySkill, skill, evidence) {
  if (!skill || !evidence || !Number.isFinite(evidence.score)) return;
  const existing = recencyBySkill.get(skill);
  if (
    !existing ||
    evidence.score > existing.score ||
    (evidence.score === existing.score && Number(evidence.endYear || 0) > Number(existing.endYear || 0))
  ) {
    recencyBySkill.set(skill, evidence);
  }
}

function skillRecencyRatioFromEndYear(endYear) {
  if (!Number.isFinite(endYear)) return 0.45;
  const age = Math.max(0, CURRENT_YEAR - endYear);
  if (age <= 1) return 1;
  if (age <= 3) return 0.9;
  if (age <= 5) return 0.75;
  if (age <= 8) return 0.55;
  return 0.35;
}

function buildSkillRecencyIndex(profile) {
  const professional = String(profile?.sections?.professional || "");
  const recencyBySkill = new Map();
  const matches = [];
  let match;
  const matcher = new RegExp(EXPERIENCE_ENTRY_RANGE_RE);

  while ((match = matcher.exec(professional)) !== null) {
    const startYear = Number(match[1]);
    const endYear = match[2] ? CURRENT_YEAR : Number(match[3]);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) continue;
    matches.push({
      index: match.index,
      endIndex: matcher.lastIndex,
      startYear,
      endYear,
      current: Boolean(match[2]),
    });
  }

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const blockStart = Math.max(0, current.index - 200);
    const blockEnd = next ? next.index : Math.min(professional.length, current.endIndex + 1200);
    const blockText = professional.slice(blockStart, blockEnd);
    const blockSkills = extractSkills(blockText);
    const score = skillRecencyRatioFromEndYear(current.endYear);
    for (const skill of blockSkills) {
      upsertSkillEvidence(recencyBySkill, skill, {
        score,
        endYear: current.endYear,
        source: "dated",
      });
    }
  }

  for (const skill of profile?.surfacedSkills || []) {
    upsertSkillEvidence(recencyBySkill, skill, {
      score: 0.65,
      endYear: null,
      source: "surfaced_undated",
    });
  }

  for (const skill of profile?.allSkills || []) {
    upsertSkillEvidence(recencyBySkill, skill, {
      score: 0.45,
      endYear: null,
      source: "undated",
    });
  }

  return recencyBySkill;
}

function buildGroupRecencyScores(groups, recencyBySkill) {
  return (groups || [])
    .filter((group) => Array.isArray(group) && group.length)
    .map((group) => {
      const evidence = unique(group)
        .map((skill) => ({ skill, evidence: recencyBySkill.get(skill) || null }))
        .filter((item) => item.evidence != null)
        .sort((a, b) => {
          const scoreDiff = b.evidence.score - a.evidence.score;
          if (scoreDiff !== 0) return scoreDiff;
          return Number(b.evidence.endYear || 0) - Number(a.evidence.endYear || 0);
        })[0];

      if (!evidence) return null;
      return {
        label: group.join(" / "),
        skill: evidence.skill,
        score: evidence.evidence.score,
        endYear: evidence.evidence.endYear,
        source: evidence.evidence.source,
      };
    })
    .filter(Boolean);
}

function category(name, weight, ratio, detail) {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  const normalizedRatio = clamp(ratio, 0, 1);
  return {
    name,
    weight,
    score: normalizedRatio,
    earned: weight * normalizedRatio,
    detail: detail || "",
  };
}

function weightedAverage(parts) {
  const applicable = (Array.isArray(parts) ? parts : []).filter(
    (part) => Number.isFinite(Number(part?.score)) && Number.isFinite(Number(part?.weight)) && Number(part.weight) > 0
  );
  if (!applicable.length) return null;
  const totalWeight = applicable.reduce((sum, part) => sum + Number(part.weight), 0);
  if (!totalWeight) return null;
  const earned = applicable.reduce((sum, part) => sum + Number(part.score) * Number(part.weight), 0);
  return clamp(earned / totalWeight, 0, 1);
}

function fitComponent(name, weight, score, detail) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  return {
    name,
    weight,
    score: clamp(Number(score), 0, 1),
    detail: detail || "",
  };
}

function yearsScore(requirements, profile) {
  const floor = requirements.experienceFloor;
  if (floor == null) return null;
  const years = profile.estimatedYears;
  const min = Number(requirements?.yearsRange?.min);
  const max = Number(requirements?.yearsRange?.max);
  const hasTightUpperBand =
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max >= min &&
    max - min <= 4;
  const bandLabel =
    Number.isFinite(min) && Number.isFinite(max) && max >= min ? `${min}-${max} years` : `${floor}+ years`;
  if (years == null) {
    return category("experience", 12, 0.25, "Resume does not make total years of experience explicit.");
  }
  if (hasTightUpperBand && years > max + 6) {
    return category("experience", 12, 0.3, `Estimated ${years} years looks substantially above the JD's ${bandLabel} target band.`);
  }
  if (hasTightUpperBand && years > max + 3) {
    return category("experience", 12, 0.5, `Estimated ${years} years looks meaningfully above the JD's ${bandLabel} target band.`);
  }
  if (hasTightUpperBand && years > max + 1) {
    return category("experience", 12, 0.72, `Estimated ${years} years is above the JD's ${bandLabel} target band.`);
  }
  if (hasTightUpperBand && years >= min && years <= max) {
    return category("experience", 12, 1, `Estimated ${years} years lands inside the JD's ${bandLabel} target band.`);
  }
  if (years >= floor + 2) {
    return category("experience", 12, 1, `Estimated ${years} years meets the ${floor}+ year floor.`);
  }
  if (years >= floor) {
    return category("experience", 12, 0.85, `Estimated ${years} years roughly meets the ${floor}+ year floor.`);
  }
  if (years + 1 >= floor) {
    return category("experience", 12, 0.55, `Estimated ${years} years is slightly below the ${floor}+ year floor.`);
  }
  return category("experience", 12, 0.15, `Estimated ${years} years is below the ${floor}+ year floor.`);
}

function educationScore(requirements, profile) {
  const requiredDegrees = Array.isArray(requirements.degrees) ? requirements.degrees.filter(Boolean) : [];
  if (!requiredDegrees.length) return null;

  const matchedDegrees = intersect(requiredDegrees, profile.degrees);
  if (matchedDegrees.length) {
    const degreeRatio = coverageRatio(requiredDegrees, profile.degrees);
    return category(
      "education",
      3,
      degreeRatio,
      `Education alignment matched ${matchedDegrees.length} degree signal${matchedDegrees.length === 1 ? "" : "s"}.`
    );
  }

  if (!requirements.acceptsEquivalentExperience) {
    return category("education", 3, 0, "Education alignment matched 0 degree signals.");
  }

  const years = profile.estimatedYears;
  const floor = requirements.experienceFloor;
  if (years == null) {
    return category(
      "education",
      3,
      0.35,
      "JD allows equivalent experience, but the resume does not make that substitute explicit enough yet."
    );
  }
  if (floor != null && years >= floor + 2) {
    return category(
      "education",
      3,
      1,
      `JD allows equivalent experience, and the resume exceeds the ${floor}+ year floor at about ${years} years.`
    );
  }
  if (floor != null && years >= floor) {
    return category(
      "education",
      3,
      0.85,
      `JD allows equivalent experience, and the resume roughly meets the ${floor}+ year floor at about ${years} years.`
    );
  }
  if (years >= 5) {
    return category(
      "education",
      3,
      0.7,
      `JD allows equivalent experience, and the resume shows about ${years} years of relevant experience.`
    );
  }
  return category(
    "education",
    3,
    0.45,
    "JD allows equivalent experience, but the resume does not yet show a strong substitute for the degree requirement."
  );
}

function seniorityScore(requirements, profile) {
  const need = seniorityValue(requirements.seniority);
  if (need == null) return null;
  const have = seniorityValue(profile.seniority);
  if (have == null) {
    return category("seniority", 8, 0.45, "Resume seniority signals are weak.");
  }
  const diff = have - need;
  if (diff >= 0 && diff <= 1) return category("seniority", 8, 1, "Resume seniority matches the role.");
  if (diff === -1) return category("seniority", 8, 0.55, "Resume looks one level lighter than the role.");
  if (diff > 1) return category("seniority", 8, 0.75, "Resume may be slightly more senior than the role.");
  return category("seniority", 8, 0.2, "Resume seniority is far from the role.");
}

function buildAtsEvaluation({ jobDescription, resumeText, retrievalScore = null, precomputedRequirements = null }) {
  const requirements = precomputedRequirements || extractJobRequirements(jobDescription);
  const profile = extractResumeProfile(resumeText);
  const skillRecency = buildSkillRecencyIndex(profile);

  const requiredAnywhereRatio = groupCoverageRatio(requirements.requiredSkillGroups, profile.allSkills);
  const requiredSurfacedRatio = groupCoverageRatio(requirements.requiredSkillGroups, profile.surfacedSkills);
  const preferredRatio = groupCoverageRatio(requirements.preferredSkillGroups, profile.allSkills);
  const roleRatio = coverageRatio(requirements.roleKeywords, profile.roleKeywords);
  const domainRatio = coverageRatio(requirements.domains, profile.domains);
  const keywordHits = countKeywordHits(profile.surfacedText, requirements.keywordSet);
  const keywordRatio = requirements.keywordSet.length ? keywordHits / requirements.keywordSet.length : null;
  const hiddenKeywordOpportunities = keywordSurfacingOpportunities(
    profile.allText,
    profile.surfacedText,
    requirements.keywordSet
  );
  const matchedRequiredSkills = intersect(requirements.requiredSkills, profile.allSkills);
  const matchedSurfacedSkills = intersect(requirements.requiredSkills, profile.surfacedSkills);
  const matchedPreferredSkills = intersect(requirements.preferredSkills, profile.allSkills);
  const matchedSurfacedPreferredSkills = intersect(requirements.preferredSkills, profile.surfacedSkills);
  const requiredMatchedGroupList = matchedGroups(requirements.requiredSkillGroups, profile.allSkills);
  const surfacedMatchedGroupList = matchedGroups(requirements.requiredSkillGroups, profile.surfacedSkills);
  const missingRequiredSkillGroups = missingGroups(requirements.requiredSkillGroups, profile.allSkills);
  const missingSurfacedSkillGroups = missingGroups(requirements.requiredSkillGroups, profile.surfacedSkills);
  const preferredMatchedGroupList = matchedGroups(requirements.preferredSkillGroups, profile.allSkills);
  const supportedButUnsurfacedRequiredSkills = matchedRequiredSkills.filter(
    (skill) => !matchedSurfacedSkills.includes(skill)
  );
  const supportedButUnsurfacedPreferredSkills = matchedPreferredSkills.filter(
    (skill) => !matchedSurfacedPreferredSkills.includes(skill)
  );
  const supportedButUnsurfacedRequiredSkillGroups = requiredMatchedGroupList.filter(
    (group) => !surfacedMatchedGroupList.includes(group)
  );
  const requiredRecencyScores = buildGroupRecencyScores(requirements.requiredSkillGroups, skillRecency);
  const preferredRecencyScores = buildGroupRecencyScores(requirements.preferredSkillGroups, skillRecency);
  const requiredRecencyRatio = average(requiredRecencyScores.map((item) => item.score));
  const preferredRecencyRatio = average(preferredRecencyScores.map((item) => item.score));
  const platformSignalFit = evaluatePlatformSignalFit(requirements, profile);
  const recentRequiredSkills = matchedRequiredSkills.filter((skill) => Number(skillRecency.get(skill)?.score) >= 0.85);
  const recentPreferredSkills = matchedPreferredSkills.filter((skill) => Number(skillRecency.get(skill)?.score) >= 0.85);
  const staleRequiredSkills = matchedRequiredSkills.filter((skill) => {
    const score = Number(skillRecency.get(skill)?.score);
    return Number.isFinite(score) && score < 0.65;
  });
  const stalePreferredSkills = matchedPreferredSkills.filter((skill) => {
    const score = Number(skillRecency.get(skill)?.score);
    return Number.isFinite(score) && score < 0.65;
  });
  const recentRequiredGroups = requiredRecencyScores.filter((item) => item.score >= 0.85);
  const recentPreferredGroups = preferredRecencyScores.filter((item) => item.score >= 0.85);
  const yearsCategory = yearsScore(requirements, profile);
  const seniorityCategory = seniorityScore(requirements, profile);
  const roleAlignmentCategory = category(
    "role_alignment",
    8,
    roleRatio,
    requirements.roleKeywords.length ? `Role/title alignment hit ${intersect(requirements.roleKeywords, profile.roleKeywords).length} role signals.` : ""
  );
  const domainAlignmentCategory = category(
    "domain_alignment",
    6,
    domainRatio,
    requirements.domains.length ? `Domain alignment matched ${intersect(requirements.domains, profile.domains).length} domain signals.` : ""
  );
  const platformObservabilityCategory = category(
    "platform_observability",
    8,
    platformSignalFit?.ratio,
    platformSignalFit?.activeLabels?.length
      ? `${platformSignalFit.matchedLabels.length}/${platformSignalFit.activeLabels.length} platform/observability signal groups are evidenced in the resume.`
      : ""
  );
  const educationCategory = educationScore(requirements, profile);
  const atsKeywordCategory = category(
    "ats_keyword_surfacing",
    4,
    keywordRatio,
    requirements.keywordSet.length ? `${keywordHits}/${requirements.keywordSet.length} JD keywords appear in summary/skills sections.` : ""
  );

  const categories = [
    category(
      "required_skills_anywhere",
      20,
      requiredAnywhereRatio,
      requirements.requiredSkillGroups.length
        ? `${requiredMatchedGroupList.length}/${requirements.requiredSkillGroups.length} required skill groups found anywhere in the resume.`
        : ""
    ),
    category(
      "required_skills_surfaced",
      16,
      requiredSurfacedRatio,
      requirements.requiredSkillGroups.length
        ? `${surfacedMatchedGroupList.length}/${requirements.requiredSkillGroups.length} required skill groups are clearly surfaced in ATS-friendly sections.`
        : ""
    ),
    category(
      "preferred_skills",
      6,
      preferredRatio,
      requirements.preferredSkillGroups.length
        ? `${preferredMatchedGroupList.length}/${requirements.preferredSkillGroups.length} preferred skill groups are present.`
        : ""
    ),
    category(
      "required_skills_recency",
      18,
      requiredRecencyRatio,
      requiredRecencyScores.length
        ? `${recentRequiredGroups.length}/${requiredRecencyScores.length} matched required groups show recent hands-on evidence.`
        : ""
    ),
    category(
      "preferred_skills_recency",
      5,
      preferredRecencyRatio,
      preferredRecencyScores.length
        ? `${recentPreferredGroups.length}/${preferredRecencyScores.length} matched preferred groups show recent hands-on evidence.`
        : ""
    ),
    yearsCategory,
    seniorityCategory,
    roleAlignmentCategory,
    domainAlignmentCategory,
    platformObservabilityCategory,
    educationCategory,
    atsKeywordCategory,
  ].filter(Boolean);

  const applicableWeight = categories.reduce((sum, item) => sum + item.weight, 0);
  const earned = categories.reduce((sum, item) => sum + item.earned, 0);
  const legacyAtsRatio = applicableWeight > 0 ? earned / applicableWeight : 0;
  let atsScore = Math.round(clamp(legacyAtsRatio * 95, 0, 95));

  const requiredSkillsScore = weightedAverage([
    { score: requiredAnywhereRatio, weight: 0.45 },
    { score: requiredSurfacedRatio, weight: 0.3 },
    { score: requiredRecencyRatio, weight: 0.25 },
  ]);
  const experienceScore = weightedAverage([
    { score: yearsCategory?.score, weight: 0.7 },
    { score: seniorityCategory?.score, weight: 0.2 },
    { score: roleAlignmentCategory?.score, weight: 0.1 },
  ]);
  const preferredSkillsScore = weightedAverage([
    { score: preferredRatio, weight: 0.75 },
    { score: preferredRecencyRatio, weight: 0.25 },
  ]);
  const optionalAlignmentScore = weightedAverage([
    { score: domainAlignmentCategory?.score, weight: 0.5 },
    { score: platformObservabilityCategory?.score, weight: 0.25 },
    { score: educationCategory?.score, weight: 0.25 },
  ]);
  const atsSurfaceScore = weightedAverage([
    { score: requiredSurfacedRatio, weight: 0.65 },
    { score: atsKeywordCategory?.score, weight: 0.35 },
  ]);
  const atsSupportScore = clamp(atsScore / 95, 0, 1);
  const requiredGroupCountValue = requirements.requiredSkillGroups.length;
  const matchedRequiredGroupCount = requiredMatchedGroupList.length;
  const recentRequiredGroupCount = recentRequiredGroups.length;
  const allRequiredGroupsMatched = requiredGroupCountValue > 0 && matchedRequiredGroupCount === requiredGroupCountValue;
  const recentRequiredCoverageRatio = requiredGroupCountValue ? recentRequiredGroupCount / requiredGroupCountValue : 0;
  const fitComponents = [
    fitComponent(
      "required_skills",
      0.45,
      requiredSkillsScore,
      requiredGroupCountValue
        ? `${requiredMatchedGroupList.length}/${requiredGroupCountValue} core JD groups were matched, with ATS surfacing and recency folded into this component.`
        : "No required skill groups were detected in the JD."
    ),
    fitComponent(
      "experience",
      0.2,
      experienceScore,
      yearsCategory?.detail || seniorityCategory?.detail || roleAlignmentCategory?.detail || "Experience fit was estimated from years, seniority, and role language."
    ),
    fitComponent(
      "preferred_skills",
      0.15,
      preferredSkillsScore,
      requirements.preferredSkillGroups.length
        ? `${preferredMatchedGroupList.length}/${requirements.preferredSkillGroups.length} preferred JD groups were supported, including recent evidence where available.`
        : "No preferred skill groups were detected in the JD."
    ),
    fitComponent(
      "optional_alignment",
      0.1,
      optionalAlignmentScore,
      "Optional alignment combines domain, platform/observability, and education signals when the JD provides them."
    ),
    fitComponent(
      "ats_support",
      0.1,
      atsSupportScore,
      `ATS support blends structured surfacing quality into the final match using the normalized ATS score (${atsScore}/95).`
    ),
  ].filter(Boolean);
  const compositeRatio = weightedAverage(fitComponents.map((component) => ({ score: component.score, weight: component.weight })));
  let matchScore = Math.round(clamp(Number(compositeRatio || 0) * 100, 0, 100));

  const missingRequiredSkills = missing(requirements.requiredSkills, profile.allSkills);
  const missingSurfacedSkills = missing(requirements.requiredSkills, profile.surfacedSkills);
  const hardFilterReasons = [];

  if (requiredGroupCountValue > 0 && matchedRequiredGroupCount === 0) {
    hardFilterReasons.push("No required JD skill groups were matched.");
  } else if (
    requiredGroupCountValue >= 3 &&
    matchedRequiredGroupCount < Math.ceil(requiredGroupCountValue / 2)
  ) {
    hardFilterReasons.push(
      `Missing too many required JD groups (${requiredGroupCountValue - matchedRequiredGroupCount}/${requiredGroupCountValue} missing).`
    );
  }
  if (
    requirements.experienceFloor != null &&
    profile.estimatedYears != null &&
    profile.estimatedYears + 2 < requirements.experienceFloor
  ) {
    hardFilterReasons.push(
      `Estimated experience is materially below the JD floor (${profile.estimatedYears}y vs ${requirements.experienceFloor}+y).`
    );
  }
  const eligible = hardFilterReasons.length === 0;

  if (missingRequiredSkillGroups.length >= Math.max(2, Math.ceil(requirements.requiredSkillGroups.length / 2))) {
    atsScore = Math.min(atsScore, 72);
  }
  if (
    requirements.experienceFloor != null &&
    profile.estimatedYears != null &&
    profile.estimatedYears + 2 < requirements.experienceFloor
  ) {
    atsScore = Math.min(atsScore, 70);
  }

  const strengths = [];
  if (requirements.requiredSkillGroups.length) {
    if (requiredMatchedGroupList.length) strengths.push(`Matched required skill groups: ${requiredMatchedGroupList.slice(0, 6).join(", ")}`);
  }
  if (recentRequiredSkills.length) {
    strengths.push(`Recent hands-on evidence for required skills: ${recentRequiredSkills.slice(0, 6).join(", ")}`);
  }
  const hasTightExperienceBand =
    Number.isFinite(Number(requirements?.yearsRange?.min)) &&
    Number.isFinite(Number(requirements?.yearsRange?.max)) &&
    Number(requirements.yearsRange.max) >= Number(requirements.yearsRange.min) &&
    Number(requirements.yearsRange.max) - Number(requirements.yearsRange.min) <= 4;
  if (
    profile.estimatedYears != null &&
    requirements.experienceFloor != null &&
    (!hasTightExperienceBand || profile.estimatedYears <= Number(requirements.yearsRange.max || 0) + 1) &&
    profile.estimatedYears >= requirements.experienceFloor
  ) {
    strengths.push(
      hasTightExperienceBand
        ? `Estimated experience lands near the JD target band at about ${profile.estimatedYears} years.`
        : `Estimated experience meets the JD floor at about ${profile.estimatedYears} years.`
    );
  }
  if (requirements.roleKeywords.length && intersect(requirements.roleKeywords, profile.roleKeywords).length) {
    strengths.push(`Resume language aligns with the role focus: ${intersect(requirements.roleKeywords, profile.roleKeywords).slice(0, 4).join(", ")}`);
  }
  if (platformSignalFit?.matchedLabels?.length) {
    strengths.push(`Platform/observability evidence matched: ${platformSignalFit.matchedLabels.slice(0, 4).join(", ")}`);
  }

  const gaps = [];
  if (missingRequiredSkillGroups.length) {
    gaps.push(`Missing required JD groups in the resume: ${missingRequiredSkillGroups.slice(0, 6).join(", ")}`);
  }
  if (supportedButUnsurfacedRequiredSkillGroups.length) {
    gaps.push(
      `These already-supported JD groups are not surfaced clearly in ATS-friendly sections: ${supportedButUnsurfacedRequiredSkillGroups
        .slice(0, 6)
        .join(", ")}`
    );
  }
  if (staleRequiredSkills.length) {
    gaps.push(`Some matched required skills look older or only loosely surfaced in the resume: ${staleRequiredSkills.slice(0, 6).join(", ")}`);
  }
  if (requirements.experienceFloor != null && profile.estimatedYears != null && profile.estimatedYears < requirements.experienceFloor) {
    gaps.push(`Estimated experience is below the JD floor (${profile.estimatedYears}y vs ${requirements.experienceFloor}+y).`);
  } else if (requirements.experienceFloor != null && profile.estimatedYears == null) {
    gaps.push("Resume does not make total years of experience easy for an ATS to confirm.");
  }
  if (
    hasTightExperienceBand &&
    profile.estimatedYears != null &&
    profile.estimatedYears > Number(requirements.yearsRange.max || 0) + 3
  ) {
    gaps.push(
      `Resume may be over-level for the JD's ${requirements.yearsRange.min}-${requirements.yearsRange.max} year target band (${profile.estimatedYears}y shown).`
    );
  }
  if (requirements.seniority && profile.seniority && seniorityValue(profile.seniority) + 1 < seniorityValue(requirements.seniority)) {
    gaps.push(`Resume reads less senior than the JD (${profile.seniority} vs ${requirements.seniority}).`);
  }
  if (platformSignalFit?.activeLabels?.length && platformSignalFit.matchedLabels.length < platformSignalFit.activeLabels.length) {
    const missingPlatformSignals = platformSignalFit.activeLabels.filter((label) => !platformSignalFit.matchedLabels.includes(label));
    if (missingPlatformSignals.length) {
      gaps.push(`Platform/observability gaps for this JD: ${missingPlatformSignals.slice(0, 4).join(", ")}`);
    }
  }
  if (hiddenKeywordOpportunities.length) {
    gaps.push(
      `These JD keywords already exist in the resume but are not surfaced clearly in SUMMARY or TECHNICAL SKILLS: ${hiddenKeywordOpportunities
        .slice(0, 8)
        .join(", ")}`
    );
  }

  if (hardFilterReasons.length) {
    gaps.unshift(`Hard filters failed: ${hardFilterReasons.join(" ")}`);
  }

  if (requiredGroupCountValue >= 3 && allRequiredGroupsMatched) {
    if (recentRequiredGroupCount === 0) {
      matchScore = Math.min(matchScore, 80);
    } else if (recentRequiredCoverageRatio < 0.5) {
      matchScore = Math.min(matchScore, 84);
    } else if (recentRequiredCoverageRatio >= 0.75) {
      matchScore = Math.min(95, matchScore + 4);
    } else {
      matchScore = Math.min(95, matchScore + 2);
    }
  }

  const summaryParts = [];
  if (requirements.requiredSkillGroups.length) {
    summaryParts.push(`${requiredMatchedGroupList.length}/${requirements.requiredSkillGroups.length} core JD groups are present`);
    summaryParts.push(`${surfacedMatchedGroupList.length}/${requirements.requiredSkillGroups.length} are clearly surfaced for ATS`);
  }
  if (requiredRecencyScores.length) {
    summaryParts.push(`${recentRequiredGroups.length}/${requiredRecencyScores.length} matched core groups show recent usage`);
  }
  if (requirements.experienceFloor != null) {
    summaryParts.push(
      profile.estimatedYears != null
        ? hasTightExperienceBand
          ? `resume shows about ${profile.estimatedYears} years against a ${requirements.yearsRange.min}-${requirements.yearsRange.max} year target band`
          : `resume shows about ${profile.estimatedYears} years against a ${requirements.experienceFloor}+ year floor`
        : hasTightExperienceBand
          ? `resume does not clearly show the ${requirements.yearsRange.min}-${requirements.yearsRange.max} year target band`
          : `resume does not clearly show the ${requirements.experienceFloor}+ year floor`
    );
  }
  if (platformSignalFit?.activeLabels?.length) {
    summaryParts.push(
      `${platformSignalFit.matchedLabels.length}/${platformSignalFit.activeLabels.length} platform/observability groups are evidenced`
    );
  }
  if (requirements.seniority) {
    summaryParts.push(
      profile.seniority ? `resume reads as ${profile.seniority} against ${requirements.seniority}` : `resume seniority is not explicit`
    );
  }
  summaryParts.push(`composite fit score uses required skills, experience, preferred skills, optional alignment, and ATS support`);
  if (!eligible && hardFilterReasons.length) {
    summaryParts.push(`hard filters failed: ${hardFilterReasons.join(" ")}`);
  }

  return {
    scoringMethod: "composite-fit+ats-support",
    matchScore,
    atsScore,
    eligible,
    summary: summaryParts.join("; ") || "ATS-style rules found limited evidence for the JD requirements.",
    strengths: unique(strengths).slice(0, 6),
    gaps: unique(gaps).slice(0, 6),
    breakdown: {
      fitComponents: fitComponents.map((component) => ({
        name: component.name,
        weight: Number(component.weight),
        score: Number(component.score.toFixed(4)),
        percent: Number((component.score * 100).toFixed(1)),
        detail: component.detail,
      })),
      categories: categories.map((item) => ({
        name: item.name,
        weight: item.weight,
        score: Number(item.score.toFixed(4)),
        earned: Number(item.earned.toFixed(2)),
        detail: item.detail,
      })),
      compositeScore: matchScore,
      atsScore,
      atsSurfaceScore: atsSurfaceScore == null ? null : Number((atsSurfaceScore * 100).toFixed(1)),
      atsSupportScore: atsSupportScore == null ? null : Number((atsSupportScore * 100).toFixed(1)),
      eligible,
      hardFilterReasons,
      requiredSkillsScore: requiredSkillsScore == null ? null : Number((requiredSkillsScore * 100).toFixed(1)),
      experienceScore: experienceScore == null ? null : Number((experienceScore * 100).toFixed(1)),
      preferredSkillsScore: preferredSkillsScore == null ? null : Number((preferredSkillsScore * 100).toFixed(1)),
      optionalAlignmentScore: optionalAlignmentScore == null ? null : Number((optionalAlignmentScore * 100).toFixed(1)),
      requiredSkills: requirements.requiredSkills,
      preferredSkills: requirements.preferredSkills,
      requiredSkillGroups: requirements.requiredSkillGroups,
      preferredSkillGroups: requirements.preferredSkillGroups,
      matchedRequiredSkills,
      matchedRequiredGroupCount,
      matchedRequiredSkillGroups: requiredMatchedGroupList,
      matchedSurfacedSkills,
      matchedSurfacedSkillGroups: surfacedMatchedGroupList,
      matchedPreferredSkills,
      matchedSurfacedPreferredSkills,
      missingRequiredSkills,
      missingRequiredSkillGroups,
      missingSurfacedSkills,
      missingSurfacedSkillGroups,
      supportedButUnsurfacedRequiredSkills,
      supportedButUnsurfacedPreferredSkills,
      supportedButUnsurfacedRequiredSkillGroups,
      hiddenKeywordOpportunities,
      requiredSkillRecency: requiredRecencyScores.map((item) => ({
        label: item.label,
        skill: item.skill,
        score: Number(item.score.toFixed(4)),
        endYear: item.endYear,
        source: item.source,
      })),
      preferredSkillRecency: preferredRecencyScores.map((item) => ({
        label: item.label,
        skill: item.skill,
        score: Number(item.score.toFixed(4)),
        endYear: item.endYear,
        source: item.source,
      })),
      recentRequiredSkills,
      recentRequiredGroupCount,
      recentPreferredSkills,
      staleRequiredSkills,
      stalePreferredSkills,
      requiredGroupCount: requiredGroupCountValue,
      allRequiredGroupsMatched,
      platformSignalGroups: requirements.platformSignalGroups || [],
      matchedPlatformSignalGroups: platformSignalFit?.matchedLabels || [],
      skillRecency: Object.fromEntries(
        Array.from(skillRecency.entries()).map(([skill, evidence]) => [
          skill,
          {
            score: Number(evidence.score.toFixed(4)),
            endYear: evidence.endYear,
            source: evidence.source,
          },
        ])
      ),
      keywordHits,
      keywordSet: requirements.keywordSet,
      roleKeywords: requirements.roleKeywords,
      domains: requirements.domains,
      acceptsEquivalentExperience: requirements.acceptsEquivalentExperience,
      estimatedYears: profile.estimatedYears,
      requiredYearsFloor: requirements.experienceFloor,
      requiredYearsCeiling: Number.isFinite(Number(requirements?.yearsRange?.max)) ? Number(requirements.yearsRange.max) : null,
      resumeSeniority: profile.seniority,
      requiredSeniority: requirements.seniority,
      retrievalScore: retrievalScore == null ? null : Number(retrievalScore),
    },
  };
}

function buildTailoringHints(evaluation) {
  const breakdown = evaluation?.breakdown || {};
  const hints = [];
  const recentRequiredSkills = Array.isArray(breakdown.recentRequiredSkills) ? breakdown.recentRequiredSkills : [];
  const supportedButUnsurfacedRequiredSkills = Array.isArray(breakdown.supportedButUnsurfacedRequiredSkills)
    ? breakdown.supportedButUnsurfacedRequiredSkills
    : [];
  const recentSkillsToSurface = recentRequiredSkills.filter((skill) => supportedButUnsurfacedRequiredSkills.includes(skill));
  if (recentSkillsToSurface.length) {
    hints.push(
      `Make the recent hands-on use of these required skills explicit in SUMMARY or TECHNICAL SKILLS: ${recentSkillsToSurface
        .slice(0, 8)
        .join(", ")}.`
    );
  }
  const supportedButUnsurfacedRequiredSkillGroups = Array.isArray(breakdown.supportedButUnsurfacedRequiredSkillGroups)
    ? breakdown.supportedButUnsurfacedRequiredSkillGroups
    : [];
  if (supportedButUnsurfacedRequiredSkillGroups.length) {
    hints.push(
      `Surface these already-supported JD groups more clearly in SUMMARY or TECHNICAL SKILLS: ${supportedButUnsurfacedRequiredSkillGroups
        .slice(0, 8)
        .join(", ")}.`
    );
  }
  if (supportedButUnsurfacedRequiredSkills.length) {
    hints.push(
      `Make these already-evidenced required skills explicit in SUMMARY or TECHNICAL SKILLS: ${supportedButUnsurfacedRequiredSkills
        .slice(0, 10)
        .join(", ")}.`
    );
  }
  const supportedButUnsurfacedPreferredSkills = Array.isArray(breakdown.supportedButUnsurfacedPreferredSkills)
    ? breakdown.supportedButUnsurfacedPreferredSkills
    : [];
  if (supportedButUnsurfacedPreferredSkills.length) {
    hints.push(
      `If space allows, surface these already-evidenced preferred skills more clearly: ${supportedButUnsurfacedPreferredSkills
        .slice(0, 8)
        .join(", ")}.`
    );
  }
  const hiddenKeywordOpportunities = Array.isArray(breakdown.hiddenKeywordOpportunities)
    ? breakdown.hiddenKeywordOpportunities
    : [];
  if (hiddenKeywordOpportunities.length) {
    hints.push(
      `Surface these JD keywords more clearly in SUMMARY or TECHNICAL SKILLS using evidence already in the resume: ${hiddenKeywordOpportunities
        .slice(0, 10)
        .join(", ")}.`
    );
  }
  if (breakdown.requiredYearsFloor != null && breakdown.estimatedYears == null) {
    hints.push("Make total years of experience easier for ATS to infer by clarifying chronology and length of experience already present in the resume.");
  }
  if (breakdown.requiredSeniority && !breakdown.resumeSeniority) {
    hints.push("Make the level of ownership and seniority more explicit using achievements already in the resume.");
  }
  return hints;
}

module.exports = {
  buildAtsEvaluation,
  buildNormalizedJobDescription,
  buildTailoringHints,
  extractJobRequirements,
  extractResumeProfile,
};
