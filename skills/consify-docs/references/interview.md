# Interview

Ask before writing. Ask in **one batch**, not one question at a time, and offer a default for each
question. When the answer is already visible in the project (languages in `docs.config.ts`, versions
in `versions.list`, existing pages), do not ask again: state it and ask the user to confirm.

## Required questions

1. **What are we documenting?** The name of the product, what it does in one sentence, where its source is.
2. **Who reads the docs?** Developers who use a library, integrators of an API, end users of an
   application, an internal team. Audience decides depth and tone.
3. **Languages.** Which languages are needed and which is the main one? Never assume. Must every
   page exist in every language at once, or may translations follow gradually (a page without a
   translation is shown in the main language)?
4. **Versions.** Is more than one version of the product documented in parallel? What are they
   called (`v1`, `2.x`), which is the latest, which are deprecated? If there is only one, there is no
   switcher and no version folder.
5. **Sections.** Which of these are needed: introduction, quick start, guides, concepts, API reference,
   CLI, configuration, migration, troubleshooting, FAQ, changelog? Propose a set that fits the kind of
   product and let the user confirm.
6. **Sources.** Where do the facts come from: which folders of code, which TSDoc, README, existing
   docs, design notes? Is anything not to be published?
7. **Examples and data.** Are there ready examples, demos, screenshots? Which domain names should the
   examples use?
8. **Publishing.** `server` or `static` mode? The public address (`site.url`)? The GitHub repository
   (for Edit on GitHub) and the branch? A sub path (`basePath`)?
9. **Look and extras.** Site name, logo, favicon, colors, font. Is a blog needed? A custom footer,
   header links, a custom home page?
10. **Tone and terms.** Formal or friendly? Terms that must not be translated or changed?

## Rules

- Do not start writing before questions 1 to 5 are answered (product, audience, languages, versions,
  sections) and the sources are known.
- "I don't know" means: propose a default and record it as an assumption in the final report.
- After the interview, summarize the answers in 5 to 10 lines and get a "yes".
- If the user later changes an answer (a new language, a new version), re-run the affected steps:
  configuration, structure, translations.
