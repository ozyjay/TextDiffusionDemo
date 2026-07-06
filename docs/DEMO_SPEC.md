# Demo Spec — Text Diffusion Lab

## Working title

**Beyond Next-Word Prediction: Text Diffusion Lab**

Subtitle:

**A glimpse at one possible future for generative AI.**

## Core idea

Show text being progressively refined through multiple stages rather than generated only left-to-right.

## Visitor experience

A visitor chooses a prompt card, chooses a style, adjusts one or two controls, and presses **Diffuse Text**.

The screen then shows:

1. a text canvas with placeholder tokens;
2. repeated iterative refinement passes;
3. stable words acting as context for the rest;
4. a final polish;
5. short explanation of what changed.

## Example run

Prompt:

> A robot joins university orientation.

Public steps:

| Stage | Text |
|---|---|
| Canvas | `robot / campus / lost / ??? / map / toaster` |
| Iterative refinement | `A robot was lost at university and needed a map.` |
| Iterative refinement | `A robot got lost during orientation and asked students for help.` |
| Iterative refinement | `A robot joined orientation, downloaded the campus map, and still followed a duck to the wrong lecture.` |
| Final polish | `On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.` |

## Controls

| Control | Values |
|---|---|
| Prompt | curated prompt cards |
| Style | clear, funny, sci-fi, campus, scientific, poetic |
| Creativity | safer, balanced, surprising |
| Length | short, medium, detailed |
| Constraint | include reef, robot, university, music, 12 words, rhyme |
| Speed | quick, normal, slow explanation |

## Modes

| Mode | Description |
|---|---|
| Scripted replay | Uses prewritten traces. Required fallback. |
| Template refinement | Uses deterministic transformations. Good MVP live mode. |
| Model-assisted | Uses a local model to rewrite stages. Optional after MVP. |
| Comparison | Shows left-to-right generation beside staged refinement. Phase C. |

## Screen layout

Recommended layout:

```text
+-------------------------------------------------------------+
| Beyond Next-Word Prediction: Text Diffusion Lab             |
| A glimpse at one possible future for generative AI           |
+-------------------------------------------------------------+
| Prompt card      | Style       | Creativity | Steps          |
| Robot orientation| Funny       | Balanced   | 6              |
+-------------------------------------------------------------+
| Step timeline                                                |
| 0 Canvas                 robot / campus / lost / ??? / map   |
| 1 Iterative refinement   A robot was lost at university...   |
| 2 Iterative refinement   A robot got lost during orientation |
| 3 Iterative refinement   A robot joined orientation...       |
| 4 Final polish           On its first day at university...   |
+-------------------------------------------------------------+
| What this shows: text can improve through repeated           |
| refinement, not only by adding one word at a time.           |
+-------------------------------------------------------------+
```

## Staff script

> “Most chatbots generate text one piece at a time. This simplified demo shows a different research direction: start with placeholder tokens on a text canvas, make repeated refinement passes that use stable words as context, then finish with a final polish.”

## Readiness gates

- Three curated prompts produce clean outputs.
- The refinement is visually obvious from 2–3 metres.
- The full run takes 20–45 seconds.
- Staff can reset in one click.
- Replay mode works offline.
- The app labels itself as simplified or diffusion-inspired.
