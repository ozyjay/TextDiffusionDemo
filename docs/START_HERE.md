# START_HERE — Text Diffusion Lab

## Purpose

Text Diffusion Lab is an Open Day demo about a possible next direction in generative AI.

The public story is:

> Today’s chatbot-style models often generate text one token at a time. Text diffusion explores another idea: start with placeholder tokens on a text canvas, refine the whole block over repeated passes, and finish with a final polish.

This repository should first build a **reliable staged refinement demo**, not a research-grade diffusion language model.

## First build target

Build **Phase A + Phase B** first.

| Phase | Name | Goal |
|---|---|---|
| A | From canvas to polish | Show placeholder tokens changing through refinement passes into a polished sentence. |
| B | Visitor-controlled refinement | Let visitors steer style, creativity, length, constraints, and speed. |
| C | Compare generation styles | Later: compare left-to-right generation with staged refinement. |

## Minimum viable demo

The MVP should:

1. load a curated prompt;
2. show a staged timeline;
3. animate changes across the whole sentence;
4. let the visitor choose style/creativity/steps;
5. support reset;
6. support offline replay mode.

A model backend is optional. Scripted traces are enough for the first version.

## Public wording

Use:

> “This is a simplified demo of one possible future direction for generative AI: text that improves through repeated refinement, rather than only next-word prediction.”

Avoid:

- “The AI is thinking.”
- “This is definitely the future.”
- “This proves diffusion is better.”
- “This shows the model’s private reasoning.”

## Local ports

Use:

| Service | Port |
|---|---:|
| Frontend | 3300 |
| Backend/API | 8300 |
| Shared model adapter, if used | 8600 |
| Shared replay service, if used | 8700 |

## Good first tasks

1. Create the app shell.
2. Add the staged refinement timeline component.
3. Add scripted traces in `src/data/traces` or equivalent.
4. Add prompt cards and style controls.
5. Add reset and replay buttons.
6. Add tests for the stage controller.
7. Add Open Day mode with fixed ports.

## Done means

The demo is not done when it generates text. It is done when a visitor can understand the point quickly, staff can reset it easily, and the fallback mode works without model/network dependency.
