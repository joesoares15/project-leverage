# Project Leverage owner’s guide

This guide describes how Joseph and ChatGPT will work on Project Leverage after the initial GitHub setup.

## Roles

### Joseph — product owner and dynasty strategist

You decide:

- Which dynasty questions matter.
- Which assumptions feel wrong or incomplete.
- Which recommendations are useful in practice.
- Which features should be prioritized.
- Whether a theory should be tested, revised, or retired.

You do **not** need to write website code, debug Python, understand GitHub Actions, or manage hosting infrastructure.

### ChatGPT — engineering and research partner

ChatGPT is responsible for:

- Translating dynasty questions into testable research designs.
- Updating the website and data pipeline.
- Writing and maintaining tests.
- Explaining assumptions, limitations, and evidence.
- Preparing versioned changes for review.
- Diagnosing failures from GitHub Actions logs.

## One-time setup

Follow `SETUP_GUIDE.md` once to:

1. Create the GitHub repository.
2. Upload the initial project.
3. Enable GitHub Pages.
4. Run the first deployment.

After that, GitHub becomes the permanent home of the project. Do not return to Netlify and do not repeatedly replace the site with ZIP uploads.

## Normal working model

### 1. Joseph proposes a question or change

Examples:

- “Add positional injuries to the RB opportunity model.”
- “Compare managers’ rookie positional reaches against consensus.”
- “The WR-depth recommendation feels too conventional.”
- “The AnyRB study should show RB18 weeks as well as RB24 weeks.”

A polished technical specification is not required.

### 2. ChatGPT defines the change

Before changing the model, ChatGPT should identify:

- The decision the feature is intended to improve.
- The data required.
- The assumptions being introduced.
- How the change will be tested.
- Whether it changes an existing study’s methodology version.

### 3. The change is prepared as a versioned update

The preferred workflow is a GitHub branch and pull request. A pull request is simply a review page showing exactly what changed before it replaces the live site.

The automated checks should verify:

- Python scripts compile.
- Unit tests pass.
- Research data builds successfully.
- Generated datasets meet structural requirements.
- The website files are publishable.

### 4. Joseph reviews the result

Review should focus on product and dynasty logic rather than code details:

- Does the explanation make sense?
- Does it answer the intended question?
- Are the assumptions acceptable?
- Is the recommendation actionable?
- Does anything feel like hidden consensus thinking?

### 5. Approved changes are merged

After a change is merged into `main`, GitHub automatically:

1. Runs the tests.
2. Rebuilds the research data.
3. Publishes the new website.

No manual hosting work is required.

## How to request a change

A normal message in ChatGPT is sufficient. This short structure is helpful for larger changes:

```text
Problem or question:
What I want the site to help me decide:
What currently feels wrong or missing:
Any examples from my leagues:
Urgency: now / later / research backlog
```

A copyable version is also stored in `CHANGE_REQUEST_TEMPLATE.md`.

## Research rules

Every published theory should show:

1. **Question** — what is being tested?
2. **Population** — which players, weeks, seasons, and formats are included?
3. **Outcome** — what counts as success?
4. **Predictors** — which signals were known before kickoff?
5. **Comparison** — what baseline or alternative is used?
6. **Validation** — was performance tested on seasons not used to design the model?
7. **Limitations** — what the evidence does not establish.
8. **Version** — whether the methodology changed from a prior release.

Market values are market-price references, not intrinsic roster value or projected points.

## Release levels

### Patch release

Small corrections that do not change research conclusions, such as wording, display bugs, or broken links.

### Minor release

New features, new controls, new manager-profile fields, or additional signals that do not redefine an existing study’s core outcome.

### Major methodology release

Changes to cohorts, success thresholds, scoring definitions, training/validation design, or other assumptions that may materially change prior conclusions.

Major methodology changes should preserve the old result or clearly archive it rather than silently overwriting history.

## Troubleshooting

When the live site or a build fails:

1. Open the GitHub repository.
2. Open **Actions**.
3. Open the workflow with a red X.
4. Open the failed step.
5. Copy the red error text into ChatGPT.

Do not spend time interpreting the error first. The raw log is the best diagnostic input.

## Cost policy

The current project is designed to remain within free services:

- GitHub repository
- GitHub Pages
- GitHub Actions
- Sleeper public API
- nflverse data

No paid service should be added without Joseph explicitly approving both the need and expected cost.
