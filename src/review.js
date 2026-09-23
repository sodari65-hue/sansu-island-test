// ゲームとNode用のESモジュール。check.html は file:// でも使えるよう共通本体をclassic scriptで読む。
import './review-core.js';
export const { plain, normalize, contentHash, isChecked, reviewState, reviewItems, parseReview, auditItems } = globalThis.SansuReview;
