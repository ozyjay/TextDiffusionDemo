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

- start messy enough that refinement is obvious;
- improve meaning at each stage;
- visibly change words in the middle, not only append words;
- keep the final output short enough for a booth screen;
- avoid private, political, medical, legal, financial, hateful, sexual, or unsafe content;
- use campus, learning, science, creativity, or IT themes.

## Example trace — robot orientation, funny

| Stage | Text | Note |
|---|---|---|
| Noise | `robot / campus / lost / ??? / map / toaster` | Noisy concepts. |
| Rough | `A robot was lost at university and needed a map.` | Meaning appears. |
| Clear | `A robot got lost during orientation and asked students for help.` | Clearer sentence. |
| Styled | `A robot joined orientation, downloaded the campus map, and still followed a duck to the wrong lecture.` | Funny style applied. |
| Final | `On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.` | Polished final. |

## Example trace — reef signal, scientific

| Stage | Text | Note |
|---|---|---|
| Noise | `reef / signal / coral / unknown / sensor / pattern` | Noisy concepts. |
| Rough | `A scientist found a strange signal near the reef.` | Rough idea. |
| Clear | `A reef scientist detected an unusual signal in the coral sensor data.` | Scientific clarity. |
| Styled | `The sensor array revealed a repeating signal hidden in coral reef data.` | More precise. |
| Final | `A reef scientist discovered a repeating signal in coral sensor data and began testing whether it marked a new environmental pattern.` | Polished final. |

## Example trace — overnight app, clear

| Stage | Text | Note |
|---|---|---|
| Noise | `student / app / midnight / bug / coffee / demo` | Noisy concepts. |
| Rough | `A student made an app overnight with bugs and coffee.` | Rough idea. |
| Clear | `A student built a simple app overnight and fixed bugs before the demo.` | Clearer. |
| Styled | `After a long night of debugging, a student turned a rough app idea into a working demo.` | Polished style. |
| Final | `After a long night of debugging, a student transformed a rough app idea into a working demo just in time.` | Final. |

## Example trace — tiny AI practical class, campus

| Stage | Text | Note |
|---|---|---|
| Noise | `tiny AI / prac / hint / student / code / confused` | Noisy concepts. |
| Rough | `A tiny AI helped a student in practical class with code.` | Rough. |
| Clear | `A tiny AI gave a student a hint during a programming practical.` | Clearer. |
| Styled | `In a university practical, a tiny AI offered hints without taking over the learning.` | Teaching framing. |
| Final | `In a university practical, a tiny AI helped a student understand the next step without doing the work for them.` | Final. |

## Future trace variants

Create variants for each prompt and style:

```text
<prompt-id>-clear
<prompt-id>-funny
<prompt-id>-sci-fi
<prompt-id>-scientific
<prompt-id>-poetic
```
