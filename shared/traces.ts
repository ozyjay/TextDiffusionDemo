import type { PromptCard, Trace } from './types';

export const promptCards: PromptCard[] = [
  {
    id: 'robot-orientation-story',
    outputType: 'story',
    prompt: 'Write a tiny sci-fi story about a robot at orientation.',
    notes: 'Friendly story, campus themed.'
  },
  {
    id: 'reef-signal-story',
    outputType: 'story',
    prompt: 'Write a short story about a reef scientist finding a strange signal.',
    notes: 'Science story with local reef flavour.'
  },
  {
    id: 'number-guess-python',
    outputType: 'python',
    prompt: 'Write a small Python number guessing game.',
    notes: 'Simple loop, input, and feedback.'
  },
  {
    id: 'reef-temperature-python',
    outputType: 'python',
    prompt: 'Write a small Python script that checks reef temperatures.',
    notes: 'A readable list-processing example.'
  }
];

export const scriptedTraces: Trace[] = [
  {
    id: 'robot-orientation-story-clear',
    promptId: 'robot-orientation-story',
    outputType: 'story',
    prompt: 'A robot joins university orientation.',
    style: 'clear',
    controls: {
      creativity: 'balanced',
      length: 'medium',
      constraint: 'include-robot',
      steps: 5
    },
    stages: [
      {
        label: 'Noise',
        text: 'robot / campus / name-tag / ??? / lecture hall / map / bright sun / wrong building / hello',
        note: 'The page starts as noisy fragments, with useful ideas scattered through the mess.'
      },
      {
        label: 'Rough',
        text: 'A robot arrived at university orientation. It had a map but still went to the wrong building. Students helped it find the lecture hall.',
        note: 'A rough story appears, but it is plain and a little stiff.'
      },
      {
        label: 'Clear',
        text: 'On orientation morning, a small robot rolled onto campus with a name tag, a map, and complete confidence. Ten minutes later, it was politely asking first-year students why the library did not look like a lecture hall.',
        note: 'The beginning and middle are rewritten so the situation is easier to follow.'
      },
      {
        label: 'Styled',
        text: 'On orientation morning, a small robot rolled onto campus wearing a name tag that said HELLO, I AM NEW. Its map was perfect, its confidence was enormous, and its first destination was completely wrong.',
        note: 'Style changes the whole draft, not just the ending.'
      },
      {
        label: 'Final',
        text: 'On orientation morning, a small robot rolled onto campus wearing a name tag that said HELLO, I AM NEW. Its map was perfect, its confidence was enormous, and its first destination was completely wrong. A group of students laughed, waved it over, and walked it to the right lecture hall. By lunchtime, the robot had learned two things: university maps are only partly trustworthy, and getting lost is a surprisingly good way to make friends.',
        note: 'The final story fits on one page and has a clear beginning, turn, and ending.'
      }
    ]
  },
  {
    id: 'reef-signal-story-clear',
    promptId: 'reef-signal-story',
    outputType: 'story',
    prompt: 'A reef scientist discovers a strange signal.',
    style: 'clear',
    controls: {
      creativity: 'balanced',
      length: 'medium',
      constraint: 'include-reef',
      steps: 5
    },
    stages: [
      {
        label: 'Noise',
        text: 'reef / midnight sensor / pulse / coral / data spike / boat light / unknown / repeat / quiet water',
        note: 'The first pass is scattered: some story, some science, no shape yet.'
      },
      {
        label: 'Rough',
        text: 'A reef scientist saw a strange signal in the sensor data. It repeated at night. She decided to check it again.',
        note: 'The rough draft finds the basic plot.'
      },
      {
        label: 'Clear',
        text: 'Every night at 11:17, the reef sensors recorded the same quiet pulse. Dr Lina Patel checked the cables, the tide charts, and the moonlight data, but the signal kept returning.',
        note: 'The scene, character, and mystery become clearer.'
      },
      {
        label: 'Styled',
        text: 'Every night at 11:17, the reef sensors recorded the same quiet pulse. Dr Lina Patel checked cables, tide charts, moonlight, and passing boats. Nothing explained why the coral data seemed to answer itself in the dark.',
        note: 'The middle is rewritten to make the mystery feel more deliberate.'
      },
      {
        label: 'Final',
        text: 'Every night at 11:17, the reef sensors recorded the same quiet pulse. The reef scientist Dr Lina Patel checked cables, tide charts, moonlight, and passing boats. Nothing explained why the coral data seemed to answer itself in the dark. On the fourth night, she noticed the pulse matched a tiny rise in water temperature. It was not a message from the reef, but it was a warning worth listening to. By morning, her team had a new pattern to test and a better question to ask.',
        note: 'The final version stays modest: it suggests discovery without overclaiming certainty.'
      }
    ]
  },
  {
    id: 'number-guess-python-clear',
    promptId: 'number-guess-python',
    outputType: 'python',
    prompt: 'Write a small Python number guessing game.',
    style: 'clear',
    controls: {
      creativity: 'balanced',
      length: 'medium',
      constraint: 'none',
      steps: 5
    },
    stages: [
      {
        label: 'Noise',
        text: 'random / guess / ??? / if too high / print / loop / number = / input / win',
        note: 'The first pass has code-like fragments but no runnable structure.'
      },
      {
        label: 'Rough',
        text: 'import random\nnumber = random\nask user for guess\nif guess is number print win\nelse say higher or lower',
        note: 'The rough draft has intent, but it is not valid Python yet.'
      },
      {
        label: 'Clear',
        text: 'import random\n\nsecret = random.randint(1, 20)\nguess = int(input(\"Guess a number from 1 to 20: \"))\n\nif guess == secret:\n    print(\"You got it!\")\nelif guess < secret:\n    print(\"Too low.\")\nelse:\n    print(\"Too high.\")',
        note: 'A valid one-guess version appears.'
      },
      {
        label: 'Styled',
        text: 'import random\n\nsecret = random.randint(1, 20)\nattempts = 0\n\nwhile True:\n    guess = int(input(\"Guess a number from 1 to 20: \"))\n    attempts += 1\n\n    if guess == secret:\n        print(f\"Correct! You used {attempts} guesses.\")\n        break\n    if guess < secret:\n        print(\"Too low. Try again.\")\n    else:\n        print(\"Too high. Try again.\")',
        note: 'The middle changes into a loop, making the script feel complete.'
      },
      {
        label: 'Final',
        text: 'import random\n\nsecret = random.randint(1, 20)\nattempts = 0\n\nprint(\"I picked a number from 1 to 20.\")\n\nwhile True:\n    guess_text = input(\"Your guess: \")\n\n    if not guess_text.isdigit():\n        print(\"Please type a whole number.\")\n        continue\n\n    guess = int(guess_text)\n    attempts += 1\n\n    if guess == secret:\n        print(f\"Correct! You used {attempts} guesses.\")\n        break\n    if guess < secret:\n        print(\"Too low. Try again.\")\n    else:\n        print(\"Too high. Try again.\")',
        note: 'The final script is small, readable, and fits on a typical page.'
      }
    ]
  },
  {
    id: 'reef-temperature-python-clear',
    promptId: 'reef-temperature-python',
    outputType: 'python',
    prompt: 'Write a small Python script that checks reef temperatures.',
    style: 'clear',
    controls: {
      creativity: 'balanced',
      length: 'medium',
      constraint: 'include-reef',
      steps: 5
    },
    stages: [
      {
        label: 'Noise',
        text: 'temps = ?? / reef / for / average / if warm / print alert / sensor list / threshold',
        note: 'The text begins as code-shaped noise.'
      },
      {
        label: 'Rough',
        text: 'temperatures = [28, 29, 31]\ncheck each temperature\nif it is too hot print warning\nprint average',
        note: 'The rough pass has a plan but not enough Python structure.'
      },
      {
        label: 'Clear',
        text: 'temperatures = [28.4, 29.1, 30.6, 31.2]\n\nfor temp in temperatures:\n    if temp >= 30:\n        print(\"Warm reading:\", temp)\n\naverage = sum(temperatures) / len(temperatures)\nprint(\"Average temperature:\", average)',
        note: 'A working script takes shape.'
      },
      {
        label: 'Styled',
        text: 'reef_temperatures = [28.4, 29.1, 30.6, 31.2]\nalert_limit = 30.0\n\nfor reading in reef_temperatures:\n    if reading >= alert_limit:\n        print(f\"Reef alert: {reading}C is above the limit.\")\n\naverage = sum(reef_temperatures) / len(reef_temperatures)\nprint(f\"Average reef temperature: {average:.1f}C\")',
        note: 'Names and output become clearer for students reading from a screen.'
      },
      {
        label: 'Final',
        text: 'reef_temperatures = [28.4, 29.1, 30.6, 31.2]\nalert_limit = 30.0\n\nwarm_readings = []\n\nfor reading in reef_temperatures:\n    if reading >= alert_limit:\n        warm_readings.append(reading)\n\naverage = sum(reef_temperatures) / len(reef_temperatures)\n\nprint(f\"Average reef temperature: {average:.1f}C\")\n\nif warm_readings:\n    print(\"Warm readings found:\")\n    for reading in warm_readings:\n        print(f\"- {reading:.1f}C\")\nelse:\n    print(\"No warm readings today.\")',
        note: 'The final script keeps the logic simple and readable on one page.'
      }
    ]
  }
];
