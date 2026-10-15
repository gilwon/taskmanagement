"use client";
// 디자인 시스템 견본 중 상호작용이 필요한 컴포넌트(입력·선택·탭·툴팁·메뉴·대화상자) 모음
import { useState } from "react";
import { Copy, Info, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ShowcaseGroup, ShowcaseSection } from "@/components/help/showcase-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_LABELS, TASK_STATUS_LABELS } from "@/lib/i18n/labels";

const row = "flex flex-wrap items-center gap-(--s-4)";
const field = "grid w-full max-w-xs gap-1.5";
const VIEWS = ["board", "list", "table"] as const;

export function SystemDemos() {
  const [view, setView] = useState<string>("board");
  return (
    <>
      <ShowcaseSection id="sys-input" title="입력">
        <div className="flex flex-wrap gap-(--s-4)">
          <div className={field}>
            <Label htmlFor="sys-input-default">이름</Label>
            <Input id="sys-input-default" placeholder="예: 홈페이지 개편" />
          </div>
          <div className={field}>
            <Label htmlFor="sys-input-disabled">비활성</Label>
            <Input id="sys-input-disabled" disabled defaultValue="수정할 수 없음" />
          </div>
          <div className={field}>
            <Label htmlFor="sys-input-error">오류</Label>
            <Input id="sys-input-error" aria-invalid aria-describedby="sys-input-error-msg" defaultValue="" placeholder="이메일 주소" />
            <p id="sys-input-error-msg" className="text-(length:--fs-sm) text-(--red)">
              이메일 주소를 입력해 주세요.
            </p>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="sys-choice" title="선택">
        <ShowcaseGroup title="체크박스·스위치">
          <div className={row}>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-on" defaultChecked />
              <Label htmlFor="sys-check-on">완료한 작업 보기</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-off" />
              <Label htmlFor="sys-check-off">하위 작업 포함</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-disabled" disabled />
              <Label htmlFor="sys-check-disabled">비활성</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sys-switch" defaultChecked />
              <Label htmlFor="sys-switch">이메일 알림</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sys-switch-sm" size="sm" />
              <Label htmlFor="sys-switch-sm">작은 스위치</Label>
            </div>
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="셀렉트">
          <Select defaultValue="todo">
            <SelectTrigger aria-label="상태" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ShowcaseGroup>
        <ShowcaseGroup title="토글 그룹">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={view}
            aria-label="보기 방식"
            onValueChange={(v) => v && setView(v)}
          >
            {VIEWS.map((v) => (
              <ToggleGroupItem key={v} value={v} className="px-3">
                {NAV_LABELS[v]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="sys-tabs" title="탭">
        <Tabs defaultValue="comments" className="max-w-md">
          <TabsList>
            <TabsTrigger value="comments">댓글</TabsTrigger>
            <TabsTrigger value="activity">활동</TabsTrigger>
            <TabsTrigger value="files">파일</TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="text-(length:--fs-base) text-(--text-2)">
            댓글 탭 내용입니다.
          </TabsContent>
          <TabsContent value="activity" className="text-(length:--fs-base) text-(--text-2)">
            활동 탭 내용입니다.
          </TabsContent>
          <TabsContent value="files" className="text-(length:--fs-base) text-(--text-2)">
            파일 탭 내용입니다.
          </TabsContent>
        </Tabs>
      </ShowcaseSection>

      <ShowcaseSection id="sys-overlay" title="툴팁·메뉴·대화상자">
        <div className={row}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="도움말">
                <Info aria-hidden strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>마우스를 올리거나 포커스하면 보입니다</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="작업 메뉴">
                <MoreHorizontal aria-hidden strokeWidth={1.8} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Pencil aria-hidden strokeWidth={1.8} /> 편집
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy aria-hidden strokeWidth={1.8} /> 복제
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 aria-hidden strokeWidth={1.8} /> 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">대화상자 열기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>변경 사항을 저장할까요?</DialogTitle>
                <DialogDescription>저장하지 않고 닫으면 입력한 내용이 사라집니다.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">취소</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>저장</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ShowcaseSection>
    </>
  );
}
