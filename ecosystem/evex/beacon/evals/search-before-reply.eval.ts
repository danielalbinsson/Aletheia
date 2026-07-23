import { defineEval } from "eve/evals";

export default defineEval({
  description: "Support question triggers docs search before drafting a reply.",
  async test(t) {
    await t.send(
      [
        "A customer asks how to reset their password.",
        "Search the docs, then draft a reply.",
      ].join(" ")
    );
    t.succeeded();
    t.calledTool("search_docs");
  },
});
