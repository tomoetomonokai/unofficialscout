const SESSION_QUESTION_COUNT = 5;

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
  feedback: document.getElementById('feedback'),
  answeredCount: document.getElementById('answeredCount'),
  correctCount: document.getElementById('correctCount'),
  accuracyRate: document.getElementById('accuracyRate'),
  progressChip: document.getElementById('progressChip'),
  hintStep: document.getElementById('hintStep'),
  addHintBtn: document.getElementById('addHintBtn'),
  submitBtn: document.getElementById('submitBtn'),
  resultList: document.getElementById('resultList'),
  resultCount: document.getElementById('resultCount'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
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

function setFeedback(message, type = 'loading') {
  els.feedback.className = `feedback ${type}`.trim();
  els.feedback.textContent = message;
}

function updateStats() {
  const total = Math.min(state.quizData.length, SESSION_QUESTION_COUNT);
  const shown = state.hasStarted && total > 0 ? Math.min(state.currentIndex + 1, total) : 0;
  const accuracy = state.answered === 0 ? 0 : Math.round((state.correct / state.answered) * 1000) / 10;

  els.answeredCount.textContent = String(state.answered);
  els.correctCount.textContent = String(state.correct);
  els.accuracyRate.textContent = `${accuracy}%`;
  els.progressChip.textContent = state.hasStarted ? `スカウト ${shown} / ${total} 人目` : 'お姉さん待機中...';
  els.hintStep.textContent = `${state.revealedGroups} / 5`;
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
  els.answerSelect.innerHTML = '<option value="">スカウトレター使用前</option>';
  els.answerSelect.disabled = true;
  els.submitBtn.disabled = true;
  setFeedback(message, 'loading');
}

function enterStartScreen(message = 'スカウトを始めると最初の問題を読み込みます。') {
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
          <p class="result-name">まだ誰もいません</p>
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
      <span class="result-badge ${result.isCorrect ? 'correct' : 'incorrect'}">${result.isCorrect ? '正解' : '不正解'}</span>
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
  els.addHintBtn.disabled = state.locked || state.revealedGroups >= 5;
  updateStats();
}

function buildChoices(question) {
  const rivals = question.rivalKeys.filter((key) => key !== question.answerKey);
  return shuffle([question.answerKey, ...sample(rivals, 3)]);
}

function renderChoices() {
  const choices = buildChoices(state.currentQuestion);
  els.answerSelect.innerHTML = '<option value="">選択してください</option>' + choices.map((key) => `
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
      <span class="hint-label">Session complete</span>
      <span class="hint-value">5枚のレターををすべて使い切りました。</span>
    </article>
  `;
  els.answerSelect.innerHTML = '<option value="">スカウト完了</option>';
  els.answerSelect.disabled = true;
  els.submitBtn.disabled = true;
  els.addHintBtn.disabled = true;
  setFeedback('スカウト完了です。もう一度挑戦するときは「もう一度やり直す」をクリックしてください。', 'done');
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
  setFeedback('ヒントを見て、4人の中からスカウトするキャラクター名を選んでください。', 'loading');
  updateStats();
}

function startSession() {
  if (state.quizData.length === 0) return;
  clearTimeout(state.nextTimer);
  state.hasStarted = true;
  state.sessionOrder = shuffle(state.quizData.map((_, index) => index)).slice(0, Math.min(state.quizData.length, SESSION_QUESTION_COUNT));
  state.currentIndex = -1;
  state.currentQuestion = null;
  state.revealedGroups = 0;
  state.answered = 0;
  state.correct = 0;
  state.locked = true;
  nextQuestion();
}

function addHint() {
  if (state.locked || !state.currentQuestion || state.revealedGroups >= 5) return;
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
    setFeedback(`正解です！ ${answerName}をスカウトに成功しました。`, 'success');
    triggerConfetti();
  } else {
    setFeedback(`残念！ 不正解です。正解は ${answerName} でした。`, 'error');
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
}

async function init() {
  setTheme('light');
  bindEvents();
  renderResults();
  enterStartScreen();

  try {
    await loadQuizData();
    enterStartScreen('スカウトを始めると最初のヒントを読み込みます。');
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
