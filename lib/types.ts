export type Condition =
  | { id: string; kind: "clean" }
  | { id: string; kind: "noise"; noise: string; snr_db: number }
  | { id: string; kind: "codec"; codec: string };

export type Clip = {
  id: string;
  category: string;
  text: string;
  audio_base: string | null;
};

export type ResultRow = {
  clip: string;
  condition: string;
  model: string;
  transcript: string;
  entity_ok: boolean;
  wer: number;
  cer: number;
  delta_wer: number;
};

export type Aggregate = {
  model: string;
  condition: string;
  entity_accuracy: number;
  wer: number;
  delta_wer: number;
  n: number;
};

export type Breakpoint = {
  model: string;
  noise: string;
  snr_db: number | null;
};

export type ResultsFile = {
  generated_at: string;
  models: string[];
  conditions: Condition[];
  clips: Clip[];
  results: ResultRow[];
  aggregates: Aggregate[];
  breakpoints: Breakpoint[];
};

export type Token = { text: string; hit: boolean };
