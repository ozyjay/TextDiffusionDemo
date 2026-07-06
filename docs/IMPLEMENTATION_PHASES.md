# Implementation Phases — Text Diffusion Lab

## Phase A — From canvas to polish

### Goal

Create the visual refinement loop.

### Build

- App shell.
- Stage timeline component.
- Scripted trace loader.
- Animated word/phrase changes.
- Reset button.
- Replay mode.

### Data shape

Suggested trace format:

These labels are the internal validation labels. The public UI maps them to the Google-style explanation: `Canvas`, repeated `Iterative refinement` passes, and `Final polish`.

```json
{
  "id": "robot-orientation-funny",
  "prompt": "A robot joins university orientation.",
  "style": "funny",
  "controls": {
    "creativity": "balanced",
    "length": "medium",
    "steps": 5
  },
  "stages": [
    {
      "label": "Noise",
      "text": "robot / campus / lost / ??? / map / toaster",
      "note": "Placeholder-token canvas"
    },
    {
      "label": "Rough",
      "text": "A robot was lost at university and needed a map.",
      "note": "First refinement pass fills in rough meaning"
    },
    {
      "label": "Final",
      "text": "On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.",
      "note": "Final polish"
    }
  ]
}
```

### Tests

- Trace loader rejects malformed traces.
- Stage order is preserved.
- Reset returns to initial state.
- Replay can run without backend.

### Exit criteria

The demo is visually clear using only scripted traces.

## Phase B — Visitor-controlled refinement

### Goal

Let visitors steer the refinement without risky free text.

### Build

- Prompt card selector.
- Style buttons.
- Creativity slider.
- Length selector.
- Constraint buttons.
- Step/speed control.
- Deterministic trace selection based on controls.

### Optional backend

A simple backend can map selected controls to traces or run template-based rewrites. It should not be required for replay mode.

### Tests

- Every prompt card maps to at least one trace.
- Every style button maps to at least one safe output.
- Controls cannot create missing or broken trace states.
- Reset clears current run.

### Exit criteria

Visitors can run the demo through curated controls only.

## Phase C — Compare generation styles

### Goal

Add an educational comparison between today’s LLM-style next-token generation and diffusion-style staged refinement.

### Build

- Split-screen view.
- Left panel: left-to-right token stream.
- Right panel: staged whole-text refinement.
- Toggle to hide comparison if it is too busy.
- Explanation cards.

### Tests

- Comparison labels do not overclaim.
- Left-to-right panel does not say “thinking”.
- Diffusion panel says “simplified” or “diffusion-inspired”.
- Staff can disable comparison view.

### Exit criteria

A visitor can explain the contrast in one sentence:

> “One version adds words one by one; the other repeatedly refines the whole draft.”

## Stretch — Model-assisted refinement

Only attempt this after A+B are reliable.

Possible flow:

```text
Prompt + controls -> local model rewrite call -> stage controller -> screen timeline
```

Rules:

- Keep scripted replay as fallback.
- Time out model calls quickly.
- Never block the public screen on model failure.
- Avoid open-ended visitor input in Open Day mode.
