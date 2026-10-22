import { useTranslation } from "react-i18next";
import React from "react";
import { Clock, Users } from "lucide-react";
import { formatMoney } from "@sdkwork/utils/money";
import { CourseData } from "../services/CourseService";

export interface CourseCardProps {
  course: CourseData;
  onClick?: () => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || "zh-CN";
return (
    <div 
      className="flex items-start gap-4 p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 select-none"
      onClick={onClick}
    >
       <div className="relative w-[130px] shrink-0 aspect-[4/3] rounded-xl overflow-hidden border border-black/5 dark:border-white/5 bg-gray-100 dark:bg-gray-800">
          {course.cover ? (
            <img
              src={course.cover}
              alt={course.title}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = "1";
                  target.className = "hidden";
                  target.nextElementSibling?.classList.remove("hidden");
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : null}
          <div
            className={`w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center ${
              course.cover ? "hidden" : ""
            }`}
          >
            {course.cover ? null : (
              <span className="text-white/95 text-2xl font-bold select-none">
                {course.title.trim().charAt(0) || "课"}
              </span>
            )}
          </div>
          {course.type === 'live' ? (
             <div className="absolute top-1.5 left-1.5 bg-red-500/95 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium shadow-sm">
               <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />{course.liveStatus === 'live' ? '正在直播' : '预告'}</div>
          ) : course.kind === 'column' || course.kind === 'collection' ? (
            <div className="absolute top-1.5 left-1.5 bg-indigo-600/95 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium shadow-sm">
              {course.kind === 'column' ? '专栏' : '合集'}
            </div>
          ) : null}
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-md text-white/90 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium">
            {course.type === 'recorded' ? <Clock className="w-3 h-3 opacity-80" /> : null}
            {course.duration}
          </div>
       </div>
       <div className="flex flex-col flex-1 min-w-0 min-h-[97px] justify-between py-0.5">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[15px] font-bold text-text-main line-clamp-2 leading-snug">{course.title}</h3>
            <div className="flex items-center text-[12px] text-text-sub gap-2">
              <span className="truncate max-w-[100px]">{course.author || course.instructor}</span>
              <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20 shrink-0" />
              <div className="flex items-center gap-1 shrink-0">
                 <Users className="w-3.5 h-3.5 opacity-70" />
                 <span>{course.students >= 10000 ? `${(course.students/10000).toFixed(1)}w` : course.students}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2 mt-2">
             {course.isPurchased ? (
                <span className="text-[13px] text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{t("course.purchased", "已购")}</span>
             ) : (
                <div className="flex items-baseline gap-1.5">
                   <span className="text-[16px] font-bold text-red-500 leading-none">
                     {course.price > 0
                       ? formatMoney(course.price, {
                           currency: "CNY",
                           locale,
                           mode: "symbol",
                           minFractionDigits: 0,
                           maxFractionDigits: 2,
                         }) ?? "--"
                       : t("course.free", "免费")}
                   </span>
                   {course.originalPrice && course.originalPrice > course.price && (
                      <span className="text-[11px] text-text-sub line-through opacity-70">
                        {formatMoney(course.originalPrice, {
                          currency: "CNY",
                          locale,
                          mode: "symbol",
                          minFractionDigits: 0,
                          maxFractionDigits: 2,
                        }) ?? ""}
                      </span>
                   )}
                </div>
             )}
          </div>
       </div>
    </div>
  );
};
