<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { PUBLIC_EXPLANATION } from './content/publicCopy';
import { fetchModelStatus, fetchPrompts, requestRefinementStream } from './services/api';
import { getNextAutoplaySelection, type AutoplaySelection } from './services/autoplay';
import { buildHighlightedSegments } from './services/stageDiff';
import { buildStageDisplay, formatStageText } from './services/stageLabels';
import { buildTokenCells } from './services/tokenGrid';
import type {
  Creativity,
  Length,
  OutputType,
  PromptCard,
  RefineRequest,
  ModelRuntimeStatus,
  Trace
} from '../../shared/types';

const outputTypes: Array<{ id: OutputType; label: string; hint: string }> = [
  { id: 'story', label: 'Short story', hint: 'A page-sized story that becomes clearer each pass.' },
  { id: 'python', label: 'Python script', hint: 'A small readable script that fills in from missing pieces.' }
];

const styles = ['clear', 'funny', 'sci-fi', 'campus', 'scientific', 'poetic'];
const constraints = [
  { id: 'none', label: 'No constraint' },
  { id: 'include-reef', label: 'Include reef' },
  { id: 'include-robot', label: 'Include robot' },
  { id: 'university', label: 'Include university' },
  { id: 'under-12-words', label: 'Under 12 words' },
  { id: 'rhyme', label: 'Make it rhyme' }
];

const prompts = ref<PromptCard[]>([]);
const outputType = ref<OutputType>('story');
const selectedPromptId = ref('robot-orientation-story');
const promptSource = ref<'cards' | 'custom'>('cards');
const customPrompt = ref('');
const selectedStyle = ref('clear');
const creativity = ref<Creativity>('balanced');
const length = ref<Length>('medium');
const constraint = ref('none');
const steps = ref(5);
const speed = ref(2100);
const activeTrace = ref<Trace | null>(null);
const activeIndex = ref(-1);
const mode = ref('scripted');
const isRunning = ref(false);
const reducedMotion = ref(false);
const autoplayEnabled = ref(false);
const modelAssisted = ref(false);
const modelStatus = ref<ModelRuntimeStatus>({
  state: 'fallback',
  message: 'Checking model status...',
  updatedAt: new Date().toISOString(),
  preloadEnabled: false
});
const showDebugLabels = ref(false);
const lastAutoplaySelection = ref<AutoplaySelection | null>(null);
const viewMode = ref<'steps' | 'frames' | 'grid'>('steps');
let timer: number | undefined;
let autoplayTimer: number | undefined;
let modelStatusTimer: number | undefined;
let streamAbortController: AbortController | undefined;

const filteredPrompts = computed(() =>
  prompts.value.filter((prompt) => prompt.outputType === outputType.value)
);

const currentStage = computed(() =>
  activeTrace.value && activeIndex.value >= 0 ? activeTrace.value.stages[activeIndex.value] : null
);

const frameCount = computed(() => activeTrace.value?.stages.length ?? 0);

const selectedPrompt = computed(() =>
  filteredPrompts.value.find((prompt) => prompt.id === selectedPromptId.value)
);

const trimmedCustomPrompt = computed(() => customPrompt.value.trim());

const customPromptAvailable = computed(() => outputType.value === 'story');

const customPromptValid = computed(() =>
  trimmedCustomPrompt.value.length >= 8 && trimmedCustomPrompt.value.length <= 140
);

const usingCustomPrompt = computed(() =>
  promptSource.value === 'custom' && customPromptAvailable.value
);

const effectivePromptText = computed(() =>
  usingCustomPrompt.value
    ? trimmedCustomPrompt.value || 'Enter a short staff-supervised prompt'
    : selectedPrompt.value?.prompt ?? 'Choose a prompt card'
);

const customPromptStatus = computed(() => {
  const count = trimmedCustomPrompt.value.length;
  if (!usingCustomPrompt.value) {
    return `${count}/140`;
  }
  if (count < 8) {
    return `${count}/140 - at least 8 characters`;
  }
  return `${count}/140`;
});

const canRunDemo = computed(() =>
  !isRunning.value && (!usingCustomPrompt.value || customPromptValid.value)
);

const previousStageText = computed(() =>
  activeTrace.value && activeIndex.value > 0
    ? formatStageText(activeTrace.value.stages[activeIndex.value - 1].text, showDebugLabels.value)
    : ''
);

const highlightedSegments = computed(() =>
  currentStage.value
    ? buildHighlightedSegments(previousStageText.value, formatStageText(currentStage.value.text, showDebugLabels.value))
    : []
);

const tokenCells = computed(() =>
  currentStage.value
    ? buildTokenCells(formatStageText(currentStage.value.text, showDebugLabels.value), previousStageText.value)
    : []
);

const currentStageDisplay = computed(() =>
  currentStage.value
    ? buildStageDisplay(
        currentStage.value,
        activeIndex.value,
        activeTrace.value?.stages.length ?? activeIndex.value + 1,
        showDebugLabels.value
      )
    : null
);

const modelStatusLabel = computed(() => {
  const labels = {
    fallback: 'Fallback',
    loading: 'Loading',
    ready: 'Ready',
    error: 'Needs attention'
  };
  return labels[modelStatus.value.state];
});

onMounted(async () => {
  prompts.value = await fetchPrompts();
  await refreshModelStatus();
  modelStatusTimer = window.setInterval(() => {
    void refreshModelStatus();
  }, 2500);
  syncSelectedPrompt();
});

onUnmounted(() => {
  if (modelStatusTimer) {
    window.clearInterval(modelStatusTimer);
    modelStatusTimer = undefined;
  }
});

watch(outputType, () => {
  if (outputType.value !== 'story') {
    promptSource.value = 'cards';
    customPrompt.value = '';
  }
  syncSelectedPrompt();
  clearCurrentRun();
});

watch(autoplayEnabled, (enabled) => {
  clearAutoplayTimer();
  if (enabled) {
    queueAutoplay(800);
  }
});

function syncSelectedPrompt() {
  const firstPrompt = filteredPrompts.value[0];
  if (!firstPrompt) {
    return;
  }
  if (!filteredPrompts.value.some((prompt) => prompt.id === selectedPromptId.value)) {
    selectedPromptId.value = firstPrompt.id;
  }
  constraint.value = outputType.value === 'story' ? 'include-reef' : 'none';
}

async function runDemo(nextMode = 'scripted') {
  if (!canRunDemo.value) {
    return;
  }

  clearTimer();
  abortStream();
  clearAutoplayTimer();
  isRunning.value = true;
  const request: RefineRequest = {
    outputType: outputType.value,
    promptId: selectedPromptId.value,
    style: selectedStyle.value,
    creativity: creativity.value,
    length: length.value,
    constraint: constraint.value,
    steps: steps.value,
    streamDelayMs: reducedMotion.value ? Math.min(speed.value, 500) : speed.value,
    includeEveryFrame: viewMode.value === 'frames' || viewMode.value === 'grid',
    mode: usingCustomPrompt.value || modelAssisted.value ? 'model-assisted' : 'scripted'
  };
  if (usingCustomPrompt.value && customPromptValid.value) {
    request.customPrompt = trimmedCustomPrompt.value;
  }

  const currentStreamController = new AbortController();
  streamAbortController = currentStreamController;
  activeTrace.value = createStreamingTrace(request);
  activeIndex.value = -1;
  mode.value = nextMode === 'replay' ? 'replay' : 'streaming';

  try {
    const response = await requestRefinementStream(
      { ...request },
      (index, stage) => {
        if (!activeTrace.value) {
          activeTrace.value = createStreamingTrace(request);
        }
        activeTrace.value.stages[index] = stage;
        activeIndex.value = index;
      },
      currentStreamController.signal
    );
    activeTrace.value = response.trace;
    mode.value = nextMode === 'replay' ? 'replay' : response.mode;
    activeIndex.value = Math.max(response.trace.stages.length - 1, 0);
  } catch {
    if (!currentStreamController.signal.aborted) {
      isRunning.value = false;
    }
    return;
  } finally {
    if (streamAbortController === currentStreamController) {
      streamAbortController = undefined;
    }
  }

  isRunning.value = false;
  if (autoplayEnabled.value) {
    queueAutoplay(4500);
  }
}

async function runAutoplayDemo() {
  const selection = getNextAutoplaySelection(prompts.value, lastAutoplaySelection.value);
  if (!selection) {
    return;
  }

  lastAutoplaySelection.value = selection;
  outputType.value = selection.outputType;
  selectedPromptId.value = selection.promptId;
  await runDemo('autoplay');
}

function scheduleNextStage() {
  if (!activeTrace.value) {
    isRunning.value = false;
    return;
  }

  if (activeIndex.value >= activeTrace.value.stages.length - 1) {
    isRunning.value = false;
    if (autoplayEnabled.value) {
      queueAutoplay(4500);
    }
    return;
  }

  timer = window.setTimeout(() => {
    activeIndex.value += 1;
    scheduleNextStage();
  }, reducedMotion.value ? 500 : speed.value);
}

function resetDemo() {
  clearCurrentRun();
  clearAutoplayTimer();
  autoplayEnabled.value = false;
  customPrompt.value = '';
}

function clearCurrentRun() {
  clearTimer();
  abortStream();
  activeTrace.value = null;
  activeIndex.value = -1;
  isRunning.value = false;
  mode.value = 'scripted';
}

function abortStream() {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = undefined;
  }
}

function clearTimer() {
  if (timer) {
    window.clearTimeout(timer);
    timer = undefined;
  }
}

function toggleAutoplay() {
  autoplayEnabled.value = !autoplayEnabled.value;
}

function queueAutoplay(delay: number) {
  clearAutoplayTimer();
  autoplayTimer = window.setTimeout(() => {
    void runAutoplayDemo();
  }, reducedMotion.value ? Math.min(delay, 800) : delay);
}

function clearAutoplayTimer() {
  if (autoplayTimer) {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
  }
}

async function refreshModelStatus() {
  modelStatus.value = await fetchModelStatus();
}

function setPromptSource(source: 'cards' | 'custom') {
  if (source === 'custom' && !customPromptAvailable.value) {
    return;
  }
  promptSource.value = source;
  if (source === 'custom') {
    modelAssisted.value = true;
  }
}

function selectPrompt(promptId: string) {
  selectedPromptId.value = promptId;
  promptSource.value = 'cards';
}

function selectStage(index: number) {
  if (!activeTrace.value || index < 0 || index >= activeTrace.value.stages.length) {
    return;
  }
  clearTimer();
  isRunning.value = false;
  activeIndex.value = index;
}

function selectFrame(event: Event) {
  const input = event.target as HTMLInputElement;
  selectStage(Number(input.value));
}

function createStreamingTrace(request: RefineRequest): Trace {
  return {
    id: `${request.promptId}-${request.style}-streaming`,
    promptId: request.promptId,
    outputType: request.outputType,
    prompt: effectivePromptText.value,
    style: request.style,
    controls: {
      creativity: request.creativity,
      length: request.length,
      constraint: request.constraint,
      steps: request.steps
    },
    stages: []
  };
}
</script>

<template>
  <main class="shell">
    <div class="control-column">
      <header class="hero">
        <div>
          <p class="eyebrow">Open Day AI Demo</p>
          <h1>Beyond Next-Word Prediction: Text Diffusion Lab</h1>
          <p class="subtitle">Watch missing text fill in and become clearer through staged refinement.</p>
        </div>
        <aside class="status-panel" aria-label="Demo status">
          <span class="mode-label">Mode: {{ mode }}</span>
          <span>{{ autoplayEnabled ? 'Autoplay on' : isRunning ? 'Refining' : 'Ready' }}</span>
        </aside>
      </header>

      <section class="chooser" aria-label="Visitor choices">
        <div class="lane-switch" role="group" aria-label="Output type">
          <button
            v-for="item in outputTypes"
            :key="item.id"
            :class="{ selected: outputType === item.id }"
            type="button"
            @click="outputType = item.id"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.hint }}</span>
          </button>
        </div>

        <div class="prompt-panel">
          <div class="prompt-source" role="group" aria-label="Prompt source">
            <button
              type="button"
              :class="{ selected: promptSource === 'cards' }"
              @click="setPromptSource('cards')"
            >
              Prompt cards
            </button>
            <button
              type="button"
              :class="{ selected: promptSource === 'custom' }"
              :disabled="!customPromptAvailable"
              @click="setPromptSource('custom')"
            >
              Custom prompt
            </button>
          </div>
          <label class="custom-prompt-field">
            Custom prompt
            <input
              v-model="customPrompt"
              maxlength="140"
              minlength="8"
              placeholder="A robot discovers a hidden campus garden."
              type="text"
              @focus="setPromptSource('custom')"
            />
            <span>{{ customPromptStatus }}</span>
          </label>
          <div class="prompt-strip">
            <button
              v-for="prompt in filteredPrompts"
              :key="prompt.id"
              class="prompt-card"
              :class="{ selected: promptSource === 'cards' && selectedPromptId === prompt.id }"
              type="button"
              @click="selectPrompt(prompt.id)"
            >
              <strong>{{ prompt.prompt }}</strong>
              <span>{{ prompt.notes }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="control-board" aria-label="Demo controls">
        <div class="selected-summary">
          <span class="label">Selected</span>
          <strong>{{ effectivePromptText }}</strong>
        </div>

        <label class="style-field">
          Style
          <select v-model="selectedStyle">
            <option v-for="style in styles" :key="style" :value="style">
              {{ style }}
            </option>
          </select>
        </label>

        <label>
          Creativity
          <select v-model="creativity">
            <option value="safer">Safer</option>
            <option value="balanced">Balanced</option>
            <option value="surprising">Surprising</option>
          </select>
        </label>
        <label>
          Length
          <select v-model="length">
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <label>
          Constraint
          <select v-model="constraint">
            <option v-for="item in constraints" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label>
          <span class="range-label">
            Steps
            <strong>{{ steps }}</strong>
          </span>
          <input v-model.number="steps" min="3" max="8" step="1" type="range" />
        </label>
        <label>
          Speed
          <input v-model.number="speed" min="1000" max="3200" step="100" type="range" />
        </label>

        <div class="button-row primary-actions">
          <button class="primary" type="button" :disabled="!canRunDemo" @click="runDemo()">Diffuse Text</button>
        </div>
      </section>

      <section class="staff-controls" aria-label="Staff controls">
        <span class="label">Staff controls</span>
        <div class="model-status" :class="`state-${modelStatus.state}`" aria-live="polite">
          <span>Model: {{ modelStatusLabel }}</span>
          <strong>{{ modelStatus.providerId ?? 'local fallback' }}</strong>
          <small>{{ modelStatus.message }}</small>
        </div>
        <div class="button-row">
          <button type="button" @click="runDemo('replay')">Replay</button>
          <button type="button" :class="{ selected: autoplayEnabled }" @click="toggleAutoplay">
            Autoplay loop
          </button>
          <button type="button" :class="{ selected: viewMode === 'steps' }" @click="viewMode = 'steps'">
            Steps
          </button>
          <button type="button" :class="{ selected: viewMode === 'frames' }" @click="viewMode = 'frames'">
            Every frame
          </button>
          <button type="button" :class="{ selected: viewMode === 'grid' }" @click="viewMode = 'grid'">
            Token grid
          </button>
          <button type="button" @click="resetDemo">Reset</button>
        </div>
        <label class="checkbox-line">
          <input v-model="modelAssisted" :disabled="usingCustomPrompt" type="checkbox" />
          Model-assisted
        </label>
        <label class="checkbox-line">
          <input v-model="reducedMotion" type="checkbox" />
          Reduced motion
        </label>
        <label class="checkbox-line">
          <input v-model="showDebugLabels" type="checkbox" />
          Debug labels
        </label>
      </section>

      <footer class="explanation">
        <strong>What this shows:</strong>
        {{ PUBLIC_EXPLANATION }}
      </footer>
    </div>

    <section
      class="stage-view"
      :class="{ 'frame-view': viewMode === 'frames' || viewMode === 'grid' }"
      aria-label="Current staged refinement"
    >
      <aside v-if="viewMode === 'steps'" class="stage-list">
        <h2>Steps</h2>
        <ol>
          <li
            v-for="(stage, index) in activeTrace?.stages ?? []"
            :key="`${stage.label}-${index}`"
            :class="{ visible: index <= activeIndex, current: index === activeIndex }"
          >
            <button type="button" @click="selectStage(index)">
              <span>{{ buildStageDisplay(stage, index, activeTrace?.stages.length ?? index + 1, showDebugLabels).stepText }}</span>
              <strong>{{ buildStageDisplay(stage, index, activeTrace?.stages.length ?? index + 1, showDebugLabels).label }}</strong>
              <small>{{ buildStageDisplay(stage, index, activeTrace?.stages.length ?? index + 1, showDebugLabels).detail }}</small>
            </button>
          </li>
        </ol>
      </aside>

      <article class="page-output" :class="{ code: outputType === 'python', 'token-grid-view': viewMode === 'grid' }">
        <div v-if="viewMode === 'frames' || viewMode === 'grid'" class="frame-slider">
          <label>
            <span class="range-label">
              Frame
              <strong>{{ frameCount > 0 ? activeIndex + 1 : 0 }} / {{ frameCount }}</strong>
            </span>
            <input
              :value="activeIndex"
              :disabled="!activeTrace"
              :max="Math.max(frameCount - 1, 0)"
              min="0"
              step="1"
              type="range"
              @input="selectFrame"
            />
          </label>
        </div>
        <template v-if="currentStage">
          <div v-if="currentStageDisplay" class="page-heading">
            <span>{{ currentStageDisplay.stepText }} - {{ currentStageDisplay.label }}</span>
            <strong>{{ currentStage.note }}</strong>
            <small>
              {{ currentStageDisplay.detail }}
            </small>
            <small v-if="showDebugLabels && currentStageDisplay.debugText" class="debug-detail">
              Raw frame: {{ currentStage.label }} · {{ currentStageDisplay.debugText }}
            </small>
          </div>
          <div v-if="viewMode === 'grid'" class="token-grid" aria-label="Token grid for current frame">
            <span
              v-for="(cell, index) in tokenCells"
              :key="`${cell.text}-${index}`"
              class="token-cell"
              :class="`token-${cell.kind}`"
            >
              {{ cell.text }}
            </span>
          </div>
          <pre v-else-if="outputType === 'python'"><template
            v-for="(segment, index) in highlightedSegments"
            :key="`${segment.text}-${index}`"
          ><mark v-if="segment.changed" class="changed-word">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span></template></pre>
          <p v-else><template
            v-for="(segment, index) in highlightedSegments"
            :key="`${segment.text}-${index}`"
          ><mark v-if="segment.changed" class="changed-word">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span></template></p>
        </template>
        <template v-else>
          <p class="idle-copy">{{ PUBLIC_EXPLANATION }}</p>
          <span class="idle-help">Pick Short story or Python script, choose a card, then press Diffuse Text.</span>
        </template>
      </article>
    </section>
  </main>
</template>
