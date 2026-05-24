const openapi = {
  openapi: "3.1.0",
  info: {
    title: "KonfigAI Resume Bot Matching Agent API",
    version: "0.1.0",
    description:
      "Thin HTTP wrapper around the resume-to-job matching engine. Submit one formatted resume and a list of scraped job postings, and the service retrieves the closest job vectors from pgvector, then scores the shortlist with the same 60% keyword / 40% TF-IDF formula used by the tailoring agent.",
  },
  servers: [
    {
      url: "http://127.0.0.1:5051",
      description: "Local development",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        operationId: "getHealth",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    service: { type: "string" },
                    persistenceConfigured: { type: "boolean" },
                    persistenceEnabled: { type: "boolean" },
                    vectorDatabaseConfigured: { type: "boolean" },
                    endpoints: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "ok",
                    "service",
                    "persistenceConfigured",
                    "persistenceEnabled",
                    "vectorDatabaseConfigured",
                    "endpoints",
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "OpenAPI spec",
        operationId: "getOpenApiSpec",
        responses: {
          200: {
            description: "OpenAPI document",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
    "/match/jobs": {
      post: {
        summary: "Match one resume against many jobs",
        description:
          "Primary integration entrypoint. Upstream should fetch one stored Tabner resume and a bounded set of candidate jobs, then submit them here for scoring and persistence.",
        operationId: "matchJobs",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/MatchJobsTextRequest" },
                  { $ref: "#/components/schemas/MatchJobsBase64FileRequest" },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Ranked job matches",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MatchJobsResponse",
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          413: { $ref: "#/components/responses/PayloadTooLarge" },
        },
      },
    },
    "/match/jobs/upload": {
      post: {
        summary: "Match jobs using multipart resume upload",
        operationId: "matchJobsUpload",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "Resume file (.pdf, .docx, or plain text).",
                  },
                  jobs: {
                    type: "string",
                    description: "JSON-encoded array of scraped job objects.",
                  },
                  topK: {
                    type: "string",
                    description: "Optional number of ranked jobs to return.",
                  },
                  resumeId: {
                    type: "string",
                    description: "Optional stable resume identifier. If omitted, the service derives one from the resume content.",
                  },
                  candidateName: {
                    type: "string",
                    description: "Optional candidate display name to persist with the resume row.",
                  },
                  resumeVersion: {
                    type: "string",
                    description: "Optional resume version label to persist with the resume row.",
                  },
                  matchRunId: {
                    type: "string",
                    description: "Optional explicit match run identifier. If omitted, the service generates one.",
                  },
                  persist: {
                    type: "string",
                    description: "Optional boolean string. Set to false to skip saving match_runs and match_results even when DB persistence is configured.",
                  },
                  vectorTopN: {
                    type: "string",
                    description: "Optional shortlist size to retrieve from pgvector before final ranking. Defaults to 100.",
                  },
                  skillGroups: {
                    type: "string",
                    description:
                      "Reserved JSON-encoded taxonomy overrides. Currently ignored by the partner-style scorer.",
                  },
                },
                required: ["file", "jobs"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Ranked job matches",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MatchJobsResponse",
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          413: { $ref: "#/components/responses/PayloadTooLarge" },
          415: { $ref: "#/components/responses/UnsupportedMediaType" },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description: "Invalid request payload",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      PayloadTooLarge: {
        description: "Payload exceeded the max accepted size",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      UnsupportedMediaType: {
        description: "Unsupported content type",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
    },
    schemas: {
      JobPostingInput: {
        type: "object",
        properties: {
          id: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          job_title: { type: ["string", "null"] },
          position: { type: ["string", "null"] },
          company: { type: ["string", "null"] },
          company_name: { type: ["string", "null"] },
          employer_name: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          job_location: { type: ["string", "null"] },
          candidate_required_location: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
          job_url: { type: ["string", "null"] },
          apply_url: { type: ["string", "null"] },
          source: { type: ["string", "null"] },
          publisher: { type: ["string", "null"] },
          source_publisher: { type: ["string", "null"] },
          job_type: { type: ["string", "null"] },
          employment_type: { type: ["string", "null"] },
          salary: { type: ["string", "null"] },
          salary_range: { type: ["string", "null"] },
          publication_date: { type: ["string", "null"] },
          posted_at: { type: ["string", "null"] },
          date_posted: { type: ["string", "null"] },
          description_text: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          description_html: { type: ["string", "null"] },
          normalizedJobDescription: {
            type: ["string", "null"],
            description: "Optional pre-normalized Tabner-style JD text. Preferred over rebuilding from raw scraped text.",
          },
          normalized_jd_text: {
            type: ["string", "null"],
            description: "Snake-case alias for pre-normalized Tabner-style JD text.",
          },
          requirements: {
            type: ["object", "null"],
            description: "Optional precomputed JD requirements object from the pharmaiq ATS core.",
            additionalProperties: true,
          },
          requirements_json: {
            type: ["object", "null"],
            description: "Snake-case alias for a precomputed JD requirements object.",
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
      SkillGroup: {
        type: "object",
        properties: {
          canonical: { type: "string" },
          aliases: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["canonical", "aliases"],
      },
      ResumeFileBase64: {
        type: "object",
        properties: {
          filename: { type: "string" },
          contentBase64: {
            type: "string",
            description: "Base64-encoded file content. Data URLs are also accepted.",
          },
        },
        required: ["filename", "contentBase64"],
      },
      MatchJobsTextRequest: {
        type: "object",
        description:
          "Recommended upstream caller payload: resumeId, candidateName, resumeVersion, resumeText, jobs, and topK.",
        properties: {
          resumeText: { type: "string" },
          resumeId: {
            type: "string",
            description: "Optional stable resume identifier. If omitted, the service derives one from the resume content.",
          },
          candidateName: {
            type: "string",
            description: "Optional candidate display name to persist with the resume row.",
          },
          resumeVersion: {
            type: "string",
            description: "Optional resume version label to persist with the resume row.",
          },
          matchRunId: {
            type: "string",
            description: "Optional explicit match run identifier. If omitted, the service generates one.",
          },
          persist: {
            type: "boolean",
            description: "Set to false to skip saving match_runs and match_results even when DB persistence is configured.",
          },
          jobs: {
            type: "array",
            items: { $ref: "#/components/schemas/JobPostingInput" },
          },
          topK: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 5,
          },
          vectorTopN: {
            type: "integer",
            minimum: 1,
            maximum: 500,
            default: 100,
            description: "Optional shortlist size to retrieve from pgvector before final ranking.",
          },
          skillGroups: {
            type: "array",
            items: { $ref: "#/components/schemas/SkillGroup" },
            description: "Reserved for future taxonomy overrides. Currently ignored by the partner-style scorer.",
          },
        },
        required: ["resumeText", "jobs"],
      },
      MatchJobsBase64FileRequest: {
        type: "object",
        description:
          "Alternative request shape for direct file uploads. The normal team pipeline should prefer sending stored resumeText.",
        properties: {
          resumeFile: { $ref: "#/components/schemas/ResumeFileBase64" },
          resumeId: {
            type: "string",
            description: "Optional stable resume identifier. If omitted, the service derives one from the resume content.",
          },
          candidateName: {
            type: "string",
            description: "Optional candidate display name to persist with the resume row.",
          },
          resumeVersion: {
            type: "string",
            description: "Optional resume version label to persist with the resume row.",
          },
          matchRunId: {
            type: "string",
            description: "Optional explicit match run identifier. If omitted, the service generates one.",
          },
          persist: {
            type: "boolean",
            description: "Set to false to skip saving match_runs and match_results even when DB persistence is configured.",
          },
          jobs: {
            type: "array",
            items: { $ref: "#/components/schemas/JobPostingInput" },
          },
          topK: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 5,
          },
          vectorTopN: {
            type: "integer",
            minimum: 1,
            maximum: 500,
            default: 100,
            description: "Optional shortlist size to retrieve from pgvector before final ranking.",
          },
          skillGroups: {
            type: "array",
            items: { $ref: "#/components/schemas/SkillGroup" },
            description: "Reserved for future taxonomy overrides. Currently ignored by the partner-style scorer.",
          },
        },
        required: ["resumeFile", "jobs"],
      },
      ResumeMeta: {
        type: "object",
        properties: {
          source: { type: "string" },
          filename: { type: ["string", "null"] },
          extractedLength: { type: "integer" },
          resumeId: { type: ["string", "null"] },
          candidateName: { type: ["string", "null"] },
          resumeVersion: { type: ["string", "null"] },
          matchRunId: { type: ["string", "null"] },
          persist: { type: ["boolean", "null"] },
        },
        required: ["source", "filename", "extractedLength"],
      },
      PersistenceStatus: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          saved: { type: "boolean" },
          reason: { type: ["string", "null"] },
          resumeId: { type: ["string", "null"] },
          matchRunId: { type: ["string", "null"] },
          savedResults: { type: ["integer", "null"] },
        },
        required: ["enabled", "saved"],
      },
      FitComponent: {
        type: "object",
        properties: {
          name: { type: "string" },
          weight: { type: "number" },
          score: { type: "number" },
          percent: { type: "number" },
          detail: { type: "string" },
        },
        required: ["name", "weight", "score", "percent", "detail"],
      },
      MatchBreakdown: {
        type: "object",
        description:
          "Detailed diagnostics from the pgvector retrieval + partner-style keyword / TF-IDF scoring pipeline. This object is intentionally extensible and may gain new fields over time.",
        properties: {
          fitComponents: {
            type: "array",
            items: { $ref: "#/components/schemas/FitComponent" },
          },
          categories: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          hardFilterReasons: {
            type: "array",
            items: { type: "string" },
          },
          requiredSkills: {
            type: "array",
            items: { type: "string" },
          },
          preferredSkills: {
            type: "array",
            items: { type: "string" },
          },
          matchedRequiredSkills: {
            type: "array",
            items: { type: "string" },
          },
          matchedPreferredSkills: {
            type: "array",
            items: { type: "string" },
          },
          supportedButUnsurfacedRequiredSkills: {
            type: "array",
            items: { type: "string" },
          },
          supportedButUnsurfacedRequiredSkillGroups: {
            type: "array",
            items: { type: "string" },
          },
          estimatedYears: { type: ["number", "null"] },
          requiredYearsFloor: { type: ["number", "null"] },
          requiredSeniority: { type: ["string", "null"] },
          resumeSeniority: { type: ["string", "null"] },
        },
        additionalProperties: true,
      },
      MatchedJob: {
        type: "object",
        properties: {
          id: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          company: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
          source: { type: ["string", "null"] },
          jobType: { type: ["string", "null"] },
          salary: { type: ["string", "null"] },
          publicationDate: { type: ["string", "null"] },
          descriptionText: { type: ["string", "null"] },
          normalizedJobDescription: { type: "string" },
          matchScore: { type: "number" },
          atsScore: { type: "number" },
          eligible: { type: "boolean" },
          summary: { type: "string" },
          strengths: {
            type: "array",
            items: { type: "string" },
          },
          gaps: {
            type: "array",
            items: { type: "string" },
          },
          tailoringHints: {
            type: "array",
            items: { type: "string" },
          },
          breakdown: { $ref: "#/components/schemas/MatchBreakdown" },
        },
        required: [
          "id",
          "title",
          "company",
          "location",
          "url",
          "source",
          "jobType",
          "salary",
          "publicationDate",
          "normalizedJobDescription",
          "matchScore",
          "atsScore",
          "eligible",
          "summary",
          "strengths",
          "gaps",
          "tailoringHints",
          "breakdown",
        ],
      },
      MatchJobsResponse: {
        type: "object",
        properties: {
          method: { type: "string" },
          vectorBackend: { type: ["string", "null"] },
          topK: { type: "integer" },
          vectorTopN: { type: ["integer", "null"] },
          totalJobsConsidered: { type: ["integer", "null"] },
          totalJobsRetrieved: { type: ["integer", "null"] },
          embeddingModel: { type: ["string", "null"] },
          jobs: {
            type: "array",
            items: { $ref: "#/components/schemas/MatchedJob" },
          },
          resume: { $ref: "#/components/schemas/ResumeMeta" },
          persistence: { $ref: "#/components/schemas/PersistenceStatus" },
          totalJobsReceived: { type: "integer" },
          totalJobsReturned: { type: "integer" },
        },
        required: [
          "method",
          "vectorBackend",
          "topK",
          "vectorTopN",
          "jobs",
          "resume",
          "persistence",
          "totalJobsReceived",
          "totalJobsReturned",
        ],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
    },
  },
};

module.exports = {
  openapi,
};
