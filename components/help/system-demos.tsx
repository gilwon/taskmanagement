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
import { useT } from "@/lib/i18n/client";
import { TASK_STATUS_LABELS } from "@/lib/i18n/labels";
import type { TaskStatus } from "@/lib/tasks/types";

const row = "flex flex-wrap items-center gap-(--s-4)";
const field = "grid w-full max-w-xs gap-1.5";
const VIEWS = ["board", "list", "table"] as const;

export function SystemDemos() {
  const t = useT();
  const [view, setView] = useState<string>("board");
  return (
    <>
      <ShowcaseSection id="sys-input" title={t("help.system.input")}>
        <div className="flex flex-wrap gap-(--s-4)">
          <div className={field}>
            <Label htmlFor="sys-input-default">{t("help.system.name")}</Label>
            <Input id="sys-input-default" placeholder={t("help.system.namePlaceholder")} />
          </div>
          <div className={field}>
            <Label htmlFor="sys-input-disabled">{t("help.system.disabled")}</Label>
            <Input id="sys-input-disabled" disabled defaultValue={t("help.system.readonlyValue")} />
          </div>
          <div className={field}>
            <Label htmlFor="sys-input-error">{t("help.system.error")}</Label>
            <Input id="sys-input-error" aria-invalid aria-describedby="sys-input-error-msg" defaultValue="" placeholder={t("help.system.emailPlaceholder")} />
            <p id="sys-input-error-msg" className="text-(length:--fs-sm) text-(--red)">
              {t("help.states.emailRequired")}
            </p>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="sys-choice" title={t("help.system.choice")}>
        <ShowcaseGroup title={t("help.system.checkSwitch")}>
          <div className={row}>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-on" defaultChecked />
              <Label htmlFor="sys-check-on">{t("help.system.showDone")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-off" />
              <Label htmlFor="sys-check-off">{t("help.system.includeSubtasks")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sys-check-disabled" disabled />
              <Label htmlFor="sys-check-disabled">{t("help.system.disabled")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sys-switch" defaultChecked />
              <Label htmlFor="sys-switch">{t("help.system.emailNotifications")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sys-switch-sm" size="sm" />
              <Label htmlFor="sys-switch-sm">{t("help.system.smallSwitch")}</Label>
            </div>
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title={t("help.system.select")}>
          <Select defaultValue="todo">
            <SelectTrigger aria-label={t("help.system.status")} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`common.taskStatus.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ShowcaseGroup>
        <ShowcaseGroup title={t("help.system.toggleGroup")}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={view}
            aria-label={t("help.system.viewMode")}
            onValueChange={(v) => v && setView(v)}
          >
            {VIEWS.map((v) => (
              <ToggleGroupItem key={v} value={v} className="px-3">
                {t(`common.nav.${v}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="sys-tabs" title={t("help.system.tabs")}>
        <Tabs defaultValue="comments" className="max-w-md">
          <TabsList>
            <TabsTrigger value="comments">{t("common.detailTab.comments")}</TabsTrigger>
            <TabsTrigger value="activity">{t("common.detailTab.activity")}</TabsTrigger>
            <TabsTrigger value="files">{t("common.detailTab.files")}</TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="text-(length:--fs-base) text-(--text-2)">
            {t("help.system.tabContent.comments")}
          </TabsContent>
          <TabsContent value="activity" className="text-(length:--fs-base) text-(--text-2)">
            {t("help.system.tabContent.activity")}
          </TabsContent>
          <TabsContent value="files" className="text-(length:--fs-base) text-(--text-2)">
            {t("help.system.tabContent.files")}
          </TabsContent>
        </Tabs>
      </ShowcaseSection>

      <ShowcaseSection id="sys-overlay" title={t("help.system.overlays")}>
        <div className={row}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("help.system.help")}>
                <Info aria-hidden strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("help.system.tooltip")}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("help.system.taskMenu")}>
                <MoreHorizontal aria-hidden strokeWidth={1.8} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Pencil aria-hidden strokeWidth={1.8} /> {t("help.system.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy aria-hidden strokeWidth={1.8} /> {t("help.system.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 aria-hidden strokeWidth={1.8} /> {t("help.system.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t("help.system.openDialog")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("help.system.dialogTitle")}</DialogTitle>
                <DialogDescription>{t("help.system.dialogDescription")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("common.action.cancel")}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>{t("common.action.save")}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ShowcaseSection>
    </>
  );
}
