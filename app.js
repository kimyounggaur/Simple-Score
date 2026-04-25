/* ═══════════════════════════════════════════════════════════
   Lesson Designer — Music Score Editor
   ───────────────────────────────────────────────────────────
   SIMPLE ENTRY MODE  (Finale-style)
   ═══════════════════════════════════════════════════════════
   §1   State & Constants
   §2   DOM
   §3   Audio Engine
   §4   Pitch ↔ Y Math
   §5   Pitch Utilities  (letter-key entry)
   §6   Measure Splitting
   §7   VexFlow Renderer
   §8   Cursor Line Drawing
   §8.5 Ghost Note Preview   ★ NEW
   §9   Simple Entry Logic
   §10  Mouse Interaction
   §11  Keyboard Handler
   §12  Measure Playback
   §13  Full Playback
   §14  Export PNG / PDF
   §15  UI Bindings
   §16  Status Bar
   §17  Init
   ═══════════════════════════════════════════════════════════ */

const VF = Vex.Flow;
const { Renderer, Stave, StaveNote, Voice, Formatter, Dot, Accidental } = VF;

/* ═══════════════════════════════════════
   §1  STATE & CONSTANTS
   ═══════════════════════════════════════ */

const appState = {
  currentDuration : 'q',
  isRest          : false,
  isDotted        : false,

  timeSignature : '4/4',
  keySignature  : 'C',
  bpm           : 120,

  notes : [],

  cursorIndex : 0,

  /* ── Chord Symbol mode ── */
  chordMode      : false,   // true when chord entry mode is active
  chordEditIndex : -1,      // note index being edited

  /* ── Lyrics mode ── */
  lyricMode      : false,
  lyricEditIndex : -1,
  lyricEditVoice : 0,    // which voice is being edited (0 or 1)
  lyricVerse     : 0,    // current lyric verse being edited (0–4 → 1st–5th verse)

  /* ── Lyric visual style ── */
  lyricStyle : {
    font   : "'DM Sans', sans-serif",  // font-family
    size   : 12,          // font-size in px
    offsetY: 22,          // distance below note bbox bottom
    weight : '500',       // font-weight
    italic : true,        // italic toggle
    color  : '#3a3035',   // fill color
  },

  selectedNoteIndex : -1,
  isDragging        : false,
  _mouseDidDrag     : false,
  _mouseDownOnNote  : false,

  instrument : null,
  audioCtx   : null,

  isPlaying    : false,
  playTimeouts : [],

  renderedBBoxes : [],
  staveCache     : [],

  /* ── Measure numbers ── */
  showMeasureNumbers : true,

  /* ── Note color ── */
  noteColor : {
    head : '#000000',
    stem : '#000000',
  },

  /* ── Song Form labels ── */
  songFormLabels   : {},     // { measureIndex: 'intro' | 'verse' | ... }
  songFormMode     : false,  // true when assigning form labels
  songFormSelected : null,   // currently selected form type

  /* ── Repeat notation markers ── */
  repeatMarkers  : {},     // { measureIndex: { 'repeat-start': true, 'segno': true, ... } }
  repeatMode     : false,
  repeatSelected : null,

  /* ── Articulation ── */
  articulationMode     : false,
  articulationSelected : null,   // 'staccato' | 'accent' | 'tenuto' | 'marcato' | 'staccatissimo'

  /* ── Dynamics ── */
  dynamicsMode     : false,
  dynamicsSelected : null,   // 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'sfz' | 'fp'

  /* ── Voice Part (성부) ── */
  voice2Notes      : [],   // notes for voice 2 (stems down, blue)
  currentVoice     : 0,    // 0 = voice 1, 1 = voice 2
  v2CursorIdx      : 0,    // cursor index for voice 2
  selectedNoteVoice: 0,    // voice of currently dragged/selected note

  /* ── Layout settings ── */
  layout : {
    measuresPerLine : 4,
    staffLineSpacing: 10,      // px between staff lines (VexFlow default: 10)
    staffSpacing    : 130,     // px between staff rows
    measureWidth    : 200,     // px width per measure
  },

  /* ── Measure Gap ── */
  measureGapMode      : false,
  measureGaps         : {},    // { measureIndex: extraPixels } — extra space after that measure
  _gapSelectedMeasure : null,
};

const DURATION_BEATS  = { w:4, h:2, q:1, '8':0.5, '16':0.25 };
const DURATION_LABELS = { w:'𝅝 Whole', h:'𝅗𝅥 Half', q:'♩ Quarter', '8':'♪ 8th', '16':'𝅘𝅥𝅯 16th' };
const NUM_TO_DURATION = { '7':'w', '6':'h', '5':'q', '4':'8', '3':'16' };

const STAVE_X       = 10;
const STAVE_Y_START = 75;   // leaves room above stave for badges/brackets (VexFlow adds space_above internally)

/* ── Song Form: display names & badge colors ── */
const FORM_DISPLAY = {
  'intro'      : 'Intro',
  'verse'      : 'Verse',
  'pre-chorus' : 'Pre-Ch',
  'chorus'     : 'Chorus',
  'interlude'  : 'Interlude',
  'bridge'     : 'Bridge',
  'climax'     : 'Climax',
  'outro'      : 'Outro',
  'fade-in'    : 'Fade In',
  'fade-out'   : 'Fade Out',
};
const FORM_COLORS = {
  'intro'      : { bg:'#e8f0fe', stroke:'#4285f4', text:'#1a73e8' },
  'verse'      : { bg:'#e6f4ea', stroke:'#34a853', text:'#1e8e3e' },
  'pre-chorus' : { bg:'#fde7f3', stroke:'#e91e8c', text:'#c2185b' },
  'chorus'     : { bg:'#fef7e0', stroke:'#f9ab00', text:'#e37400' },
  'interlude'  : { bg:'#f3e8fd', stroke:'#9334e6', text:'#7627bb' },
  'bridge'     : { bg:'#e6f4f1', stroke:'#00897b', text:'#00695c' },
  'climax'     : { bg:'#fce8e6', stroke:'#d93025', text:'#b31412' },
  'outro'      : { bg:'#f1f3f4', stroke:'#80868b', text:'#5f6368' },
  'fade-in'    : { bg:'#e8f5e9', stroke:'#43a047', text:'#2e7d32' },
  'fade-out'   : { bg:'#fafafa', stroke:'#9e9e9e', text:'#616161' },
};

/* ── Repeat Notation definitions ── */
const REPEAT_DEFS = {
  'repeat-start' : { type: 'barline-start' },
  'repeat-end'   : { type: 'barline-end'   },
  'segno'        : { type: 'symbol'        },
  'coda'         : { type: 'symbol'        },
  'da-capo'      : { type: 'text-end'      },
  'dal-segno'    : { type: 'text-end'      },
  'ds-al-coda'   : { type: 'text-end'      },
  'fine'         : { type: 'text-end'      },
  'volta-1'      : { type: 'volta'         },
  'volta-2'      : { type: 'volta'         },
  'fermata'      : { type: 'note'          },
};

/* ── Articulation definitions ── */
const ARTICULATION_DEFS = {
  'staccato'      : { label: '· Staccato'      },
  'accent'        : { label: '> Accent'        },
  'tenuto'        : { label: '— Tenuto'        },
  'marcato'       : { label: '^ Marcato'       },
  'staccatissimo' : { label: '▾ Staccatissimo' },
};

/* ── Dynamics definitions ── */
const DYNAMICS_DEFS = {
  'pp'  : { label: 'pp',  display: 'pp'  },
  'p'   : { label: 'p',   display: 'p'   },
  'mp'  : { label: 'mp',  display: 'mp'  },
  'mf'  : { label: 'mf',  display: 'mf'  },
  'f'   : { label: 'f',   display: 'f'   },
  'ff'  : { label: 'ff',  display: 'ff'  },
  'sfz' : { label: 'sfz', display: 'sfz' },
  'fp'  : { label: 'fp',  display: 'fp'  },
};

const DRAG_COLOR       = '#FF9800';
const SELECT_COLOR     = '#4A90D9';
const V2_COLOR         = '#1565C0';   // blue for voice 2 notes
const CURSOR_COLOR     = '#4A90D9';
const GHOST_COLOR      = '#4A90D9';
const GHOST_OPACITY    = '0.38';
const HIGHLIGHT_FILL   = 'rgba(100, 160, 255, 0.12)';
const HIGHLIGHT_STROKE = 'rgba(100, 160, 255, 0.28)';
const RIGHT_BARLINE_NOTE_PAD = 34;

const TREBLE_PITCHES = [
  'a/5','g/5','f/5','e/5','d/5','c/5',
  'b/4','a/4','g/4','f/4','e/4','d/4','c/4',
  'b/3','a/3',
];

const SEMI = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };

/* ── Key transposition helpers ── */

/** Semitone value of each key signature root */
const KEY_SEMI = { C:0, G:7, D:2, A:9, E:4, F:5, Bb:10, Eb:3 };

/** Sharp keys use sharps, flat keys use flats for enharmonic spelling */
const SHARP_KEYS = new Set(['G','D','A','E']);

/** Semitone → note name lookup (sharp spelling) */
const SEMI_TO_SHARP = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
/** Semitone → note name lookup (flat spelling) */
const SEMI_TO_FLAT  = ['c','db','d','eb','e','f','gb','g','ab','a','bb','b'];

/**
 * Convert a VexFlow pitch string to absolute semitone number.
 *   'c/4' → 48,  'a/5' → 69
 */
function pitchToSemitone(pitch) {
  const [name, octStr] = pitch.split('/');
  const letter = name.charAt(0);
  const acc    = name.slice(1);           // '', '#', 'b'
  let semi = SEMI[letter] || 0;
  if (acc === '#') semi += 1;
  if (acc === 'b') semi -= 1;
  return semi + (Number(octStr) + 1) * 12;
}

/**
 * Convert an absolute semitone number back to a VexFlow pitch string,
 * using the appropriate enharmonic spelling for the target key.
 * Clamps to the TREBLE_PITCHES range (A3–A5).
 */
function semitoneToPitch(semi, targetKey) {
  const useSharp = SHARP_KEYS.has(targetKey);
  const octave   = Math.floor(semi / 12) - 1;
  const pc       = ((semi % 12) + 12) % 12;
  const name     = useSharp ? SEMI_TO_SHARP[pc] : SEMI_TO_FLAT[pc];
  return `${name}/${octave}`;
}

/**
 * Transpose all existing notes when the key signature changes.
 * direction: 'up' = nearest upward, 'down' = nearest downward, 'none' = no transpose
 */
function transposeAllNotes(oldKey, newKey, direction) {
  if (direction === 'none') return;

  let interval = (KEY_SEMI[newKey] ?? 0) - (KEY_SEMI[oldKey] ?? 0);

  /* normalise interval into the requested direction */
  if (direction === 'up') {
    if (interval <= 0) interval += 12;       // force upward
  } else if (direction === 'down') {
    if (interval >= 0) interval -= 12;       // force downward
  }

  if (interval === 0) return;

  const minSemi = pitchToSemitone('a/3');
  const maxSemi = pitchToSemitone('a/5');

  appState.notes.forEach(n => {
    if (n.isRest) return;
    const oldSemi = pitchToSemitone(n.keys[0]);
    let   newSemi = oldSemi + interval;

    while (newSemi < minSemi) newSemi += 12;
    while (newSemi > maxSemi) newSemi -= 12;

    n.keys = [semitoneToPitch(newSemi, newKey)];
  });
}

/**
 * Show a modal dialog with three transpose options when the key changes.
 */
function showTransposeModal(oldKey, newKey) {
  /* prevent duplicate */
  if (document.getElementById('transpose-modal-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'transpose-modal-backdrop';

  const semitoneUp   = (((KEY_SEMI[newKey] ?? 0) - (KEY_SEMI[oldKey] ?? 0)) % 12 + 12) % 12 || 12;
  const semitoneDown = semitoneUp - 12;

  backdrop.innerHTML = `
    <div class="transpose-modal">
      <h3>Key Change — Transpose?</h3>
      <div class="key-change-badge">
        <span>${oldKey} Major</span>
        <span class="arrow-icon">→</span>
        <span>${newKey} Major</span>
      </div>
      <p class="modal-sub">
        기존에 입력된 음표들을 새로운 조에 맞춰 조옮김할 방법을 선택하세요.
      </p>
      <div class="modal-buttons">
        <button class="modal-btn" data-dir="up">
          <span class="btn-icon">⬆</span>
          <div>
            <div>위로 조옮김 (Up)</div>
            <div class="btn-desc">+${semitoneUp} 반음 — 음표를 높은 쪽으로 이동</div>
          </div>
        </button>
        <button class="modal-btn" data-dir="down">
          <span class="btn-icon">⬇</span>
          <div>
            <div>아래로 조옮김 (Down)</div>
            <div class="btn-desc">${semitoneDown} 반음 — 음표를 낮은 쪽으로 이동</div>
          </div>
        </button>
        <button class="modal-btn primary" data-dir="none">
          <span class="btn-icon">━</span>
          <div>
            <div>조옮김 없음 (No Transpose)</div>
            <div class="btn-desc">조표만 변경하고 음표 높이는 그대로 유지</div>
          </div>
        </button>
      </div>
    </div>`;

  function applyChoice(direction) {
    backdrop.remove();
    transposeAllNotes(oldKey, newKey, direction);
    appState.keySignature = newKey;
    renderScore();
  }

  backdrop.querySelectorAll('.modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyChoice(btn.dataset.dir);
    });
  });

  /* clicking the backdrop = cancel (revert select back to old key) */
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
      dom.keySig.value = oldKey;   // revert dropdown
    }
  });

  /* Escape key = cancel */
  function onEsc(e) {
    if (e.key === 'Escape') {
      backdrop.remove();
      dom.keySig.value = oldKey;
      document.removeEventListener('keydown', onEsc);
    }
  }
  document.addEventListener('keydown', onEsc);

  document.body.appendChild(backdrop);
}


/* ═══════════════════════════════════════
   §2  DOM
   ═══════════════════════════════════════ */

const dom = {
  overlay     : document.getElementById('loading-overlay'),
  canvas      : document.getElementById('score-canvas'),
  instrument  : document.getElementById('instrument-select'),
  btnPlay     : document.getElementById('btn-play'),
  btnStop     : document.getElementById('btn-stop'),
  bpmSlider   : document.getElementById('bpm-slider'),
  bpmDisplay  : document.getElementById('bpm-display'),
  noteButtons : document.querySelectorAll('.note-buttons .tool-btn'),
  btnRest     : document.getElementById('btn-rest'),
  btnDot      : document.getElementById('btn-dot'),
  keySig      : document.getElementById('key-sig-select'),
  timeSig     : document.getElementById('time-sig-select'),
  btnUndo     : document.getElementById('btn-undo'),
  btnClear    : document.getElementById('btn-clear'),
  btnChord    : document.getElementById('btn-chord'),
  chordInput  : document.getElementById('chord-input'),
  btnLyric    : document.getElementById('btn-lyric'),
  lyricInput  : document.getElementById('lyric-input'),
  btnPNG      : document.getElementById('btn-export-png'),
  btnPDF      : document.getElementById('btn-export-pdf'),
  statusDur   : document.getElementById('status-duration'),
  statusPos   : document.getElementById('status-position'),
  statusPitch : document.getElementById('status-pitch'),
  statusChord : document.getElementById('status-chord'),
  statusLyric : document.getElementById('status-lyric'),

  /* lyric style controls */
  lyricFont       : document.getElementById('lyric-font'),
  lyricSize       : document.getElementById('lyric-size'),
  lyricSizeVal    : document.getElementById('lyric-size-val'),
  lyricOffset     : document.getElementById('lyric-offset'),
  lyricOffsetVal  : document.getElementById('lyric-offset-val'),
  lyricWeight     : document.getElementById('lyric-weight'),
  lyricItalicToggle : document.getElementById('lyric-italic-toggle'),
  lyricColor      : document.getElementById('lyric-color'),
  lyricColorHex   : document.getElementById('lyric-color-hex'),
  /* layout sliders */
  slMPL    : document.getElementById('sl-measures-per-line'),
  valMPL   : document.getElementById('val-measures-per-line'),
  slScale  : document.getElementById('sl-staff-scale'),
  valScale : document.getElementById('val-staff-scale'),
  slSpace  : document.getElementById('sl-staff-spacing'),
  valSpace : document.getElementById('val-staff-spacing'),
  slMW     : document.getElementById('sl-measure-width'),
  valMW    : document.getElementById('val-measure-width'),
  /* measure numbers */
  toggleMeasureNumbers : document.getElementById('toggle-measure-numbers'),
  /* note color */
  noteHeadColor    : document.getElementById('note-head-color'),
  noteHeadColorHex : document.getElementById('note-head-color-hex'),
  noteStemColor    : document.getElementById('note-stem-color'),
  noteStemColorHex : document.getElementById('note-stem-color-hex'),
  /* repeat notation buttons */
  repeatButtons    : document.querySelectorAll('.repeat-btn'),
  /* articulation buttons */
  articButtons     : document.querySelectorAll('.artic-btn'),
  /* dynamics buttons */
  dynamicButtons   : document.querySelectorAll('.dynamic-btn'),
  /* voice part buttons */
  voiceButtons     : document.querySelectorAll('.voice-btn'),
  /* lyric verse buttons */
  lyricVerseButtons: document.querySelectorAll('.lyric-verse-btn'),
};

function readEditorAccessProfile() {
  const fallback = {
    level: 'guest',
    isLoggedIn: false,
    isAdmin: false,
    permissions: {
      basicEntry: true,
      pdfExport: false,
      fullTools: false,
    },
    labels: {
      badge: '체험',
      summary: '기본 입력 체험',
    },
    features: [],
  };
  const node = document.getElementById('simple-score-access-config');
  if (!node?.textContent) return fallback;

  try {
    const parsed = JSON.parse(node.textContent);
    return {
      ...fallback,
      ...parsed,
      permissions: {
        ...fallback.permissions,
        ...(parsed.permissions || {}),
      },
      labels: {
        ...fallback.labels,
        ...(parsed.labels || {}),
      },
    };
  } catch (error) {
    console.error('Failed to read access profile:', error);
    return fallback;
  }
}

const editorAccess = readEditorAccessProfile();

function hasPdfAccess() {
  return Boolean(editorAccess.permissions?.pdfExport);
}

function hasFullToolsAccess() {
  return Boolean(editorAccess.permissions?.fullTools);
}

function getAccessMessage(type) {
  if (type === 'pdf') {
    return 'PDF 내보내기는 로그인 후 사용할 수 있습니다.';
  }

  if (editorAccess.isAdmin) {
    return '관리자 계정에서는 모든 기능을 사용할 수 있습니다.';
  }

  if (editorAccess.isLoggedIn) {
    return '이 기능은 유료 이용권에서 활성화됩니다. 현재 계정에서는 PDF 내보내기까지 사용할 수 있습니다.';
  }

  return '이 기능은 유료 이용권에서 활성화됩니다. 지금은 음표, 쉼표, 가사, 코드 입력을 체험할 수 있습니다.';
}

function showAccessToast(message) {
  const existing = document.getElementById('access-toast');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'access-toast';
  toast.className = 'access-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  window.clearTimeout(showAccessToast._timer);
  showAccessToast._timer = window.setTimeout(() => {
    toast.remove();
  }, 2600);
}

function requirePdfAccess() {
  if (hasPdfAccess()) {
    return true;
  }

  showAccessToast(getAccessMessage('pdf'));
  return false;
}

function requireFullToolsAccess() {
  if (hasFullToolsAccess()) {
    return true;
  }

  showAccessToast(getAccessMessage('full'));
  return false;
}

function lockButtonAccess(element, message) {
  if (!element) return;

  element.classList.add('access-locked', 'access-locked-button');
  element.setAttribute('aria-disabled', 'true');
  element.title = message;
  element.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAccessToast(message);
    },
    true,
  );
}

function lockInputAccess(element, message) {
  if (!element) return;

  element.classList.add('access-locked', 'access-locked-input');
  element.disabled = true;
  element.title = message;
}

function lockMenuAccess(element, message) {
  if (!element) return;

  element.classList.add('access-locked-menu');
  const trigger = element.querySelector(':scope > span');
  if (!trigger) return;

  trigger.title = message;
  trigger.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAccessToast(message);
    },
    true,
  );
}

function applyAccessLocks() {
  if (!hasPdfAccess()) {
    const pdfMessage = getAccessMessage('pdf');
    lockButtonAccess(dom.btnPDF, pdfMessage);
    document
      .querySelectorAll('[data-action="export-pdf"]')
      .forEach((button) => lockButtonAccess(button, pdfMessage));
  }

  if (!hasFullToolsAccess()) {
    const fullMessage = getAccessMessage('full');
    [
      dom.keySig,
      dom.timeSig,
      dom.instrument,
      dom.bpmSlider,
      dom.slMPL,
      dom.slScale,
      dom.slSpace,
      dom.slMW,
      dom.toggleMeasureNumbers,
      dom.noteHeadColor,
      dom.noteStemColor,
      dom.lyricFont,
      dom.lyricSize,
      dom.lyricOffset,
      dom.lyricWeight,
      dom.lyricColor,
      document.getElementById('gap-panel-slider'),
      document.getElementById('gap-panel-number'),
    ].forEach((element) => lockInputAccess(element, fullMessage));

    [
      dom.btnPlay,
      dom.btnStop,
      dom.btnPNG,
      dom.lyricItalicToggle,
      document.getElementById('btn-gap-mode'),
      document.getElementById('gap-panel-reset'),
      ...dom.repeatButtons,
      ...dom.articButtons,
      ...dom.dynamicButtons,
      ...dom.voiceButtons,
      ...dom.lyricVerseButtons,
      ...document.querySelectorAll('.form-btn'),
      ...document.querySelectorAll('[data-action="export-png"]'),
      ...document.querySelectorAll('[data-action="set-mpl"]'),
      ...document.querySelectorAll('[data-action="set-key"]'),
      ...document.querySelectorAll('[data-action="set-time"]'),
      ...document.querySelectorAll('[data-action="set-repeat"]'),
      ...document.querySelectorAll('[data-action="set-artic"]'),
      ...document.querySelectorAll('[data-action="set-dynamic"]'),
      ...document.querySelectorAll('[data-action="set-form"]'),
      ...document.querySelectorAll('[data-action="set-voice"]'),
      ...document.querySelectorAll('[data-action="set-verse"]'),
      ...document.querySelectorAll('[data-action="toggle-measure-numbers"]'),
    ].forEach((element) => lockButtonAccess(element, fullMessage));

    [
      document.getElementById('mbi-form'),
      document.getElementById('mbi-repeat'),
      document.getElementById('mbi-expr'),
      document.getElementById('mbi-view'),
      document.getElementById('mbi-score'),
    ].forEach((element) => lockMenuAccess(element, fullMessage));

    document.getElementById('lyric-style-section')?.classList.add('access-locked');
    document.getElementById('toolbar-settings')?.classList.add('access-locked');
    document.getElementById('toolbar-note-color')?.classList.add('access-locked');
  }
}


/* ═══════════════════════════════════════
   §3  AUDIO ENGINE
   ═══════════════════════════════════════ */

applyAccessLocks();

function getAudioCtx() {
  if (!appState.audioCtx) appState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return appState.audioCtx;
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`INSTRUMENT_LOAD_TIMEOUT:${timeoutMs}`));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function loadInstrument(name) {
  if (!hasFullToolsAccess()) {
    showLoading(false);
    return;
  }

  showLoading(true);
  try {
    appState.instrument = await withTimeout(
      Soundfont.instrument(getAudioCtx(), name),
      5000,
    );
  } catch (e) {
    appState.instrument = null;
    console.error('Instrument load failed:', e);
    showAccessToast('악기 미리듣기 로딩에 실패했습니다. 입력 기능은 계속 사용할 수 있습니다.');
  } finally {
    showLoading(false);
  }
}

function playNote(midiStr, dur) {
  if (!appState.instrument) return;
  try { appState.instrument.play(midiStr, 0, { duration: dur || 0.5 }); } catch(_){}
}

function vexKeyToMidi(key) {
  const [n, o] = key.split('/');
  return n.charAt(0).toUpperCase() + n.slice(1) + o;
}

function showLoading(v) { dom.overlay.classList.toggle('hidden', !v); }


/* ═══════════════════════════════════════
   §4  PITCH ↔ Y  MATH
   ═══════════════════════════════════════ */

function calculatePitchFromY(y, stave) {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < TREBLE_PITCHES.length; i++) {
    const d = Math.abs(stave.getYForLine(-1 + i * 0.5) - y);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return TREBLE_PITCHES[bestIdx];
}

function pitchToIndex(pitch) {
  const idx = TREBLE_PITCHES.indexOf(pitch);
  if (idx >= 0) return idx;

  /* pitch has an accidental (e.g. 'f#/4') — find nearest by semitone */
  const semi = pitchToSemitone(pitch);
  let best = 6, bestDist = Infinity;
  for (let i = 0; i < TREBLE_PITCHES.length; i++) {
    const d = Math.abs(pitchToSemitone(TREBLE_PITCHES[i]) - semi);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/** Get the pixel-Y for a pitch index on a given stave */
function getYForPitchIndex(pitchIdx, stave) {
  const halfLine = -1 + pitchIdx * 0.5;
  return stave.getYForLine(halfLine);
}


/* ═══════════════════════════════════════
   §4.5  VOICE HELPERS
   ═══════════════════════════════════════ */

function activeNotes()      { return appState.currentVoice === 0 ? appState.notes : appState.voice2Notes; }
function activeCursor()     { return appState.currentVoice === 0 ? appState.cursorIndex : appState.v2CursorIdx; }
function setActiveCursor(i) { if (appState.currentVoice === 0) appState.cursorIndex = i; else appState.v2CursorIdx = i; }


/* ═══════════════════════════════════════
   §5  PITCH UTILITIES
   ═══════════════════════════════════════ */

function closestPitchForLetter(letter, refIdx) {
  let best = null, bestDist = Infinity;
  for (let i = 0; i < TREBLE_PITCHES.length; i++) {
    if (TREBLE_PITCHES[i].charAt(0) === letter) {
      const d = Math.abs(i - refIdx);
      if (d < bestDist) { bestDist = d; best = TREBLE_PITCHES[i]; }
    }
  }
  return best || TREBLE_PITCHES[refIdx] || 'c/4';
}

function getRefPitchIndex() {
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci > 0 && ci <= notes.length) {
    const prev = notes[ci - 1];
    if (!prev.isRest) return pitchToIndex(prev.keys[0]);
  }
  if (ci < notes.length) {
    const cur = notes[ci];
    if (!cur.isRest) return pitchToIndex(cur.keys[0]);
  }
  return 6;
}


/* ═══════════════════════════════════════
   §6  MEASURE SPLITTING
   ═══════════════════════════════════════ */

function getBeatsPerMeasure() {
  const [num, den] = appState.timeSignature.split('/').map(Number);
  return num * (4 / den);
}

function noteBeatValue(n) {
  let b = DURATION_BEATS[n.duration] || 1;
  if (n.isDotted) b *= 1.5;
  return b;
}

function splitIntoMeasures(notes) {
  const bpm = getBeatsPerMeasure();
  const measures = [];
  let cur = [], beats = 0;
  notes.forEach((n, gi) => {
    const nb = noteBeatValue(n);
    if (beats + nb > bpm + 0.001) { measures.push(cur); cur = []; beats = 0; }
    cur.push({ ...n, _gi: gi });
    beats += nb;
    if (Math.abs(beats - bpm) < 0.001) { measures.push(cur); cur = []; beats = 0; }
  });
  if (cur.length) measures.push(cur);
  return measures;
}


/* ═══════════════════════════════════════
   §7  VEXFLOW RENDERER
   ═══════════════════════════════════════ */

function buildVexDuration(n) {
  let d = n.duration;
  if (n.isRest)   d += 'r';
  if (n.isDotted) d += 'd';
  return d;
}

/**
 * After VexFlow draws a stave, find the time-signature SVG group(s) and
 * rescale them so they fit exactly within the 4 staff-line gaps.
 * VexFlow default: spacing_between_lines_px = 10  →  staff height = 4 × 10 = 40px.
 * We scale by (staffLineSpacing / 10) around the vertical staff centre.
 */
function rescaleTimeSig(stave, staffLineSpacing) {
  const svgEl = dom.canvas.querySelector('svg');
  if (!svgEl) return;

  const scaleFactor = staffLineSpacing / 10; // 10 = VexFlow default spacing
  if (Math.abs(scaleFactor - 1) < 0.005) return; // nothing to do

  // VexFlow 4.x gives time-sig groups a class that contains "timesig"
  const tsGroups = Array.from(svgEl.querySelectorAll('[class*="timesig"]'));
  if (!tsGroups.length) return;

  // Vertical centre of the staff in SVG coordinates
  const staffCenterY = stave.getY() + staffLineSpacing * 2;

  tsGroups.forEach(g => {
    let bb;
    try { bb = g.getBBox(); } catch (e) { return; }
    if (!bb || bb.height < 1) return;

    // Horizontal centre from the group's own bounding box
    const cx = bb.x + bb.width / 2;

    // Scale around (cx, staffCenterY) so the glyph stays on the staff
    g.setAttribute('transform',
      `translate(${cx},${staffCenterY}) scale(${scaleFactor}) translate(${-cx},${-staffCenterY})`
    );
  });
}

/**
 * Build an array of VexFlow StaveNote objects for one voice in one measure.
 * voiceNum: 0 = Voice 1 (stems up, user noteColor), 1 = Voice 2 (stems down, V2_COLOR)
 */
function buildVexNotesForVoice(mNotes, voiceNum, cursorIdx, notesArr) {
  const stemDir = voiceNum === 0 ? 1 : -1;
  return mNotes.map(n => {
    const sn = new StaveNote({
      keys: n.isRest ? ['b/4'] : n.keys,
      duration: buildVexDuration(n),
      stem_direction: stemDir,
    });
    if (n.isDotted) Dot.buildAndAttach([sn]);
    if (!n.isRest) {
      n.keys.forEach((k, ki) => {
        const nm = k.split('/')[0];
        if (nm.length > 1) sn.addModifier(new Accidental(nm.includes('b') ? 'b' : '#'), ki);
      });
    }
    const isCursor = !appState.isDragging
      && appState.currentVoice === voiceNum
      && n._gi === cursorIdx
      && cursorIdx < notesArr.length;
    const isDrag = appState.isDragging
      && appState.selectedNoteVoice === voiceNum
      && n._gi === appState.selectedNoteIndex;

    if (isDrag) {
      sn.setStyle({ fillStyle: DRAG_COLOR, strokeStyle: DRAG_COLOR });
    } else if (isCursor) {
      sn.setStyle({ fillStyle: SELECT_COLOR, strokeStyle: SELECT_COLOR });
    } else if (voiceNum === 0) {
      const hc = appState.noteColor.head, sc = appState.noteColor.stem;
      sn.setStyle({ fillStyle: hc, strokeStyle: hc });
      sn.setStemStyle({ fillStyle: sc, strokeStyle: sc });
    } else {
      sn.setStyle({ fillStyle: V2_COLOR, strokeStyle: V2_COLOR });
      sn.setStemStyle({ fillStyle: V2_COLOR, strokeStyle: V2_COLOR });
    }
    return sn;
  });
}

function renderScore() {
  /* Remove only SVG and ghost overlay — preserve chord/lyric input elements */
  dom.canvas.querySelectorAll('svg, #ghost-overlay').forEach(el => el.remove());
  _ghostOverlayEl = null;
  appState.renderedBBoxes = [];
  appState.staveCache     = [];

  const measures   = splitIntoMeasures(appState.notes);
  const v2measures = splitIntoMeasures(appState.voice2Notes);
  /* Always show at least 4 rows (4 staves) of empty measures */
  const minMeasures = appState.layout.measuresPerLine * 4;
  while (measures.length < minMeasures) measures.push([]);

  const { measuresPerLine, staffSpacing, measureWidth, staffLineSpacing } = appState.layout;
  const numRows     = Math.ceil(measures.length / measuresPerLine);
  const FIRST_X     = STAVE_X;
  const clefWidth   = 80;  // extra width for clef/key/time in first measure
  /* find max cumulative gap across all rows (last measure's gap is trailing, skip it) */
  let _maxGapSum = 0;
  for (let _r = 0; _r < numRows; _r++) {
    let _gapSum = 0;
    for (let _c = 0; _c < measuresPerLine - 1; _c++) {
      _gapSum += (appState.measureGaps[_r * measuresPerLine + _c] || 0);
    }
    if (_gapSum > _maxGapSum) _maxGapSum = _gapSum;
  }
  const rowWidth    = measureWidth * measuresPerLine + clefWidth + _maxGapSum;

  const svgW = rowWidth + FIRST_X * 2 + 20;
  const svgH = STAVE_Y_START + numRows * staffSpacing + 60;

  const renderer = new Renderer(dom.canvas, Renderer.Backends.SVG);
  renderer.resize(svgW, svgH);
  const context = renderer.getContext();
  context.setFont('DM Sans', 10);

  /* no viewBox scaling — staff size is controlled via spacing_between_lines_px */

  const tsDen = Number(appState.timeSignature.split('/')[1]);

  measures.forEach((mNotes, mIdx) => {
    const row = Math.floor(mIdx / measuresPerLine);
    const col = mIdx % measuresPerLine;
    const y   = STAVE_Y_START + row * staffSpacing;

    /* first measure in first row gets extra width for clef/sig */
    const isFirstMeasure = (mIdx === 0);
    const extraW  = isFirstMeasure ? clefWidth : 0;
    const staveW  = measureWidth + extraW;
    let   staveX  = FIRST_X;
    for (let c = 0; c < col; c++) {
      staveX += measureWidth + (c === 0 && mIdx >= measuresPerLine ? 0 : 0);
    }
    /* accumulate X: first measure of row 0 is wider; add custom gap after each measure */
    staveX = FIRST_X;
    for (let c = 0; c < col; c++) {
      const prevIdx = row * measuresPerLine + c;
      staveX += measureWidth + (prevIdx === 0 ? clefWidth : 0) + (appState.measureGaps[prevIdx] || 0);
    }

    const stave = new Stave(staveX, y, staveW, { spacing_between_lines_px: staffLineSpacing });
    if (isFirstMeasure) {
      stave.addClef('treble');
      stave.addTimeSignature(appState.timeSignature);
      stave.addKeySignature(appState.keySignature);
    }
    /* draw bar line at end of each measure except the last in row */
    stave.setContext(context).draw();
    if (isFirstMeasure) rescaleTimeSig(stave, staffLineSpacing);

    const startGi = mNotes.length ? mNotes[0]._gi : -1;
    const endGi   = mNotes.length ? mNotes[mNotes.length - 1]._gi : -1;
    appState.staveCache.push({
      stave, measureIndex: mIdx,
      x: stave.getX(), width: stave.getWidth(),
      y, row, col,
      startNoteIdx: startGi, endNoteIdx: endGi,
    });

    const mV2Notes = v2measures[mIdx] || [];
    if (mNotes.length === 0 && mV2Notes.length === 0) return;

    const vexV1 = mNotes.length > 0
      ? buildVexNotesForVoice(mNotes,   0, appState.cursorIndex, appState.notes)
      : [];
    const vexV2 = mV2Notes.length > 0
      ? buildVexNotesForVoice(mV2Notes, 1, appState.v2CursorIdx, appState.voice2Notes)
      : [];

    const formatW = Math.max(80, staveW - 40 - RIGHT_BARLINE_NOTE_PAD);

    if (vexV1.length > 0 && vexV2.length > 0) {
      const beats1 = mNotes.reduce((s, n) => s + noteBeatValue(n), 0);
      const beats2 = mV2Notes.reduce((s, n) => s + noteBeatValue(n), 0);
      const v1 = new Voice({ num_beats: beats1 * (tsDen / 4), beat_value: tsDen }).setStrict(false);
      const v2 = new Voice({ num_beats: beats2 * (tsDen / 4), beat_value: tsDen }).setStrict(false);
      v1.addTickables(vexV1);
      v2.addTickables(vexV2);
      /* joinVoices / format require identical total ticks across voices.
         When durations match, join & format together for proper alignment.
         Otherwise format each voice independently to avoid TickMismatch crash. */
      if (Math.abs(beats1 - beats2) < 0.001) {
        new Formatter().joinVoices([v1, v2]).format([v1, v2], formatW);
      } else {
        new Formatter().joinVoices([v1]).format([v1], formatW);
        new Formatter().joinVoices([v2]).format([v2], formatW);
      }
      v1.draw(context, stave);
      v2.draw(context, stave);
    } else if (vexV1.length > 0) {
      const beats1 = mNotes.reduce((s, n) => s + noteBeatValue(n), 0);
      const v1 = new Voice({ num_beats: beats1 * (tsDen / 4), beat_value: tsDen }).setStrict(false);
      v1.addTickables(vexV1);
      new Formatter().joinVoices([v1]).format([v1], formatW);
      v1.draw(context, stave);
    } else {
      const beats2 = mV2Notes.reduce((s, n) => s + noteBeatValue(n), 0);
      const v2 = new Voice({ num_beats: beats2 * (tsDen / 4), beat_value: tsDen }).setStrict(false);
      v2.addTickables(vexV2);
      new Formatter().joinVoices([v2]).format([v2], formatW);
      v2.draw(context, stave);
    }

    vexV1.forEach((vn, vi) => {
      const bb = vn.getBoundingBox();
      if (bb) appState.renderedBBoxes.push({ x:bb.getX(), y:bb.getY(), w:bb.getW(), h:bb.getH(), globalIndex:mNotes[vi]._gi,   voice:0 });
    });
    vexV2.forEach((vn, vi) => {
      const bb = vn.getBoundingBox();
      if (bb) appState.renderedBBoxes.push({ x:bb.getX(), y:bb.getY(), w:bb.getW(), h:bb.getH(), globalIndex:mV2Notes[vi]._gi, voice:1 });
    });
  });

  /* ── Draw gap mode visual indicators ── */
  if (appState.measureGapMode) {
    const svgGap = dom.canvas.querySelector('svg');
    if (svgGap) {
      appState.staveCache.forEach(sc => {
        const isLastInRow = (sc.col === measuresPerLine - 1);
        const gapPx = appState.measureGaps[sc.measureIndex] || 0;
        const isSelected = sc.measureIndex === appState._gapSelectedMeasure;
        const staffTop    = sc.stave.getYForLine(0);
        const staffBottom = sc.stave.getYForLine(4);

        /* highlight selected measure */
        if (isSelected) {
          const hi = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          hi.setAttribute('x', sc.x);
          hi.setAttribute('y', staffTop - 10);
          hi.setAttribute('width', sc.width);
          hi.setAttribute('height', staffBottom - staffTop + 20);
          hi.setAttribute('fill', 'rgba(66,133,244,0.08)');
          hi.setAttribute('stroke', '#4285f4');
          hi.setAttribute('stroke-width', '1.5');
          hi.setAttribute('rx', '3');
          svgGap.appendChild(hi);
        }

        /* show gap area after measure (skip last in row) */
        if (!isLastInRow && (gapPx > 0 || isSelected)) {
          const gapW = Math.max(6, gapPx);
          const gr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          gr.setAttribute('x', sc.x + sc.width);
          gr.setAttribute('y', staffTop);
          gr.setAttribute('width', gapW);
          gr.setAttribute('height', staffBottom - staffTop);
          gr.setAttribute('fill', isSelected ? 'rgba(66,133,244,0.18)' : 'rgba(66,133,244,0.08)');
          gr.setAttribute('stroke', isSelected ? '#4285f4' : '#a8c4f8');
          gr.setAttribute('stroke-width', '1');
          gr.setAttribute('stroke-dasharray', '3,2');
          svgGap.appendChild(gr);

          /* ↔ resize handle icon */
          const mx2 = sc.x + sc.width + gapW / 2;
          const my2 = (staffTop + staffBottom) / 2;
          const ic = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          ic.setAttribute('x', mx2);
          ic.setAttribute('y', my2 + 4);
          ic.setAttribute('text-anchor', 'middle');
          ic.setAttribute('font-size', '11');
          ic.setAttribute('fill', '#4285f4');
          ic.setAttribute('pointer-events', 'none');
          ic.textContent = '↔';
          svgGap.appendChild(ic);
        }
      });
    }
  }

  /* ── Draw measure numbers ── */
  const svgForMN = dom.canvas.querySelector('svg');
  if (svgForMN && appState.showMeasureNumbers) {
    const numFontSize = Math.max(8, Math.round(staffLineSpacing * 1.0));
    appState.staveCache.forEach(sc => {
      const measureNum = sc.measureIndex + 1;
      /* show "1" always; for subsequent measures show only the first of each row */
      if (measureNum !== 1 && sc.col !== 0) return;
      const staffTop = sc.stave.getYForLine(0);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', sc.x + 2);
      txt.setAttribute('y', staffTop - 4);
      txt.setAttribute('font-family', "'DM Sans', sans-serif");
      txt.setAttribute('font-size', String(numFontSize));
      txt.setAttribute('font-weight', '600');
      txt.setAttribute('fill', '#888888');
      txt.setAttribute('class', 'vf-measure-number');
      txt.textContent = String(measureNum);
      svgForMN.appendChild(txt);
    });
  }

  /* ── Draw chord symbols above notes ── */
  const svg2 = dom.canvas.querySelector('svg');
  if (svg2) {
    appState.renderedBBoxes.forEach(bb => {
      if (bb.voice !== 0) return;                    // chords only on voice 1
      const note = appState.notes[bb.globalIndex];
      if (!note || !note.chord) return;
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', bb.x + bb.w / 2);
      txt.setAttribute('y', bb.y - 14);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', "'DM Sans', sans-serif");
      txt.setAttribute('font-size', '13');
      txt.setAttribute('font-weight', '700');
      txt.setAttribute('fill', '#2a2520');
      txt.textContent = note.chord;
      svg2.appendChild(txt);
    });

    /* ── Draw lyrics below notes ── */
    const ls = appState.lyricStyle;

    /* Build composite key "voice:gi" → row map */
    const giToRow = new Map();
    /* Voice 1: use staveCache start/end indices */
    appState.staveCache.forEach(sc => {
      appState.renderedBBoxes.forEach(bb => {
        if (bb.voice === 0 && sc.startNoteIdx >= 0 && bb.globalIndex >= sc.startNoteIdx && bb.globalIndex <= sc.endNoteIdx) {
          giToRow.set(`0:${bb.globalIndex}`, sc.row);
        }
      });
    });
    /* Voice 2: use v2measures measure indices */
    v2measures.forEach((mNotes, mIdx) => {
      const sc = appState.staveCache[mIdx];
      if (sc) mNotes.forEach(n => giToRow.set(`1:${n._gi}`, sc.row));
    });

    /* For each row, compute the maximum bottom edge of all note bounding boxes */
    const rowMaxBottom = new Map();
    appState.renderedBBoxes.forEach(bb => {
      const row = giToRow.get(`${bb.voice}:${bb.globalIndex}`);
      if (row !== undefined) {
        const bottom = bb.y + bb.h;
        if (!rowMaxBottom.has(row) || rowMaxBottom.get(row) < bottom) rowMaxBottom.set(row, bottom);
      }
    });

    appState.renderedBBoxes.forEach((bb) => {
      const notesArr = bb.voice === 0 ? appState.notes : appState.voice2Notes;
      const note = notesArr[bb.globalIndex];
      if (!note) return;
      const row = giToRow.get(`${bb.voice}:${bb.globalIndex}`);
      const baseBottom = (row !== undefined && rowMaxBottom.has(row)) ? rowMaxBottom.get(row) : (bb.y + bb.h);

      /* Draw each verse line (up to 5) stacked below the note */
      const verses = note.lyrics || (note.lyric ? [note.lyric] : []);
      for (let vi = 0; vi < verses.length; vi++) {
        const lyricText = verses[vi];
        if (!lyricText) continue;
        const lyricY = baseBottom + ls.offsetY + vi * (ls.size + 3);
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', bb.x + bb.w / 2);
        txt.setAttribute('y', lyricY);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-family', ls.font);
        txt.setAttribute('font-size', String(ls.size));
        txt.setAttribute('font-weight', ls.weight);
        txt.setAttribute('font-style', ls.italic ? 'italic' : 'normal');
        txt.setAttribute('fill', ls.color);
        txt.textContent = lyricText;
        svg2.appendChild(txt);
        if (lyricText.endsWith('-')) {
          const nextBB = appState.renderedBBoxes.find(b2 => b2.globalIndex === bb.globalIndex + 1 && b2.voice === bb.voice);
          if (nextBB) {
            const hx = (bb.x + bb.w / 2 + nextBB.x + nextBB.w / 2) / 2;
            const hy = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            hy.setAttribute('x', hx); hy.setAttribute('y', lyricY);
            hy.setAttribute('text-anchor', 'middle');
            hy.setAttribute('font-family', ls.font);
            hy.setAttribute('font-size', String(ls.size));
            hy.setAttribute('font-weight', ls.weight);
            hy.setAttribute('font-style', ls.italic ? 'italic' : 'normal');
            hy.setAttribute('fill', ls.color);
            hy.setAttribute('opacity', '0.5');
            hy.textContent = '-';
            svg2.appendChild(hy);
          }
        }
      }
    });
  }

  /* ── Draw song form badges above staves ── */
  const svgForm = dom.canvas.querySelector('svg');
  if (svgForm) {
    appState.staveCache.forEach(sc => {
      const label = appState.songFormLabels[sc.measureIndex];
      if (!label) return;
      const colors   = FORM_COLORS[label] || FORM_COLORS['outro'];
      const dispName = FORM_DISPLAY[label] || label;
      const fontSize = 9;
      const padX = 6, padY = 2;
      const badgeW = dispName.length * (fontSize * 0.62) + padX * 2;
      const badgeH = fontSize + padY * 2 + 2;
      const staffTop = sc.stave.getYForLine(0);
      const bx = sc.x + 2;
      const by = staffTop - badgeH - 18;   // just above the measure-number area

      const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badgeRect.setAttribute('x', bx);
      badgeRect.setAttribute('y', by);
      badgeRect.setAttribute('width',  badgeW);
      badgeRect.setAttribute('height', badgeH);
      badgeRect.setAttribute('rx', 4);
      badgeRect.setAttribute('fill',         colors.bg);
      badgeRect.setAttribute('stroke',       colors.stroke);
      badgeRect.setAttribute('stroke-width', '1.2');

      const badgeTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeTxt.setAttribute('x', bx + badgeW / 2);
      badgeTxt.setAttribute('y', by + badgeH / 2 + 0.5);
      badgeTxt.setAttribute('text-anchor',       'middle');
      badgeTxt.setAttribute('dominant-baseline', 'middle');
      badgeTxt.setAttribute('font-family', "'DM Sans', sans-serif");
      badgeTxt.setAttribute('font-size',   String(fontSize));
      badgeTxt.setAttribute('font-weight', '700');
      badgeTxt.setAttribute('fill', colors.text);
      badgeTxt.setAttribute('letter-spacing', '0.3');
      badgeTxt.textContent = dispName;

      svgForm.appendChild(badgeRect);
      svgForm.appendChild(badgeTxt);
    });

    /* ── Draw repeat notation (barlines, symbols, volta, fermata) ── */
    drawAllRepeatMarkers(svgForm);
    /* ── Draw articulation markings ── */
    drawAllArticulations(svgForm);
    /* ── Draw dynamics markings ── */
    drawAllDynamics(svgForm);
    /* ── Draw ties and slurs ── */
    drawAllTiesAndSlurs(svgForm);
  }

  dom.canvas.style.minWidth  = svgW + 60 + 'px';
  dom.canvas.style.minHeight = svgH + 20 + 'px';

  const _activeN  = activeNotes();
  const _activeCi = activeCursor();
  if (_activeCi === _activeN.length && !appState.isDragging) drawCursorLine();

  ensureGhostOverlay();
  updateStatusBar();

  if (appState.chordMode) repositionChordInput();
  if (appState.lyricMode) repositionLyricInput();
  if (appState.measureGapMode && appState._gapSelectedMeasure !== null) repositionGapPanel();
}


/* ═══════════════════════════════════════
   §8  CURSOR LINE DRAWING
   ═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   §8.1  REPEAT NOTATION DRAWING
   ═══════════════════════════════════════ */

/** Shorthand to create an SVG element with attributes */
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Draw repeat-start barline ( |: ) at left edge of stave */
function drawRepeatStartBarline(svg, x, staveTop, staveBot, sls) {
  const dotR = Math.max(2.2, sls * 0.22);
  svg.append(
    svgEl('rect',   { x: x,    y: staveTop, width: 3.5, height: staveBot - staveTop, fill: '#000' }),
    svgEl('line',   { x1: x+6, y1: staveTop, x2: x+6, y2: staveBot, stroke: '#000', 'stroke-width': '1.3' }),
    svgEl('circle', { cx: x+11, cy: staveTop + sls*1.5, r: dotR, fill: '#000' }),
    svgEl('circle', { cx: x+11, cy: staveTop + sls*2.5, r: dotR, fill: '#000' })
  );
}

/** Draw repeat-end barline ( :| ) at right edge of stave */
function drawRepeatEndBarline(svg, x, staveTop, staveBot, sls) {
  const dotR = Math.max(2.2, sls * 0.22);
  svg.append(
    svgEl('circle', { cx: x-11, cy: staveTop + sls*1.5, r: dotR, fill: '#000' }),
    svgEl('circle', { cx: x-11, cy: staveTop + sls*2.5, r: dotR, fill: '#000' }),
    svgEl('line',   { x1: x-6, y1: staveTop, x2: x-6, y2: staveBot, stroke: '#000', 'stroke-width': '1.3' }),
    svgEl('rect',   { x: x-3.5, y: staveTop, width: 3.5, height: staveBot - staveTop, fill: '#000' })
  );
}

/** Draw Segno sign (𝄋) above a measure */
function drawSegnoSymbol(svg, cx, cy, sls) {
  const r = Math.max(6, sls * 0.75);
  svg.append(
    svgEl('circle', { cx, cy, r, fill: 'none', stroke: '#000', 'stroke-width': '1.6' }),
    svgEl('line',   { x1: cx - r*0.75, y1: cy + r*0.75, x2: cx + r*0.75, y2: cy - r*0.75,
                      stroke: '#000', 'stroke-width': '1.6' }),
    svgEl('circle', { cx, cy: cy - r - 3, r: 1.8, fill: '#000' }),
    svgEl('circle', { cx, cy: cy + r + 3, r: 1.8, fill: '#000' })
  );
}

/** Draw Coda sign (𝄌) above a measure */
function drawCodaSymbol(svg, cx, cy, sls) {
  const r = Math.max(6, sls * 0.7);
  svg.append(
    svgEl('circle', { cx, cy, r, fill: 'none', stroke: '#000', 'stroke-width': '1.6' }),
    svgEl('line',   { x1: cx,       y1: cy - r - 5, x2: cx,       y2: cy + r + 5,
                      stroke: '#000', 'stroke-width': '1.6' }),
    svgEl('line',   { x1: cx - r - 5, y1: cy, x2: cx + r + 5, y2: cy,
                      stroke: '#000', 'stroke-width': '1.6' })
  );
}

/** Draw text at end of measure (Fine, D.C., D.S., D.S. al Coda) */
function drawEndText(svg, text, x, y, sls) {
  const t = svgEl('text', {
    x, y,
    'text-anchor':       'end',
    'font-family':       "'DM Sans', sans-serif",
    'font-size':         Math.max(9, sls),
    'font-style':        'italic',
    'font-weight':       '600',
    fill:                '#111',
  });
  t.textContent = text;
  svg.appendChild(t);
}

/** Draw volta bracket (1st/2nd ending) over a group of stave entries */
function drawVoltaBracket(svg, scList, voltaNum, sls) {
  const x1      = scList[0].x;
  const last    = scList[scList.length - 1];
  const x2      = last.x + last.width;
  const staffTop = scList[0].stave.getYForLine(0);  // actual top staff line
  const lineY   = staffTop - 15;   // horizontal bracket line
  const dropY   = staffTop - 7;    // bottom of vertical drops

  svg.append(
    svgEl('line', { x1, y1: lineY, x2, y2: lineY, stroke: '#333', 'stroke-width': '1.6' }),
    svgEl('line', { x1, y1: lineY, x2: x1, y2: dropY, stroke: '#333', 'stroke-width': '1.6' })
  );
  /* 1st volta: closed bracket; 2nd volta: open (no right vertical) */
  if (voltaNum === 1) {
    svg.appendChild(svgEl('line', { x1: x2, y1: lineY, x2, y2: dropY, stroke: '#333', 'stroke-width': '1.6' }));
  }
  const lbl = svgEl('text', {
    x: x1 + 4, y: lineY - 2,
    'font-family': "'DM Sans', sans-serif",
    'font-size':   Math.max(8, sls * 0.95),
    'font-weight': '700',
    fill:          '#333',
  });
  lbl.textContent = voltaNum + '.';
  svg.appendChild(lbl);
}

/** Draw fermata above a note bounding box */
function drawFermata(svg, bb, sls) {
  const cx = bb.x + bb.w / 2;
  const cy = bb.y - 5;
  const r  = Math.max(5, sls * 0.55);
  svg.append(
    svgEl('path',   { d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
                      stroke: '#000', 'stroke-width': '1.6', fill: 'none' }),
    svgEl('circle', { cx, cy, r: Math.max(1.5, sls * 0.17), fill: '#000' })
  );
}

/* ═══════════════════════════════════════
   §8.2  ARTICULATION DRAWING
   ═══════════════════════════════════════ */

/**
 * Articulation Y helper:
 * Voice 1 (stems up)  → place above bb.y (above the stem top)
 * Voice 2 (stems down)→ place below bb.y + bb.h (below the stem bottom)
 */
function articY(bb, offset) {
  return bb.voice === 1 ? bb.y + bb.h + offset : bb.y - offset;
}

/** · Staccato — small filled dot */
function drawArticStaccato(svg, bb, sls) {
  const cx = bb.x + bb.w / 2;
  const cy = articY(bb, Math.max(6, sls * 0.65));
  const r  = Math.max(1.8, sls * 0.22);
  svg.appendChild(svgEl('circle', { cx, cy, r, fill: '#000' }));
}

/** > Accent — two lines forming a right-pointing wedge */
function drawArticAccent(svg, bb, sls) {
  const cx = bb.x + bb.w / 2;
  const cy = articY(bb, Math.max(10, sls * 1.1));
  const w  = Math.max(7, sls * 0.85);
  const h  = Math.max(3.5, sls * 0.4);
  svg.append(
    svgEl('line', { x1: cx - w/2, y1: cy - h/2, x2: cx + w/2, y2: cy, stroke: '#000', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
    svgEl('line', { x1: cx + w/2, y1: cy, x2: cx - w/2, y2: cy + h/2, stroke: '#000', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
  );
}

/** — Tenuto — horizontal bar */
function drawArticTenuto(svg, bb, sls) {
  const cx = bb.x + bb.w / 2;
  const cy = articY(bb, Math.max(8, sls * 0.9));
  const w  = Math.max(7, sls * 0.85);
  svg.appendChild(svgEl('line', { x1: cx - w/2, y1: cy, x2: cx + w/2, y2: cy, stroke: '#000', 'stroke-width': '2.2', 'stroke-linecap': 'round' }));
}

/** ^ Marcato — open chevron (inverted V) */
function drawArticMarcato(svg, bb, sls) {
  const cx   = bb.x + bb.w / 2;
  const base = articY(bb, Math.max(9, sls * 1.0));
  const tip  = articY(bb, Math.max(17, sls * 1.85));
  const halfW = Math.max(5, sls * 0.6);
  svg.append(
    svgEl('line', { x1: cx - halfW, y1: base, x2: cx, y2: tip,  stroke: '#000', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
    svgEl('line', { x1: cx,         y1: tip,  x2: cx + halfW, y2: base, stroke: '#000', 'stroke-width': '1.6', 'stroke-linecap': 'round' })
  );
}

/** ▾ Staccatissimo — narrow filled stroke */
function drawArticStaccatissimo(svg, bb, sls) {
  const cx = bb.x + bb.w / 2;
  const cy = articY(bb, Math.max(9, sls * 1.0));
  const h  = Math.max(6, sls * 0.65);
  const w  = Math.max(2.5, sls * 0.27);
  // For voice 2 the stroke points downward (away from note), voice 1 upward
  const y0 = bb.voice === 1 ? cy : cy - h / 2;
  svg.appendChild(svgEl('rect', { x: cx - w/2, y: y0, width: w, height: h, rx: w/2, fill: '#000' }));
}

/** Draw all articulations on top of the score SVG */
function drawAllArticulations(svg) {
  if (!svg) return;
  const sls = appState.layout.staffLineSpacing;
  appState.renderedBBoxes.forEach(bb => {
    const notesArr = bb.voice === 0 ? appState.notes : appState.voice2Notes;
    const note = notesArr[bb.globalIndex];
    if (!note || !note.articulation) return;
    switch (note.articulation) {
      case 'staccato':      drawArticStaccato(svg, bb, sls);      break;
      case 'accent':        drawArticAccent(svg, bb, sls);        break;
      case 'tenuto':        drawArticTenuto(svg, bb, sls);        break;
      case 'marcato':       drawArticMarcato(svg, bb, sls);       break;
      case 'staccatissimo': drawArticStaccatissimo(svg, bb, sls); break;
    }
  });
}

/* ═══════════════════════════════════════
   §8.25  DYNAMICS DRAWING
   ═══════════════════════════════════════ */

/**
 * Draw a single dynamic mark (pp, p, mp, mf, f, ff, sfz, fp) below the staff.
 * Placed at a fixed distance below the bottom staff line.
 */
function drawDynamicMark(svg, bb, label, sls) {
  const sc = _scForBB(bb);
  const staffBot = sc ? sc.stave.getYForLine(4) : (bb.y + bb.h);
  const dy = staffBot + Math.max(14, sls * 1.6);
  const cx = bb.x + bb.w / 2;
  const fontSize = Math.max(11, sls * 1.25);

  const txt = svgEl('text', {
    x:                   cx,
    y:                   dy,
    'text-anchor':       'middle',
    'dominant-baseline': 'auto',
    'font-family':       'Georgia, "Times New Roman", serif',
    'font-size':         fontSize,
    'font-style':        'italic',
    'font-weight':       'bold',
    fill:                '#111',
  });
  txt.textContent = label;
  svg.appendChild(txt);
}

/** Draw all dynamics marks on the score SVG */
function drawAllDynamics(svg) {
  if (!svg) return;
  const sls = appState.layout.staffLineSpacing;
  appState.renderedBBoxes.forEach(bb => {
    const notesArr = bb.voice === 0 ? appState.notes : appState.voice2Notes;
    const note = notesArr[bb.globalIndex];
    if (!note || !note.dynamic) return;
    drawDynamicMark(svg, bb, note.dynamic, sls);
  });
}

/* ═══════════════════════════════════════
   §8.3  TIE & SLUR DRAWING
   ═══════════════════════════════════════ */

/**
 * Draw a full arc (tie or slur) between two note bboxes.
 * arcDir: +1 = bows downward (voice 1, below notehead), -1 = bows upward (voice 2, above notehead)
 */
function _drawArc(svg, x1, y1, x2, y2, arcDir, color, sw) {
  const dist  = Math.max(1, Math.abs(x2 - x1));
  const depth = Math.max(9, dist * 0.18 + 4);
  const cp1x  = x1 + dist * 0.28;
  const cp2x  = x2 - dist * 0.28;
  const cp1y  = y1 + arcDir * depth;
  const cp2y  = y2 + arcDir * depth;
  svg.appendChild(svgEl('path', {
    d:                 `M ${x1} ${y1} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x2} ${y2}`,
    stroke:            color,
    'stroke-width':    sw,
    fill:              'none',
    'stroke-linecap':  'round',
  }));
}

/**
 * Draw a partial arc (half-tie at a line break).
 * Both endpoints share the same y; the arc bows in arcDir.
 */
function _drawArcPartial(svg, x1, y1, x2, arcDir, color, sw) {
  const dist  = Math.max(1, Math.abs(x2 - x1));
  const depth = Math.max(7, dist * 0.26);
  const cpX   = (x1 + x2) / 2;
  const cpY   = y1 + arcDir * depth;
  svg.appendChild(svgEl('path', {
    d:                `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y1}`,
    stroke:           color,
    'stroke-width':   sw,
    fill:             'none',
    'stroke-linecap': 'round',
  }));
}

/** Return the staveCache entry whose x-range contains bbox.x */
function _scForBB(bb) {
  return appState.staveCache.find(sc =>
    bb.x >= sc.x - 8 && bb.x <= sc.x + sc.width + 8
  ) || null;
}

/** Draw all tie and slur arcs on top of the rendered score */
function drawAllTiesAndSlurs(svg) {
  if (!svg) return;
  const sls = appState.layout.staffLineSpacing;

  [0, 1].forEach(voice => {
    const notes  = voice === 0 ? appState.notes : appState.voice2Notes;
    const bboxes = appState.renderedBBoxes.filter(bb => bb.voice === voice);
    const color  = voice === 1 ? V2_COLOR : '#111';
    /* voice 1 (stems up)   → arc BELOW notehead (arcDir = +1)
       voice 2 (stems down) → arc ABOVE notehead (arcDir = -1) */
    const arcDir = voice === 1 ? -1 : 1;
    const yOff   = Math.max(3, sls * 0.32);

    notes.forEach((note, i) => {
      if (!note.tie && !note.slur) return;

      const bb1 = bboxes.find(bb => bb.globalIndex === i);
      if (!bb1) return;

      const bb2  = bboxes.find(bb => bb.globalIndex === i + 1);
      const sw   = '1.8';
      /* Anchor y: below notehead for voice 0, above for voice 2 */
      const ay1  = (arcDir === 1) ? bb1.y + bb1.h + yOff : bb1.y - yOff;
      const x1   = bb1.x + bb1.w * 0.55;
      const sc1  = _scForBB(bb1);

      if (bb2) {
        const sc2  = _scForBB(bb2);
        const ay2  = (arcDir === 1) ? bb2.y + bb2.h + yOff : bb2.y - yOff;
        const x2   = bb2.x + bb2.w * 0.45;
        const sameRow = sc1 && sc2 && sc1.row === sc2.row;

        if (sameRow) {
          _drawArc(svg, x1, ay1, x2, ay2, arcDir, color, sw);
        } else {
          /* Different rows: two half-arcs */
          if (sc1) _drawArcPartial(svg, x1, ay1, sc1.x + sc1.width + 6, arcDir, color, sw);
          if (sc2) {
            /* Skip clef/sig area on first measure of row */
            const leftX = sc2.x + (sc2.col === 0 ? 82 : 8);
            _drawArcPartial(svg, leftX, ay2, x2, arcDir, color, sw);
          }
        }
      } else if (sc1) {
        /* Next note not rendered yet — draw open-ended half-arc */
        _drawArcPartial(svg, x1, ay1, sc1.x + sc1.width + 6, arcDir, color, sw);
      }
    });
  });
}

/** Master function — draws all repeat notation on top of the VexFlow SVG */
function drawAllRepeatMarkers(svg) {
  if (!svg) return;
  const sls = appState.layout.staffLineSpacing;

  appState.staveCache.forEach(sc => {
    const m    = appState.repeatMarkers[sc.measureIndex] || {};
    /* Use the stave object to get ACTUAL staff-line Y coordinates */
    const top  = sc.stave.getYForLine(0);   // top staff line
    const bot  = sc.stave.getYForLine(4);   // bottom staff line
    const endX = sc.x + sc.width;

    if (m['repeat-start'])  drawRepeatStartBarline(svg, sc.x, top, bot, sls);
    if (m['repeat-end'])    drawRepeatEndBarline(svg, endX, top, bot, sls);

    /* Segno / Coda symbols — above staff */
    if (m['segno'])          drawSegnoSymbol(svg, sc.x + 10, top - 50, sls);
    if (m['coda'])           drawCodaSymbol (svg, sc.x + 10, top - 50, sls);

    /* End-of-measure text marks */
    const textY = top - 6;
    if (m['da-capo'])        drawEndText(svg, 'D.C.',          endX - 4, textY, sls);
    else if (m['dal-segno']) drawEndText(svg, 'D.S.',          endX - 4, textY, sls);
    else if (m['ds-al-coda'])drawEndText(svg, 'D.S. al Coda', endX - 4, textY, sls);
    else if (m['fine'])      drawEndText(svg, 'Fine',          endX - 4, textY, sls);
  });

  /* Volta brackets — group consecutive same-row measures */
  [1, 2].forEach(voltaNum => {
    const key = `volta-${voltaNum}`;
    const groups = [];
    let current  = null;

    appState.staveCache.forEach(sc => {
      const has = (appState.repeatMarkers[sc.measureIndex] || {})[key];
      if (has) {
        if (!current || sc.row !== current.row || sc.measureIndex !== current.lastMIdx + 1) {
          current = { scList: [sc], row: sc.row, lastMIdx: sc.measureIndex };
          groups.push(current);
        } else {
          current.scList.push(sc);
          current.lastMIdx = sc.measureIndex;
        }
      } else {
        current = null;
      }
    });

    groups.forEach(g => drawVoltaBracket(svg, g.scList, voltaNum, sls));
  });

  /* Fermatas — per-note markers stored on the note object */
  appState.renderedBBoxes.forEach(bb => {
    const notesArr = bb.voice === 0 ? appState.notes : appState.voice2Notes;
    const note = notesArr[bb.globalIndex];
    if (note && note.fermata) drawFermata(svg, bb, sls);
  });
}


function drawCursorLine() {
  const svg = dom.canvas.querySelector('svg');
  if (!svg) return;
  let cx, cy, ch;
  const voiceBBs = appState.renderedBBoxes.filter(bb => bb.voice === appState.currentVoice);
  if (voiceBBs.length > 0) {
    const last = voiceBBs[voiceBBs.length - 1];
    cx = last.x + last.w + 12; cy = last.y - 4; ch = last.h + 8;
  } else if (appState.renderedBBoxes.length > 0) {
    const last = appState.renderedBBoxes[appState.renderedBBoxes.length - 1];
    cx = last.x + last.w + 12; cy = last.y - 4; ch = last.h + 8;
  } else if (appState.staveCache.length > 0) {
    const sc = appState.staveCache[0];
    cx = sc.x + 80; cy = sc.y + 14; ch = 52;
  } else return;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', cx); line.setAttribute('y1', cy);
  line.setAttribute('x2', cx); line.setAttribute('y2', cy + ch);
  line.setAttribute('stroke', CURSOR_COLOR);
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.style.animation = 'cursorBlink 1s ease-in-out infinite';
  svg.appendChild(line);
}


/* ═══════════════════════════════════════
   §8.5  GHOST NOTE PREVIEW   ★
   ═══════════════════════════════════════
   A semi-transparent note/rest that follows the mouse cursor,
   snapping to staff line/space positions.
   Lives in a separate overlay div so renderScore() never destroys it.
   ═══════════════════════════════════════ */

let _ghostOverlayEl = null;   // <div> overlay container
let _ghostSvg       = null;   // <svg> inside overlay
let _ghostGroup     = null;   // <g> containing note shapes
let _ghostBuiltKey  = '';     // tracks what shape is currently built
let _ghostPitchIdx  = -1;     // last snapped pitch index (to avoid redundant updates)

/**
 * Ensure the ghost overlay exists inside dom.canvas.
 * Called after every renderScore() and on init.
 */
function ensureGhostOverlay() {
  if (_ghostOverlayEl && _ghostOverlayEl.parentNode === dom.canvas) return;

  _ghostOverlayEl = document.createElement('div');
  _ghostOverlayEl.id = 'ghost-overlay';
  _ghostOverlayEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;overflow:visible;';

  _ghostSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  /* offset matches #score-canvas padding (30px top, 20px left) so that SVG
     coordinate space aligns with getCanvasCoords() which subtracts the same values */
  _ghostSvg.style.cssText = 'position:absolute;top:30px;left:20px;overflow:visible;';
  /* match the main SVG dimensions and coordinate system */
  const mainSvg = dom.canvas.querySelector('svg');
  if (mainSvg) {
    _ghostSvg.setAttribute('width',  mainSvg.getAttribute('width'));
    _ghostSvg.setAttribute('height', mainSvg.getAttribute('height'));
    const vb = mainSvg.getAttribute('viewBox');
    if (vb) _ghostSvg.setAttribute('viewBox', vb);
  } else {
    _ghostSvg.setAttribute('width',  '860');
    _ghostSvg.setAttribute('height', '300');
  }

  _ghostGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  _ghostGroup.setAttribute('opacity', GHOST_OPACITY);
  _ghostGroup.style.display = 'none';

  _ghostSvg.appendChild(_ghostGroup);
  _ghostOverlayEl.appendChild(_ghostSvg);
  dom.canvas.appendChild(_ghostOverlayEl);

  _ghostBuiltKey = '';   // force rebuild
}

/**
 * Build (or rebuild) the SVG shapes inside _ghostGroup
 * based on the current duration, rest, and dot state.
 */
function buildGhostShapes() {
  if (!_ghostGroup) return;
  _ghostGroup.innerHTML = '';

  const dur    = appState.currentDuration;
  const isRest = appState.isRest;
  const color  = GHOST_COLOR;

  if (isRest) {
    /* ── Rest symbol ── */
    const symbols = { w:'𝄻', h:'𝄼', q:'𝄽', '8':'𝄾', '16':'𝄿' };
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('fill', color);
    txt.setAttribute('font-size', '38');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('dominant-baseline', 'central');
    txt.textContent = symbols[dur] || '𝄽';
    _ghostGroup.appendChild(txt);
  } else {
    /* ── Note head ── */
    const isHollow = (dur === 'w' || dur === 'h');
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    head.setAttribute('cx', '0');
    head.setAttribute('cy', '0');
    head.setAttribute('rx', dur === 'w' ? '8' : '6.5');
    head.setAttribute('ry', dur === 'w' ? '5' : '4.5');
    head.setAttribute('transform', 'rotate(-15)');
    head.setAttribute('fill',   isHollow ? 'none' : color);
    head.setAttribute('stroke', color);
    head.setAttribute('stroke-width', isHollow ? '1.8' : '0.5');
    _ghostGroup.appendChild(head);

    /* ── Stem (not for whole notes) ── */
    if (dur !== 'w') {
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1', '6');  stem.setAttribute('y1', '-2');
      stem.setAttribute('x2', '6');  stem.setAttribute('y2', '-36');
      stem.setAttribute('stroke', color);
      stem.setAttribute('stroke-width', '1.4');
      _ghostGroup.appendChild(stem);
    }

    /* ── Flags ── */
    if (dur === '8' || dur === '16') {
      const f1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      f1.setAttribute('d', 'M6,-36 C11,-28 15,-21 9,-15');
      f1.setAttribute('stroke', color); f1.setAttribute('fill', 'none');
      f1.setAttribute('stroke-width', '1.5');
      _ghostGroup.appendChild(f1);
    }
    if (dur === '16') {
      const f2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      f2.setAttribute('d', 'M6,-29 C11,-21 15,-14 9,-8');
      f2.setAttribute('stroke', color); f2.setAttribute('fill', 'none');
      f2.setAttribute('stroke-width', '1.5');
      _ghostGroup.appendChild(f2);
    }

    /* ── Augmentation dot ── */
    if (appState.isDotted) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '13'); dot.setAttribute('cy', '-1'); dot.setAttribute('r', '2');
      dot.setAttribute('fill', color);
      _ghostGroup.appendChild(dot);
    }
  }

  _ghostBuiltKey = `${dur}|${isRest}|${appState.isDotted}`;
}

/**
 * Update the ghost note position from mouse coordinates.
 * Snaps Y to the nearest staff position.
 */
function updateGhost(mx, my) {
  if (!_ghostGroup) return;

  /* rebuild shapes if duration/rest/dot changed */
  const key = `${appState.currentDuration}|${appState.isRest}|${appState.isDotted}`;
  if (_ghostBuiltKey !== key) buildGhostShapes();

  /* which stave row? */
  const sc = getStaveForY(my);
  if (!sc) { hideGhost(); return; }

  /* track pitch index for ledger-line logic, but position at raw mouse Y */
  if (!appState.isRest) {
    const pitch = calculatePitchFromY(my, sc.stave);
    _ghostPitchIdx = pitchToIndex(pitch);
  }

  /* ghost follows the mouse cursor center exactly */
  _ghostGroup.setAttribute('transform', `translate(${mx}, ${my})`);
  _ghostGroup.style.display = '';

  /* add / remove ledger lines (positioned relative to mouse Y) */
  updateGhostLedgers(sc.stave, my);
}

/**
 * Draw small ledger lines through or near the ghost note head
 * when the pitch is above or below the five staff lines.
 */
function updateGhostLedgers(stave, mouseY) {
  /* remove old ledger lines */
  _ghostGroup.querySelectorAll('.gh-ledger').forEach(el => el.remove());

  if (appState.isRest) return;

  const pIdx     = _ghostPitchIdx;
  const halfLine = -1 + pIdx * 0.5;

  /* Determine which integer line positions need a ledger */
  const ledgerLines = [];
  if (halfLine <= -0.5) {
    for (let l = -1; l >= Math.floor(halfLine); l--) ledgerLines.push(l);
  }
  if (halfLine >= 4.5) {
    for (let l = 5; l <= Math.ceil(halfLine); l++) ledgerLines.push(l);
  }

  ledgerLines.forEach(l => {
    const ly    = stave.getYForLine(l);
    const relY  = ly - mouseY;              // relative to mouse Y (ghost transform origin)
    const line  = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'gh-ledger');
    line.setAttribute('x1', '-11'); line.setAttribute('y1', relY);
    line.setAttribute('x2', '11');  line.setAttribute('y2', relY);
    line.setAttribute('stroke', GHOST_COLOR);
    line.setAttribute('stroke-width', '1.4');
    _ghostGroup.appendChild(line);
  });
}

function hideGhost() {
  if (_ghostGroup) {
    _ghostGroup.style.display = 'none';
    _ghostPitchIdx = -1;
  }
}


/* ═══════════════════════════════════════
   §9  SIMPLE ENTRY LOGIC
   ═══════════════════════════════════════ */

function enterNoteAtCursor(pitch) {
  const notes = activeNotes();
  const ci    = activeCursor();
  const noteData = {
    keys: [pitch], duration: appState.currentDuration,
    isRest: appState.isRest, isDotted: appState.isDotted,
  };

  if (ci < notes.length) {
    notes[ci] = noteData;          // REPLACE
  } else {
    notes.push(noteData);          // APPEND
  }

  if (!appState.isRest) playNote(vexKeyToMidi(pitch));
  setActiveCursor(Math.min(ci + 1, notes.length));
  renderScore();
}

function deleteAtCursor() {
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) return;
  notes.splice(ci, 1);
  setActiveCursor(Math.min(ci, notes.length));
  renderScore();
}

function moveCursor(delta) {
  const notes = activeNotes();
  setActiveCursor(Math.max(0, Math.min(activeCursor() + delta, notes.length)));
  renderScore();
}

function transposeCursor(steps) {
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) return;
  const note = notes[ci];
  if (note.isRest) return;
  const idx    = pitchToIndex(note.keys[0]);
  const newIdx = Math.max(0, Math.min(idx - steps, TREBLE_PITCHES.length - 1));
  if (newIdx !== idx) {
    note.keys = [TREBLE_PITCHES[newIdx]];
    playNote(vexKeyToMidi(note.keys[0]));
    renderScore();
  }
}

/** Shift the cursor note by ±1 semitone (+1 = up, -1 = down) */
function shiftSemitoneCursor(delta) {
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) return;
  const note = notes[ci];
  if (note.isRest) return;
  const minSemi = pitchToSemitone('a/3');
  const maxSemi = pitchToSemitone('a/5');
  const oldSemi = pitchToSemitone(note.keys[0]);
  const newSemi = Math.max(minSemi, Math.min(oldSemi + delta, maxSemi));
  if (newSemi !== oldSemi) {
    note.keys = [semitoneToPitch(newSemi, appState.keySignature)];
    playNote(vexKeyToMidi(note.keys[0]));
    renderScore();
  }
}


/* ═══════════════════════════════════════
   §9.5  CHORD SYMBOL ENTRY (Finale-style)
   ═══════════════════════════════════════
   Workflow:
     1. Press 'L' or click Chord button → enter chord mode
     2. Cursor selects a note → floating input appears above it
     3. Type chord name (Cmaj7, Dm, G7, etc.)
     4. Enter / Tab → commit & advance to next note
        Shift+Tab → commit & go to previous note
     5. Escape → exit chord mode
     6. Clear the input and press Enter → delete chord
   ═══════════════════════════════════════ */

function toggleChordMode() {
  /* exit lyric mode first if active */
  if (appState.lyricMode)      toggleLyricMode();
  if (appState.measureGapMode) exitGapMode();

  appState.chordMode = !appState.chordMode;
  dom.btnChord.classList.toggle('active', appState.chordMode);

  if (appState.chordMode) {
    /* clamp cursor onto an existing note */
    if (appState.cursorIndex >= appState.notes.length && appState.notes.length > 0) {
      appState.cursorIndex = appState.notes.length - 1;
    }
    if (appState.notes.length === 0) {
      appState.chordMode = false;
      dom.btnChord.classList.remove('active');
      updateStatusBar();
      return;
    }
    hideGhost();
    renderScore();
    showChordInput();
  } else {
    commitChordInput();
    hideChordInput();
    appState.chordEditIndex = -1;
    renderScore();
  }
  updateStatusBar();
}

/** Show the floating text input above the note at cursorIndex */
function showChordInput() {
  const ci = appState.cursorIndex;
  if (ci >= appState.notes.length) { hideChordInput(); return; }

  appState.chordEditIndex = ci;
  const note = appState.notes[ci];
  dom.chordInput.value = note.chord || '';
  dom.chordInput.style.display = 'block';
  repositionChordInput();

  requestAnimationFrame(() => {
    dom.chordInput.focus();
    dom.chordInput.select();
  });
}

/** Move the floating input to sit above the note bbox */
function repositionChordInput() {
  const ci = appState.chordEditIndex;
  if (ci < 0) { hideChordInput(); return; }

  const bb = appState.renderedBBoxes.find(b => b.globalIndex === ci && b.voice === 0);
  if (!bb) { hideChordInput(); return; }

  /* Add canvas padding (20px left, 30px top) */
  dom.chordInput.style.left    = (20 + (bb.x + bb.w / 2)) + 'px';
  dom.chordInput.style.top     = (30 + bb.y - 34) + 'px';
  dom.chordInput.style.display = 'block';
}

function hideChordInput() {
  dom.chordInput.style.display = 'none';
  dom.chordInput.blur();
}

/** Save whatever is in the input to the note's chord property */
function commitChordInput() {
  const ci = appState.chordEditIndex;
  if (ci < 0 || ci >= appState.notes.length) return;

  const val = dom.chordInput.value.trim();
  if (val) {
    appState.notes[ci].chord = val;
  } else {
    delete appState.notes[ci].chord;
  }
}

/** Commit current chord, move to next/prev note, reopen input */
function chordAdvance(delta) {
  commitChordInput();
  let next = appState.chordEditIndex + delta;
  next = Math.max(0, Math.min(next, appState.notes.length - 1));
  appState.cursorIndex = next;
  renderScore();
  showChordInput();
}

/* ── Chord input keyboard handling ── */
dom.chordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    chordAdvance(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    dom.chordInput.value = '';
    toggleChordMode();
    return;
  }
  /* Arrow left at start of text → prev note */
  if (e.key === 'ArrowLeft' && dom.chordInput.selectionStart === 0 && dom.chordInput.selectionEnd === 0) {
    e.preventDefault();
    chordAdvance(-1);
    return;
  }
  /* Arrow right at end of text → next note */
  if (e.key === 'ArrowRight' && dom.chordInput.selectionStart === dom.chordInput.value.length) {
    e.preventDefault();
    chordAdvance(1);
    return;
  }
  /* All other keys (letters, #, b, numbers, etc.) go into the input normally */
  e.stopPropagation();
});
dom.chordInput.addEventListener('keyup',   (e) => e.stopPropagation());
dom.chordInput.addEventListener('keypress', (e) => e.stopPropagation());


/* ═══════════════════════════════════════
   §9.6  LYRICS ENTRY (Finale-style)
   ═══════════════════════════════════════
   Workflow:
     1. Press 'T' or click Lyrics button → enter lyric mode
     2. Floating input appears BELOW the current note
     3. Type syllable, then:
        - Space / Tab → commit & advance to next note
        - '-' at end of syllable → hyphenated continuation
        - Shift+Tab → go back one note
        - Enter → commit and stay (useful for editing)
        - Escape → exit lyric mode
     4. Rests are automatically skipped when advancing
   ═══════════════════════════════════════ */

function toggleLyricMode() {
  /* exit chord mode first if active */
  if (appState.chordMode)      toggleChordMode();
  if (appState.measureGapMode) exitGapMode();

  appState.lyricMode = !appState.lyricMode;
  dom.btnLyric.classList.toggle('active', appState.lyricMode);

  if (appState.lyricMode) {
    const notes = activeNotes();
    if (activeCursor() >= notes.length && notes.length > 0) {
      setActiveCursor(notes.length - 1);
    }
    /* skip rests */
    skipRestsForLyric(1);
    hideGhost();
    renderScore();
    showLyricInput();
  } else {
    commitLyricInput();
    hideLyricInput();
    appState.lyricEditIndex = -1;
    appState.lyricEditVoice = 0;
    renderScore();
  }
  updateStatusBar();
}

/** Skip past rest notes in the given direction */
function skipRestsForLyric(dir) {
  const notes = activeNotes();
  let ci = activeCursor();
  while (ci >= 0 && ci < notes.length && notes[ci].isRest) {
    ci += dir;
  }
  setActiveCursor(Math.max(0, Math.min(ci, notes.length - 1)));
}

function showLyricInput() {
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) { hideLyricInput(); return; }

  appState.lyricEditIndex = ci;
  appState.lyricEditVoice = appState.currentVoice;
  const note = notes[ci];
  const vIdx = appState.lyricVerse;
  dom.lyricInput.value = (note.lyrics && note.lyrics[vIdx]) || '';
  dom.lyricInput.style.display = 'block';
  repositionLyricInput();

  requestAnimationFrame(() => {
    dom.lyricInput.focus();
    dom.lyricInput.select();
  });
}

function repositionLyricInput() {
  const ci    = appState.lyricEditIndex;
  const voice = appState.lyricEditVoice;
  if (ci < 0) { hideLyricInput(); return; }

  const bb = appState.renderedBBoxes.find(b => b.globalIndex === ci && b.voice === voice);
  if (!bb) { hideLyricInput(); return; }

  /* Add canvas padding (20px left, 30px top) + verse offset */
  const verseOffsetY = appState.lyricVerse * (appState.lyricStyle.size + 3);
  dom.lyricInput.style.left = (20 + (bb.x + bb.w / 2)) + 'px';
  dom.lyricInput.style.top  = (30 + (bb.y + bb.h) + 8 + verseOffsetY) + 'px';
  dom.lyricInput.style.display = 'block';
}

function hideLyricInput() {
  dom.lyricInput.style.display = 'none';
  dom.lyricInput.blur();
}

function commitLyricInput() {
  const ci    = appState.lyricEditIndex;
  const notes = appState.lyricEditVoice === 0 ? appState.notes : appState.voice2Notes;
  if (ci < 0 || ci >= notes.length) return;

  const vIdx = appState.lyricVerse;
  const val  = dom.lyricInput.value.trim();
  if (!notes[ci].lyrics) notes[ci].lyrics = [];
  if (val) {
    notes[ci].lyrics[vIdx] = val;
  } else {
    notes[ci].lyrics[vIdx] = undefined;
  }
  /* clean up: remove trailing empty slots */
  while (notes[ci].lyrics.length && !notes[ci].lyrics[notes[ci].lyrics.length - 1]) {
    notes[ci].lyrics.pop();
  }
  if (!notes[ci].lyrics.length) delete notes[ci].lyrics;
  /* backward compat: keep .lyric in sync with verse 0 */
  if (notes[ci].lyrics && notes[ci].lyrics[0]) {
    notes[ci].lyric = notes[ci].lyrics[0];
  } else {
    delete notes[ci].lyric;
  }
}

function lyricAdvance(delta) {
  commitLyricInput();
  const notes = activeNotes();
  let next = appState.lyricEditIndex + delta;
  /* skip rests */
  while (next >= 0 && next < notes.length && notes[next].isRest) {
    next += delta;
  }
  next = Math.max(0, Math.min(next, notes.length - 1));
  setActiveCursor(next);
  renderScore();
  showLyricInput();
}

/* ── Lyric input keyboard handling ── */
dom.lyricInput.addEventListener('keydown', (e) => {
  /* Space → commit and advance (Finale behavior: space = next syllable) */
  if (e.key === ' ') {
    e.preventDefault();
    lyricAdvance(1);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    lyricAdvance(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    commitLyricInput();
    renderScore();
    /* stay on same note — useful for just confirming an edit */
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    dom.lyricInput.value = '';
    toggleLyricMode();
    return;
  }
  /* Hyphen at end → commit-with-hyphen & advance (Finale: '-' = syllable break) */
  if (e.key === '-') {
    /* Allow typing hyphen — it will be committed with the text.
       The hyphen at the end signals "continued syllable" visually. */
  }
  if (e.key === 'ArrowLeft' && dom.lyricInput.selectionStart === 0 && dom.lyricInput.selectionEnd === 0) {
    e.preventDefault();
    lyricAdvance(-1);
    return;
  }
  if (e.key === 'ArrowRight' && dom.lyricInput.selectionStart === dom.lyricInput.value.length) {
    e.preventDefault();
    lyricAdvance(1);
    return;
  }
  e.stopPropagation();
});
dom.lyricInput.addEventListener('keyup',   (e) => e.stopPropagation());
dom.lyricInput.addEventListener('keypress', (e) => e.stopPropagation());


/* ═══════════════════════════════════════
   §10  MOUSE INTERACTION
   ═══════════════════════════════════════ */

function hitTestNote(x, y) {
  const PAD = 6;
  for (const bb of appState.renderedBBoxes) {
    if (x >= bb.x - PAD && x <= bb.x + bb.w + PAD &&
        y >= bb.y - PAD && y <= bb.y + bb.h + PAD) {
      return { index: bb.globalIndex, voice: bb.voice };
    }
  }
  return null;
}

/** Convert mouse event to SVG-internal coordinates (accounts for canvas padding) */
function getCanvasCoords(e) {
  const rect = dom.canvas.getBoundingClientRect();
  /* #score-canvas has padding: 30px 20px — subtract to get SVG coordinate space */
  return {
    x: (e.clientX - rect.left - 20),
    y: (e.clientY - rect.top  - 30),
  };
}

function getStaveForY(y) {
  const spacing = appState.layout.staffSpacing;
  for (const sc of appState.staveCache) {
    if (y >= sc.y && y <= sc.y + spacing) return sc;
  }
  return appState.staveCache[0] || null;
}

/** Return the staveCache entry for the measure at canvas coords (mx, my). */
function getMeasureStaveForPoint(mx, my) {
  for (const sc of appState.staveCache) {
    const staffTop = sc.stave.getYForLine(0);
    const staffBottom = sc.stave.getYForLine(4);
    const yPad = Math.max(18, appState.layout.staffLineSpacing * 1.6);

    if (my >= staffTop - yPad && my <= staffBottom + yPad &&
        mx >= sc.x && mx <= sc.x + sc.width) return sc;
  }
  return null;
}

function getMeasureCursorRange(measureIndex, voice = appState.currentVoice) {
  const notes = voice === 0 ? appState.notes : appState.voice2Notes;
  const measures = splitIntoMeasures(notes);
  const measure = measures[measureIndex];

  if (measure && measure.length > 0) {
    return {
      start: measure[0]._gi,
      end: measure[measure.length - 1]._gi + 1,
    };
  }

  if (measureIndex === measures.length) {
    return {
      start: notes.length,
      end: notes.length,
    };
  }

  return null;
}

function setCursorForMeasureClick(sc, mx, voice = appState.currentVoice) {
  const range = getMeasureCursorRange(sc.measureIndex, voice);

  if (!range) {
    return false;
  }

  const measureBoxes = appState.renderedBBoxes
    .filter((bb) =>
      bb.voice === voice &&
      bb.globalIndex >= range.start &&
      bb.globalIndex < range.end
    )
    .sort((left, right) => left.x - right.x);

  let nextCursor = range.end;

  for (const bb of measureBoxes) {
    const midpoint = bb.x + bb.w / 2;

    if (mx < midpoint) {
      nextCursor = bb.globalIndex;
      break;
    }
  }

  setActiveCursor(nextCursor);
  return true;
}

let _dragRaf = 0;
function scheduleRenderDrag() {
  if (_dragRaf) return;
  _dragRaf = requestAnimationFrame(() => { _dragRaf = 0; renderScore(); });
}

let _clickTimer   = 0;
let _pendingClick = null;

/* ── Mousedown ── */
dom.canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || appState.isPlaying) return;
  const { x: mx, y: my } = getCanvasCoords(e);
  appState._mouseDidDrag = false;
  appState._mouseDownOnNote = false;

  const hit = hitTestNote(mx, my);
  if (hit) {
    /* In note-click modes (dynamics, articulation, fermata, chord, lyric),
       skip drag-start so the click event reaches handleSingleClick cleanly. */
    const isNoteClickMode = appState.dynamicsMode || appState.articulationMode ||
      appState.chordMode || appState.lyricMode ||
      (appState.repeatMode && appState.repeatSelected === 'fermata');
    if (isNoteClickMode) return;

    appState._mouseDownOnNote   = true;
    appState.selectedNoteIndex  = hit.index;
    appState.selectedNoteVoice  = hit.voice;
    appState.isDragging         = true;
    appState.currentVoice       = hit.voice;
    if (hit.voice === 0) appState.cursorIndex = hit.index;
    else                 appState.v2CursorIdx  = hit.index;
    document.querySelectorAll('.voice-btn').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.voice) === hit.voice));
    dom.canvas.classList.remove('cursor-grab');
    dom.canvas.classList.add('cursor-grabbing');
    hideGhost();                                   // ★ hide ghost during drag
    renderScore();
    e.preventDefault();
  }
});

/* ── Mousemove ── */
dom.canvas.addEventListener('mousemove', (e) => {
  const { x: mx, y: my } = getCanvasCoords(e);

  /* dragging an existing note */
  if (appState.isDragging && appState.selectedNoteIndex >= 0) {
    appState._mouseDidDrag = true;
    hideGhost();                                   // ★ keep ghost hidden
    const sc = getStaveForY(my);
    if (!sc) return;
    const newPitch = calculatePitchFromY(my, sc.stave);
    const dragArr = appState.selectedNoteVoice === 0 ? appState.notes : appState.voice2Notes;
    const note = dragArr[appState.selectedNoteIndex];
    if (note && !note.isRest && note.keys[0] !== newPitch) {
      note.keys = [newPitch];
      scheduleRenderDrag();
    }
    return;
  }

  /* hovering over an existing note → show grab cursor, hide ghost */
  if (hitTestNote(mx, my)) {
    dom.canvas.classList.add('cursor-grab');
    hideGhost();                                   // ★ no ghost over real notes
    return;
  }

  dom.canvas.classList.remove('cursor-grab');

  /* ★ show ghost note preview (not in chord/lyric mode) */
  if (appState.chordMode || appState.lyricMode) { hideGhost(); return; }
  updateGhost(mx, my);
});

/* ── Mouseup ── */
dom.canvas.addEventListener('mouseup', () => {
  if (!appState.isDragging) return;
  if (appState._mouseDidDrag && appState.selectedNoteIndex >= 0) {
    const dragArr = appState.selectedNoteVoice === 0 ? appState.notes : appState.voice2Notes;
    const note = dragArr[appState.selectedNoteIndex];
    if (note && !note.isRest) playNote(vexKeyToMidi(note.keys[0]));
  }
  appState.isDragging = false;
  appState.selectedNoteIndex = -1;
  dom.canvas.classList.remove('cursor-grabbing');
  renderScore();
});

/* ── Mouseleave ── */
dom.canvas.addEventListener('mouseleave', () => {
  hideGhost();                                     // ★ hide ghost when leaving
  if (appState.isDragging) {
    appState.isDragging = false;
    appState.selectedNoteIndex = -1;
    dom.canvas.classList.remove('cursor-grabbing');
    renderScore();
  }
});

/* ── Click (delayed for dblclick) ── */
dom.canvas.addEventListener('click', (e) => {
  if (e.button !== 0 || appState.isPlaying) return;
  /* Modes that require clicking directly on a note must bypass the
     _mouseDownOnNote early-return, otherwise handleSingleClick is never reached. */
  const needsNoteClick = appState.dynamicsMode || appState.articulationMode ||
    appState.chordMode || appState.lyricMode ||
    (appState.repeatMode && appState.repeatSelected === 'fermata');
  if (appState._mouseDidDrag || (appState._mouseDownOnNote && !needsNoteClick)) {
    appState._mouseDidDrag = false;
    appState._mouseDownOnNote = false;
    return;
  }
  appState._mouseDidDrag = false;
  appState._mouseDownOnNote = false;
  const { x: mx, y: my } = getCanvasCoords(e);
  clearTimeout(_clickTimer);
  _pendingClick = { mx, my };
  _clickTimer = setTimeout(() => {
    if (!_pendingClick) return;
    handleSingleClick(_pendingClick.mx, _pendingClick.my);
    _pendingClick = null;
  }, 200);
});

function toggleRepeatMarker(mIdx, markerType) {
  if (!appState.repeatMarkers[mIdx]) appState.repeatMarkers[mIdx] = {};
  if (appState.repeatMarkers[mIdx][markerType]) {
    delete appState.repeatMarkers[mIdx][markerType];
  } else {
    appState.repeatMarkers[mIdx][markerType] = true;
  }
}

function handleSingleClick(mx, my) {
  /* ── Dynamics mode ── */
  if (appState.dynamicsMode && appState.dynamicsSelected) {
    const hit = hitTestNote(mx, my);
    if (hit) {
      const notesArr = hit.voice === 0 ? appState.notes : appState.voice2Notes;
      const n = notesArr[hit.index];
      if (n) {
        if (n.dynamic === appState.dynamicsSelected) {
          delete n.dynamic;   // toggle off
        } else {
          n.dynamic = appState.dynamicsSelected;
        }
        renderScore();
      }
    }
    return;
  }

  /* ── Articulation mode ── */
  if (appState.articulationMode && appState.articulationSelected) {
    const hit = hitTestNote(mx, my);
    if (hit) {
      const notesArr = hit.voice === 0 ? appState.notes : appState.voice2Notes;
      const n = notesArr[hit.index];
      if (n) {
        if (n.articulation === appState.articulationSelected) {
          delete n.articulation;   // toggle off
        } else {
          n.articulation = appState.articulationSelected;
        }
        renderScore();
      }
    }
    return;
  }

  /* ── Repeat Notation mode ── */
  if (appState.repeatMode && appState.repeatSelected) {
    const def = REPEAT_DEFS[appState.repeatSelected];
    if (def && def.type === 'note') {
      /* Fermata: toggle on the clicked note (any voice) */
      const hit = hitTestNote(mx, my);
      if (hit) {
        const notesArr = hit.voice === 0 ? appState.notes : appState.voice2Notes;
        const n = notesArr[hit.index];
        if (n) { n.fermata = !n.fermata; renderScore(); }
      }
    } else {
      /* Measure-level marker */
      const sc = getMeasureStaveForPoint(mx, my);
      if (sc) { toggleRepeatMarker(sc.measureIndex, appState.repeatSelected); renderScore(); }
    }
    return;
  }

  /* ── Song Form mode: assign/remove label on clicked measure ── */
  if (appState.songFormMode && appState.songFormSelected) {
    const sc = getMeasureStaveForPoint(mx, my);
    if (sc) {
      const mIdx = sc.measureIndex;
      if (appState.songFormLabels[mIdx] === appState.songFormSelected) {
        delete appState.songFormLabels[mIdx];
      } else {
        appState.songFormLabels[mIdx] = appState.songFormSelected;
      }
      renderScore();
    }
    return;
  }

  /* ── Gap mode: select measure to adjust gap after it ── */
  if (appState.measureGapMode) {
    const sc = getMeasureStaveForPoint(mx, my);
    if (sc) {
      appState._gapSelectedMeasure = sc.measureIndex;
      renderScore();
      showGapPanel(sc.measureIndex);
    }
    return;
  }

  const hit = hitTestNote(mx, my);

  if (hit) {
    /* Switch to the voice that was clicked */
    appState.currentVoice = hit.voice;
    if (hit.voice === 0) appState.cursorIndex = hit.index;
    else                 appState.v2CursorIdx  = hit.index;
    document.querySelectorAll('.voice-btn').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.voice) === hit.voice));

    /* In chord mode, clicking a note opens the chord input on it (voice 1 only) */
    if (appState.chordMode) {
      renderScore();
      showChordInput();
      return;
    }

    /* In lyric mode, clicking a note opens the lyric input on it (voice 1 only) */
    if (appState.lyricMode) {
      renderScore();
      showLyricInput();
      return;
    }

    renderScore();
    const notesArr = hit.voice === 0 ? appState.notes : appState.voice2Notes;
    const n = notesArr[hit.index];
    if (n && !n.isRest) playNote(vexKeyToMidi(n.keys[0]));
    return;
  }

  /* Don't place new notes while in chord or lyric mode */
  if (appState.chordMode || appState.lyricMode) return;

  const sc = getMeasureStaveForPoint(mx, my);
  if (!sc) return;
  if (!setCursorForMeasureClick(sc, mx)) return;

  const pitch = calculatePitchFromY(my, sc.stave);
  enterNoteAtCursor(pitch);
}


/* ═══════════════════════════════════════
   §11  KEYBOARD HANDLER
   ═══════════════════════════════════════ */

document.addEventListener('keydown', (e) => {
  const target = e.target;
  const tagName = target?.tagName;

  if (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target?.isContentEditable
  ) {
    return;
  }

  /* Let chord / lyric inputs handle their own keys */
  if (target.id === 'chord-input') return;
  if (target.id === 'lyric-input') return;
  /* Ignore keyboard events fired on voice buttons (e.g. Space/Enter activating them) */
  if (target.classList.contains('voice-btn')) return;

  const key = e.key, kl = key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;

  /* ── L key: toggle chord mode ── */
  if (kl === 'l' && !ctrl) { e.preventDefault(); toggleChordMode(); return; }

  /* ── T key: toggle tie (붙임줄) ── */
  if (kl === 't' && !ctrl) { e.preventDefault(); if (!requireFullToolsAccess()) return; toggleTie(); return; }

  /* ── S key: toggle slur (이음줄) ── */
  if (kl === 's' && !ctrl) { e.preventDefault(); if (!requireFullToolsAccess()) return; toggleSlur(); return; }

  /* ── Escape exits dynamics / articulation / repeat / song form / gap mode ── */
  if (key === 'Escape') {
    if (appState.dynamicsMode)    { e.preventDefault(); exitDynamicsMode();     return; }
    if (appState.articulationMode){ e.preventDefault(); exitArticulationMode(); return; }
    if (appState.repeatMode)      { e.preventDefault(); exitRepeatMode();       return; }
    if (appState.songFormMode)    { e.preventDefault(); exitSongFormMode();     return; }
    if (appState.measureGapMode)  { e.preventDefault(); exitGapMode();          return; }
  }

  /* ── Block note/duration entry while chord mode is active ── */
  if (appState.chordMode) {
    if (key === 'ArrowLeft')  { e.preventDefault(); chordAdvance(-1); return; }
    if (key === 'ArrowRight') { e.preventDefault(); chordAdvance(1); return; }
    if (key === 'Escape')     { e.preventDefault(); toggleChordMode(); return; }
    return;
  }

  /* ── Block note/duration entry while lyric mode is active ── */
  if (appState.lyricMode) {
    if (key === 'ArrowLeft')  { e.preventDefault(); lyricAdvance(-1); return; }
    if (key === 'ArrowRight') { e.preventDefault(); lyricAdvance(1); return; }
    if (key === 'Escape')     { e.preventDefault(); toggleLyricMode(); return; }
    return;
  }

  if (NUM_TO_DURATION[key])        { e.preventDefault(); setDuration(NUM_TO_DURATION[key]); return; }
  if ('abcdefg'.includes(kl) && !ctrl) { e.preventDefault(); enterNoteAtCursor(closestPitchForLetter(kl, getRefPitchIndex())); return; }
  if (key === 'ArrowLeft')         { e.preventDefault(); moveCursor(-1); return; }
  if (key === 'ArrowRight')        { e.preventDefault(); moveCursor(+1); return; }
  if (key === 'ArrowUp')           { e.preventDefault(); transposeCursor(+1); return; }
  if (key === 'ArrowDown')         { e.preventDefault(); transposeCursor(-1); return; }
  if (key === '+' || key === '=')  { e.preventDefault(); shiftSemitoneCursor(+1); return; }
  if (key === '-' || key === '_')  { e.preventDefault(); shiftSemitoneCursor(-1); return; }
  if (kl === 'r' && !ctrl)         { e.preventDefault(); toggleRest(); return; }
  if (key === '.')                  { e.preventDefault(); toggleDot(); return; }
  if (key === 'Delete')            { e.preventDefault(); deleteAtCursor(); return; }
  if (key === 'Backspace')         { e.preventDefault(); if (appState.cursorIndex > 0) { appState.cursorIndex--; deleteAtCursor(); } return; }
  if (key === ' ')                 { e.preventDefault(); if (!requireFullToolsAccess()) return; appState.isPlaying ? stopPlayback() : startPlayback(); return; }
  if (ctrl && kl === 'z')          { e.preventDefault(); const _n = activeNotes(); if (_n.length) { _n.pop(); setActiveCursor(Math.min(activeCursor(), _n.length)); renderScore(); } return; }
});


/* ═══════════════════════════════════════
   §12  MEASURE PLAYBACK
   ═══════════════════════════════════════ */

dom.canvas.addEventListener('dblclick', (e) => {
  if (!requireFullToolsAccess()) return;
  e.preventDefault();
  clearTimeout(_clickTimer); _pendingClick = null;
  const mIdx = getMeasureIndexFromXY(e.offsetX, e.offsetY);
  if (mIdx < 0) return;
  playMeasure(mIdx);
});

function getMeasureIndexFromXY(x, y) {
  for (const sc of appState.staveCache) {
    if (y >= sc.y && y <= sc.y + STAVE_SPACING && x >= sc.x && x <= sc.x + sc.width) return sc.measureIndex;
  }
  return -1;
}

function playMeasure(measureIndex) {
  if (!requireFullToolsAccess()) return;
  stopPlayback();
  const measures   = splitIntoMeasures(appState.notes);
  const v2measures = splitIntoMeasures(appState.voice2Notes);
  const mNotes  = measures[measureIndex]   || [];
  const mV2Notes = v2measures[measureIndex] || [];
  if (!mNotes.length && !mV2Notes.length) return;
  highlightMeasure(measureIndex, true);
  const beatDur = 60 / appState.bpm;
  let time1 = 0, time2 = 0;
  mNotes.forEach(n => {
    const beats = noteBeatValue(n); const dur = beats * beatDur;
    if (!n.isRest) appState.playTimeouts.push(setTimeout(() => playNote(vexKeyToMidi(n.keys[0]), dur), time1 * 1000));
    time1 += dur;
  });
  mV2Notes.forEach(n => {
    const beats = noteBeatValue(n); const dur = beats * beatDur;
    if (!n.isRest) appState.playTimeouts.push(setTimeout(() => playNote(vexKeyToMidi(n.keys[0]), dur), time2 * 1000));
    time2 += dur;
  });
  const time = Math.max(time1, time2);
  appState.playTimeouts.push(setTimeout(() => highlightMeasure(measureIndex, false), time * 1000 + 150));
}

function highlightMeasure(measureIndex, show) {
  const ID = 'measure-highlight';
  const old = dom.canvas.querySelector('#' + ID); if (old) old.remove();
  if (!show) return;
  const sc = appState.staveCache[measureIndex]; if (!sc) return;
  const svg = dom.canvas.querySelector('svg'); if (!svg) return;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('id', ID); rect.setAttribute('x', sc.x); rect.setAttribute('y', sc.y + 10);
  rect.setAttribute('width', sc.width); rect.setAttribute('height', 75); rect.setAttribute('rx', 6);
  rect.setAttribute('fill', HIGHLIGHT_FILL); rect.setAttribute('stroke', HIGHLIGHT_STROKE); rect.setAttribute('stroke-width', '1.2');
  svg.insertBefore(rect, svg.firstChild);
}


/* ═══════════════════════════════════════
   §13  FULL PLAYBACK
   ═══════════════════════════════════════ */

function stopPlayback() {
  appState.isPlaying = false;
  appState.playTimeouts.forEach(clearTimeout);
  appState.playTimeouts = [];
  dom.btnPlay.classList.remove('playing');
  const hl = dom.canvas.querySelector('#measure-highlight'); if (hl) hl.remove();
}

function startPlayback() {
  if (!requireFullToolsAccess()) return;
  if (!appState.notes.length && !appState.voice2Notes.length) return;
  stopPlayback(); appState.isPlaying = true;
  dom.btnPlay.classList.add('playing');
  hideGhost();                                     // ★ hide ghost during playback
  hideChordInput();                                // ★ hide chord input during playback
  hideLyricInput();                                // ★ hide lyric input during playback
  const beatDur = 60 / appState.bpm;

  /* ── Voice 1 (with measure highlight) ── */
  const measures = splitIntoMeasures(appState.notes);
  let gTime1 = 0;
  measures.forEach((mNotes, mIdx) => {
    appState.playTimeouts.push(setTimeout(() => highlightMeasure(mIdx, true), gTime1 * 1000));
    let mTime = 0;
    mNotes.forEach(n => {
      const beats = noteBeatValue(n); const dur = beats * beatDur;
      if (!n.isRest) appState.playTimeouts.push(setTimeout(() => playNote(vexKeyToMidi(n.keys[0]), dur), (gTime1 + mTime) * 1000));
      mTime += dur;
    });
    appState.playTimeouts.push(setTimeout(() => highlightMeasure(mIdx, false), (gTime1 + mTime) * 1000));
    gTime1 += mTime;
  });

  /* ── Voice 2 (notes only, no highlight) ── */
  const v2measures = splitIntoMeasures(appState.voice2Notes);
  let gTime2 = 0;
  v2measures.forEach((mNotes) => {
    let mTime = 0;
    mNotes.forEach(n => {
      const beats = noteBeatValue(n); const dur = beats * beatDur;
      if (!n.isRest) appState.playTimeouts.push(setTimeout(() => playNote(vexKeyToMidi(n.keys[0]), dur), (gTime2 + mTime) * 1000));
      mTime += dur;
    });
    gTime2 += mTime;
  });

  const totalTime = Math.max(gTime1, gTime2);
  appState.playTimeouts.push(setTimeout(() => stopPlayback(), totalTime * 1000 + 250));
}


/* ═══════════════════════════════════════
   §14  EXPORT PNG / PDF
   ═══════════════════════════════════════ */

function prepareExport() {
  hideGhost();
  hideChordInput();
  hideLyricInput();
  document.getElementById('gap-panel').style.display = 'none';
  /* temporarily suppress gap mode indicators in SVG */
  const _wasGapMode = appState.measureGapMode;
  const _wasSelected = appState._gapSelectedMeasure;
  if (_wasGapMode) {
    appState.measureGapMode      = false;
    appState._gapSelectedMeasure = null;
    renderScore();
  }
  return () => {
    if (_wasGapMode) {
      appState.measureGapMode      = true;
      appState._gapSelectedMeasure = _wasSelected;
      renderScore();
      if (_wasSelected !== null) showGapPanel(_wasSelected);
    }
  };
}

async function exportToPNG() {
  if (!requireFullToolsAccess()) return;
  const btn = dom.btnPNG;
  btn.classList.add('busy'); btn.querySelector('span').textContent = 'Saving…';
  document.body.style.cursor = 'wait';
  const restoreExport = prepareExport();
  try {
    const c = await html2canvas(dom.canvas, { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a'); a.href = c.toDataURL('image/png');
    a.download = 'my_music_score.png'; document.body.appendChild(a); a.click(); a.remove();
  } catch(e) { console.error('PNG export error:', e); }
  restoreExport();
  btn.classList.remove('busy'); btn.querySelector('span').textContent = 'PNG';
  document.body.style.cursor = '';
}

async function exportToPDF() {
  if (!requirePdfAccess()) return;
  const btn = dom.btnPDF;
  btn.classList.add('busy'); btn.querySelector('span').textContent = 'Saving…';
  document.body.style.cursor = 'wait';
  const restoreExport = prepareExport();
  try {
    await html2pdf().set({
      margin: 10, filename: 'my_music_score.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    }).from(dom.canvas).save();
  } catch(e) { console.error('PDF export error:', e); }
  restoreExport();
  btn.classList.remove('busy'); btn.querySelector('span').textContent = 'PDF';
  document.body.style.cursor = '';
}


/* ═══════════════════════════════════════
   §15  UI BINDINGS
   ═══════════════════════════════════════ */

function setDuration(dur) {
  appState.currentDuration = dur;
  dom.noteButtons.forEach(b => b.classList.toggle('active', b.dataset.duration === dur));
  updateStatusBar();
  /* ghost shape will auto-rebuild on next mousemove */
}

function toggleRest() {
  appState.isRest = !appState.isRest;
  dom.btnRest.classList.toggle('active', appState.isRest);
  updateStatusBar();
}

function toggleDot() {
  appState.isDotted = !appState.isDotted;
  dom.btnDot.classList.toggle('active', appState.isDotted);
  updateStatusBar();
}

function toggleTie() {
  if (!requireFullToolsAccess()) return;
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) return;
  const note  = notes[ci];
  note.tie    = !note.tie;
  renderScore();
}

function toggleSlur() {
  if (!requireFullToolsAccess()) return;
  const notes = activeNotes();
  const ci    = activeCursor();
  if (ci >= notes.length) return;
  const note  = notes[ci];
  note.slur   = !note.slur;
  renderScore();
}

dom.noteButtons.forEach(btn => { btn.addEventListener('click', () => setDuration(btn.dataset.duration)); });
dom.btnRest.addEventListener('click', toggleRest);
dom.btnDot.addEventListener('click', toggleDot);
dom.btnChord.addEventListener('click', toggleChordMode);
dom.btnLyric.addEventListener('click', toggleLyricMode);

/* ── Repeat Mode ── */
function exitRepeatMode() {
  appState.repeatMode     = false;
  appState.repeatSelected = null;
  document.querySelectorAll('.repeat-btn').forEach(b => b.classList.remove('active'));
  dom.canvas.classList.remove('cursor-form');
  updateStatusBar();
}

document.querySelectorAll('.repeat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    const type = btn.dataset.repeat;
    if (appState.repeatMode && appState.repeatSelected === type) {
      exitRepeatMode();
    } else {
      if (appState.chordMode)        toggleChordMode();
      if (appState.lyricMode)        toggleLyricMode();
      if (appState.songFormMode)     exitSongFormMode();
      if (appState.articulationMode) exitArticulationMode();
      if (appState.dynamicsMode)     exitDynamicsMode();
      if (appState.measureGapMode)   exitGapMode();
      appState.repeatMode     = true;
      appState.repeatSelected = type;
      document.querySelectorAll('.repeat-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.repeat === type));
      dom.canvas.classList.add('cursor-form');
      updateStatusBar();
    }
  });
});

/* ── Articulation Mode ── */
function exitArticulationMode() {
  appState.articulationMode     = false;
  appState.articulationSelected = null;
  document.querySelectorAll('.artic-btn').forEach(b => b.classList.remove('active'));
  dom.canvas.classList.remove('cursor-form');
  updateStatusBar();
}

document.querySelectorAll('.artic-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    const type = btn.dataset.artic;
    if (appState.articulationMode && appState.articulationSelected === type) {
      exitArticulationMode();
    } else {
      if (appState.chordMode)      toggleChordMode();
      if (appState.lyricMode)      toggleLyricMode();
      if (appState.repeatMode)     exitRepeatMode();
      if (appState.songFormMode)   exitSongFormMode();
      if (appState.dynamicsMode)   exitDynamicsMode();
      if (appState.measureGapMode) exitGapMode();
      appState.articulationMode     = true;
      appState.articulationSelected = type;
      document.querySelectorAll('.artic-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.artic === type));
      dom.canvas.classList.add('cursor-form');
      updateStatusBar();
    }
  });
});

/* ── Dynamics Mode ── */
function exitDynamicsMode() {
  appState.dynamicsMode     = false;
  appState.dynamicsSelected = null;
  document.querySelectorAll('.dynamic-btn').forEach(b => b.classList.remove('active'));
  dom.canvas.classList.remove('cursor-form');
  updateStatusBar();
}

document.querySelectorAll('.dynamic-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    const type = btn.dataset.dynamic;
    if (appState.dynamicsMode && appState.dynamicsSelected === type) {
      exitDynamicsMode();
    } else {
      if (appState.chordMode)        toggleChordMode();
      if (appState.lyricMode)        toggleLyricMode();
      if (appState.repeatMode)       exitRepeatMode();
      if (appState.songFormMode)     exitSongFormMode();
      if (appState.articulationMode) exitArticulationMode();
      if (appState.measureGapMode)   exitGapMode();
      appState.dynamicsMode     = true;
      appState.dynamicsSelected = type;
      document.querySelectorAll('.dynamic-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.dynamic === type));
      dom.canvas.classList.add('cursor-form');
      updateStatusBar();
    }
  });
});

/* ── Voice Part (성부) ── */
function switchVoice(v) {
  /* Clean up any pending canvas interaction state before switching voice */
  clearTimeout(_clickTimer);
  _pendingClick = null;
  appState._mouseDownOnNote = false;
  appState._mouseDidDrag    = false;
  if (appState.isDragging) {
    appState.isDragging = false;
    appState.selectedNoteIndex = -1;
    dom.canvas.classList.remove('cursor-grabbing');
  }
  appState.currentVoice = v;
  document.querySelectorAll('.voice-btn').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.voice) === v));
  renderScore();
  updateStatusBar();
}

document.querySelectorAll('.voice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    switchVoice(Number(btn.dataset.voice));
  });
});

/* ── Lyric Verse (가사 성부) ── */
function switchLyricVerse(v) {
  if (appState.lyricMode) commitLyricInput();
  appState.lyricVerse = v;
  document.querySelectorAll('.lyric-verse-btn').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.verse) === v));
  if (appState.lyricMode) {
    renderScore();
    showLyricInput();
  } else {
    renderScore();
  }
  updateStatusBar();
}

document.querySelectorAll('.lyric-verse-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    switchLyricVerse(Number(btn.dataset.verse));
  });
});

/* ── Song Form Mode ── */
function exitSongFormMode() {
  appState.songFormMode     = false;
  appState.songFormSelected = null;
  document.querySelectorAll('.form-btn').forEach(b => b.classList.remove('active'));
  dom.canvas.classList.remove('cursor-form');
  updateStatusBar();
}

document.querySelectorAll('.form-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!requireFullToolsAccess()) return;
    const form = btn.dataset.form;
    if (appState.songFormMode && appState.songFormSelected === form) {
      exitSongFormMode();
    } else {
      if (appState.chordMode)        toggleChordMode();
      if (appState.lyricMode)        toggleLyricMode();
      if (appState.repeatMode)       exitRepeatMode();
      if (appState.articulationMode) exitArticulationMode();
      if (appState.dynamicsMode)     exitDynamicsMode();
      appState.songFormMode     = true;
      appState.songFormSelected = form;
      document.querySelectorAll('.form-btn').forEach(b => b.classList.toggle('active', b.dataset.form === form));
      dom.canvas.classList.add('cursor-form');
      updateStatusBar();
    }
  });
});

/* ── Measure Gap Mode ── */
function exitGapMode() {
  appState.measureGapMode      = false;
  appState._gapSelectedMeasure = null;
  const btn = document.getElementById('btn-gap-mode');
  if (btn) btn.classList.remove('active');
  const panel = document.getElementById('gap-panel');
  if (panel) panel.style.display = 'none';
  dom.canvas.classList.remove('cursor-form');
  renderScore();
  updateStatusBar();
}

function showGapPanel(mIdx) {
  const panel = document.getElementById('gap-panel');
  if (!panel) return;
  const gap = appState.measureGaps[mIdx] || 0;
  document.getElementById('gap-panel-label').textContent = `마디 ${mIdx + 1} 이후 간격`;
  document.getElementById('gap-panel-slider').value = gap;
  document.getElementById('gap-panel-number').value = gap;
  panel.dataset.measureIndex = mIdx;
  panel.style.display = 'flex';
  repositionGapPanel();
}

function repositionGapPanel() {
  const panel = document.getElementById('gap-panel');
  if (!panel || panel.style.display === 'none') return;
  const mIdx = Number(panel.dataset.measureIndex);
  if (isNaN(mIdx)) return;
  const sc = appState.staveCache.find(s => s.measureIndex === mIdx);
  if (!sc) return;
  const staffBottom = sc.stave.getYForLine(4);
  /* SVG coords → canvas-div coords: add padding (20px left, 30px top) */
  panel.style.left = (sc.x + 20) + 'px';
  panel.style.top  = (staffBottom + 30 + 12) + 'px';
}

document.getElementById('btn-gap-mode').addEventListener('click', () => {
  if (!requireFullToolsAccess()) return;
  if (appState.measureGapMode) {
    exitGapMode();
  } else {
    if (appState.chordMode)        toggleChordMode();
    if (appState.lyricMode)        toggleLyricMode();
    if (appState.repeatMode)       exitRepeatMode();
    if (appState.articulationMode) exitArticulationMode();
    if (appState.dynamicsMode)     exitDynamicsMode();
    if (appState.songFormMode)     exitSongFormMode();
    appState.measureGapMode      = true;
    appState._gapSelectedMeasure = null;
    document.getElementById('btn-gap-mode').classList.add('active');
    dom.canvas.classList.add('cursor-form');
    renderScore();
    updateStatusBar();
  }
});

function applyGapValue(mIdx, val) {
  val = Math.max(0, Math.min(300, Math.round(val)));
  document.getElementById('gap-panel-slider').value = val;
  document.getElementById('gap-panel-number').value = val;
  if (val === 0) delete appState.measureGaps[mIdx];
  else           appState.measureGaps[mIdx] = val;
  renderScore();
}

document.getElementById('gap-panel-slider').addEventListener('input', (e) => {
  if (!requireFullToolsAccess()) return;
  const mIdx = Number(document.getElementById('gap-panel').dataset.measureIndex);
  if (!isNaN(mIdx)) applyGapValue(mIdx, Number(e.target.value));
});

document.getElementById('gap-panel-number').addEventListener('input', (e) => {
  if (!requireFullToolsAccess()) return;
  const mIdx = Number(document.getElementById('gap-panel').dataset.measureIndex);
  if (!isNaN(mIdx) && e.target.value !== '') applyGapValue(mIdx, Number(e.target.value));
});

document.getElementById('gap-panel-number').addEventListener('change', (e) => {
  if (!requireFullToolsAccess()) return;
  const mIdx = Number(document.getElementById('gap-panel').dataset.measureIndex);
  if (!isNaN(mIdx)) applyGapValue(mIdx, Number(e.target.value) || 0);
});

document.getElementById('gap-panel-reset').addEventListener('click', () => {
  if (!requireFullToolsAccess()) return;
  const mIdx = Number(document.getElementById('gap-panel').dataset.measureIndex);
  if (!isNaN(mIdx)) applyGapValue(mIdx, 0);
});

document.getElementById('gap-panel-close').addEventListener('click', () => {
  const panel = document.getElementById('gap-panel');
  panel.style.display = 'none';
  appState._gapSelectedMeasure = null;
  renderScore();
});

/* ── Lyric Style Controls ── */
dom.lyricFont.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.lyricFont.value = appState.lyricStyle.font;
    return;
  }
  appState.lyricStyle.font = dom.lyricFont.value;
  renderScore();
});
dom.lyricSize.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.lyricSize.value = appState.lyricStyle.size;
    dom.lyricSizeVal.textContent = appState.lyricStyle.size;
    return;
  }
  appState.lyricStyle.size = Number(dom.lyricSize.value);
  dom.lyricSizeVal.textContent = dom.lyricSize.value;
  renderScore();
});
dom.lyricOffset.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.lyricOffset.value = appState.lyricStyle.offsetY;
    dom.lyricOffsetVal.textContent = appState.lyricStyle.offsetY;
    return;
  }
  appState.lyricStyle.offsetY = Number(dom.lyricOffset.value);
  dom.lyricOffsetVal.textContent = dom.lyricOffset.value;
  renderScore();
});
dom.lyricWeight.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.lyricWeight.value = appState.lyricStyle.weight;
    return;
  }
  appState.lyricStyle.weight = dom.lyricWeight.value;
  renderScore();
});
dom.lyricItalicToggle.addEventListener('click', () => {
  if (!requireFullToolsAccess()) return;
  appState.lyricStyle.italic = !appState.lyricStyle.italic;
  dom.lyricItalicToggle.classList.toggle('active', appState.lyricStyle.italic);
  renderScore();
});
dom.lyricColor.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.lyricColor.value = appState.lyricStyle.color;
    dom.lyricColorHex.textContent = appState.lyricStyle.color;
    return;
  }
  appState.lyricStyle.color = dom.lyricColor.value;
  dom.lyricColorHex.textContent = dom.lyricColor.value;
  renderScore();
});
dom.keySig.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.keySig.value = appState.keySignature;
    return;
  }
  const newKey = dom.keySig.value;
  const oldKey = appState.keySignature;

  if (newKey === oldKey) return;

  /* no notes → just change key, no popup needed */
  if (appState.notes.length === 0) {
    appState.keySignature = newKey;
    renderScore();
    return;
  }

  showTransposeModal(oldKey, newKey);
});
dom.timeSig.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.timeSig.value = appState.timeSignature;
    return;
  }
  appState.timeSignature = dom.timeSig.value;
  renderScore();
});
dom.instrument.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.instrument.value = 'acoustic_grand_piano';
    return;
  }
  loadInstrument(dom.instrument.value);
});
dom.bpmSlider.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.bpmSlider.value = appState.bpm;
    dom.bpmDisplay.textContent = appState.bpm;
    return;
  }
  appState.bpm = Number(dom.bpmSlider.value);
  dom.bpmDisplay.textContent = appState.bpm;
});
dom.btnPlay.addEventListener('click', startPlayback);
dom.btnStop.addEventListener('click', stopPlayback);
dom.btnUndo.addEventListener('click', () => {
  const notes = activeNotes();
  if (!notes.length) return;
  notes.pop();
  setActiveCursor(Math.min(activeCursor(), notes.length));
  if (appState.chordMode && appState.notes.length === 0) { appState.chordMode = false; dom.btnChord.classList.remove('active'); hideChordInput(); }
  if (appState.lyricMode && appState.notes.length === 0) { appState.lyricMode = false; dom.btnLyric.classList.remove('active'); hideLyricInput(); }
  renderScore();
});
dom.btnClear.addEventListener('click', () => {
  if (!appState.notes.length && !appState.voice2Notes.length) return;
  appState.notes = []; appState.voice2Notes = [];
  appState.cursorIndex = 0; appState.v2CursorIdx = 0;
  appState.repeatMarkers  = {};
  appState.songFormLabels = {};
  if (appState.chordMode)  { appState.chordMode  = false; dom.btnChord.classList.remove('active'); hideChordInput(); }
  if (appState.lyricMode)  { appState.lyricMode  = false; dom.btnLyric.classList.remove('active'); hideLyricInput(); }
  if (appState.repeatMode) exitRepeatMode();
  renderScore();
});
dom.btnPNG.addEventListener('click', exportToPNG);
dom.btnPDF.addEventListener('click', exportToPDF);

/* ── Layout Sliders ── */
dom.slMPL.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.slMPL.value = appState.layout.measuresPerLine;
    dom.valMPL.textContent = appState.layout.measuresPerLine;
    return;
  }
  appState.layout.measuresPerLine = Number(dom.slMPL.value);
  dom.valMPL.textContent = dom.slMPL.value;
  renderScore();
});
dom.slScale.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.slScale.value = appState.layout.staffLineSpacing;
    dom.valScale.textContent = appState.layout.staffLineSpacing;
    return;
  }
  appState.layout.staffLineSpacing = Number(dom.slScale.value);
  dom.valScale.textContent = dom.slScale.value;
  renderScore();
});
dom.slSpace.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.slSpace.value = appState.layout.staffSpacing;
    dom.valSpace.textContent = appState.layout.staffSpacing;
    return;
  }
  appState.layout.staffSpacing = Number(dom.slSpace.value);
  dom.valSpace.textContent = dom.slSpace.value;
  renderScore();
});
dom.slMW.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.slMW.value = appState.layout.measureWidth;
    dom.valMW.textContent = appState.layout.measureWidth;
    return;
  }
  appState.layout.measureWidth = Number(dom.slMW.value);
  dom.valMW.textContent = dom.slMW.value;
  renderScore();
});

/* ── Measure Numbers ── */
dom.toggleMeasureNumbers.addEventListener('change', () => {
  if (!requireFullToolsAccess()) {
    dom.toggleMeasureNumbers.checked = appState.showMeasureNumbers;
    return;
  }
  appState.showMeasureNumbers = dom.toggleMeasureNumbers.checked;
  renderScore();
});

/* ── Note Color ── */
dom.noteHeadColor.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.noteHeadColor.value = appState.noteColor.head;
    dom.noteHeadColorHex.textContent = appState.noteColor.head;
    return;
  }
  appState.noteColor.head = dom.noteHeadColor.value;
  dom.noteHeadColorHex.textContent = dom.noteHeadColor.value;
  renderScore();
});
dom.noteStemColor.addEventListener('input', () => {
  if (!requireFullToolsAccess()) {
    dom.noteStemColor.value = appState.noteColor.stem;
    dom.noteStemColorHex.textContent = appState.noteColor.stem;
    return;
  }
  appState.noteColor.stem = dom.noteStemColor.value;
  dom.noteStemColorHex.textContent = dom.noteStemColor.value;
  renderScore();
});


/* ═══════════════════════════════════════
   §16  STATUS BAR
   ═══════════════════════════════════════ */

function updateStatusBar() {
  let durLabel = DURATION_LABELS[appState.currentDuration] || '♩ Quarter';
  if (appState.isDotted) durLabel += ' ·';
  if (appState.isRest) durLabel += ' (Rest)';
  dom.statusDur.textContent = durLabel;
  const notes = activeNotes();
  const ci    = activeCursor();
  const vLabel = appState.currentVoice === 0 ? 'V1' : 'V2';
  dom.statusPos.textContent = `${vLabel} Pos: ${ci + 1} / ${notes.length + 1}`;
  if (ci < notes.length) {
    const n = notes[ci];
    dom.statusPitch.textContent = n.isRest ? 'Rest' : n.keys[0].replace('/', '').toUpperCase();
  } else {
    dom.statusPitch.textContent = '—';
  }

  /* chord status */
  if (appState.chordMode) {
    dom.statusChord.textContent = '🎸 Chord Mode';
  } else if (ci < appState.notes.length && appState.notes[ci].chord) {
    dom.statusChord.textContent = 'Chord: ' + appState.notes[ci].chord;
  } else {
    dom.statusChord.textContent = '';
  }

  /* lyric / repeat / articulation / dynamics status */
  if (appState.lyricMode) {
    dom.statusLyric.textContent = '✏️ Lyric Mode';
  } else if (appState.dynamicsMode && appState.dynamicsSelected) {
    dom.statusLyric.textContent = '𝆑 Dynamics: ' + appState.dynamicsSelected + ' — click a note';
  } else if (appState.articulationMode && appState.articulationSelected) {
    const aLabels = {
      'staccato':      '· Staccato',
      'accent':        '> Accent',
      'tenuto':        '— Tenuto',
      'marcato':       '^ Marcato',
      'staccatissimo': '▾ Staccatissimo',
    };
    dom.statusLyric.textContent = '🎵 Artic: ' + (aLabels[appState.articulationSelected] || '') + ' — click a note';
  } else if (appState.repeatMode && appState.repeatSelected) {
    const repeatLabels = {
      'repeat-start': '|: Repeat Start',  'repeat-end': 'Repeat End :|',
      'segno':        '𝄋 Segno',          'coda':       '𝄌 Coda',
      'da-capo':      'D.C.',             'dal-segno':  'D.S.',
      'ds-al-coda':   'D.S. al Coda',     'fine':       'Fine',
      'volta-1':      '1st Ending [ ]',   'volta-2':    '2nd Ending [ ]',
      'fermata':      '𝄐 Fermata — click a note',
    };
    const rLabel = repeatLabels[appState.repeatSelected] || appState.repeatSelected;
    const suffix = REPEAT_DEFS[appState.repeatSelected]?.type === 'note' ? '' : ' — click a measure';
    dom.statusLyric.textContent = '🎼 Repeat: ' + rLabel + suffix;
  } else if (appState.songFormMode && appState.songFormSelected) {
    dom.statusLyric.textContent = '♬ Form: ' + (FORM_DISPLAY[appState.songFormSelected] || appState.songFormSelected) + ' — click a measure';
  } else if (ci < notes.length && (notes[ci].tie || notes[ci].slur)) {
    const marks = [];
    if (notes[ci].tie)  marks.push('붙임줄(Tie)');
    if (notes[ci].slur) marks.push('이음줄(Slur)');
    dom.statusLyric.textContent = marks.join(' + ');
  } else if (ci < appState.notes.length && appState.notes[ci].lyrics && appState.notes[ci].lyrics.some(Boolean)) {
    const parts = appState.notes[ci].lyrics.map((l, i) => l ? `V${i + 1}: ${l}` : null).filter(Boolean);
    dom.statusLyric.textContent = 'Lyric: ' + parts.join(' | ');
  } else {
    dom.statusLyric.textContent = '';
  }
}


/* ═══════════════════════════════════════
   §16  MENU BAR
   ═══════════════════════════════════════ */

(function initMenuBar() {
  const menuBar = document.getElementById('menu-bar');
  if (!menuBar) return;

  /* ── Open / close ── */
  let _anyOpen = false;

  function closeAll() {
    menuBar.querySelectorAll('.mb-item.open').forEach(el => el.classList.remove('open'));
    _anyOpen = false;
  }

  function openItem(item) {
    closeAll();
    item.classList.add('open');
    _anyOpen = true;
  }

  menuBar.querySelectorAll('.mb-item > span').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = span.parentElement;
      if (item.classList.contains('open')) { closeAll(); } else { syncMarks(); openItem(item); }
    });
    span.addEventListener('mouseenter', () => {
      if (_anyOpen) { syncMarks(); openItem(span.parentElement); }
    });
  });

  document.addEventListener('click', (e) => {
    if (!menuBar.contains(e.target)) closeAll();
  });

  /* ── Submenus (hover-driven) ── */
  menuBar.querySelectorAll('.mb-has-sub').forEach(li => {
    li.addEventListener('mouseenter', () => {
      li.closest('.mb-dropdown')
        .querySelectorAll('.mb-has-sub.sub-open')
        .forEach(el => el.classList.remove('sub-open'));
      li.classList.add('sub-open');
    });
    li.addEventListener('mouseleave', (e) => {
      if (!li.contains(e.relatedTarget)) li.classList.remove('sub-open');
    });
  });

  /* ── Sync all checkmarks / radio marks from appState ── */
  function syncMarks() {
    /* 보기 */
    document.getElementById('mb-check-mno')?.classList.toggle('checked', appState.showMeasureNumbers);
    menuBar.querySelectorAll('[data-action="set-mpl"]').forEach(b =>
      b.classList.toggle('checked', Number(b.dataset.value) === appState.layout.measuresPerLine));

    /* 악보 */
    menuBar.querySelectorAll('[data-action="set-key"]').forEach(b =>
      b.classList.toggle('checked', b.dataset.value === appState.keySignature));
    menuBar.querySelectorAll('[data-action="set-time"]').forEach(b =>
      b.classList.toggle('checked', b.dataset.value === appState.timeSignature));

    /* 입력 — duration */
    const curDur = document.querySelector('.note-buttons .tool-btn.active')?.dataset.duration || 'q';
    menuBar.querySelectorAll('[data-action="set-duration"]').forEach(b =>
      b.classList.toggle('checked', b.dataset.value === curDur));

    /* 입력 — rest / dot / chord / lyric */
    document.getElementById('mb-check-rest')?.classList.toggle('checked',
      document.getElementById('btn-rest').classList.contains('active'));
    document.getElementById('mb-check-dot')?.classList.toggle('checked',
      document.getElementById('btn-dot').classList.contains('active'));
    document.getElementById('mb-check-chord')?.classList.toggle('checked', appState.chordMode);
    document.getElementById('mb-check-lyric')?.classList.toggle('checked', appState.lyricMode);

    /* 입력 — verse / voice */
    menuBar.querySelectorAll('[data-action="set-verse"]').forEach(b =>
      b.classList.toggle('checked', Number(b.dataset.value) === appState.lyricVerse));
    menuBar.querySelectorAll('[data-action="set-voice"]').forEach(b =>
      b.classList.toggle('checked', Number(b.dataset.value) === appState.currentVoice));

    /* 폼 */
    menuBar.querySelectorAll('[data-action="set-form"]').forEach(b =>
      b.classList.toggle('checked',
        appState.songFormMode && appState.songFormSelected === b.dataset.value));

    /* 반복 */
    menuBar.querySelectorAll('[data-action="set-repeat"]').forEach(b =>
      b.classList.toggle('checked',
        appState.repeatMode && appState.repeatSelected === b.dataset.value));

    /* 표현 — articulation */
    menuBar.querySelectorAll('[data-action="set-artic"]').forEach(b =>
      b.classList.toggle('checked',
        appState.articulationMode && appState.articulationSelected === b.dataset.value));

    /* 표현 — dynamics */
    menuBar.querySelectorAll('[data-action="set-dynamic"]').forEach(b =>
      b.classList.toggle('checked',
        appState.dynamicsMode && appState.dynamicsSelected === b.dataset.value));
  }

  /* ── Action handler ── */
  menuBar.querySelectorAll('.mb-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, value } = btn.dataset;

      switch (action) {
        /* 파일 */
        case 'new-score':
          closeAll();
          if (confirm('새 악보를 만들겠습니까?\n현재 악보가 삭제됩니다.')) {
            dom.btnClear.click();
            appState.measureGaps = {};
          }
          break;
        case 'export-png': closeAll(); exportToPNG(); break;
        case 'export-pdf': closeAll(); exportToPDF(); break;

        /* 편집 */
        case 'undo':  closeAll(); dom.btnUndo.click();  break;
        case 'clear': closeAll(); dom.btnClear.click(); break;

        /* 입력 — duration */
        case 'set-duration':
          closeAll();
          document.querySelector(`.note-buttons [data-duration="${value}"]`)?.click();
          break;

        /* 입력 — toggles (don't close, so user can see state flip) */
        case 'toggle-rest':
          dom.btnRest.click();
          syncMarks();
          break;
        case 'toggle-dot':
          dom.btnDot.click();
          syncMarks();
          break;
        case 'toggle-chord':
          closeAll();
          dom.btnChord.click();
          break;
        case 'toggle-lyric':
          closeAll();
          dom.btnLyric.click();
          break;

        /* 입력 — verse */
        case 'set-verse':
          closeAll();
          document.querySelector(`.lyric-verse-btn[data-verse="${value}"]`)?.click();
          break;

        /* 입력 — voice */
        case 'set-voice':
          closeAll();
          document.querySelector(`.voice-btn[data-voice="${value}"]`)?.click();
          break;

        /* 폼 */
        case 'set-form':
          closeAll();
          document.querySelector(`.form-btn[data-form="${value}"]`)?.click();
          break;

        /* 반복 */
        case 'set-repeat':
          closeAll();
          document.querySelector(`.repeat-btn[data-repeat="${value}"]`)?.click();
          break;

        /* 표현 — articulation */
        case 'set-artic':
          closeAll();
          document.querySelector(`.artic-btn[data-artic="${value}"]`)?.click();
          break;

        /* 표현 — dynamics */
        case 'set-dynamic':
          closeAll();
          document.querySelector(`.dynamic-btn[data-dynamic="${value}"]`)?.click();
          break;

        /* 보기 */
        case 'toggle-measure-numbers':
          if (!requireFullToolsAccess()) break;
          appState.showMeasureNumbers = !appState.showMeasureNumbers;
          dom.toggleMeasureNumbers.checked = appState.showMeasureNumbers;
          renderScore();
          syncMarks();
          break;
        case 'set-mpl':
          if (!requireFullToolsAccess()) break;
          closeAll();
          appState.layout.measuresPerLine = Number(value);
          dom.slMPL.value = value;
          dom.valMPL.textContent = value;
          renderScore();
          break;

        /* 악보 */
        case 'set-key':
          closeAll();
          dom.keySig.value = value;
          dom.keySig.dispatchEvent(new Event('change'));
          break;
        case 'set-time':
          closeAll();
          dom.timeSig.value = value;
          dom.timeSig.dispatchEvent(new Event('change'));
          break;

        /* 도움말 */
        case 'show-shortcuts':
          closeAll();
          showShortcutsModal();
          break;
      }
    });
  });

  syncMarks();
})();

/* ── Shortcuts Modal ── */
function showShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('open');
}
document.getElementById('sc-modal-close').addEventListener('click', () => {
  document.getElementById('shortcuts-modal').classList.remove('open');
});
document.getElementById('shortcuts-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget)
    e.currentTarget.classList.remove('open');
});

/* ═══════════════════════════════════════
   §17  INIT
   ═══════════════════════════════════════ */

(async function init() {
  renderScore();
  updateStatusBar();
  await loadInstrument(dom.instrument.value);
})();
