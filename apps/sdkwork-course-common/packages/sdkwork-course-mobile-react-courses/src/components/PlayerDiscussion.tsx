import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Quote, Send, Smile, X } from "lucide-react";
import { CourseService, CourseDiscussion } from "../services/CourseService";
import { showToast } from "@sdkwork/ui-mobile-react";

export interface PlayerDiscussionProps {
  courseId: string;
  lessonId?: string;
}

const EMOJIS = ["👍", "👏", "🎉", "❤️", "🔥", "💡", "📚", "✅", "🙏", "😊", "😂", "🤔"];

interface Target {
  comment: CourseDiscussion;
  mode: "reply" | "quote";
}

export const PlayerDiscussion: React.FC<PlayerDiscussionProps> = ({ courseId, lessonId }) => {
  const { t } = useTranslation();
  const [discussions, setDiscussions] = useState<CourseDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadDiscussions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await CourseService.getCourseDiscussions(courseId, lessonId);
      setDiscussions([...data]);
      setLoadFailed(false);
    } catch (error) {
      console.error("Failed to fetch discussions", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    void loadDiscussions();
  }, [loadDiscussions]);

  const roots = useMemo(
    () => discussions.filter((item) => !item.parentId),
    [discussions],
  );
  const repliesByRoot = useMemo(() => {
    const map = new Map<string, CourseDiscussion[]>();
    for (const item of discussions) {
      if (!item.parentId) continue;
      const key = item.rootId || item.parentId;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [discussions]);

  const selectTarget = (comment: CourseDiscussion, mode: "reply" | "quote") => {
    setTarget({ comment, mode });
    setEmojiOpen(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const content = inputVal.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const parentId = target
        ? target.comment.parentId
          ? target.comment.rootId || target.comment.parentId
          : target.comment.id
        : undefined;
      const quoteId =
        target && (target.mode === "quote" || Boolean(target.comment.parentId))
          ? target.comment.id
          : undefined;
      await CourseService.postDiscussion(courseId, lessonId, content, {
        parentId,
        quoteId,
      });
      setInputVal("");
      setTarget(null);
      await loadDiscussions();
    } catch (e) {
      showToast(t("course.sendFailed", "发送失败，请重试"));
    } finally {
      setSubmitting(false);
    }
  };

  const targetLabel = target
    ? target.mode === "quote"
      ? `引用 @${target.comment.user.name}`
      : `回复 @${target.comment.user.name}`
    : "";

  return (
    <div className="relative flex min-h-full flex-col bg-white dark:bg-[#1C1C1E]">
      <div className="flex-1 p-4 pb-24" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center p-8 text-[14px] text-text-sub">
            {t("course.loading", "加载中...")}
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8">
            <p className="text-[14px] text-text-sub">
              {t("course.loadFailed", "加载失败，请重试")}
            </p>
            <button
              onClick={() => void loadDiscussions()}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-[12px] text-white active:bg-blue-700"
            >
              {t("course.retry", "重试")}
            </button>
          </div>
        ) : roots.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-[14px] text-text-sub">
            {t("course.auto_45d0d76", "暂无讨论，来抢沙发吧")}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 px-1 pb-3 text-[12px] text-text-sub">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>
                {t("course.discussionCount", "共 {{count}} 条讨论", {
                  count: discussions.length,
                })}
              </span>
            </div>
            <div className="flex flex-col gap-5">
              {roots.map((item) => {
                const replies = repliesByRoot.get(item.id) ?? [];
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                      {item.user.avatar ? (
                        <img
                          src={item.user.avatar}
                          className="h-8 w-8 rounded-full object-cover"
                          alt=""
                        />
                      ) : (
                        item.user.name.slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-black/5 pb-4 dark:border-white/5">
                      <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-text-sub">
                        {item.user.name}
                        <span className="text-[11px] font-normal text-text-sub/70">
                          {item.time}
                        </span>
                      </div>
                      {item.quote ? (
                        <div className="mb-2 rounded-lg bg-[#F2F2F7] px-3 py-2 text-[12px] leading-relaxed text-text-sub dark:bg-[#2A2A2D]">
                          <span className="font-medium">{item.quote.author}：</span>
                          {item.quote.content}
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-text-main">
                        {item.content}
                      </div>

                      {replies.length > 0 ? (
                        <div className="mt-3 space-y-3 border-l-2 border-black/5 pl-3 dark:border-white/10">
                          {replies.map((reply) => (
                            <div key={reply.id}>
                              <div className="flex items-center gap-1.5 text-[12px]">
                                <span className="font-medium text-text-sub">
                                  {reply.user.name}
                                </span>
                                <span className="text-[11px] text-text-sub/70">
                                  {reply.time}
                                </span>
                              </div>
                              {reply.quote ? (
                                <div className="mt-1 rounded-lg bg-[#F2F2F7] px-2.5 py-1.5 text-[12px] leading-relaxed text-text-sub dark:bg-[#2A2A2D]">
                                  <span className="font-medium">
                                    {reply.quote.author}：
                                  </span>
                                  {reply.quote.content}
                                </div>
                              ) : null}
                              <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-main">
                                {reply.content}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[11px] text-text-sub">
                                <button
                                  onClick={() => selectTarget(reply, "reply")}
                                >
                                  回复
                                </button>
                                <button
                                  onClick={() => selectTarget(reply, "quote")}
                                >
                                  引用
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-text-sub">
                        <button
                          className="flex items-center gap-1"
                          onClick={() => selectTarget(item, "reply")}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {t("course.auto_addef", "回复")}
                        </button>
                        <button
                          className="flex items-center gap-1"
                          onClick={() => selectTarget(item, "quote")}
                        >
                          <Quote className="h-3.5 w-3.5" />
                          引用
                        </button>
                        {replies.length > 0 ? (
                          <span className="ml-auto">{replies.length} 条回复</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-black/5 bg-white p-3 pb-safe dark:border-white/5 dark:bg-[#1C1C1E]">
        {target ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[12px] text-blue-600 dark:bg-blue-950/40">
            <span className="shrink-0 font-medium">{targetLabel}</span>
            <span className="min-w-0 flex-1 truncate text-blue-500/80">
              {target.comment.content}
            </span>
            <button onClick={() => setTarget(null)} aria-label="取消">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="mb-2 flex flex-wrap gap-1 rounded-xl bg-[#F2F2F7] p-2 dark:bg-[#2A2A2D]">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInputVal((value) => `${value}${emoji}`);
                  setEmojiOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg active:bg-black/5"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEmojiOpen((value) => !value)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-sub active:bg-black/5"
            aria-label="表情"
          >
            <Smile className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#F2F2F7] px-4 py-2 dark:bg-[#2A2A2D]">
            <input
              className="h-6 flex-1 border-none bg-transparent text-[14px] text-text-main outline-none placeholder:text-text-sub"
              placeholder={
                target ? targetLabel : t("course.auto_prop_n22e56ef0", "参与讨论...")
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
            {inputVal.trim() ? (
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white active:scale-95 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
