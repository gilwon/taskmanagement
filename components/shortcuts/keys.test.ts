// 전역 단축키 판정(입력 중·IME 조합 중·대화상자 포커스 무시, 한글 자판 물리 키)을 고정한다
import { describe, expect, it } from "vitest";
import { isComposingKey, isPlainKey, isTypingTarget, matchGoTarget, matchShortcut, type KeyLike } from "@/components/shortcuts/keys";

const k = (p: Partial<KeyLike>): KeyLike => ({
  key: "",
  code: "",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...p,
});
const idle = { typing: false, overlay: false };

describe("matchShortcut", () => {
  it("⌘K·Ctrl+K는 팔레트, ⌘⇧L은 테마. 입력 중에도 동작한다", () => {
    expect(matchShortcut(k({ key: "k", code: "KeyK", metaKey: true }), idle)).toBe("palette");
    expect(matchShortcut(k({ key: "k", code: "KeyK", ctrlKey: true }), { typing: true, overlay: true })).toBe("palette");
    expect(matchShortcut(k({ key: "L", code: "KeyL", metaKey: true, shiftKey: true }), { typing: true, overlay: false })).toBe("theme");
    expect(matchShortcut(k({ key: "l", code: "KeyL", metaKey: true }), idle)).toBeNull();
  });

  it("한 글자 단축키", () => {
    expect(matchShortcut(k({ key: "n", code: "KeyN" }), idle)).toBe("newTask");
    expect(matchShortcut(k({ key: "p", code: "KeyP" }), idle)).toBe("newProject");
    expect(matchShortcut(k({ key: "/", code: "Slash" }), idle)).toBe("search");
    expect(matchShortcut(k({ key: "?", code: "Slash", shiftKey: true }), idle)).toBe("help");
    expect(matchShortcut(k({ key: "[", code: "BracketLeft" }), idle)).toBe("sidebar");
    expect(matchShortcut(k({ key: "g", code: "KeyG" }), idle)).toBe("go");
  });

  it("한글 자판이면 e.key가 달라도 물리 키로 맞춘다", () => {
    expect(matchShortcut(k({ key: "ㅜ", code: "KeyN" }), idle)).toBe("newTask");
    expect(matchShortcut(k({ key: "ㅎ", code: "KeyG" }), idle)).toBe("go");
  });

  it("입력 중·대화상자·메뉴 안에서는 한 글자 단축키를 무시한다", () => {
    expect(matchShortcut(k({ key: "n", code: "KeyN" }), { typing: true, overlay: false })).toBeNull();
    expect(matchShortcut(k({ key: "?", code: "Slash", shiftKey: true }), { typing: false, overlay: true })).toBeNull();
  });

  it("IME 조합 중(isComposing·keyCode 229)이면 모두 무시한다", () => {
    expect(matchShortcut(k({ key: "n", code: "KeyN", isComposing: true }), idle)).toBeNull();
    expect(matchShortcut(k({ key: "Process", code: "KeyN", keyCode: 229 }), idle)).toBeNull();
    expect(matchShortcut(k({ key: "k", code: "KeyK", metaKey: true, isComposing: true }), idle)).toBeNull();
    expect(isComposingKey(k({ keyCode: 229 }))).toBe(true);
  });

  it("다른 조합 키가 붙으면 한 글자 단축키가 아니다", () => {
    expect(matchShortcut(k({ key: "n", code: "KeyN", metaKey: true }), idle)).toBeNull();
    expect(matchShortcut(k({ key: "n", code: "KeyN", altKey: true }), idle)).toBeNull();
    expect(matchShortcut(k({ key: "N", code: "KeyN", shiftKey: true }), idle)).toBeNull();
  });
});

describe("matchGoTarget", () => {
  it("g 다음 키", () => {
    expect(matchGoTarget(k({ key: "h", code: "KeyH" }))).toBe("KeyH");
    expect(matchGoTarget(k({ key: "ㅅ", code: "KeyT" }))).toBe("KeyT");
    expect(matchGoTarget(k({ key: "x", code: "KeyX" }))).toBeNull();
    expect(matchGoTarget(k({ key: "h", code: "KeyH", shiftKey: true }))).toBeNull();
    expect(matchGoTarget(k({ key: "h", code: "KeyH", isComposing: true }))).toBeNull();
  });
});

describe("isPlainKey", () => {
  it("한글 자판에서도 물리 키로 맞추고 조합 중·조합 키는 무시한다", () => {
    expect(isPlainKey(k({ key: "e", code: "KeyE" }), "KeyE")).toBe(true);
    expect(isPlainKey(k({ key: "ㄷ", code: "KeyE" }), "KeyE")).toBe(true);
    expect(isPlainKey(k({ key: "Process", code: "KeyE", keyCode: 229 }), "KeyE")).toBe(false);
    expect(isPlainKey(k({ key: "ㄷ", code: "KeyE", isComposing: true }), "KeyE")).toBe(false);
    expect(isPlainKey(k({ key: "e", code: "KeyE", metaKey: true }), "KeyE")).toBe(false);
    expect(isPlainKey(k({ key: "E", code: "KeyE", shiftKey: true }), "KeyE")).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it("글자 입력 요소만 입력으로 본다", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingTarget({ tagName: "input", type: "search" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
