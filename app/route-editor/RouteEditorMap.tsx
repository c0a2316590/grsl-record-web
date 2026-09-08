"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useState } from "react";


/* ============================================================
   ルートの種類
   ============================================================ */

type RouteType =
  | "ORANGE"
  | "BLUE";


/* ============================================================
   地図上のポイント
   ============================================================ */

type Point = {
  lat: number;
  lng: number;
};


/* ============================================================
   地図クリック処理
   ============================================================ */

function MapClickHandler({
  onClick,
}: {
  onClick: (point: Point) => void;
}) {
  useMapEvents({
    click(e) {
      onClick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}


/* ============================================================
   ルート編集画面
   ============================================================ */

export default function RouteEditorMap() {

  /* ==========================================================
     ルート種類
     ========================================================== */

  const [
    routeType,
    setRouteType,
  ] = useState<RouteType>("ORANGE");


  /* ==========================================================
     クリックした地点
     ========================================================== */

  const [
    points,
    setPoints,
  ] = useState<Point[]>([]);


  /* ==========================================================
     道路に沿って生成したルート
     ========================================================== */

  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState<[number, number][]>([]);


  /* ==========================================================
     ルート生成中
     ========================================================== */

  const [
    loading,
    setLoading,
  ] = useState(false);


  /* ==========================================================
     エラー
     ========================================================== */

  const [
    error,
    setError,
  ] = useState("");


  /* ==========================================================
     地図中心
     ========================================================== */

  const center: [number, number] = [
    35.6406891,
    140.0466451,
  ];


  /* ==========================================================
     地図をクリック
     ========================================================== */

  const handleMapClick = (
    point: Point
  ) => {

    setPoints(
      (previous) => [
        ...previous,
        point,
      ]
    );

    /*
     * 新しい地点を追加した場合、
     * 以前に生成したルートを消す
     */

    setRouteCoordinates([]);

    setError("");
  };


  /* ==========================================================
     最後の地点を削除
     ========================================================== */

  const removeLastPoint = () => {

    setPoints(
      (previous) =>
        previous.slice(0, -1)
    );

    setRouteCoordinates([]);

    setError("");
  };


  /* ==========================================================
     全地点を削除
     ========================================================== */

  const clearPoints = () => {

    setPoints([]);

    setRouteCoordinates([]);

    setError("");
  };


  /* ==========================================================
     ルート種類を変更
     ========================================================== */

  const changeRouteType = (
    type: RouteType
  ) => {

    setRouteType(type);

    /*
     * オレンジ / ブルーを切り替えたら
     * いったん地点をクリア
     */

    setPoints([]);

    setRouteCoordinates([]);

    setError("");
  };


  /* ==========================================================
     道路に沿った巡回ルートを生成
     ========================================================== */

  const createRoute = async () => {

    /* --------------------------------------------------------
       最低2地点必要
       -------------------------------------------------------- */

    if (points.length < 2) {

      setError(
        "2点以上の地点を地図上に指定してください。"
      );

      return;
    }


    setLoading(true);

    setError("");


    try {

      /* ======================================================
         最後の地点から最初の地点へ戻る

         例：

         ① → ② → ③ → ④

         ではなく、

         ① → ② → ③ → ④ → ①

         とする
         ====================================================== */

      const routePoints = [
        ...points,
        points[0],
      ];


      /* ======================================================
         OSRMに渡す座標

         OSRM：
         longitude,latitude

         の順番
         ====================================================== */

      const coordinateString =
        routePoints
          .map(
            (point) =>
              `${point.lng},${point.lat}`
          )
          .join(";");


      console.log(
        "OSRMに送信する座標:",
        coordinateString
      );


      /* ======================================================
         OSRM API

         drivingを使用して、
         実際の道路に沿ったルートを取得
         ====================================================== */

      const url =
        `https://router.project-osrm.org/route/v1/driving/${coordinateString}` +
        `?overview=full` +
        `&geometries=geojson` +
        `&steps=false`;


      console.log(
        "OSRM URL:",
        url
      );


      /* ======================================================
         API通信
         ====================================================== */

      const response =
        await fetch(url);


      if (!response.ok) {

        throw new Error(
          "OSRMへの接続に失敗しました。"
        );
      }


      /* ======================================================
         JSON取得
         ====================================================== */

      const data =
        await response.json();


      console.log(
        "OSRMレスポンス:",
        data
      );


      /* ======================================================
         ルート取得確認
         ====================================================== */

      if (
        data.code !== "Ok" ||
        !data.routes ||
        data.routes.length === 0
      ) {

        throw new Error(
          "指定した地点を道路で接続できませんでした。"
        );
      }


      /* ======================================================
         道路に沿ったルート座標を取得

         GeoJSON：
         [longitude, latitude]

         Leaflet：
         [latitude, longitude]

         なので順番を入れ替える
         ====================================================== */

      const roadRouteCoordinates =
        data.routes[0]
          .geometry
          .coordinates
          .map(
            (
              coordinate: [
                number,
                number
              ]
            ) => {

              return [
                coordinate[1],
                coordinate[0],
              ] as [
                number,
                number
              ];

            }
          );


      /* ======================================================
         生成したルートを保存
         ====================================================== */

      setRouteCoordinates(
        roadRouteCoordinates
      );


    } catch (err) {

      console.error(
        "ルート生成エラー:",
        err
      );

      setError(
        "ルートの生成に失敗しました。"
      );

    } finally {

      setLoading(false);

    }

  };


  /* ==========================================================
     GeoJSONを保存
     ========================================================== */

  const downloadGeoJSON = () => {

    /* --------------------------------------------------------
       ルートが生成されているか確認
       -------------------------------------------------------- */

    if (
      routeCoordinates.length === 0
    ) {

      setError(
        "先に「道路に沿ってルート生成」を実行してください。"
      );

      return;
    }


    /* ========================================================
       Leaflet形式をGeoJSON形式へ戻す

       Leaflet：
       [latitude, longitude]

       GeoJSON：
       [longitude, latitude]
       ======================================================== */

    const geoJSONCoordinates =
      routeCoordinates.map(
        (coordinate) => [

          coordinate[1],
          coordinate[0],

        ]
      );


    /* ========================================================
       GeoJSON
       ======================================================== */

    const geojson = {

      type:
        "FeatureCollection",

      features: [

        {

          type:
            "Feature",

          properties: {

            route:
              routeType,

            name:
              routeType ===
              "ORANGE"
                ? "オレンジルート"
                : "ブルールート",

          },

          geometry: {

            type:
              "LineString",

            coordinates:
              geoJSONCoordinates,

          },

        },

      ],

    };


    /* ========================================================
       Blob作成
       ======================================================== */

    const blob =
      new Blob(
        [
          JSON.stringify(
            geojson,
            null,
            2
          ),
        ],
        {
          type:
            "application/geo+json",
        }
      );


    /* ========================================================
       ダウンロードURL
       ======================================================== */

    const url =
      URL.createObjectURL(
        blob
      );


    /* ========================================================
       ダウンロード
       ======================================================== */

    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      routeType ===
      "ORANGE"
        ? "orange.geojson"
        : "blue.geojson";


    document.body.appendChild(
      link
    );


    link.click();


    document.body.removeChild(
      link
    );


    URL.revokeObjectURL(
      url
    );

  };


  /* ==========================================================
     画面
     ========================================================== */

  return (

    <div
      style={{

        position:
          "relative",

        width:
          "100vw",

        height:
          "100vh",

        overflow:
          "hidden",

      }}
    >

      {/* ======================================================
          地図
          ====================================================== */}

      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={true}

        style={{

          width:
            "100%",

          height:
            "100%",

        }}
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'

          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* ====================================================
            地図クリック
            ==================================================== */}

        <MapClickHandler
          onClick={
            handleMapClick
          }
        />


        {/* ====================================================
            クリックした地点のマーカー
            ==================================================== */}

        {points.map(
          (
            point,
            index
          ) => (

            <Marker
              key={
                index
              }

              position={[
                point.lat,
                point.lng,
              ]}

              icon={
                L.divIcon({

                  className:
                    "",

                  html: `
                    <div
                      style="
                        width:30px;
                        height:30px;

                        border-radius:50%;

                        background:${
                          routeType ===
                          "ORANGE"
                            ? "#ff6600"
                            : "#2979ff"
                        };

                        border:3px solid white;

                        box-shadow:
                          0 2px 5px
                          rgba(0,0,0,0.35);

                        display:flex;

                        align-items:center;

                        justify-content:center;

                        color:white;

                        font-size:14px;

                        font-weight:bold;
                      "
                    >
                      ${
                        index + 1
                      }
                    </div>
                  `,

                  iconSize: [
                    30,
                    30,
                  ],

                  iconAnchor: [
                    15,
                    15,
                  ],

                })
              }
            >

              <Popup>

                <strong>
                  経由地点
                  {index + 1}
                </strong>

                <br />

                緯度：
                {
                  point.lat.toFixed(6)
                }

                <br />

                経度：
                {
                  point.lng.toFixed(6)
                }

              </Popup>

            </Marker>

          )
        )}


        {/* ====================================================
            クリックした地点を結ぶ仮線

            最後から最初にも戻す
            ==================================================== */}

        {points.length >= 2 && (

          <Polyline

            positions={[
              ...points.map(
                (
                  point
                ) => [

                  point.lat,
                  point.lng,

                ] as [
                  number,
                  number
                ]
              ),

              [
                points[0].lat,
                points[0].lng,
              ],

            ]}

            pathOptions={{

              color:
                "#999999",

              weight:
                2,

              dashArray:
                "6 6",

              opacity:
                0.7,

            }}

          />

        )}


        {/* ====================================================
            道路に沿った巡回ルート

            最後 → 最初も含む
            ==================================================== */}

        {routeCoordinates.length > 0 && (

          <Polyline

            positions={
              routeCoordinates
            }

            pathOptions={{

              color:
                routeType ===
                "ORANGE"
                  ? "#ff6600"
                  : "#2979ff",

              weight:
                7,

              opacity:
                0.9,

              lineCap:
                "round",

              lineJoin:
                "round",

            }}

          />

        )}

      </MapContainer>


      {/* ======================================================
          操作パネル
          ====================================================== */}

      <div
        style={{

          position:
            "absolute",

          top:
            "20px",

          right:
            "20px",

          width:
            "360px",

          maxHeight:
            "calc(100vh - 40px)",

          overflowY:
            "auto",

          padding:
            "20px",

          background:
            "rgba(255,255,255,0.96)",

          borderRadius:
            "14px",

          boxShadow:
            "0 4px 16px rgba(0,0,0,0.25)",

          zIndex:
            1000,

        }}
      >

        {/* ====================================================
            タイトル
            ==================================================== */}

        <h1
          style={{

            margin:
              "0 0 15px 0",

            fontSize:
              "22px",

            fontWeight:
              "bold",

          }}
        >

          公式ルート作成

        </h1>


        {/* ====================================================
            ルート選択
            ==================================================== */}

        <div
          style={{

            display:
              "flex",

            gap:
              "8px",

            marginBottom:
              "15px",

          }}
        >

          <button
            onClick={() =>
              changeRouteType(
                "ORANGE"
              )
            }

            style={{

              flex:
                1,

              height:
                "42px",

              border:
                "none",

              borderRadius:
                "8px",

              background:
                routeType ===
                "ORANGE"
                  ? "#ff6600"
                  : "#eeeeee",

              color:
                routeType ===
                "ORANGE"
                  ? "white"
                  : "#333333",

              fontWeight:
                "bold",

              cursor:
                "pointer",

            }}
          >

            オレンジ

          </button>


          <button
            onClick={() =>
              changeRouteType(
                "BLUE"
              )
            }

            style={{

              flex:
                1,

              height:
                "42px",

              border:
                "none",

              borderRadius:
                "8px",

              background:
                routeType ===
                "BLUE"
                  ? "#2979ff"
                  : "#eeeeee",

              color:
                routeType ===
                "BLUE"
                  ? "white"
                  : "#333333",

              fontWeight:
                "bold",

              cursor:
                "pointer",

            }}
          >

            ブルー

          </button>

        </div>


        {/* ====================================================
            説明
            ==================================================== */}

        <div
          style={{

            padding:
              "12px",

            marginBottom:
              "15px",

            background:
              "#f5f5f5",

            borderRadius:
              "8px",

            fontSize:
              "14px",

            lineHeight:
              "1.7",

          }}
        >

          <strong>
            ルートの作り方
          </strong>

          <br />

          地図上の道路を確認しながら、

          <br />

          <strong>
            通過する順番
          </strong>

          にクリックしてください。

          <br />
          <br />

          最後の地点から
          最初の地点へも
          自動的に接続されます。

          <br />
          <br />

          交差点や曲がり角などを
          指定すると、
          より公式ルートに近づけられます。

        </div>


        {/* ====================================================
            地点数
            ==================================================== */}

        <div
          style={{

            marginBottom:
              "12px",

            fontSize:
              "15px",

            fontWeight:
              "bold",

          }}
        >

          経由地点：

          {points.length}

          点

        </div>


        {/* ====================================================
            ルート生成
            ==================================================== */}

        <button
          onClick={
            createRoute
          }

          disabled={
            loading ||
            points.length < 2
          }

          style={{

            width:
              "100%",

            height:
              "46px",

            marginBottom:
              "8px",

            border:
              "none",

            borderRadius:
              "8px",

            background:
              loading ||
              points.length < 2
                ? "#cccccc"
                : "#333333",

            color:
              "white",

            fontSize:
              "14px",

            fontWeight:
              "bold",

            cursor:
              loading ||
              points.length < 2
                ? "default"
                : "pointer",

          }}
        >

          {loading
            ? "道路を検索中..."
            : "道路に沿ってルート生成"}

        </button>


        {/* ====================================================
            最後の地点を削除
            ==================================================== */}

        <button
          onClick={
            removeLastPoint
          }

          disabled={
            points.length === 0
          }

          style={{

            width:
              "100%",

            height:
              "38px",

            marginBottom:
              "8px",

            border:
              "1px solid #cccccc",

            borderRadius:
              "8px",

            background:
              "white",

            cursor:
              points.length === 0
                ? "default"
                : "pointer",

          }}
        >

          最後の地点を削除

        </button>


        {/* ====================================================
            全地点削除
            ==================================================== */}

        <button
          onClick={
            clearPoints
          }

          style={{

            width:
              "100%",

            height:
              "38px",

            marginBottom:
              "15px",

            border:
              "1px solid #cccccc",

            borderRadius:
              "8px",

            background:
              "white",

            cursor:
              "pointer",

          }}
        >

          すべて削除

        </button>


        {/* ====================================================
            GeoJSON保存
            ==================================================== */}

        <button
          onClick={
            downloadGeoJSON
          }

          disabled={
            routeCoordinates.length === 0
          }

          style={{

            width:
              "100%",

            height:
              "46px",

            border:
              "none",

            borderRadius:
              "8px",

            background:
              routeCoordinates.length > 0
                ? "#4CAF50"
                : "#cccccc",

            color:
              "white",

            fontSize:
              "14px",

            fontWeight:
              "bold",

            cursor:
              routeCoordinates.length > 0
                ? "pointer"
                : "default",

          }}
        >

          GeoJSONを保存

        </button>


        {/* ====================================================
            エラー表示
            ==================================================== */}

        {error && (

          <div
            style={{

              marginTop:
                "12px",

              padding:
                "10px",

              borderRadius:
                "7px",

              background:
                "#ffebee",

              color:
                "#c62828",

              fontSize:
                "13px",

              lineHeight:
                "1.5",

            }}
          >

            {error}

          </div>

        )}


        {/* ====================================================
            生成完了
            ==================================================== */}

        {routeCoordinates.length > 0 && (

          <div
            style={{

              marginTop:
                "12px",

              padding:
                "10px",

              borderRadius:
                "7px",

              background:
                "#e8f5e9",

              color:
                "#2e7d32",

              fontSize:
                "13px",

              lineHeight:
                "1.5",

            }}
          >

            道路に沿った
            <strong>
              巡回ルート
            </strong>
            を生成しました。

            <br />

            最後の地点から
            最初の地点まで
            道路に沿って
            接続されています。

            <br />

            経路ポイント数：
            {
              routeCoordinates.length
            }

          </div>

        )}

      </div>

    </div>

  );
}