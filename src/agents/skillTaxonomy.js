const { unique } = require("./text");

// Canonical skill -> aliases/synonyms (lowercase).
// Keep this list small and high-signal; we can expand as we see real JDs.
const SKILL_GROUPS = [
  { canonical: "javascript", aliases: ["javascript", "js", "ecmascript"] },
  { canonical: "typescript", aliases: ["typescript", "ts"] },
  { canonical: "node", aliases: ["node", "node.js", "nodejs"] },
  { canonical: "react", aliases: ["react", "react.js", "reactjs"] },
  { canonical: "salesforce", aliases: ["salesforce", "sfdc", "salesforce crm", "force.com", "force com"] },
  { canonical: "sales cloud", aliases: ["sales cloud"] },
  { canonical: "service cloud", aliases: ["service cloud"] },
  { canonical: "marketing cloud", aliases: ["marketing cloud"] },
  { canonical: "experience cloud", aliases: ["experience cloud", "community cloud"] },
  { canonical: "cpq", aliases: ["cpq", "salesforce cpq"] },
  { canonical: "sap", aliases: ["sap", "sap erp"] },
  { canonical: "sap sd", aliases: ["sap sd", "sales and distribution"] },
  { canonical: "sap mm", aliases: ["sap mm", "materials management"] },
  { canonical: "sap fico", aliases: ["sap fico", "sap fi/co", "sap fi", "sap co"] },
  { canonical: "sap treasury", aliases: ["sap treasury", "treasury management", "sap trm"] },
  { canonical: "s/4hana", aliases: ["s/4hana", "s4hana", "sap s/4hana"] },
  { canonical: "abap", aliases: ["abap", "sap abap"] },
  { canonical: "otc", aliases: ["otc", "order to cash", "order-to-cash"] },
  { canonical: "aws", aliases: ["aws", "amazon web services"] },
  { canonical: "gcp", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { canonical: "azure", aliases: ["azure", "microsoft azure"] },
  { canonical: "docker", aliases: ["docker", "docker-compose", "docker compose"] },
  { canonical: "kubernetes", aliases: ["kubernetes", "k8s"] },
  { canonical: "postgres", aliases: ["postgres", "postgresql", "postgreSQL"] },
  { canonical: "mysql", aliases: ["mysql"] },
  { canonical: "oracle", aliases: ["oracle", "oracle db", "oracle database"] },
  { canonical: "sql server", aliases: ["sql server", "ms sql", "mssql", "microsoft sql server"] },
  { canonical: "dba", aliases: ["dba", "database administrator", "database administration"] },
  { canonical: "rac", aliases: ["rac", "oracle rac", "real application clusters"] },
  { canonical: "exadata", aliases: ["exadata", "oracle exadata"] },
  { canonical: "sql", aliases: ["sql"] },
  { canonical: "mongodb", aliases: ["mongodb", "mongo"] },
  { canonical: "redis", aliases: ["redis"] },
  { canonical: "kafka", aliases: ["kafka", "apache kafka"] },
  { canonical: "rest", aliases: ["rest", "rest api", "rest apis", "restful"] },
  { canonical: "graphql", aliases: ["graphql"] },
  { canonical: "python", aliases: ["python"] },
  { canonical: "java", aliases: ["java"] },
  { canonical: "spark", aliases: ["spark", "apache spark"] },
  { canonical: "airflow", aliases: ["airflow", "apache airflow"] },
  { canonical: "dbt", aliases: ["dbt", "data build tool"] },
  { canonical: "snowflake", aliases: ["snowflake"] },
  { canonical: "databricks", aliases: ["databricks"] },
  { canonical: "terraform", aliases: ["terraform"] },
  { canonical: "ci/cd", aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery"] },
  { canonical: "rag", aliases: ["rag", "retrieval augmented generation", "retrieval-augmented generation"] },
  { canonical: "llm", aliases: ["llm", "large language model", "large language models"] },
];

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildSkillGroups(extraGroups = []) {
  const merged = []
    .concat(SKILL_GROUPS)
    .concat(Array.isArray(extraGroups) ? extraGroups : [])
    .filter(Boolean);

  const byCanonical = new Map();
  for (const group of merged) {
    const canonical = normalizeAlias(group.canonical);
    if (!canonical) continue;
    const aliases = unique([canonical].concat(group.aliases || []).map(normalizeAlias)).filter(Boolean);
    const existing = byCanonical.get(canonical);
    if (!existing) byCanonical.set(canonical, { canonical, aliases });
    else byCanonical.set(canonical, { canonical, aliases: unique(existing.aliases.concat(aliases)) });
  }

  return Array.from(byCanonical.values());
}

function groupsToSkillTerms(groups) {
  return unique(
    (groups || [])
      .flatMap((g) => [g.canonical].concat(g.aliases || []))
      .map(normalizeAlias)
      .filter(Boolean)
  );
}

module.exports = {
  SKILL_GROUPS,
  buildSkillGroups,
  groupsToSkillTerms,
};
