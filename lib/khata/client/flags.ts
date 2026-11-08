import type { Flag } from "@/lib/khata/types";

/** Plain-words explanation for each server flag, Hindi first. */
export const FLAG_TEXT: Record<Flag, { hi: string; en: string }> = {
  numbers_differ: {
    hi: "दोनों बार अलग रकम सुनाई दी — ध्यान से जाँचिए",
    en: "The two hearings gave different numbers. Check carefully.",
  },
  raw_empty: {
    hi: "पहली बार कुछ सुनाई नहीं दिया",
    en: "Nothing was heard in the raw audio.",
  },
  amount_not_heard: {
    hi: "यह रकम बोली नहीं गई थी",
    en: "An amount on this card was not in what was heard.",
  },
  sum_mismatch: {
    hi: "सामान का जोड़ कुल से अलग है",
    en: "The items do not add up to the total.",
  },
  new_customer: {
    hi: "नया ग्राहक बनेगा",
    en: "A new customer will be added.",
  },
  no_total: {
    hi: "कुल रकम नहीं मिली — भर दीजिए",
    en: "No total was found. Please fill it in.",
  },
  denoise_unavailable: {
    hi: "आवाज़ साफ़ करने का कदम नहीं चला",
    en: "The cleaning step did not run, so there is only one hearing.",
  },
};

export const FLAG_ORDER: Flag[] = [
  "numbers_differ",
  "raw_empty",
  "amount_not_heard",
  "no_total",
  "sum_mismatch",
  "denoise_unavailable",
  "new_customer",
];

export function sortFlags(flags: Flag[]): Flag[] {
  return [...new Set(flags)].sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b));
}
