# Test Plan — Text Diffusion Lab

## Purpose

The demo must be reliable enough for a public Open Day booth. It should fail safely into replay mode and never require developer-only recovery in front of visitors.

## Functional tests

| Test | Expected result |
|---|---|
| Load app | App starts on frontend port 3300. |
| Load traces | All scripted traces load without schema errors. |
| Run prompt card | Selected prompt shows all stages in order. |
| Change style | Style changes selected trace or output path. |
| Change creativity | Creativity control affects staged output or trace selection. |
| Reset | Clears current prompt, stage state, and visitor-visible output. |
| Replay | Runs without backend/model/network. |
| Open Day mode | Uses fixed ports and does not select random fallback ports. |

## Content tests

| Test | Expected result |
|---|---|
| No overclaiming | UI says simplified, staged, or diffusion-inspired. |
| No “AI thinking” | No screen, script, or docs claim the AI is thinking. |
| Safe prompts | Curated prompts avoid sensitive or unsafe topics. |
| Visitor input | No open free text in default Open Day mode. |
| Clear explanation | Staff script fits under 45 seconds. |

## Visual tests

| Test | Expected result |
|---|---|
| Readability | Text readable from 2–3 metres. |
| Stage clarity | Each stage label is obvious. |
| Change visibility | Earlier words visibly change during refinement. |
| Idle state | Screen looks intentional when waiting. |
| Fallback label | Replay/fallback mode is visibly labelled. |

## Reliability tests

| Test | Expected result |
|---|---|
| 60-minute run | App remains responsive. |
| Backend unavailable | App switches to replay or scripted mode. |
| Model unavailable | App does not block; fallback still works. |
| Browser refresh | App returns to clean start state. |
| Port conflict | Launch script stops and prints a clear error. |

## Manual booth test

Ask someone who did not build the demo to use it.

Pass condition:

- They can run a prompt.
- They can describe the idea in one sentence.
- They can reset it.
- They understand that it is a simplified demo, not a claim that all future AI will work this way.

## Go/no-go decision

The demo is Open Day ready only if:

- three curated prompts work cleanly;
- reset works;
- fallback works offline;
- public wording is accurate;
- staff can explain it quickly;
- no model call is required for the basic demo loop.
