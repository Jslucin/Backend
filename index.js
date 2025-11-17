const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Seguridad simple: compara un API_KEY enviado en header con la variable de entorno
const API_KEY = process.env.API_KEY || "demo_key_change_this";

// Leer la credencial de servicio desde la variable de entorno SERVICE_ACCOUNT_JSON
// y escribirla temporalmente a serviceAccountKey.json para inicializar firebase-admin.
if (!process.env.SERVICE_ACCOUNT_JSON) {
  console.error("Falta la variable de entorno SERVICE_ACCOUNT_JSON");
  throw new Error("No SERVICE_ACCOUNT_JSON");
}

try {
  let jsonContent = process.env.SERVICE_ACCOUNT_JSON.trim();

  if (!jsonContent.startsWith("{")) {
    jsonContent = Buffer.from(jsonContent, "base64").toString("utf8");
  }

  const serviceAccount = JSON.parse(jsonContent);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("Firebase admin inicializado correctamente");

} catch (err) {
  console.error("Error parseando SERVICE_ACCOUNT_JSON:", err);
  throw err;
}


try {
  const saJson = process.env.SERVICE_ACCOUNT_JSON;
  // Si se guarda base64, decodificar
  let jsonContent = saJson;
  try {
    // si es base64 detectamos por caracteres no JSON
    if (!saJson.trim().startsWith("{")) {
      jsonContent = Buffer.from(saJson, "base64").toString("utf8");
    }
    const tmpPath = "/tmp/serviceAccountKey.json";
    fs.writeFileSync(tmpPath, jsonContent, { encoding: "utf8" });
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(jsonContent))
    });
    console.log("Firebase admin inicializado correctamente");
  } catch (err) {
    console.error("Error parseando SERVICE_ACCOUNT_JSON:", err);
    process.exit(1);
  }
} catch (err) {
  console.error("Error inicializando service account:", err);
  process.exit(1);
}

// Endpoint healthcheck
app.get("/", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Endpoint para enviar notificación
app.post("/send", async (req, res) => {
  try {
    // Autorización simple
    const key = req.header("x-api-key") || req.query.api_key;
    if (!key || key !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token, solicitudId, cliente_nombre, origen_lat, origen_lng, destino } = req.body;
    if (!token || !solicitudId) {
      return res.status(400).json({ error: "Faltan campos token o solicitudId" });
    }

    // Payload data + notification (notification para que suene incluso si la app está cerrada)
    const message = {
      token: token,
      notification: {
        title: "Nueva solicitud de mototaxi",
        body: `${cliente_nombre || "Cliente"} solicita viaje a ${destino || "destino"}`
      },
      data: {
        type: "solicitud",
        solicitud_id: String(solicitudId),
        cliente_nombre: cliente_nombre ? String(cliente_nombre) : "Cliente",
        origen_lat: String(origen_lat ?? ""),
        origen_lng: String(origen_lng ?? ""),
        destino: destino ? String(destino) : ""
      }
    };

    const response = await admin.messaging().send(message);
    return res.json({ success: true, result: response });
  } catch (error) {
    console.error("Error enviando mensaje:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server escuchando en puerto ${PORT}`);
});
