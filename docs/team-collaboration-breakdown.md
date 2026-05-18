# Team Collaboration Breakdown

## 1. Zweck und Nutzung

Dieses Dokument ist der Einstieg fuer claimbare Aufgaben in der aktuellen Kollaborationsphase. Es basiert auf dem aktuellen Implementierungsstand und ersetzt aeltere Next-Phase-Listen, die inzwischen durch gemergte Arbeit ueberholt sind.

Grundregeln fuer die Task-Arbeit:

- Keine kompletten Module claimen, nur einzelne Task-Eintraege.
- `★★★`-Tasks werden zuerst als Vertrags- oder Schnittstellenaufgabe abgestimmt und erst danach implementiert.
- Ein Task soll moeglichst in einem PR schliessbar sein.

Priorisierte Datenbasis: `docs/project-status.md` -> `docs/PRD.md` -> `docs/architecture.md` -> Code und Git-Historie nur zur Klaerung offener Punkte.

## 2. Aktueller Stand

Das Projekt hat jetzt eine getrennte Browser- und API-Schicht:

- `services/web-shop-frontend` ist der einzige host-exponierte App-Container, serviert `/static` und leitet alle anderen Browser-Requests an `web-shop-backend` weiter.
- `services/web-shop-backend` rendert die EJS-Seiten und leitet `/api/*` same-origin an `api-gateway` weiter.
- `api-gateway` proxyt APIs, setzt die Cart-Session-Cookie und stellt produktnahe Support-Endpunkte wie `/api/destinations` bereit.
- `car-configurator`, `merch-shop`, `ai-feature` und `shopping-cart` bilden die Backend-Dienste.
- MySQL, Redis und MinIO sind ueber Docker Compose integriert.

Bereits erledigt und nicht mehr als Next-Phase-Arbeit zu planen:

- AI Prompt/Template plus strukturiertes Output-Schema
- Merch Product Detail Route und Detail View
- Cart Quantity Update und Clear Cart
- Destination Endpoint plus Route-Page-Migration
- Phase 2 Service-owned Image Endpoints; Browser-Bildpfade laufen ueber `/api/configurator/assets/*` und `/api/merch/assets/*`, MinIO API 9000 ist nur noch Docker-intern

Aktuell akzeptierte Vereinfachungen bleiben bestehen:

- Gemeinsame Nutzung von `bmw_app`, mit Service Ownership per Konvention
- Keine Authentifizierung und kein Checkout
- Configurator bleibt im Rahmen des vorhandenen Options- und Datenmodells
- AI ist ein Orchestrierungsdienst und besitzt kein Datenbankschema

## 3. Modul-Aufteilung

### 3.1 `web-shop-frontend` / `web-shop-backend`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | EJS-Seiten fuer Home, Configurator, Merch, Merch Detail, AI, Cart und Impressum in `web-shop-backend` rendern. | — | Nutzer erreichen alle Hauptseiten ueber den Browser-Einstieg. |
| Static / Proxy | `Abgeschlossen` | `★` | `/static` und Host-Port 3000 in `web-shop-frontend` bereitstellen; sonst an `web-shop-backend` proxien. | — | Nur der Frontend-Container ist als App am Host exponiert. |
| API / Contract | `Abgeschlossen` | `★★` | Same-origin `/api/*` ueber `web-shop-backend` an `api-gateway` weiterleiten. | — | Client-Code nutzt keine container-internen URLs. |
| Integration / Connectivity | `Abgeschlossen` | `★★` | Merch-SSR-Daten ueber Gateway `/api/merch/products` und `/api/merch/products/:productId` laden. | api-gateway Merch-Routen. | Die Praesentationsschicht ruft `merch-shop` nicht direkt auf. |
| Integration / Connectivity | `Abgeschlossen` | `★★` | Service-owned Image Endpoints fuer Configurator und Merch ueber Gateway bereitstellen. | car-configurator und merch-shop Asset-Routen. | Browser-Bildpfade nutzen `/api/configurator/assets/*` und `/api/merch/assets/*`; kein `/minio` Browservertrag. |
| Integration / Connectivity | `Offen` | `★★` | AI-Merch-Links auf die kanonische Detailroute `/merch-shop/:productId` oder Slug ausrichten. | AI URL-Builder anpassen. | AI-Empfehlungen oeffnen direkt die passende Produktdetailseite. |

### 3.2 `api-gateway`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| API / Contract | `Abgeschlossen` | `★★` | Configurator-, Merch-, Cart- und AI-APIs proxien. | — | Frontend-Flows bleiben same-origin und serviceunabhaengig. |
| API / Contract | `Abgeschlossen` | `★` | `/api/destinations` bereitstellen. | — | Route Planning konsumiert Backend-gelieferte Ziel-Daten. |
| Session | `Abgeschlossen` | `★` | Cart-Session-Cookie fuer anonyme Warenkoerbe setzen. | — | Cart-Zustand ist pro Browser-Session getrennt. |
| Maintenance | `Abgeschlossen` | `★` | Alte page-rendering Routen im Gateway entfernt. | `web-shop-backend` deckt alle Browser-Routen ab. | Gateway bleibt klar API-fokussiert. |

### 3.3 `car-configurator`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| API / Contract | `Abgeschlossen` | `★★` | Modelle, Optionen, Konfigurationen und offizielle Preis-/Bilddaten liefern. | — | Frontend und AI koennen unterstuetzte Konfigurationen aus Service-Daten ableiten. |
| Data / Storage | `Abgeschlossen` | `★★` | Konfigurationsdaten in MySQL lesen und Bildkeys auf MinIO-URLs abbilden. | — | Der Dienst bleibt Source of Truth fuer Konfigurationsgueltigkeit, Preis und Bildreferenzen. |
| API / Contract | `Offen` | `★★` | Einen finalen Resolution-/Validation-Schritt fuer AI-Car-Empfehlungen sauber nutzen oder dokumentieren. | Entscheidung, ob PRD-Wortlaut strikt umgesetzt werden soll. | AI kann vor der Antwort ein offizielles Configurator-Ergebnis validieren. |

### 3.4 `merch-shop`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| API / Contract | `Abgeschlossen` | `★★` | Produktliste und Produktdetails ueber stabile IDs/Slugs liefern. | — | Listen- und Detailseiten nutzen dieselbe Produktquelle. |
| Page / UI | `Abgeschlossen` | `★★` | Produktdetail-Erlebnis ueber `web-shop-backend` bereitstellen. | — | Nutzer koennen einzelne Produkte direkt oeffnen. |
| Integration / Connectivity | `Offen` | `★★` | AI-Empfehlungslinks auf die bestehende Detailroute abstimmen. | AI URL-Builder. | Empfehlungen landen nicht mehr auf der generischen Liste. |

### 3.5 `shopping-cart`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| API / Contract | `Abgeschlossen` | `★★` | Add, List, Quantity Update, Remove und Clear unterstuetzen. | — | Nutzer koennen Warenkorbpositionen verwalten, ohne Delete-und-Readd Workarounds. |
| Page / UI | `Abgeschlossen` | `★★` | Quantity Controls und Total-Aktualisierung auf der Cart-Seite. | — | Mengen- und Preisanderungen sind direkt sichtbar. |
| API / Contract | `Spaetere Erweiterung` | `★` | Quantity-Policy fuer Car Items explizit festlegen. | Produktentscheidung. | Team kann klar sagen, ob Car Items immer Quantity 1 bleiben. |

### 3.6 `ai-feature`

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| API / Contract | `Abgeschlossen` | `★★★` | Prompt/Template und strukturiertes Gemini Response-Schema verwenden. | — | Frontend konsumiert stabile Felder statt frei schwankender Modelltexte. |
| Data Boundary | `Abgeschlossen` | `★★★` | Domain-Daten nur ueber `car-configurator` und `merch-shop` APIs beziehen, kein direkter MySQL-Zugriff. | — | AI bleibt Integrations-/Orchestrierungsservice ohne Datenbank-Ownership. |
| Integration / Connectivity | `Abgeschlossen` | `★★` | Merch URLs von `/merch-shop?product=<id>` auf kanonische Detailroute umstellen. | Bestehende Merch Detail Route. | AI-Merch-Empfehlungen sind echte Deep Links. |
| Integration / Connectivity | `Offen` | `★★` | Optional: Car Recommendations vor der Antwort ueber Configurator API offiziell validieren. | Entscheidung zum PRD-Akzeptanzniveau. | AI-Antworten enthalten nur offiziell aufloesbare Konfigurationen. |

## 4. Moduluebergreifende Vertragsaufgaben

| Vertragsthema | Status | Komplexitaet | Warum moduluebergreifend | Sichtbares Ergebnis |
|---|---|---|---|---|
| AI no-DB boundary | `Abgeschlossen` | `★★★` | Betrifft Architektur, AI, Configurator und Merch. | AI nutzt Service-APIs statt SQL oder fremder Tabellen. |
| Merch recommendation URL contract | `Offen` | `★★` | Betrifft `ai-feature`, `web-shop-backend` und `merch-shop`. | AI kennt ein stabiles Produktziel und der Web-Shop kann es direkt rendern. |
| AI car official resolution | `Offen` | `★★` | Betrifft `ai-feature` und `car-configurator`. | Car-Empfehlungen koennen vor der Antwort gegen Configurator-Daten validiert werden. |
| Web/API responsibility split | `Abgeschlossen` | `★★` | Betrifft `web-shop-frontend`, `web-shop-backend`, `api-gateway`, Docker Compose und Doku. | Browser-Praesentation, SSR und API-Proxying sind klar getrennt. |

## 5. Current Key Path

Die naechste sinnvolle Kette ist klein und konkret:

1. AI merch recommendation links auf `/merch-shop/:productId` oder Slug umstellen.
2. Entscheiden, ob AI car recommendations vor der Antwort zwingend ueber Configurator API validiert werden muessen.
3. Falls ja: Configurator-Resolution in `ai-feature` integrieren und Fehlerfaelle sauber behandeln.
4. Danach `project-status.md` und `architecture.md` erneut mit dem finalen Verhalten abgleichen.

Nicht mehr Teil der kritischen Kette:

- AI Prompt/Template + Output Schema
- Merch Product Detail View
- Cart Quantity Update
- Destination Endpoint
- Route-Planning Migration auf Gateway-Destinationen
