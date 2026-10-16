// 키보드 단축키 일본어 문구
import type { Messages } from "../types";

export default {
  title: "キーボードショートカット",
  dialogHint: "入力欄に入力中は、1キーのショートカットは使えません。",
  settingsHint: "カーソルがテキスト入力欄にある間は、1キーのショートカットは使えません。",
  then: "の次に",
  thenLabel: "{first} の次に {second}",
  group: {
    general: "全般",
    create: "作成",
    navigate: "移動",
    task: "タスク",
  },
  item: {
    palette: "コマンドパレットを開く/閉じる",
    search: "ワークスペースを検索",
    help: "キーボードショートカットを表示",
    theme: "ダークモードの切り替え",
    sidebar: "サイドバーの折りたたみ/展開",
    escape: "ポップオーバー・ダイアログ・ドロワーを閉じる、選択を解除",
    submit: "ダイアログを送信、コメントを送信",
    edit: "開いているタスクを編集 (ドロワー)",
    nextPrevTask: "次・前のタスクへ (ドロワー)",
    pickStatus: "ステータス選択でステータスを選ぶ",
    reorder: "リスト・ボードで並べ替え",
    moveColumn: "ボードの列間を移動",
    taskMenu: "タスクメニューを開く (コンテキストメニュー)",
    select: "リスト・ボードでタスクを選択",
  },
  copied: "{what}をコピーしました",
  copyFailed: "{what}をコピーできませんでした。",
} satisfies Messages["shortcuts"];
