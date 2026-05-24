SYSTEM_PROMPT = """You are an expert resume parser.
Return only valid JSON that matches the requested schema.
Do not include markdown, explanations, or any text outside the JSON object.
Preserve the original resume wording as closely as possible and do not hallucinate missing details."""

RESUME_EXTRACTION_SCHEMA = """{
  "Name": "",
  "Phone": "",
  "Email": "",
  "Summary": "",
  "Academics": [
    {
      "Degree": "",
      "Major": "",
      "University": ""
    }
  ],
  "Technical_Skills": {
    "Skill_Category_1": ["Skill 1", "Skill 2"],
    "Skill_Category_2": ["Skill 3"]
  },
  "Professional_Experience": [
    {
      "Company": "",
      "location": "",
      "title": "",
      "dates_of_employment": "",
      "project_description": "",
      "Responsibilities": [],
      "Environment": []
    }
  ],
  "Academic_projects": [
    {
      "project_name": "",
      "your_title": "",
      "project_responsibilities": [],
      "Technologies_used": []
    }
  ],
  "certifications": []
}"""

RESUME_EXTRACTION_RULES = """- Preserve wording closely.
- Do not hallucinate or Invent Values.
- Use empty strings or empty arrays if information is missing.
- Extract all academic entries; multiple degrees are allowed.
- Split each experience separately; multiple experiences are allowed.
- Keep multiple titles at the same company as separate entries when the resume presents them separately.
- If the resume includes an academic projects section, extract each project into `Academic_projects`.
- `Academic_projects` is optional, so return an empty array when the section is missing.
- `certifications` is optional, so return an empty array when the section is missing.
- `Technical_Skills` must be a dynamic JSON object where each key is a skill category and each value is a list of skills.
- Use the resume's own skill category headings and subheadings when they are present.
- If both work experience and professional experience are present, only consider work experience.
- `project_description` should be a overview of the project, product, client system, or application for that experience. keep empty string if not available.
- Environment should include tools, platforms, languages, databases, and technologies used in that role.
- `project_responsibilities` should capture the candidate's project responsibilities as a list.
- `Technologies_used` should capture the tools, languages, platforms, and frameworks used in the academic project.
- Extract certifications as a list of certification names when present."""

USER_PROMPT_TEMPLATE = """Extract the following resume into strict JSON.

Return only this schema:
{schema}

Rules:
{rules}

Resume text:
\"\"\"
{resume_text}
\"\"\"
"""
