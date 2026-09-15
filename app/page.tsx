"use client";

import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { signInAnonymously } from "firebase/auth";

import {
  db,
  auth,
} from "@/lib/firebase";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
});

/* ========================================
   運行記録
   ======================================== */

type OperationRecord = {
  id: string;
  latitude: number;
  longitude: number;
  passengerChange: number;
  passengerCount: number;
  routeType: string;
  time: Timestamp;
};

/* ========================================
   乗車 / 降車
   ======================================== */

type DisplayMode =
  | "boarding"
  | "alighting";

/* ========================================
   日ごと / 月ごと
   ======================================== */

type PeriodMode =
  | "day"
  | "month";

/* ========================================
   ルート
   ======================================== */

type RouteFilter =
  | "ALL"
  | "ORANGE"
  | "BLUE"
  | "FREE";

/* ========================================
   協賛施設
   ======================================== */

type SponsorFacility = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

/* ========================================
   協賛施設一覧
   ======================================== */

const sponsorFacilities: SponsorFacility[] = [
  {
    id: "crossport",
    name: "幕張ベイパーク クロスポート",
    latitude: 35.6409,
    longitude: 140.0462,
  },

  {
    id: "yanmar",
    name: "幕張ベイタウン フレッシュランド ヤンマー",
    latitude: 35.6398,
    longitude: 140.0465,
  },
];

export default function Home() {
  /* ========================================
     表示期間
     ======================================== */

  const [periodMode, setPeriodMode] =
    useState<PeriodMode>("day");

  /* ========================================
     日付
     ======================================== */

  const [selectedDate, setSelectedDate] =
    useState("2026-08-22");

  /* ========================================
     月
     ======================================== */

  const [selectedMonth, setSelectedMonth] =
    useState("2026-08");

  /* ========================================
     Firestoreの運行記録
     ======================================== */

  const [records, setRecords] =
    useState<OperationRecord[]>([]);

  /* ========================================
     乗車 / 降車
     ======================================== */

  const [displayMode, setDisplayMode] =
    useState<DisplayMode>("boarding");

  /* ========================================
     ルート
     ======================================== */

  const [selectedRoute, setSelectedRoute] =
    useState<RouteFilter>("ALL");

  /* ========================================
     協賛施設
     "" = 選択なし
     ======================================== */

  const [selectedFacility, setSelectedFacility] =
    useState("");

  /* ========================================
     時間帯フィルター
     ======================================== */

  const [useTimeFilter, setUseTimeFilter] =
    useState(false);

  const [startTime, setStartTime] =
    useState("00:00");

  const [endTime, setEndTime] =
    useState("23:59");

  const [appliedStartTime, setAppliedStartTime] =
    useState("00:00");

  const [appliedEndTime, setAppliedEndTime] =
    useState("23:59");

  /* ========================================
     読み込み
     ======================================== */

  const [loading, setLoading] =
    useState(true);

  /* ========================================
     エラー
     ======================================== */

  const [error, setError] =
    useState("");

  /* ========================================
     Firestoreからデータ取得
     ======================================== */

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError("");
      setRecords([]);

      try {
        /* ==================================
           Firebase Authentication
           ==================================

           Firestore Rulesで
           request.auth != null
           を条件にしているため、
           Firestoreを読む前に匿名認証する。
        */

        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        const fetchedRecords:
          OperationRecord[] = [];

        /* ==================================
           日ごとの表示
           ================================== */

        if (periodMode === "day") {
          const snapshot =
            await getDocs(
              collection(
                db,
                selectedDate
              )
            );

          snapshot.forEach(
            (document) => {
              const record =
                document.data();

              if (
                record.latitude !== undefined &&
                record.longitude !== undefined &&
                record.passengerChange !== undefined &&
                record.passengerCount !== undefined &&
                record.routeType !== undefined &&
                record.time !== undefined
              ) {
                fetchedRecords.push({
                  id:
                    `${selectedDate}_${document.id}`,

                  latitude:
                    Number(record.latitude),

                  longitude:
                    Number(record.longitude),

                  passengerChange:
                    Number(record.passengerChange),

                  passengerCount:
                    Number(record.passengerCount),

                  routeType:
                    String(record.routeType),

                  time:
                    record.time,
                });
              }
            }
          );
        }

        /* ==================================
           月ごとの表示
           ================================== */

        else {
          const [year, month] =
            selectedMonth.split("-");

          const yearNumber =
            Number(year);

          const monthNumber =
            Number(month);

          /*
           * その月の日数
           */

          const daysInMonth =
            new Date(
              yearNumber,
              monthNumber,
              0
            ).getDate();

          for (
            let day = 1;
            day <= daysInMonth;
            day++
          ) {
            const dayString =
              String(day).padStart(
                2,
                "0"
              );

            const collectionName =
              `${year}-${month}-${dayString}`;

            try {
              const snapshot =
                await getDocs(
                  collection(
                    db,
                    collectionName
                  )
                );

              snapshot.forEach(
                (document) => {
                  const record =
                    document.data();

                  if (
                    record.latitude !== undefined &&
                    record.longitude !== undefined &&
                    record.passengerChange !== undefined &&
                    record.passengerCount !== undefined &&
                    record.routeType !== undefined &&
                    record.time !== undefined
                  ) {
                    fetchedRecords.push({
                      id:
                        `${collectionName}_${document.id}`,

                      latitude:
                        Number(record.latitude),

                      longitude:
                        Number(record.longitude),

                      passengerChange:
                        Number(record.passengerChange),

                      passengerCount:
                        Number(record.passengerCount),

                      routeType:
                        String(record.routeType),

                      time:
                        record.time,
                    });
                  }
                }
              );
            } catch {
              console.log(
                `${collectionName} は取得できません`
              );
            }
          }
        }

        console.log(
          "取得した運行記録:",
          fetchedRecords
        );

        setRecords(
          fetchedRecords
        );
      } catch (err) {
        console.error(
          "Firestoreエラー:",
          err
        );

        setError(
          "Firestoreからデータを取得できませんでした。"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [
    periodMode,
    selectedDate,
    selectedMonth,
  ]);

  /* ========================================
     ルート一覧
     ======================================== */

  const routes = [
    {
      value: "ALL" as RouteFilter,
      label: "すべて",
    },

    {
      value: "ORANGE" as RouteFilter,
      label: "オレンジ",
    },

    {
      value: "BLUE" as RouteFilter,
      label: "ブルー",
    },

    {
      value: "FREE" as RouteFilter,
      label: "Free",
    },
  ];

  /* ========================================
     乗車 / 降車で絞り込み
     ======================================== */

  const modeFilteredRecords =
    records.filter(
      (record) => {
        if (
          displayMode ===
          "boarding"
        ) {
          return (
            record.passengerChange > 0
          );
        }

        return (
          record.passengerChange < 0
        );
      }
    );

  /* ========================================
     ルートで絞り込み
     ======================================== */

  const routeFilteredRecords =
    modeFilteredRecords.filter(
      (record) => {
        const routeType =
          String(
            record.routeType
          )
            .trim()
            .toUpperCase();

        /* すべて */

        if (
          selectedRoute ===
          "ALL"
        ) {
          return true;
        }

        /* オレンジ */

        if (
          selectedRoute ===
          "ORANGE"
        ) {
          return (
            routeType ===
            "ORANGE"
          );
        }

        /* ブルー */

        if (
          selectedRoute ===
          "BLUE"
        ) {
          return (
            routeType ===
            "BLUE"
          );
        }

        /* Free */

        if (
          selectedRoute ===
          "FREE"
        ) {
          return (
            routeType ===
            "FREE"
          );
        }

        return false;
      }
    );

  /* ========================================
     時間帯で絞り込み
     ======================================== */

  const filteredRecords =
    routeFilteredRecords.filter(
      (record) => {
        /*
         * 時間フィルターOFF
         */

        if (!useTimeFilter) {
          return true;
        }

        /*
         * Timestamp → Date
         */

        const date =
          record.time.toDate();

        /*
         * 記録時刻
         */

        const recordMinutes =
          date.getHours() * 60 +
          date.getMinutes();

        /*
         * 開始時刻
         */

        const [
          startHour,
          startMinute,
        ] =
          appliedStartTime
            .split(":")
            .map(Number);

        /*
         * 終了時刻
         */

        const [
          endHour,
          endMinute,
        ] =
          appliedEndTime
            .split(":")
            .map(Number);

        const startMinutes =
          startHour * 60 +
          startMinute;

        const endMinutes =
          endHour * 60 +
          endMinute;

        /*
         * 通常の時間帯
         */

        if (
          startMinutes <=
          endMinutes
        ) {
          return (
            recordMinutes >=
              startMinutes &&
            recordMinutes <=
              endMinutes
          );
        }

        /*
         * 日付をまたぐ場合
         */

        return (
          recordMinutes >=
            startMinutes ||
          recordMinutes <=
            endMinutes
        );
      }
    );

  /* ========================================
     Mapに渡すデータ
     ======================================== */

  const mapRecords =
    filteredRecords.map(
      (record) => ({
        ...record,

        time:
          record.time
            .toDate()
            .toLocaleString(
              "ja-JP"
            ),
      })
    );

  /* ========================================
     選択されている協賛施設
     ======================================== */

  const selectedFacilityData =
    sponsorFacilities.find(
      (facility) =>
        facility.id ===
        selectedFacility
    ) ?? null;

  /* ========================================
     選択されているルート名
     ======================================== */

  const selectedRouteLabel =
    routes.find(
      (route) =>
        route.value ===
        selectedRoute
    )?.label ?? "すべて";

  /* ========================================
     時間フィルター適用
     ======================================== */

  const applyTimeFilter = () => {
    setAppliedStartTime(
      startTime
    );

    setAppliedEndTime(
      endTime
    );

    setUseTimeFilter(
      true
    );
  };

  /* ========================================
     時間フィルター解除
     ======================================== */

  const clearTimeFilter = () => {
    setUseTimeFilter(
      false
    );

    setStartTime(
      "00:00"
    );

    setEndTime(
      "23:59"
    );

    setAppliedStartTime(
      "00:00"
    );

    setAppliedEndTime(
      "23:59"
    );
  };

  /* ========================================
     読み込み画面
     ======================================== */

  if (loading) {
    return (
      <div className="loading-screen">
        <p>
          Firestoreから
          運行記録を読み込んでいます...
        </p>
      </div>
    );
  }

  /* ========================================
     エラー画面
     ======================================== */

  if (error) {
    return (
      <div className="loading-screen">
        <h1>
          運行記録表示システム
        </h1>

        <p>
          {error}
        </p>
      </div>
    );
  }

  /* ========================================
     メイン画面
     ======================================== */

  return (
    <main className="map-screen">

      {/* ==================================
          マップ
          ================================== */}

      <div className="map-container">
        <Map
          records={mapRecords}
          selectedRoute={selectedRoute}
          periodMode={periodMode}
          selectedFacility={selectedFacilityData}
        />
      </div>

      {/* ==================================
          操作パネル
          ================================== */}

      <div className="control-panel">

        {/* ==================================
            タイトル
            ================================== */}

        <div className="panel-title">
          <h1>
            運行記録表示システム
          </h1>
        </div>

        {/* ==================================
            日ごと / 月ごと
            ================================== */}

        <div className="period-section">
          <label>
            表示期間
          </label>

          <div className="period-buttons">

            <button
              className={
                periodMode === "day"
                  ? "period-button active"
                  : "period-button"
              }
              onClick={() =>
                setPeriodMode("day")
              }
            >
              日ごと
            </button>

            <button
              className={
                periodMode === "month"
                  ? "period-button active"
                  : "period-button"
              }
              onClick={() =>
                setPeriodMode("month")
              }
            >
              月ごと
            </button>

          </div>
        </div>

        {/* ==================================
            日付 / 月
            ================================== */}

        {periodMode === "day" ? (
          <div className="date-section">

            <label htmlFor="date">
              運行日
            </label>

            <input
              id="date"
              type="date"
              value={
                selectedDate
              }
              onChange={(e) =>
                setSelectedDate(
                  e.target.value
                )
              }
            />

          </div>
        ) : (
          <div className="date-section">

            <label htmlFor="month">
              運行月
            </label>

            <input
              id="month"
              type="month"
              value={
                selectedMonth
              }
              onChange={(e) =>
                setSelectedMonth(
                  e.target.value
                )
              }
            />

          </div>
        )}

        {/* ==================================
            ルート
            ================================== */}

        <div className="route-section">

          <label htmlFor="route">
            ルート
          </label>

          <select
            id="route"
            value={
              selectedRoute
            }
            onChange={(e) =>
              setSelectedRoute(
                e.target.value as RouteFilter
              )
            }
          >

            {routes.map(
              (route) => (
                <option
                  key={
                    route.value
                  }
                  value={
                    route.value
                  }
                >
                  {
                    route.label
                  }
                </option>
              )
            )}

          </select>

        </div>

        {/* ==================================
            協賛施設
            ================================== */}

        <div className="facility-section">

          <label htmlFor="facility">
            協賛施設
          </label>

          <select
            id="facility"
            value={
              selectedFacility
            }
            onChange={(e) =>
              setSelectedFacility(
                e.target.value
              )
            }
          >

            <option value="">
              選択なし
            </option>

            {sponsorFacilities.map(
              (facility) => (
                <option
                  key={
                    facility.id
                  }
                  value={
                    facility.id
                  }
                >
                  {
                    facility.name
                  }
                </option>
              )
            )}

          </select>

          {selectedFacilityData && (
            <div className="facility-selected">

              選択中：
              <br />

              {
                selectedFacilityData.name
              }

            </div>
          )}

        </div>

        {/* ==================================
            時間帯
            ================================== */}

        <div className="time-section">

          <label>
            時間帯
          </label>

          <button
            className={
              !useTimeFilter
                ? "time-all-button active"
                : "time-all-button"
            }
            onClick={
              clearTimeFilter
            }
          >
            すべて
          </button>

          <div className="time-input-row">

            <input
              type="time"
              value={
                startTime
              }
              onChange={(e) =>
                setStartTime(
                  e.target.value
                )
              }
            />

            <span>
              ～
            </span>

            <input
              type="time"
              value={
                endTime
              }
              onChange={(e) =>
                setEndTime(
                  e.target.value
                )
              }
            />

          </div>

          <button
            className="time-apply-button"
            onClick={
              applyTimeFilter
            }
          >
            この時間帯を適用
          </button>

          {useTimeFilter && (
            <p className="time-applied">

              {appliedStartTime}

              {" ～ "}

              {appliedEndTime}

              {" を表示中"}

            </p>
          )}

        </div>

        {/* ==================================
            乗車 / 降車
            ================================== */}

        <div className="mode-buttons">

          <button
            className={
              displayMode ===
              "boarding"
                ? "mode-button active"
                : "mode-button"
            }
            onClick={() =>
              setDisplayMode(
                "boarding"
              )
            }
          >
            乗車
          </button>

          <button
            className={
              displayMode ===
              "alighting"
                ? "mode-button active"
                : "mode-button"
            }
            onClick={() =>
              setDisplayMode(
                "alighting"
              )
            }
          >
            降車
          </button>

        </div>

        {/* ==================================
            表示情報
            ================================== */}

        <div className="display-info">

          <div>

            <div className="display-mode">

              {displayMode ===
              "boarding"
                ? "乗車地点"
                : "降車地点"}

            </div>

            <div className="selected-date-text">

              {periodMode ===
              "day"
                ? selectedDate
                : selectedMonth}

            </div>

            <div className="selected-route-text">

              ルート：
              {
                selectedRouteLabel
              }

            </div>

            {useTimeFilter && (
              <div className="selected-route-text">

                時間：

                {
                  appliedStartTime
                }

                {" ～ "}

                {
                  appliedEndTime
                }

              </div>
            )}

            {selectedFacilityData && (
              <div className="selected-route-text">

                施設：

                {
                  selectedFacilityData.name
                }

              </div>
            )}

          </div>

          <div className="record-count">

            {
              filteredRecords.length
            }

            件

          </div>

        </div>

      </div>
    </main>
  );
}