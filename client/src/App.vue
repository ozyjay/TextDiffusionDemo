<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PUBLIC_EXPLANATION } from './content/publicCopy';
import { fetchPrompts, requestRefinement } from './services/api';
import { getNextAutoplaySelection, type AutoplaySelection } from './services/autoplay';
import { buildHighlightedSegments } from './services/stageDiff';
import type {
  Creativity,
  Length,
  OutputType,
  PromptCard,
  RefinementStage,
  Trace
} from '../../shared/types';

const outputTypes: Array<{ id: OutputType; label: string; hint: string }> = [
  { id: 'story', label: 'Short story', hint: 'A page-sized story that becomes clearer each pass.' },
  { id: 'python', label: 'Python script', hint: 'A small readable script that forms from code-like noise.' }
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
const showAdvanced = ref(false);
const autoplayEnabled = ref(false);
const modelAssisted = ref(false);
const lastAutoplaySelection = ref<AutoplaySelection | null>(null);
let timer: number | undefined;
let autoplayTimer: number | undefined;

const filteredPrompts = computed(() =>
  prompts.value.filter((prompt) => prompt.outputType === outputType.value)
);

const visibleStages = computed<RefinementStage[]>(() =>
  activeTrace.value ? activeTrace.value.stages.slice(0, activeIndex.value + 1) : []
);

const currentStage = computed(() =>
  activeTrace.value && activeIndex.value >= 0 ? activeTrace.value.stages[activeIndex.value] : null
);

const selectedPrompt = computed(() =>
  filteredPrompts.value.find((prompt) => prompt.id === selectedPromptId.value)
);

const previousStageText = computed(() =>
  activeTrace.value && activeIndex.value > 0 ? activeTrace.value.stages[activeIndex.value - 1].text : ''
);

const highlightedSegments = computed(() =>
  currentStage.value ? buildHighlightedSegments(previousStageText.value, currentStage.value.text) : []
);

onMounted(async () => {
  prompts.value = await fetchPrompts();
  syncSelectedPrompt();
});

watch(outputType, () => {
  syncSelectedPrompt();
  resetDemo();
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
  clearTimer();
  clearAutoplayTimer();
  isRunning.value = true;
  const response = await requestRefinement({
    outputType: outputType.value,
    promptId: selectedPromptId.value,
    style: selectedStyle.value,
    creativity: creativity.value,
    length: length.value,
    constraint: constraint.value,
    steps: steps.value,
    mode: modelAssisted.value ? 'model-assisted' : 'scripted'
  });
  activeTrace.value = response.trace;
  mode.value = nextMode === 'replay' ? 'replay' : response.mode;
  activeIndex.value = 0;
  scheduleNextStage();
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
  clearTimer();
  clearAutoplayTimer();
  autoplayEnabled.value = false;
  activeTrace.value = null;
  activeIndex.value = -1;
  isRunning.value = false;
  mode.value = 'scripted';
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
</script>

<template>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Open Day AI Demo</p>
        <h1>Beyond Next-Word Prediction: Text Diffusion Lab</h1>
        <p class="subtitle">Watch page-sized text form from noise through staged refinement.</p>
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

      <div class="prompt-strip">
        <button
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          class="prompt-card"
          :class="{ selected: selectedPromptId === prompt.id }"
          type="button"
          @click="selectedPromptId = prompt.id"
        >
          <strong>{{ prompt.prompt }}</strong>
          <span>{{ prompt.notes }}</span>
        </button>
      </div>
    </section>

    <section class="run-bar" aria-label="Run controls">
      <div>
        <span class="label">Selected</span>
        <strong>{{ selectedPrompt?.prompt ?? 'Choose a prompt card' }}</strong>
      </div>
      <div class="button-row">
        <button class="primary" type="button" @click="runDemo()">Diffuse Text</button>
        <button type="button" @click="runDemo('replay')">Replay</button>
        <button type="button" :class="{ selected: autoplayEnabled }" @click="toggleAutoplay">
          Autoplay
        </button>
        <button type="button" @click="resetDemo">Reset</button>
      </div>
    </section>

    <section class="stage-view" aria-label="Current staged refinement">
      <aside class="stage-list">
        <h2>Refinement passes</h2>
        <ol>
          <li
            v-for="(stage, index) in activeTrace?.stages ?? []"
            :key="stage.label"
            :class="{ visible: index <= activeIndex, current: index === activeIndex }"
          >
            <span>Step {{ index }}</span>
            {{ stage.label }}
          </li>
        </ol>
      </aside>

      <article class="page-output" :class="{ code: outputType === 'python' }">
        <template v-if="currentStage">
          <div class="page-heading">
            <span>Step {{ activeIndex }} - {{ currentStage.label }}</span>
            <strong>{{ currentStage.note }}</strong>
          </div>
          <pre v-if="outputType === 'python'"><template
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

    <section class="advanced">
      <button class="advanced-toggle" type="button" @click="showAdvanced = !showAdvanced">
        Staff controls
      </button>
      <div v-if="showAdvanced" class="advanced-panel">
        <div class="style-buttons" role="group" aria-label="Style">
          <span>Style</span>
          <button
            v-for="style in styles"
            :key="style"
            :class="{ selected: selectedStyle === style }"
            type="button"
            @click="selectedStyle = style"
          >
            {{ style }}
          </button>
        </div>
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
          Speed
          <input v-model.number="speed" min="1000" max="3200" step="100" type="range" />
        </label>
        <label class="checkbox-line">
          <input v-model="modelAssisted" type="checkbox" />
          Model-assisted
        </label>
        <label class="checkbox-line">
          <input v-model="reducedMotion" type="checkbox" />
          Reduced motion
        </label>
      </div>
    </section>

    <footer class="explanation">
      <strong>What this shows:</strong>
      {{ PUBLIC_EXPLANATION }}
    </footer>
  </main>
</template>
