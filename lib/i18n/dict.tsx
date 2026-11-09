import type { ReactNode } from "react";
import type { Flag } from "@/lib/khata/types";

export type Lang = "hi" | "en";

const num = (n: ReactNode) => <span className="num">{n}</span>;

const en = {
  langLabel: "Language",
  loading: "Loading…",
  retry: "Try again",
  back: "Back",
  demoBadge: "Demo",
  somethingWrong: "Something went wrong.",

  // Entry kinds
  kindUdhaar: "Credit given",
  kindJama: "Payment received",
  kindUdhaarShort: "Credit",
  kindJamaShort: "Paid",

  // Checks
  flagsAria: "Checks",
  flags: {
    numbers_differ: "The two hearings gave different numbers. Check carefully.",
    raw_empty: "Nothing was heard in the raw audio.",
    amount_not_heard: "An amount on this card was not in what was heard.",
    sum_mismatch: "The items do not add up to the total.",
    new_customer: "A new customer will be added.",
    no_total: "No total was found. Please fill it in.",
    denoise_unavailable: "The cleaning step did not run, so there is only one hearing.",
  } satisfies Record<Flag, string>,

  // Sign in
  authPinError: "PIN must be 4 to 6 digits.",
  authDemo: "Try the demo",
  authDemoNote: "A throwaway shop with sample customers. No signup. Deleted after 24 hours.",
  authLogin: "Login",
  authNewShop: "New shop",
  authShopCode: "Shop code",
  authShopName: "Shop name",
  authPin: "PIN",
  authPinHint: "4–6 digits",
  authLoginSubmit: "Log in",
  authCreate: "Create shop",
  authCreated: (name: string) => `Shop created: ${name}`,
  authYourCode: "Your shop code",
  authNoteCode: "Note this code down. You need it and your PIN to log in again.",
  authOpen: "Open the khata",
  authContinue: (name: string) => `Continue to ${name}`,
  authOtherShop: "Use a different shop",

  // Confirm card
  cardCheck: "Check, then save",
  cardNew: "New entry",
  cancel: "Cancel",
  noisy: (db: number) => (
    <>The shop is noisy (about {num(db)} dB). Numbers need a closer look.</>
  ),
  customer: "Customer",
  customerPlaceholder: "Name",
  kindLegend: "Credit or payment",
  itemsLegend: "Items (optional for a payment)",
  itemPlaceholder: "Item",
  qtyPlaceholder: "Qty",
  itemNameAria: (i: number) => `Item ${i} name`,
  itemQtyAria: (i: number) => `Item ${i} quantity`,
  itemAmountAria: (i: number) => `Item ${i} amount in rupees`,
  itemRemoveAria: (i: number) => `Remove item ${i}`,
  addItem: "Add item",
  total: "Total",
  totalRupees: "Total, rupees",
  itemsAddUp: "Items add up to",
  differsFromTotal: " — differs from the total",
  saving: "Saving…",
  save: "Save",
  saveChecked: "Checked, save",
  recordAgain: "Record again",
  draftErrors: {
    name: "Enter the customer's name.",
    total: "Enter the total in whole rupees.",
    totalTooBig: "The total can be at most ₹1,00,00,000.",
    itemName: "Every item needs a name.",
    itemAmount: "Item amounts must be whole rupees.",
  },

  // Transcripts
  heard: "Heard (raw)",
  cleaned: "From cleaned audio",
  nothingHeard: "Nothing was heard",
  stepSkipped: "This step did not run",
  differsSr: " (differs in the other hearing)",

  // Recorder
  recUnsupported: "This browser cannot record audio",
  recUnsupportedHelp: "Try Chrome or Safari, or type the entry below.",
  recStopAria: "Stop recording",
  recStartAria: "Start recording",
  recSpeak: "Speak",
  recStop: "Stop",
  recTapSpeak: "Tap to speak",
  recTapStop: "Tap to stop",
  recSecondsLeft: (n: number) => `${n} seconds left`,
  recPrompt: "Say the customer, the items and the amount.",
  recLimit: (s: number) => `Up to ${s} seconds.`,
  recErrors: {
    denied: {
      title: "Microphone access was blocked",
      detail: "Allow it in the browser settings, or type the entry instead.",
    },
    unsupported: {
      title: "This browser cannot record",
      detail: "Try Chrome or Safari, or type the entry instead.",
    },
    failed: {
      title: "The microphone could not start",
      detail: "Check that no other app is using it.",
    },
  },

  // Customers
  customers: "Customers",
  searchCustomers: "Search customers",
  noMatch: "No customer matches that name",
  discardConfirm: "Discard this entry? The recording will be lost.",
  noCustomers: "No customers yet",
  noCustomersHelp: "Speak your first entry above, and the customer is added when you save it.",
  totalOwed: "Total owed to you",
  due: "Due",
  advance: "Advance",
  settled: "Settled",
  customersLoadFail: "Could not load customers.",
  panelBalance: "Balance",
  readBalance: "Read the balance aloud",
  history: "History, newest first",
  noEntries: "No entries yet",
  savedAfterChecks: (list: string) => `Saved after checks: ${list}`,

  // Speak button
  readToCustomer: "Read out to customer",
  speakLoading: "Preparing audio",
  speakStop: "Stop",
  playFail: "Could not play the audio.",
  playFailVolume: "Could not play the audio. Is the phone volume on?",

  // Khata app
  opening: "Opening the khata…",
  shopLoadFail: "Could not load your shop.",
  shopCode: "Shop code",
  logOut: "Log out",
  newEntryHeading: "New entry",
  typeInstead: "Type instead",
  steps: ["Cleaning the audio", "Prisma is listening, twice", "Writing the entry"],
  stepsTime: "Usually 5–15 seconds",
  saved: "Saved to the khata",
  newBalance: "New balance",
  nextEntry: "Next entry",
  saveFail: "Could not save.",
  noticeBusy: "Busy right now, try again shortly",
  noticeVoiceOff: "Voice entry is switched off. Type the entry instead.",
  noticeGeneric: "Something went wrong",
  noticeTooShort: "That recording was too short",
  noticeTooShortHelp: "Tap, speak the entry, then tap again.",
  noticeUnreadable: "Could not read the recording",
  noticeUnreadableHelp: "Please try again.",

  // Landing
  topbarLeft: "Voice udhaar ledger",
  noiseTest: "Noise test",
  heroTag: "Udhaar you can trust.",
  heroSub: "Every amount is checked twice.",
  heroBody: (
    <>
      Tap, say <span lang="hi">“रमेश के खाते में 2 Maggi 30, दूध 28”</span>, check the card, save. The
      customer hears the total read out. No amount is saved without the shop owner seeing it.
    </>
  ),
  exampleAria: "Example confirm card",
  exCheck: "check before saving",
  exCaption: (
    <>
      Example. The noisy recording heard {num(38)}, the cleaned one heard {num(28)}. Pakka shows both and
      waits for the shop owner.
    </>
  ),
  statLabels: [
    "of key words right in clean audio",
    "with fan noise at 5 dB",
    "phone numbers came back with a digit wrong in street noise at 0 dB",
  ],
  whyTitle: "Why check twice",
  whyIntro:
    "We tested Gnani Prisma on 40 Hindi clips with mixed-in shop and street noise, 520 calls in all. In noise it usually gets single digits wrong first, which is the worst place to be wrong in a khata.",
  catchTitle: "What the second hearing catches",
  catchBody: (a: ReactNode, b: ReactNode) => (
    <>
      Pakka transcribes the raw audio and a copy cleaned with DeepFilterNet. When the numbers in the two
      disagree, the card turns red. In our test that caught {a} wrong entries with fan noise at 0 dB, and{" "}
      {b} with street noise at 0 dB.
    </>
  ),
  frac: (a: number, b: number): ReactNode => (
    <span className="font-medium">
      {num(a)} of {num(b)}
    </span>
  ),
  cleanTitle: "Cleaning alone does not fix it",
  cleanBody:
    "At 5–10 dB, cleaning the audio did not make Prisma more accurate. We use the cleaned copy as a second opinion to spot doubt, not as a fix. A red card still needs a human to look.",
  seeTest: "See the full noise test",
  footer: "Pakka · पक्का. Built with Gnani Prisma v3.0 + Timbre v3.0, DeepFilterNet, Gemini 3.5 Flash Lite.",
};

export type Dict = typeof en;

const hi: Dict = {
  langLabel: "भाषा",
  loading: "लोड हो रहा है…",
  retry: "फिर कोशिश कीजिए",
  back: "वापस",
  demoBadge: "डेमो",
  somethingWrong: "कुछ गड़बड़ हुई।",

  kindUdhaar: "उधार",
  kindJama: "जमा",
  kindUdhaarShort: "उधार",
  kindJamaShort: "जमा",

  flagsAria: "जाँच के नतीजे",
  flags: {
    numbers_differ: "दोनों बार अलग रकम सुनाई दी — ध्यान से जाँचिए",
    raw_empty: "पहली बार कुछ सुनाई नहीं दिया",
    amount_not_heard: "यह रकम बोली नहीं गई थी",
    sum_mismatch: "सामान का जोड़ कुल से अलग है",
    new_customer: "नया ग्राहक बनेगा",
    no_total: "कुल रकम नहीं मिली — भर दीजिए",
    denoise_unavailable: "आवाज़ साफ़ करने का कदम नहीं चला, इसलिए सिर्फ़ एक बार सुना गया",
  },

  authPinError: "PIN 4 से 6 अंकों का होना चाहिए।",
  authDemo: "डेमो खोलिए",
  authDemoNote: "नमूने के ग्राहकों वाली एक अस्थायी दुकान। साइनअप नहीं चाहिए। 24 घंटे बाद मिट जाती है।",
  authLogin: "लॉगिन",
  authNewShop: "नई दुकान",
  authShopCode: "दुकान कोड",
  authShopName: "दुकान का नाम",
  authPin: "PIN",
  authPinHint: "4–6 अंक",
  authLoginSubmit: "खोलिए",
  authCreate: "दुकान बनाइए",
  authCreated: (name) => `दुकान बन गई: ${name}`,
  authYourCode: "आपका दुकान कोड",
  authNoteCode: "यह कोड लिख लीजिए। दोबारा लॉगिन के लिए कोड और PIN दोनों चाहिए।",
  authOpen: "खाता खोलिए",
  authContinue: (name) => `${name} खोलिए`,
  authOtherShop: "दूसरी दुकान",

  cardCheck: "जाँचिए और सेव कीजिए",
  cardNew: "नई एंट्री",
  cancel: "रद्द कीजिए",
  noisy: (db) => (
    <>दुकान में शोर ज़्यादा है (करीब {num(db)} dB)। रकम ध्यान से जाँचिए।</>
  ),
  customer: "ग्राहक",
  customerPlaceholder: "नाम",
  kindLegend: "उधार या जमा",
  itemsLegend: "सामान (जमा के लिए ज़रूरी नहीं)",
  itemPlaceholder: "सामान",
  qtyPlaceholder: "मात्रा",
  itemNameAria: (i) => `सामान ${i} का नाम`,
  itemQtyAria: (i) => `सामान ${i} की मात्रा`,
  itemAmountAria: (i) => `सामान ${i} की रकम, रुपये में`,
  itemRemoveAria: (i) => `सामान ${i} हटाइए`,
  addItem: "सामान जोड़िए",
  total: "कुल",
  totalRupees: "कुल रकम, रुपये में",
  itemsAddUp: "सामान का जोड़",
  differsFromTotal: " — कुल से अलग",
  saving: "सेव हो रहा है…",
  save: "सेव करें",
  saveChecked: "जाँच लिया, सेव करें",
  recordAgain: "दोबारा बोलिए",
  draftErrors: {
    name: "ग्राहक का नाम लिखिए।",
    total: "कुल रकम पूरे रुपयों में भरिए।",
    totalTooBig: "कुल रकम ₹1,00,00,000 से ज़्यादा नहीं हो सकती।",
    itemName: "हर सामान का नाम लिखिए।",
    itemAmount: "रकम सिर्फ़ अंकों में लिखिए।",
  },

  heard: "जो सुना",
  cleaned: "साफ़ आवाज़ से",
  nothingHeard: "कुछ सुनाई नहीं दिया",
  stepSkipped: "यह कदम नहीं चला",
  differsSr: " (दूसरी बार अलग)",

  recUnsupported: "इस ब्राउज़र में रिकॉर्डिंग नहीं चलती",
  recUnsupportedHelp: "Chrome या Safari में खोलिए, या नीचे लिखकर एंट्री डालिए।",
  recStopAria: "रिकॉर्डिंग रोकिए",
  recStartAria: "रिकॉर्डिंग शुरू कीजिए",
  recSpeak: "बोलिए",
  recStop: "रोकिए",
  recTapSpeak: "बोलने के लिए दबाइए",
  recTapStop: "रोकने के लिए दबाइए",
  recSecondsLeft: (n) => `${n} सेकंड बाकी`,
  recPrompt: "ग्राहक का नाम, सामान और रकम बोलिए।",
  recLimit: (s) => `ज़्यादा से ज़्यादा ${s} सेकंड।`,
  recErrors: {
    denied: {
      title: "माइक की इजाज़त नहीं मिली",
      detail: "ब्राउज़र की सेटिंग में इजाज़त दीजिए, या एंट्री लिखकर डालिए।",
    },
    unsupported: {
      title: "इस ब्राउज़र में रिकॉर्डिंग नहीं चलती",
      detail: "Chrome या Safari में खोलिए, या एंट्री लिखकर डालिए।",
    },
    failed: {
      title: "माइक शुरू नहीं हो पाया",
      detail: "देखिए कि कोई दूसरा ऐप माइक इस्तेमाल तो नहीं कर रहा।",
    },
  },

  customers: "ग्राहक",
  searchCustomers: "ग्राहक खोजिए",
  noMatch: "इस नाम का कोई ग्राहक नहीं मिला",
  discardConfirm: "यह एंट्री हटाएँ? रिकॉर्डिंग खो जाएगी।",
  noCustomers: "अभी कोई ग्राहक नहीं",
  noCustomersHelp: "ऊपर पहली एंट्री बोलिए। सेव करते ही ग्राहक जुड़ जाएगा।",
  totalOwed: "कुल बाकी",
  due: "बाकी",
  advance: "अग्रिम",
  settled: "हिसाब बराबर",
  customersLoadFail: "ग्राहक लोड नहीं हुए।",
  panelBalance: "बाकी",
  readBalance: "बाकी सुनाइए",
  history: "हिसाब (नया पहले)",
  noEntries: "अभी कोई एंट्री नहीं",
  savedAfterChecks: (list) => `जाँच कर सेव हुआ: ${list}`,

  readToCustomer: "ग्राहक को सुनाइए",
  speakLoading: "आवाज़ बन रही है…",
  speakStop: "रोकिए",
  playFail: "आवाज़ चल नहीं पाई।",
  playFailVolume: "आवाज़ चल नहीं पाई। फ़ोन की आवाज़ चालू है?",

  opening: "खाता खुल रहा है…",
  shopLoadFail: "दुकान लोड नहीं हो पाई।",
  shopCode: "दुकान कोड",
  logOut: "बाहर",
  newEntryHeading: "नई एंट्री",
  typeInstead: "बिना आवाज़ के लिखिए",
  steps: ["आवाज़ साफ़ की जा रही है…", "Prisma दो बार सुन रहा है…", "खाता बन रहा है…"],
  stepsTime: "इसमें 5–15 सेकंड लगते हैं",
  saved: "खाते में लिख दिया",
  newBalance: "नया बाकी",
  nextEntry: "अगली एंट्री",
  saveFail: "सेव नहीं हुआ।",
  noticeBusy: "अभी बहुत भीड़ है, थोड़ी देर बाद बोलिए",
  noticeVoiceOff: "आवाज़ से एंट्री अभी बंद है — लिखकर डालिए",
  noticeGeneric: "कुछ गड़बड़ हुई",
  noticeTooShort: "रिकॉर्डिंग बहुत छोटी थी",
  noticeTooShortHelp: "दबाइए, एंट्री बोलिए, फिर दोबारा दबाइए।",
  noticeUnreadable: "आवाज़ पढ़ी नहीं जा सकी",
  noticeUnreadableHelp: "फिर से कोशिश कीजिए।",

  topbarLeft: "आवाज़ से उधार का खाता",
  noiseTest: "शोर की जाँच",
  heroTag: "पक्का हिसाब।",
  heroSub: "हर रकम दो बार जाँची जाती है।",
  heroBody: (
    <>
      दबाइए, बोलिए <span lang="hi">“रमेश के खाते में 2 Maggi 30, दूध 28”</span>, कार्ड जाँचिए, सेव कीजिए। ग्राहक
      को कुल रकम बोलकर सुनाई जाती है। दुकानदार के देखे बिना कोई रकम सेव नहीं होती।
    </>
  ),
  exampleAria: "उदाहरण: जाँच कार्ड",
  exCheck: "सेव करने से पहले जाँचिए",
  exCaption: (
    <>
      उदाहरण। शोर वाली रिकॉर्डिंग में {num(38)} सुनाई दिया, साफ़ की हुई में {num(28)}। Pakka दोनों दिखाता है और
      दुकानदार के फ़ैसले का इंतज़ार करता है।
    </>
  ),
  statLabels: [
    "साफ़ आवाज़ में मुख्य शब्द सही",
    "पंखे के शोर में (5 dB)",
    "सड़क के शोर (0 dB) में फ़ोन नंबर में एक अंक ग़लत",
  ],
  whyTitle: "क्यों दो बार?",
  whyIntro:
    "हमने Gnani Prisma को 40 हिंदी क्लिप पर परखा, जिनमें दुकान और सड़क का शोर मिलाया गया, कुल 520 कॉल। शोर में सबसे पहले अक्सर एक अंक ग़लत होता है, और खाते में यही सबसे बुरी ग़लती है।",
  catchTitle: "दो बार सुनने से पकड़ में आता है",
  catchBody: (a, b) => (
    <>
      Pakka सीधी आवाज़ और DeepFilterNet से साफ़ की गई कॉपी, दोनों को टेक्स्ट में बदलता है। दोनों में रकम अलग हो
      तो कार्ड लाल हो जाता है। हमारी जाँच में पंखे के शोर (0 dB) में {a} और सड़क के शोर (0 dB) में {b} ग़लत
      एंट्री पकड़ में आईं।
    </>
  ),
  frac: (a, b) => (
    <span className="font-medium">
      {num(b)} में से {num(a)}
    </span>
  ),
  cleanTitle: "साफ़ करना अकेले काफ़ी नहीं",
  cleanBody:
    "5–10 dB पर आवाज़ साफ़ करने से Prisma ज़्यादा सही नहीं हुआ। हम साफ़ की हुई कॉपी को दूसरी राय की तरह इस्तेमाल करते हैं, ताकि शक पकड़ में आए, इलाज की तरह नहीं। लाल कार्ड को फिर भी इंसान को देखना होगा।",
  seeTest: "पूरा टेस्ट देखिए",
  footer: "Pakka · पक्का। Gnani Prisma v3.0 + Timbre v3.0, DeepFilterNet और Gemini 3.5 Flash Lite से बना।",
};

export const dict: Record<Lang, Dict> = { en, hi };
