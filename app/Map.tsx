"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { useEffect, useState } from "react";


/* ============================================================
   運行記録
   ============================================================ */

type MapRecord = {
  id: string;
  latitude: number;
  longitude: number;
  passengerChange: number;
  passengerCount: number;
  routeType: string;
  time: string;
};


/* ============================================================
   表示期間
   ============================================================ */

type PeriodMode =
  | "day"
  | "month";


/* ============================================================
   ルート選択
   ============================================================ */

type RouteFilter =
  | "ALL"
  | "ORANGE"
  | "BLUE"
  | "FREE";


/* ============================================================
   GeoJSONルート座標
   ============================================================ */

type RouteCoordinates = [
  number,
  number
][];


/* ============================================================
   協賛施設
   ============================================================ */

type SelectedFacility = {

  id: string;

  name: string;

  latitude: number;

  longitude: number;

};


/* ============================================================
   月表示でまとめた地点
   ============================================================ */

type MonthlyCluster = {

  id: string;

  latitude: number;

  longitude: number;

  totalPassenger: number;

  recordCount: number;

  routeTypes: string[];

};


/* ============================================================
   50m以内か判定する距離
   ============================================================ */

const CLUSTER_DISTANCE_METERS =
  50;


/* ============================================================
   2地点間の距離を計算
   ============================================================ */

function calculateDistanceMeters(

  latitude1: number,

  longitude1: number,

  latitude2: number,

  longitude2: number

) {

  const earthRadius =
    6371000;


  const lat1 =
    latitude1 *
    Math.PI /
    180;


  const lat2 =
    latitude2 *
    Math.PI /
    180;


  const deltaLat =
    (
      latitude2 -
      latitude1
    ) *
    Math.PI /
    180;


  const deltaLon =
    (
      longitude2 -
      longitude1
    ) *
    Math.PI /
    180;


  const a =
    Math.sin(
      deltaLat / 2
    ) *
    Math.sin(
      deltaLat / 2
    ) +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(
      deltaLon / 2
    ) *
    Math.sin(
      deltaLon / 2
    );


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return (
    earthRadius *
    c
  );

}


/* ============================================================
   月表示用の地点集約
   ============================================================ */

function createMonthlyClusters(

  records: MapRecord[]

): MonthlyCluster[] {

  const clusters:
    MonthlyCluster[] = [];


  records.forEach(
    (record) => {

      const passenger =
        Math.abs(
          record.passengerChange
        );


      let targetCluster:
        MonthlyCluster | null =
        null;


      for (
        const cluster
        of clusters
      ) {

        const distance =
          calculateDistanceMeters(

            record.latitude,

            record.longitude,

            cluster.latitude,

            cluster.longitude

          );


        if (
          distance <=
          CLUSTER_DISTANCE_METERS
        ) {

          targetCluster =
            cluster;

          break;

        }

      }


      /* ======================================================
         既存の集約地点がある場合
         ====================================================== */

      if (
        targetCluster
      ) {

        targetCluster.totalPassenger +=
          passenger;


        targetCluster.recordCount +=
          1;


        /*
         * 座標を平均化
         */

        targetCluster.latitude =
          (
            targetCluster.latitude *
              (
                targetCluster.recordCount -
                1
              ) +
            record.latitude
          ) /
          targetCluster.recordCount;


        targetCluster.longitude =
          (
            targetCluster.longitude *
              (
                targetCluster.recordCount -
                1
              ) +
            record.longitude
          ) /
          targetCluster.recordCount;


        /*
         * ルート情報
         */

        const routeType =
          String(
            record.routeType
          )
            .trim()
            .toUpperCase();


        if (
          !targetCluster.routeTypes.includes(
            routeType
          )
        ) {

          targetCluster.routeTypes.push(
            routeType
          );

        }

      }


      /* ======================================================
         新しい集約地点の場合
         ====================================================== */

      else {

        clusters.push({

          id:
            `cluster_${record.id}`,

          latitude:
            record.latitude,

          longitude:
            record.longitude,

          totalPassenger:
            passenger,

          recordCount:
            1,

          routeTypes: [

            String(
              record.routeType
            )
              .trim()
              .toUpperCase(),

          ],

        });

      }

    }
  );


  return clusters;

}


/* ============================================================
   日ごとのピン
   ============================================================ */

function createDailyPassengerIcon(

  passengerChange: number

) {

  const count =
    Math.abs(
      passengerChange
    );


  let size =
    36;

  let color =
    "#4CAF50";


  /* 1人 */

  if (
    count === 1
  ) {

    size =
      36;

    color =
      "#4CAF50";

  }


  /* 2人 */

  else if (
    count === 2
  ) {

    size =
      46;

    color =
      "#FF9800";

  }


  /* 3人以上 */

  else if (
    count >= 3
  ) {

    size =
      58;

    color =
      "#F44336";

  }


  return L.divIcon({

    className: "",

    html: `

      <div
        style="

          width: ${size}px;

          height: ${size}px;

          background-color: ${color};

          border-radius: 50%;

          border: 3px solid white;

          box-shadow:
            0 2px 6px
            rgba(0,0,0,0.35);

          display: flex;

          align-items: center;

          justify-content: center;

          color: white;

          font-size:
            ${Math.max(
              14,
              size * 0.4
            )}px;

          font-weight: bold;

          box-sizing: border-box;

        "
      >

        ${count}

      </div>

    `,

    iconSize: [

      size,

      size,

    ],

    iconAnchor: [

      size / 2,

      size / 2,

    ],

    popupAnchor: [

      0,

      -size / 2,

    ],

  });

}


/* ============================================================
   月ごとのピン
   ============================================================ */

function createMonthlyPassengerIcon(

  totalPassenger: number

) {

  let size =
    36;

  let color =
    "#4CAF50";


  /* 1～10人 */

  if (
    totalPassenger <= 10
  ) {

    size =
      36;

    color =
      "#4CAF50";

  }


  /* 11～30人 */

  else if (
    totalPassenger <= 30
  ) {

    size =
      48;

    color =
      "#FF9800";

  }


  /* 31人以上 */

  else {

    size =
      60;

    color =
      "#F44336";

  }


  let fontSize =
    16;


  if (
    totalPassenger >= 100
  ) {

    fontSize =
      13;

  }

  else if (
    totalPassenger >= 50
  ) {

    fontSize =
      15;

  }


  return L.divIcon({

    className: "",

    html: `

      <div
        style="

          width: ${size}px;

          height: ${size}px;

          background-color: ${color};

          border-radius: 50%;

          border: 3px solid white;

          box-shadow:
            0 2px 6px
            rgba(0,0,0,0.35);

          display: flex;

          align-items: center;

          justify-content: center;

          color: white;

          font-size: ${fontSize}px;

          font-weight: bold;

          box-sizing: border-box;

          white-space: nowrap;

        "
      >

        ${totalPassenger}

      </div>

    `,

    iconSize: [

      size,

      size,

    ],

    iconAnchor: [

      size / 2,

      size / 2,

    ],

    popupAnchor: [

      0,

      -size / 2,

    ],

  });

}


/* ============================================================
   協賛施設用マーカー
   ============================================================ */

function createFacilityIcon() {

  return L.divIcon({

    className:
      "facility-marker-wrapper",

    html: `

      <div
        style="

          position: relative;

          width: 48px;

          height: 58px;

          display: flex;

          flex-direction: column;

          align-items: center;

        "
      >

        <div
          style="

            width: 42px;

            height: 42px;

            background: #1976D2;

            border: 4px solid white;

            border-radius: 50% 50% 50% 0;

            transform: rotate(-45deg);

            box-shadow:
              0 2px 7px
              rgba(0,0,0,0.35);

            display: flex;

            align-items: center;

            justify-content: center;

          "
        >

          <div
            style="

              transform: rotate(45deg);

              color: white;

              font-size: 22px;

              font-weight: bold;

              line-height: 1;

            "
          >
            ★
          </div>

        </div>

        <div
          style="

            position: absolute;

            top: 48px;

            left: 50%;

            transform: translateX(-50%);

            background: white;

            border: 1px solid #ccc;

            border-radius: 5px;

            padding: 2px 6px;

            font-size: 11px;

            font-weight: bold;

            color: #333;

            white-space: nowrap;

            box-shadow:
              0 1px 4px
              rgba(0,0,0,0.2);

          "
        >
          協賛施設
        </div>

      </div>

    `,

    iconSize: [

      48,

      58,

    ],

    iconAnchor: [

      24,

      42,

    ],

    popupAnchor: [

      0,

      -42,

    ],

  });

}


/* ============================================================
   選択施設へ地図を移動する
   ============================================================ */

function FacilityMapController({

  selectedFacility,

}: {

  selectedFacility:
    SelectedFacility | null;

}) {

  const map =
    useMap();


  useEffect(() => {

    if (
      !selectedFacility
    ) {

      return;

    }


    map.flyTo(

      [

        selectedFacility.latitude,

        selectedFacility.longitude,

      ],

      17,

      {

        duration:
          1.2,

      }

    );

  }, [
    selectedFacility,
    map,
  ]);


  return null;

}


/* ============================================================
   GeoJSON読み込み
   ============================================================ */

async function loadRouteGeoJSON(

  path: string

): Promise<RouteCoordinates> {

  const response =
    await fetch(path);


  if (
    !response.ok
  ) {

    throw new Error(
      `${path} の読み込みに失敗しました`
    );

  }


  const data =
    await response.json();


  /* FeatureCollection */

  if (
    data.type ===
      "FeatureCollection" &&
    data.features &&
    data.features.length > 0
  ) {

    const feature =
      data.features[0];


    if (
      feature.geometry &&
      feature.geometry.type ===
        "LineString"
    ) {

      return feature.geometry.coordinates.map(

        (
          coordinate: [
            number,
            number
          ]
        ) => {

          return [

            coordinate[1],

            coordinate[0],

          ];

        }

      );

    }

  }


  /* Feature */

  if (
    data.type ===
      "Feature" &&
    data.geometry &&
    data.geometry.type ===
      "LineString"
  ) {

    return data.geometry.coordinates.map(

      (
        coordinate: [
          number,
          number
        ]
      ) => {

        return [

          coordinate[1],

          coordinate[0],

        ];

      }

    );

  }


  throw new Error(
    `${path} にLineStringのルートがありません`
  );

}


/* ============================================================
   Map
   ============================================================ */

export default function Map({

  records,

  selectedRoute =
    "ALL",

  periodMode =
    "day",

  selectedFacility =
    null,

}: {

  records:
    MapRecord[];

  selectedRoute?:
    RouteFilter;

  periodMode?:
    PeriodMode;

  selectedFacility?:
    SelectedFacility | null;

}) {


  /* ==========================================================
     地図中心
     ========================================================== */

  const center: [
    number,
    number
  ] = [

    35.6406891,

    140.0466451,

  ];


  /* ==========================================================
     オレンジルート
     ========================================================== */

  const [
    orangeRoute,
    setOrangeRoute,
  ] = useState<RouteCoordinates>(
    []
  );


  /* ==========================================================
     ブルールート
     ========================================================== */

  const [
    blueRoute,
    setBlueRoute,
  ] = useState<RouteCoordinates>(
    []
  );


  /* ==========================================================
     ルート読み込み状態
     ========================================================== */

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(true);


  /* ==========================================================
     ルート読み込みエラー
     ========================================================== */

  const [
    routeError,
    setRouteError,
  ] = useState("");


  /* ==========================================================
     GeoJSON読み込み
     ========================================================== */

  useEffect(() => {

    const loadRoutes =
      async () => {

        try {

          setRouteLoading(
            true
          );

          setRouteError(
            ""
          );


          const [
            orange,
            blue,
          ] = await Promise.all([

            loadRouteGeoJSON(
              "/routes/orange.geojson"
            ),

            loadRouteGeoJSON(
              "/routes/blue.geojson"
            ),

          ]);


          console.log(
            "オレンジルート読み込み完了:",
            orange
          );


          console.log(
            "ブルールート読み込み完了:",
            blue
          );


          setOrangeRoute(
            orange
          );


          setBlueRoute(
            blue
          );


        } catch (
          error
        ) {

          console.error(
            "GeoJSON読み込みエラー:",
            error
          );


          setRouteError(
            "ルートデータを読み込めませんでした。"
          );


        } finally {

          setRouteLoading(
            false
          );

        }

      };


    loadRoutes();

  }, []);


  /* ==========================================================
     ルート表示判定
     ========================================================== */

  const showOrangeRoute =
    selectedRoute ===
      "ALL" ||
    selectedRoute ===
      "ORANGE";


  const showBlueRoute =
    selectedRoute ===
      "ALL" ||
    selectedRoute ===
      "BLUE";


  /* ==========================================================
     運行記録のルート絞り込み
     ========================================================== */

  const visibleRecords =
    records.filter(
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


  /* ==========================================================
     月表示の場合だけ50m以内を集約
     ========================================================== */

  const monthlyClusters =
    periodMode === "month"
      ? createMonthlyClusters(
          visibleRecords
        )
      : [];


  /* ==========================================================
     地図
     ========================================================== */

  return (

    <div
      style={{

        width:
          "100%",

        height:
          "100%",

        position:
          "relative",

      }}
    >


      {/* ======================================================
          Leaflet
          ====================================================== */}

      <MapContainer

        center={
          center
        }

        zoom={
          15
        }

        scrollWheelZoom={
          true
        }

        style={{

          width:
            "100%",

          height:
            "100%",

        }}

      >


        {/* ====================================================
            選択施設へ移動
            ==================================================== */}

        <FacilityMapController

          selectedFacility={
            selectedFacility
          }

        />


        {/* ====================================================
            OpenStreetMap
            ==================================================== */}

        <TileLayer

          attribution=
            "&copy; OpenStreetMap contributors"

          url=
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

        />


        {/* ====================================================
            オレンジルート
            ==================================================== */}

        {showOrangeRoute &&
          orangeRoute.length >
            0 && (

          <Polyline

            positions={
              orangeRoute
            }

            pathOptions={{

              color:
                "#ff6600",

              weight:
                6,

              opacity:
                0.85,

              lineCap:
                "round",

              lineJoin:
                "round",

            }}

          >

            <Tooltip sticky>

              オレンジルート

            </Tooltip>

          </Polyline>

        )}


        {/* ====================================================
            ブルールート
            ==================================================== */}

        {showBlueRoute &&
          blueRoute.length >
            0 && (

          <Polyline

            positions={
              blueRoute
            }

            pathOptions={{

              color:
                "#2979ff",

              weight:
                6,

              opacity:
                0.85,

              lineCap:
                "round",

              lineJoin:
                "round",

            }}

          >

            <Tooltip sticky>

              ブルールート

            </Tooltip>

          </Polyline>

        )}


        {/* ====================================================
            日ごとのピン
            ==================================================== */}

        {periodMode === "day" &&

          visibleRecords.map(
            (record) => (

              <Marker

                key={
                  record.id
                }

                position={[

                  record.latitude,

                  record.longitude,

                ]}

                icon={
                  createDailyPassengerIcon(
                    record.passengerChange
                  )
                }

              >

                <Popup>

                  <div
                    style={{

                      minWidth:
                        "220px",

                      fontSize:
                        "16px",

                      lineHeight:
                        "1.8",

                    }}
                  >

                    <h3
                      style={{

                        margin:
                          "0 0 10px 0",

                        fontSize:
                          "20px",

                      }}
                    >

                      運行記録

                    </h3>


                    <div>

                      <strong>
                        ルート：
                      </strong>

                      {
                        record.routeType
                      }

                    </div>


                    <div>

                      <strong>
                        人数変化：
                      </strong>

                      {
                        record.passengerChange
                      }

                    </div>


                    <div>

                      <strong>

                        {
                          record.passengerChange >
                          0
                            ? "乗車人数"
                            : "降車人数"
                        }

                        ：

                      </strong>

                      {
                        Math.abs(
                          record.passengerChange
                        )
                      }

                    </div>


                    <div>

                      <strong>
                        乗車人数：
                      </strong>

                      {
                        record.passengerCount
                      }

                    </div>


                    <div>

                      <strong>
                        時刻：
                      </strong>

                      {
                        record.time
                      }

                    </div>

                  </div>

                </Popup>

              </Marker>

            )

          )
        }


        {/* ====================================================
            月ごとの集約ピン
            ==================================================== */}

        {periodMode === "month" &&

          monthlyClusters.map(
            (cluster) => (

              <Marker

                key={
                  cluster.id
                }

                position={[

                  cluster.latitude,

                  cluster.longitude,

                ]}

                icon={
                  createMonthlyPassengerIcon(
                    cluster.totalPassenger
                  )
                }

              >

                <Popup>

                  <div
                    style={{

                      minWidth:
                        "230px",

                      fontSize:
                        "16px",

                      lineHeight:
                        "1.8",

                    }}
                  >

                    <h3
                      style={{

                        margin:
                          "0 0 10px 0",

                        fontSize:
                          "20px",

                      }}
                    >

                      月間利用状況

                    </h3>


                    <div>

                      <strong>
                        合計人数：
                      </strong>

                      {
                        cluster.totalPassenger
                      }

                      人

                    </div>


                    <div>

                      <strong>
                        記録件数：
                      </strong>

                      {
                        cluster.recordCount
                      }

                      件

                    </div>


                    <div>

                      <strong>
                        ルート：
                      </strong>

                      {
                        cluster.routeTypes
                          .map(
                            (route) => {

                              if (
                                route ===
                                "ORANGE"
                              ) {

                                return "オレンジ";

                              }


                              if (
                                route ===
                                "BLUE"
                              ) {

                                return "ブルー";

                              }


                              if (
                                route ===
                                "FREE"
                              ) {

                                return "Free";

                              }


                              return route;

                            }
                          )
                          .join(
                            "、"
                          )
                      }

                    </div>


                    <div
                      style={{

                        marginTop:
                          "8px",

                        fontSize:
                          "12px",

                        color:
                          "#666",

                      }}
                    >

                      50m以内の記録を
                      1つにまとめています

                    </div>

                  </div>

                </Popup>

              </Marker>

            )

          )
        }


        {/* ====================================================
            協賛施設マーカー
            ==================================================== */}

        {selectedFacility && (

          <Marker

            position={[

              selectedFacility.latitude,

              selectedFacility.longitude,

            ]}

            icon={
              createFacilityIcon()
            }

            zIndexOffset={
              1000
            }

          >

            <Popup>

              <div
                style={{

                  minWidth:
                    "220px",

                  fontSize:
                    "16px",

                  lineHeight:
                    "1.7",

                }}
              >

                <h3
                  style={{

                    margin:
                      "0 0 8px 0",

                    fontSize:
                      "18px",

                  }}
                >

                  協賛施設

                </h3>


                <div>

                  <strong>
                    施設名：
                  </strong>

                  <br />

                  {
                    selectedFacility.name
                  }

                </div>


                <div
                  style={{

                    marginTop:
                      "8px",

                    fontSize:
                      "12px",

                    color:
                      "#666",

                  }}
                >

                  選択した協賛施設

                </div>

              </div>

            </Popup>

          </Marker>

        )}

      </MapContainer>


      {/* ======================================================
          ルート読み込み中
          ====================================================== */}

      {routeLoading && (

        <div
          style={{

            position:
              "absolute",

            bottom:
              "20px",

            left:
              "20px",

            zIndex:
              1000,

            background:
              "rgba(255,255,255,0.95)",

            padding:
              "10px 14px",

            borderRadius:
              "8px",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.2)",

            fontSize:
              "13px",

          }}
        >

          ルートデータを
          読み込んでいます...

        </div>

      )}


      {/* ======================================================
          ルート読み込みエラー
          ====================================================== */}

      {routeError && (

        <div
          style={{

            position:
              "absolute",

            bottom:
              "20px",

            left:
              "20px",

            zIndex:
              1000,

            background:
              "rgba(255,235,238,0.96)",

            color:
              "#c62828",

            padding:
              "10px 14px",

            borderRadius:
              "8px",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.2)",

            fontSize:
              "13px",

          }}
        >

          {
            routeError
          }

        </div>

      )}


      {/* ======================================================
          ルート凡例
          ====================================================== */}

      {selectedRoute !==
        "FREE" && (

        <div
          style={{

            position:
              "absolute",

            bottom:
              "20px",

            left:
              "20px",

            zIndex:
              1000,

            background:
              "rgba(255,255,255,0.95)",

            padding:
              "12px 15px",

            borderRadius:
              "10px",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.25)",

            fontSize:
              "14px",

          }}
        >


          {/* オレンジ */}

          {(
            selectedRoute ===
              "ALL" ||
            selectedRoute ===
              "ORANGE"
          ) && (

            <div
              style={{

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "8px",

                marginBottom:
                  selectedRoute ===
                  "ALL"
                    ? "7px"
                    : "0",

              }}
            >

              <span
                style={{

                  display:
                    "inline-block",

                  width:
                    "28px",

                  height:
                    "6px",

                  background:
                    "#ff6600",

                  borderRadius:
                    "5px",

                }}
              />

              <span>
                オレンジルート
              </span>

            </div>

          )}


          {/* ブルー */}

          {(
            selectedRoute ===
              "ALL" ||
            selectedRoute ===
              "BLUE"
          ) && (

            <div
              style={{

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "8px",

              }}
            >

              <span
                style={{

                  display:
                    "inline-block",

                  width:
                    "28px",

                  height:
                    "6px",

                  background:
                    "#2979ff",

                  borderRadius:
                    "5px",

                }}
              />

              <span>
                ブルールート
              </span>

            </div>

          )}

        </div>

      )}

    </div>

  );

}