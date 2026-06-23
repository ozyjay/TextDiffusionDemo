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

1. noisy fragments;
2. rough draft;
3. clearer draft;
4. styled draft;
5. polished final;
6. short explanation of what changed.

## Example run

Prompt:

> A robot joins university orientation.

Stages:

| Stage | Text |
|---|---|
| Noise | `robot / campus / lost / ??? / map / toaster` |
| Rough | `A robot was lost at university and needed a map.` |
| Clear | `A robot got lost during orientation and asked students for help.` |
| Styled | `A robot joined orientation, downloaded the campus map, and still followed a duck to the wrong lecture.` |
| Final | `On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.` |

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
| Stage timeline                                               |
| 0 Noise      robot / campus / lost / ??? / map               |
| 1 Rough      A robot was lost at university...               |
| 2 Clear      A robot got lost during orientation...          |
| 3 Styled     A robot joined orientation...                   |
| 4 Final      On its first day at university...               |
+-------------------------------------------------------------+
| What this shows: text can improve through repeated           |
| refinement, not only by adding one word at a time.           |
+-------------------------------------------------------------+
```

## Staff script

> “Most chatbots generate text one piece at a time. This demo shows a different research direction: start with rough or noisy text, then refine the whole answer over several passes. It is simplified, but it shows why future GenAI might become more controllable and editable.”

## Readiness gates

- Three curated prompts produce clean outputs.
- The refinement is visually obvious from 2–3 metres.
- The full run takes 20–45 seconds.
- Staff can reset in one click.
- Replay mode works offline.
- The app labels itself as simplified or diffusion-inspired.
