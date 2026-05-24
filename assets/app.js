const SESSION_QUESTION_COUNT = 10;

const state = {
  quizData: [],
  nameMap: {},
  sessionOrder: [],
  currentIndex: -1,
  currentQuestion: null,
  revealedGroups: 0,
  answered: 0,
  correct: 0,
  locked: true,
  hasStarted: false,
  nextTimer: null,
  results: []
};

const els = {
  hintList: document.getElementById('hintList'),
  answerSelect: document.getElementById('answerSelect'),
  hintsPanel: document.querySelector('.hints-panel'),
  feedback: document.getElementById('feedback'),
  progressChip: document.getElementById('progressChip'),
  hintStep: document.getElementById('hintStep'),
  addHintBtn: document.getElementById('addHintBtn'),
  submitBtn: document.getElementById('submitBtn'),
  resultList: document.getElementById('resultList'),
  resultCount: document.getElementById('resultCount'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  helpBtn: document.getElementById('helpBtn'),
  closeHelpBtn: document.getElementById('closeHelpBtn'),
  helpModal: document.getElementById('helpModal'),
  confettiLayer: document.getElementById('confettiLayer')
};

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function sample(array, count) {
  return shuffle(array).slice(0, count);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setTheme(theme = 'light') {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

function openHelpModal() {
  els.helpModal.classList.add('is-open');
  els.helpModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  els.closeHelpBtn.focus();
}

function closeHelpModal() {
  els.helpModal.classList.remove('is-open');
  els.helpModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function getSessionTotal() {
  return Math.min(state.quizData.length, SESSION_QUESTION_COUNT);
}

function getHintTotal() {
  return state.currentQuestion?.hintGroups?.length ?? 0;
}

function getAccuracy() {
  return state.answered === 0 ? 0 : Math.round((state.correct / state.answered) * 1000) / 10;
}

function setFeedback(message, type = 'loading', includeAccuracy = false) {
  const suffix = includeAccuracy && state.answered > 0 ? `\n正答率: ${getAccuracy()}%` : '';
  els.feedback.className = `feedback ${type}`.trim();
  els.feedback.textContent = `${message}${suffix}`;
}

function scrollToHintsPanel() {
  if (!els.hintsPanel) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
  if (!isMobileViewport) return;

  requestAnimationFrame(() => {
    els.hintsPanel.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  });
}

function updateStats() {
  const total = getSessionTotal();
  const shown = state.hasStarted && total > 0 ? Math.min(state.currentIndex + 1, total) : 0;
  const hintTotal = getHintTotal();
  const revealed = state.currentQuestion ? Math.min(state.revealedGroups, hintTotal) : 0;

  els.progressChip.textContent = `${shown} / ${total} 連目`;
  els.hintStep.textContent = `${revealed} / ${hintTotal} ステップ`;
}

function renderIdleHints(message) {
  els.hintList.innerHTML = `
    <article class="hint-card">
      <span class="hint-label">Ready?</span>
      <span class="hint-value">${escapeHtml(message)}</span>
    </article>
  `;
}

function resetAnswerArea(message) {
  els.answerSelect.innerHTML = '<option value="" style="text-align-last: center">------------------</option>';
  els.answerSelect.disabled = true;
  els.submitBtn.disabled = true;
  setFeedback(message, 'loading');
}

function enterStartScreen(message) {
  clearTimeout(state.nextTimer);
  state.currentIndex = -1;
  state.currentQuestion = null;
  state.revealedGroups = 0;
  state.answered = 0;
  state.correct = 0;
  state.locked = true;
  state.hasStarted = false;
  state.results = [];
  setTheme('light');
  renderIdleHints('スカウトできるキャラクターのヒントが表示されます。最大5回までヒントをもらうことができますよ。');
  resetAnswerArea(message);
  els.addHintBtn.disabled = true;
  els.startBtn.disabled = state.quizData.length === 0;
  updateStats();
  renderResults();
}

function renderResults() {
  els.resultCount.textContent = `スカウト成功：${state.correct} 人`;

  if (state.results.length === 0) {
    els.resultList.innerHTML = `
      <article class="result-item idle">
        <div>
          <p class="result-name">まだ仲間はいません</p>
          <p class="result-meta">スカウトに挑戦するとここに結果が表示されます。</p>
        </div>
      </article>
    `;
    return;
  }

  els.resultList.innerHTML = state.results.map((result) => `
    <article class="result-item">
      <div>
        <p class="result-name">${escapeHtml(result.answerName)}</p>
      </div>
      <span class="result-badge ${result.isCorrect ? 'correct' : 'incorrect'}">${result.isCorrect ? '成功' : '失敗'}</span>
    </article>
  `).join('');
}

function flattenHints(question, groupCount) {
  return question.hintGroups.slice(0, groupCount).flat();
}

function renderHints() {
  const hints = flattenHints(state.currentQuestion, state.revealedGroups);
  els.hintList.innerHTML = hints.map((hint) => `
    <article class="hint-card">
      <span class="hint-label">${escapeHtml(hint.label)}</span>
      <span class="hint-value">${escapeHtml(hint.value)}</span>
    </article>
  `).join('');
  els.addHintBtn.disabled = state.locked || state.revealedGroups >= getHintTotal();
  updateStats();
}

function buildChoices(question) {
  const rivals = question.rivalKeys.filter((key) => key !== question.answerKey);
  return shuffle([question.answerKey, ...sample(rivals, 3)]);
}

function renderChoices() {
  const choices = buildChoices(state.currentQuestion);
  els.answerSelect.innerHTML = '<option value="">キャラクター名を選択してください</option>' + choices.map((key) => `
    <option value="${key}">${escapeHtml(state.nameMap[key] || key)}</option>
  `).join('');
  els.answerSelect.disabled = false;
  els.submitBtn.disabled = false;
}

function triggerConfetti() {
  const colors = ['#ff8a5b', '#65c2b8', '#f6c667', '#ff6f91', '#9d7bf6'];
  for (let i = 0; i < 48; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--x-end', `${(Math.random() - 0.5) * 220}px`);
    piece.style.animationDuration = `${2.3 + Math.random() * 1.6}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    els.confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function applyQuestionTheme(question) {
  setTheme(question?.theme === 'dark' ? 'dark' : 'light');
}

function finishSession() {
  state.currentQuestion = null;
  state.locked = true;
  els.hintList.innerHTML = `
    <article class="hint-card">
      <span class="hint-label">Scout Complete!</span>
      <span class="hint-value">${SESSION_QUESTION_COUNT}枚のレターをすべて使い切りました。</span>
    </article>
  `;
  els.answerSelect.innerHTML = '<option value="" style="text-align-last: center">------------------</option>';
  els.answerSelect.disabled = true;
  els.submitBtn.disabled = true;
  els.addHintBtn.disabled = true;
  setFeedback('スカウト完了です。もう一度挑戦するときは「もう一度やり直す」をクリックしてください。', 'done', true);
  updateStats();
}

function nextQuestion() {
  clearTimeout(state.nextTimer);
  state.currentIndex += 1;
  if (state.currentIndex >= state.sessionOrder.length) {
    finishSession();
    return;
  }

  state.currentQuestion = state.quizData[state.sessionOrder[state.currentIndex]];
  state.revealedGroups = 1;
  state.locked = false;
  applyQuestionTheme(state.currentQuestion);
  renderHints();
  renderChoices();
  setFeedback('ヒントを参考に、4人の中からスカウトするキャラクターを選んでください。', 'loading');
  updateStats();
  if (state.currentIndex === 0) {
    scrollToHintsPanel();
  }
}

function startSession() {
  if (state.quizData.length === 0 || state.hasStarted) return;
  clearTimeout(state.nextTimer);
  state.hasStarted = true;
  state.sessionOrder = shuffle(state.quizData.map((_, index) => index)).slice(0, Math.min(state.quizData.length, SESSION_QUESTION_COUNT));
  state.currentIndex = -1;
  state.currentQuestion = null;
  state.revealedGroups = 0;
  state.answered = 0;
  state.correct = 0;
  state.results = [];
  state.locked = true;
  els.startBtn.disabled = true;
  renderResults();
  updateStats();
  nextQuestion();
}

function addHint() {
  if (state.locked || !state.currentQuestion || state.revealedGroups >= getHintTotal()) return;
  state.revealedGroups += 1;
  renderHints();
}

function scheduleNext(delayMs) {
  clearTimeout(state.nextTimer);
  state.nextTimer = setTimeout(nextQuestion, delayMs);
}

function submitAnswer() {
  if (state.locked || !state.currentQuestion) return;

  const selected = els.answerSelect.value;
  if (!selected) {
    setFeedback('回答前にキャラクター名を選択してください。', 'error');
    return;
  }

  state.locked = true;
  state.answered += 1;
  const answerName = state.nameMap[state.currentQuestion.answerKey] || state.currentQuestion.answerKey;
  const isCorrect = selected === state.currentQuestion.answerKey;

  els.addHintBtn.disabled = true;
  els.answerSelect.disabled = true;
  els.submitBtn.disabled = true;

  if (isCorrect) {
    state.correct += 1;
    setFeedback(`正解です！ ${answerName}をスカウトに成功しました。`, 'success', true);
    triggerConfetti();
  } else {
    setFeedback(`残念！ 不正解です。正解は ${answerName} でした。`, 'error', true);
  }

  state.results.unshift({
    answerName,
    isCorrect,
    //message: isCorrect ? 'ユーザー回答: 正解' : 'ユーザー回答: 不正解'
  });
  renderResults();
  updateStats();
  scheduleNext(isCorrect ? 1350 : 1750);
}

async function loadQuizData() {
  setFeedback('データを読み込んでいます。', 'loading');
  const response = await fetch('./assets/quiz-data.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  state.quizData = data.characters;
  state.nameMap = data.nameMap;
}

function bindEvents() {
  els.addHintBtn.addEventListener('click', addHint);
  els.submitBtn.addEventListener('click', submitAnswer);
  els.startBtn.addEventListener('click', startSession);
  els.restartBtn.addEventListener('click', () => {
    enterStartScreen('スカウト開始画面に戻りました。「スカウトを始める」をクリックしてください。');
  });
  els.helpBtn.addEventListener('click', openHelpModal);
  els.closeHelpBtn.addEventListener('click', closeHelpModal);
  els.helpModal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal === 'true') {
      closeHelpModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.helpModal.classList.contains('is-open')) {
      closeHelpModal();
    }
  });
}

async function init() {
  setTheme('light');
  bindEvents();
  renderResults();
  enterStartScreen();

  try {
    await loadQuizData();
    enterStartScreen('スカウトを始めると4人の候補者を読み込みます。');
  } catch (error) {
    console.error(error);
    els.startBtn.disabled = true;
    els.addHintBtn.disabled = true;
    els.answerSelect.innerHTML = '<option value="">読み込み失敗</option>';
    els.answerSelect.disabled = true;
    els.submitBtn.disabled = true;
    setFeedback('データの読み込みに失敗しました。ファイル配置を確認してください。', 'error');
  }
}

init();
