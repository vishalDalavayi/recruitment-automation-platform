const { matching } = require("../src/index");

const jd = `
Senior Software Engineer

Requirements:
- 5+ years experience building backend services

Required:
- Node.js, JavaScript/TypeScript
- REST APIs
- AWS

Preferred:
- React
- PostgreSQL
- Docker
`;

const candidates = [
  {
    id: "c1",
    name: "Candidate A",
    resumeText: `SUMMARY:\nBackend engineer with 6 years building Node.js REST APIs on AWS.\n\nTECHNICAL SKILLS:\nJavaScript, TypeScript, Node.js, Express, AWS, Lambda, DynamoDB, REST\n\nPROFESSIONAL EXPERIENCE:\nBuilt and operated services on AWS with CI/CD.\n\nENVIRONMENT:\nAWS, Docker, Git.\n`,
  },
  {
    id: "c2",
    name: "Candidate B",
    resumeText: `SUMMARY:\nData engineer, 3 years.\n\nTECHNICAL SKILLS:\nPython, Spark, Airflow, Snowflake, SQL\n\nPROFESSIONAL EXPERIENCE:\nETL pipelines and analytics.\n`,
  },
];

const result = matching.matchCandidates({ jobDescription: jd, candidates, topK: 5 });
console.log(JSON.stringify(result, null, 2));
