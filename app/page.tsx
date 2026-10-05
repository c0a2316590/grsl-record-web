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
    latitude: 35.6467027877686,
    longitude: 140.04998703776445,
  },
  {
    id: "kameda",
    name: "亀田ホームクリニック幕張",
    latitude: 35.64391458150275,
    longitude: 140.05389912242066,
  },
  {
    id: "neighborhood-dock",
    name: "MAKUHARI NEIGHBORHOOD DOCK",
    latitude: 35.64450136700986,
    longitude: 140.05178110892845,
  },
  {
    id: "makuhari-messe",
    name: "幕張メッセ",
    latitude: 35.64785122248293,
    longitude: 140.0354642224209,
  },
  {
    id: "yanmar",
    name: "幕張ベイタウン フレッシュランド ヤンマー",
    latitude: 35.641005855848945,
    longitude: 140.0459376377642,
  },
];

/* ========================================
   日付を YYYY-MM-DD にする
   ======================================== */

const formatDate = (date: Date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* ========================================
   指定した日付から過去へ検索して
   最新の記録がある日を探す
   ======================================== */

const findLatestRecordedDate =
  async (): Promise<string> => {
    const today = new Date();

    /*
     * 今日から過去366日まで検索
     */
    for (
      let offset = 0;
      offset <= 366;
      offset++
    ) {
      const checkDate =
        new Date(today);

      checkDate.setDate(
        today.getDate() - offset
      );

      const dateString =
        formatDate(checkDate);

      try {
        const snapshot =
          await getDocs(
            collection(
              db,
              dateString
            )
          );

        if (snapshot.empty) {
          continue;
        }

        /*
         * 有効な運行記録が1件でも
         * 入っているか確認
         */
        let hasValidRecord =
          false;

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
              hasValidRecord = true;
            }
          }
        );

        if (hasValidRecord) {
          return dateString;
        }

      } catch {
        console.log(
          `${dateString} は取得できません`
        );
      }
    }

    return "";
  };

/* ========================================
   メイン
   ======================================== */

export default function Home() {

  /* ========================================
     表示期間

     最初は「月ごと」
     ======================================== */

  const [periodMode, setPeriodMode] =
    useState<PeriodMode>("month");

  /* ========================================
     選択日
     ======================================== */

  const [selectedDate, setSelectedDate] =
    useState("");

  /* ========================================
     選択月
     ======================================== */

  const [selectedMonth, setSelectedMonth] =
    useState("");

  /* ========================================
     運行記録
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
     パネル最小化
     ======================================== */

  const [isPanelMinimized, setIsPanelMinimized] =
    useState(false);

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
     最新記録日
     ======================================== */

  const [latestRecordedDate, setLatestRecordedDate] =
    useState("");

  /* ========================================
     初期化済みか
     ======================================== */

  const [initialized, setInitialized] =
    useState(false);

  /* ========================================
     初期化

     最新の記録がある日を探す
     ======================================== */

  useEffect(() => {

    const initialize = async () => {

      try {

        setLoading(true);
        setError("");

        /* ==============================
           Firebase Authentication
           ============================== */

        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        /* ==============================
           最新の記録日を検索
           ============================== */

        const latestDate =
          await findLatestRecordedDate();

        if (!latestDate) {

          /*
           * 記録が1件もない場合
           */
          const today =
            formatDate(
              new Date()
            );

          setSelectedDate(
            today
          );

          setSelectedMonth(
            today.substring(0, 7)
          );

          setInitialized(true);

          return;
        }

        /* ==============================
           最新日を保存
           ============================== */

        setLatestRecordedDate(
          latestDate
        );

        /* ==============================
           最新日を選択
           ============================== */

        setSelectedDate(
          latestDate
        );

        /* ==============================
           最新日が含まれる月を選択
           ============================== */

        setSelectedMonth(
          latestDate.substring(0, 7)
        );

        /*
         * 初期表示は月ごとなので、
         * 最新月が表示される
         */

        setPeriodMode(
          "month"
        );

        setInitialized(true);

      } catch (err) {

        console.error(
          "初期化エラー:",
          err
        );

        setError(
          "Firestoreから最新の運行記録を取得できませんでした。"
        );

      } finally {

        setLoading(false);

      }
    };

    initialize();

  }, []);

  /* ========================================
     Firestoreから運行記録を取得
     ======================================== */

  useEffect(() => {

    /*
     * 最新日・月の取得が終わるまでは
     * 実際のデータ取得を行わない
     */

    if (!initialized) {
      return;
    }

    /*
     * 日付・月がまだ設定されていない場合
     */

    if (
      periodMode === "day" &&
      !selectedDate
    ) {
      return;
    }

    if (
      periodMode === "month" &&
      !selectedMonth
    ) {
      return;
    }

    const fetchRecords =
      async () => {

        setLoading(true);
        setError("");
        setRecords([]);

        try {

          /* ==============================
             Firebase Authentication
             ============================== */

          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }

          const fetchedRecords:
            OperationRecord[] = [];

          /* ==============================
             日ごとの表示
             ============================== */

          if (
            periodMode === "day"
          ) {

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
                      Number(
                        record.latitude
                      ),

                    longitude:
                      Number(
                        record.longitude
                      ),

                    passengerChange:
                      Number(
                        record.passengerChange
                      ),

                    passengerCount:
                      Number(
                        record.passengerCount
                      ),

                    routeType:
                      String(
                        record.routeType
                      ),

                    time:
                      record.time,

                  });

                }

              }
            );

          }

          /* ==============================
             月ごとの表示
             ============================== */

          else {

            const [
              year,
              month,
            ] =
              selectedMonth.split(
                "-"
              );

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

            /*
             * 月内の全日付コレクションを取得
             */

            for (
              let day = 1;
              day <= daysInMonth;
              day++
            ) {

              const dayString =
                String(day)
                  .padStart(
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
                          Number(
                            record.latitude
                          ),

                        longitude:
                          Number(
                            record.longitude
                          ),

                        passengerChange:
                          Number(
                            record.passengerChange
                          ),

                        passengerCount:
                          Number(
                            record.passengerCount
                          ),

                        routeType:
                          String(
                            record.routeType
                          ),

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
    initialized,
    periodMode,
    selectedDate,
    selectedMonth,
  ]);

  /* ========================================
     ルート一覧
     ======================================== */

  const routes = [
    {
      value:
        "ALL" as RouteFilter,
      label:
        "すべて",
    },
    {
      value:
        "ORANGE" as RouteFilter,
      label:
        "オレンジ",
    },
    {
      value:
        "BLUE" as RouteFilter,
      label:
        "ブルー",
    },
    {
      value:
        "FREE" as RouteFilter,
      label:
        "Free",
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
            record.passengerChange >
            0
          );

        }

        return (
          record.passengerChange <
          0
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

        if (
          selectedRoute ===
          "ALL"
        ) {

          return true;

        }

        if (
          selectedRoute ===
          "ORANGE"
        ) {

          return (
            routeType ===
            "ORANGE"
          );

        }

        if (
          selectedRoute ===
          "BLUE"
        ) {

          return (
            routeType ===
            "BLUE"
          );

        }

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

        if (
          !useTimeFilter
        ) {

          return true;

        }

        const date =
          record.time.toDate();

        const recordMinutes =
          date.getHours() * 60 +
          date.getMinutes();

        const [
          startHour,
          startMinute,
        ] =
          appliedStartTime
            .split(":")
            .map(Number);

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
         *
         * 例：
         * 09:00 ～ 17:00
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
         * 日付をまたぐ時間帯
         *
         * 例：
         * 22:00 ～ 02:00
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
    )?.label ??
    "すべて";

  /* ========================================
     時間フィルター適用
     ======================================== */

  const applyTimeFilter =
    () => {

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

  const clearTimeFilter =
    () => {

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
          selectedRoute={
            selectedRoute
          }
          periodMode={
            periodMode
          }
          selectedFacility={
            selectedFacilityData
          }
        />

      </div>

      {/* ==================================
          操作パネル
          ================================== */}

      {isPanelMinimized ? (

        <button
          className="panel-toggle-button minimized"
          onClick={() =>
            setIsPanelMinimized(
              false
            )
          }
          aria-label="操作パネルを開く"
          title="操作パネルを開く"
        >
          +
        </button>

      ) : (

        <div className="control-panel">

          {/* ==================================
              パネルヘッダー
              ================================== */}

          <div className="panel-header">

            <div className="panel-title">

              <h1>
                運行記録表示システム
              </h1>

            </div>

            <button
              className="panel-toggle-button"
              onClick={() =>
                setIsPanelMinimized(
                  true
                )
              }
              aria-label="操作パネルを最小化"
              title="操作パネルを最小化"
            >
              −
            </button>

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
                  periodMode ===
                  "day"
                    ? "period-button active"
                    : "period-button"
                }
                onClick={() => {

                  setPeriodMode(
                    "day"
                  );

                  /*
                   * 最新の記録日を表示
                   */
                  if (
                    latestRecordedDate
                  ) {

                    setSelectedDate(
                      latestRecordedDate
                    );

                  }

                }}
              >
                日ごと
              </button>

              <button
                className={
                  periodMode ===
                  "month"
                    ? "period-button active"
                    : "period-button"
                }
                onClick={() => {

                  setPeriodMode(
                    "month"
                  );

                  /*
                   * 最新の記録がある月を表示
                   */
                  if (
                    latestRecordedDate
                  ) {

                    setSelectedMonth(
                      latestRecordedDate.substring(
                        0,
                        7
                      )
                    );

                  }

                }}
              >
                月ごと
              </button>

            </div>

          </div>

          {/* ==================================
              日付 / 月
              ================================== */}

          {periodMode ===
          "day" ? (

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

      )}

    </main>

  );

}