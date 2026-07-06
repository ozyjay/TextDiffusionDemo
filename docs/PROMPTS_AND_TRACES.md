# Prompts and Traces — Text Diffusion Lab

## Prompt card set

Use curated prompts for Open Day mode.

| ID | Prompt | Notes |
|---|---|---|
| robot-orientation | A robot joins university orientation. | Friendly, visual, campus themed. |
| reef-signal | A reef scientist discovers a strange signal. | Cairns/JCU flavour. |
| overnight-app | A student builds an app overnight. | IT identity. |
| tiny-ai-prac | A tiny AI helps in a practical class. | Teaching connection. |

## Trace writing rules

A good trace should:

- start with a text canvas or placeholder-token frame so refinement is obvious;
- improve meaning at each stage;
- visibly change words in the middle, not only append words;
- keep the final output short enough for a booth screen;
- avoid private, political, medical, legal, financial, hateful, sexual, or unsafe content;
- use campus, learning, science, creativity, or IT themes.

The internal trace labels remain `Noise`, `Rough`, `Clear`, `Styled`, and `Final` for validation, but the public demo presents them as `Canvas`, repeated `Iterative refinement` passes, and `Final polish`.

## Example public trace — robot orientation, funny

| Public step | Text | Note |
|---|---|---|
| Canvas | `robot / campus / lost / ??? / map / toaster` | Placeholder-token canvas. |
| Iterative refinement | `A robot was lost at university and needed a map.` | First pass fills in rough meaning. |
| Iterative refinement | `A robot got lost during orientation and asked students for help.` | The whole block becomes clearer. |
| Iterative refinement | `A robot joined orientation, downloaded the campus map, and still followed a duck to the wrong lecture.` | Stable words guide style and context. |
| Final polish | `On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.` | Text converges into final output. |

## Example public trace — reef signal, scientific

| Public step | Text | Note |
|---|---|---|
| Canvas | `reef / signal / coral / unknown / sensor / pattern` | Placeholder-token canvas. |
| Iterative refinement | `A scientist found a strange signal near the reef.` | First pass fills in rough meaning. |
| Iterative refinement | `A reef scientist detected an unusual signal in the coral sensor data.` | The whole block becomes clearer. |
| Iterative refinement | `The sensor array revealed a repeating signal hidden in coral reef data.` | Stable words guide style and context. |
| Final polish | `A reef scientist discovered a repeating signal in coral sensor data and began testing whether it marked a new environmental pattern.` | Text converges into final output. |

## Example public trace — overnight app, clear

| Public step | Text | Note |
|---|---|---|
| Canvas | `student / app / midnight / bug / coffee / demo` | Placeholder-token canvas. |
| Iterative refinement | `A student made an app overnight with bugs and coffee.` | First pass fills in rough meaning. |
| Iterative refinement | `A student built a simple app overnight and fixed bugs before the demo.` | The whole block becomes clearer. |
| Iterative refinement | `After a long night of debugging, a student turned a rough app idea into a working demo.` | Stable words guide style and context. |
| Final polish | `After a long night of debugging, a student transformed a rough app idea into a working demo just in time.` | Text converges into final output. |

## Example public trace — tiny AI practical class, campus

| Public step | Text | Note |
|---|---|---|
| Canvas | `tiny AI / prac / hint / student / code / confused` | Placeholder-token canvas. |
| Iterative refinement | `A tiny AI helped a student in practical class with code.` | First pass fills in rough meaning. |
| Iterative refinement | `A tiny AI gave a student a hint during a programming practical.` | The whole block becomes clearer. |
| Iterative refinement | `In a university practical, a tiny AI offered hints without taking over the learning.` | Stable words guide style and context. |
| Final polish | `In a university practical, a tiny AI helped a student understand the next step without doing the work for them.` | Text converges into final output. |

## Future trace variants

Create variants for each prompt and style:

```text
<prompt-id>-clear
<prompt-id>-funny
<prompt-id>-sci-fi
<prompt-id>-scientific
<prompt-id>-poetic
```
