module.exports = {
  matching: require("./agents/matchingAgent"),
  db: require("./db/postgres"),
  integrations: {
    tailoringClient: require("./integrations/tailoringClient"),
  },
  jobPosting: require("./agents/jobPosting"),
  io: require("./io/extractText"),
  openapi: require("./openapi"),
  server: require("./server"),
};
