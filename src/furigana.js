// ふりがな記法 {漢字|よみ} の表示と、読み上げ。
// 問題データもセリフも、すべてこの記法で書く。

const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;

function esc(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

/** 画面に出す HTML。showRuby が false なら漢字だけ。 */
export function toHTML(text, showRuby){
  if (text == null) return '';
  let out = '', last = 0, m;
  RUBY.lastIndex = 0;
  while ((m = RUBY.exec(text)) !== null){
    out += esc(text.slice(last, m.index));
    out += showRuby
      ? `<ruby>${esc(m[1])}<rt>${esc(m[2])}</rt></ruby>`
      : esc(m[1]);
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

/** 読み上げに渡す文字列（漢字を「よみ」に置きかえる） */
export function toSpeech(text){
  return String(text ?? '').replace(RUBY, (_, kanji, yomi) => yomi);
}

/** 記録などに使う、記号をとった文字列 */
export function toPlain(text){
  return String(text ?? '').replace(RUBY, (_, kanji) => kanji);
}

/** 学年からふりがなの初期設定を決める（1〜3年は出す） */
export function defaultFurigana(grade){
  return grade <= 3;
}

// ---- 読み上げ ------------------------------------------------------------

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let jaVoice = null;

function pickVoice(){
  if (!synth) return null;
  const all = synth.getVoices();
  if (!all.length) return null;
  // 日本語の声をえらぶ。複数あれば最初のもの。
  return all.find(v => /^ja/i.test(v.lang)) || null;
}

if (synth){
  jaVoice = pickVoice();
  synth.addEventListener?.('voiceschanged', () => { jaVoice = pickVoice(); });
}

export function canSpeak(){
  return !!synth;
}

export function speak(text, grade = 5){
  if (!synth) return false;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(toSpeech(text));
    u.lang  = 'ja-JP';
    u.rate  = grade <= 2 ? 0.82 : (grade <= 4 ? 0.9 : 0.98);
    u.pitch = 1.05;
    if (!jaVoice) jaVoice = pickVoice();
    if (jaVoice) u.voice = jaVoice;
    synth.speak(u);
    return true;
  } catch (e){
    return false;
  }
}

export function stopSpeak(){
  try { synth?.cancel(); } catch (e){}
}
