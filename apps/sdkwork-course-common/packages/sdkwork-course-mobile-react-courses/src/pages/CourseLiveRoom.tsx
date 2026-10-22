import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  CourseService,
  CourseCapabilityUnavailableError,
  type CourseLiveSessionUI,
} from "../services/CourseService";
import { showToast } from "@sdkwork/ui-mobile-react";
import { CourseUnavailableView } from "./CourseUnavailableView";

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function CourseLiveRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [session, setSession] = useState<CourseLiveSessionUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadSession = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const detail = await CourseService.getLiveSessionDetail(id);
      setSession(detail);
    } catch (error) {
      if (error instanceof CourseCapabilityUnavailableError) {
        setUnavailable(true);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  if (unavailable) {
    return (
      <CourseUnavailableView
        message={t("course.unavailable")}
        onBack={() => navigate(-1)}
        />
    );
  }

  if (loadFailed) {
    return (
      <CourseUnavailableView
        message={t("course.loadLiveFailed", "加载直播详情失败")}
        onBack={() => navigate(-1)}
        onRetry={() => void loadSession()}
        />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-text-sub text-[13px]">
          {t("course.loading", "加载中...")}
        </span>
      </div>
    );
  }

  if (!session) {
    return (
      <CourseUnavailableView
        message={t("course.noContent", "未找到直播")}
        onBack={() => navigate(-1)}
        />
    );
  }

  const isLive = session.liveStatus === "live";
  const isScheduled = session.liveStatus === "scheduled";
  const isEnded = session.liveStatus === "ended";

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!joined || !session) return undefined;
    const sessionId = session.id;
    const timer = window.setInterval(() => {
      void CourseService.heartbeatLiveSession(sessionId).catch(() => undefined);
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      void CourseService.leaveLiveSession(sessionId).catch(() => undefined);
    };
  }, [joined, session]);

  const handleAction = async () => {
    if (isLive) {
      // Live session join flow: registers attendance on the course service;
      // playback media is owned by the live provider, so the UI confirms the
      // join and keeps the heartbeat responsibility on the host.
      if (joining || joined) return;
      setJoining(true);
      try {
        await CourseService.joinLiveSession(session.id);
        setJoined(true);
        showToast(t("course.joinSuccess", "已加入直播"));
      } catch (error) {
        if (error instanceof CourseCapabilityUnavailableError) {
          setUnavailable(true);
        } else {
          showToast(t("course.joinFailed", "加入直播失败，请稍后再试"));
        }
      } finally {
        setJoining(false);
      }
      return;
    }
    showToast(
      isScheduled
        ? t("course.liveNotStarted", "直播尚未开始")
        : t("course.liveEnded", "直播已结束"),
    );
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black flex flex-col">
      <div className="bg-black">
        <div className="aspect-video flex items-center justify-center">
          {isLive ? (
            <div className="text-white text-center">
              <div className="text-5xl mb-3 animate-pulse text-red-500">LIVE</div>
              <p className="text-[14px]">{t("course.liveNow", "正在直播中")}</p>
            </div>
          ) : isScheduled ? (
            <div className="text-white text-center">
              <div className="text-5xl mb-3">⏱</div>
              <p className="text-[14px]">{t("course.liveUpcoming", "预告")}</p>
              <p className="text-[12px] text-gray-400 mt-1">
                {formatTime(session.scheduledStartAt)}
              </p>
            </div>
          ) : (
            <div className="text-white text-center">
              <div className="text-5xl mb-3">📷</div>
              <p className="text-[14px]">{t("course.liveEnded", "已结束")}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-[13px] text-text-sub">
          ←
        </button>
        <h1 className="text-[16px] font-bold text-text-main truncate flex-1">
          {session.title}
        </h1>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            isLive
              ? "bg-red-100 text-red-700 dark:bg-red-500/15"
              : isScheduled
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15"
                : "bg-gray-100 text-gray-600 dark:bg-white/10"
          }`}
        >
          {isLive
            ? t("course.liveNow", "正在直播中")
            : isScheduled
              ? t("course.liveUpcoming", "即将开始")
              : t("course.liveEnded", "已结束")}
        </span>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-[14px] text-text-main mb-2">
            {t("course.intro", "介绍")}
          </h2>
          <p className="text-[13px] text-text-sub leading-relaxed">
            {session.description || t("course.noDescription", "暂无详情描述")}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-[14px] text-text-main mb-3">
            {t("course.enrollNotice", "时间安排")}
          </h2>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-text-sub">{t("course.startTime", "开始时间")}</span>
              <span className="text-text-main">{formatTime(session.scheduledStartAt)}</span>
            </div>
            {session.scheduledEndAt && (
              <div className="flex justify-between">
                <span className="text-text-sub">{t("course.endTime", "结束时间")}</span>
                <span className="text-text-main">{formatTime(session.scheduledEndAt)}</span>
              </div>
            )}
            {session.actualStartAt && (
              <div className="flex justify-between">
                <span className="text-text-sub">{t("course.actualStart", "实际开始")}</span>
                <span className="text-text-main">{formatTime(session.actualStartAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] border-t border-black/5 dark:border-white/5 p-4">
        {isLive && (
          <button
            onClick={() => void handleAction()}
            disabled={joining || joined}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold active:bg-red-700 transition-colors disabled:opacity-50"
          >
            {joining
              ? t("course.joining", "加入中...")
              : joined
                ? t("course.joined", "已加入")
                : t("course.joinLive", "加入直播")}
          </button>
        )}
        {isScheduled && (
          <button
            onClick={() => void handleAction()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold active:bg-blue-700 transition-colors"
          >
            {t("course.remindLive", "预约提醒")}
          </button>
        )}
        {isEnded && (
          <button
            onClick={() => void handleAction()}
            className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold active:bg-gray-700 transition-colors"
          >
            {t("course.watchReplay", "查看回放")}
          </button>
        )}
      </div>
    </div>
  );
}
