// TwoStepQuestion ― 答え＋理由の2段階選択（出題・称号・報酬 実装計画書 3.1）
// クエスト・ダンジョン・ボスで共通に使う。
//
//   答え 正 ／ 理由 正 → クリア
//   答え 正 ／ 理由 誤 →「どうして そう おもったのかな？」と うながし、理由だけ えらびなおす
//   答え 誤           → まちがえた選択肢に合ったヒントを出し、答えから えらびなおす
//
// 答え・理由の選択肢の並びは、毎回入れかえる（位置で覚えないように）。

import { shuffle } from './questions.js';

/**
 * @param box   ボタンを並べる場所（要素）
 * @param q     { choices, answer, hints?, hint?, reasons, reasonAnswer, reasonHints? }
 * @param o     { H(markup)→html, say(text, cls), talk(text), onStep({stage, correct, tries}), onDone({tries}) }
 *              onStep が false を返したら そこで止める（ボス戦で たおれたときなど）
 */
export function runTwoStep(box, q, o){
  const order  = shuffle(q.choices.map((_, i) => i));
  const rOrder = shuffle(q.reasons.map((_, i) => i));
  let aTries = 0, rTries = 0;

  function header(num, text){
    const h = document.createElement('div');
    h.className = 'tsHead';
    h.innerHTML = `<span class="tsNum">${num}</span>${o.H(text)}`;
    return h;
  }

  function answerStage(){
    box.className = 'encAns choices';
    box.innerHTML = '';
    box.append(header('①', 'こたえを えらぼう'));
    for (const i of order){
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = o.H(q.choices[i]);
      b.addEventListener('click', () => {
        aTries++;
        const ok = i === q.answer;
        if (o.onStep?.({ stage: 'answer', correct: ok, tries: aTries }) === false) return;
        if (ok){
          o.say('そうだね！ では、どうして そう いえるかな？', 'ok');
          o.talk('そうだね。では、どうして そう いえるかな');
          reasonStage();
        } else {
          const hint = q.hints?.[i] ?? q.hint ?? 'もう いちど かんがえてみよう。';
          o.say('ヒント：' + hint, 'ng');
          o.talk(hint);
          b.disabled = true;
        }
      });
      box.append(b);
    }
  }

  function reasonStage(){
    box.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'tsChosen';
    chip.innerHTML = `<span class="tsNum">①</span>${o.H(q.choices[q.answer])} <b>✓</b>`;
    box.append(chip, header('②', 'りゆうを えらぼう'));
    for (const i of rOrder){
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = o.H(q.reasons[i]);
      b.addEventListener('click', () => {
        rTries++;
        const ok = i === q.reasonAnswer;
        if (o.onStep?.({ stage: 'reason', correct: ok, tries: rTries }) === false) return;
        if (ok){
          box.innerHTML = '';
          o.onDone?.({ tries: aTries + rTries, answerTries: aTries, reasonTries: rTries });
        } else {
          const hint = q.reasonHints?.[i];
          o.say('どうして そう おもったのかな？' + (hint ? '　' + hint : ''), 'ng');
          o.talk('どうして そう おもったのかな。' + (hint || ''));
          b.disabled = true;
        }
      });
      box.append(b);
    }
  }

  answerStage();
}
