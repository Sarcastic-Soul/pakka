import type { Token } from "./types";

function split(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0);
}

function key(token: string): string {
  return token.toLowerCase().replace(/[\p{P}\p{S}]/gu, "");
}

export function diffWords(
  reference: string,
  hypothesis: string,
): { reference: Token[]; hypothesis: Token[] } {
  const refText = split(reference);
  const hypText = split(hypothesis);
  const ref = refText.map(key);
  const hyp = hypText.map(key);
  const n = ref.length;
  const m = hyp.length;

  // lcs[i][j] = LCS length of ref[i..] and hyp[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        ref[i] === hyp[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const refHit = new Array<boolean>(n).fill(false);
  const hypHit = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ref[i] === hyp[j]) {
      refHit[i] = true;
      hypHit[j] = true;
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return {
    reference: refText.map((text, k) => ({ text, hit: refHit[k] })),
    hypothesis: hypText.map((text, k) => ({ text, hit: hypHit[k] })),
  };
}
