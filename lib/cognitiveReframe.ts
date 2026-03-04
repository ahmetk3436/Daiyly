export const REFRAME_QUESTIONS: Record<string, string[]> = {
  sad: [
    "What would your wiser self say to you right now?",
    "Is there a part of you that needs comfort — what does it need?",
    "What's one small thing that might help, even slightly?",
  ],
  angry: [
    "What boundary feels like it was crossed?",
    "What's underneath the anger — hurt, fear, or something else?",
    "What would you need to feel heard right now?",
  ],
  anxious: [
    "What's the worst realistic outcome — and could you handle it?",
    "What's in your control right now, even one small thing?",
    "What would you tell a friend feeling exactly this way?",
  ],
  tired: [
    "What's draining you the most right now?",
    "What would feel like real rest today?",
    "What's one thing you can let go of today?",
  ],
  default: [
    "What's really going on for you right now?",
    "What do you need most today?",
    "What would help you feel even 10% better?",
  ],
};

// Maps mood emoji values (from MOOD_OPTIONS) to reframe category keys
const MOOD_VALUE_TO_REFRAME: Record<string, string> = {
  sad: 'sad',
  angry: 'angry',
  anxious: 'anxious',
  tired: 'tired',
};

export function getReframeQuestions(moodValue: string): string[] {
  const key = MOOD_VALUE_TO_REFRAME[moodValue] ?? 'default';
  return REFRAME_QUESTIONS[key] ?? REFRAME_QUESTIONS.default;
}
