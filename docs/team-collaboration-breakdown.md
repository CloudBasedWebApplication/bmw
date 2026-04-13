# Team Collaboration Breakdown

## 1. Zweck und Nutzung

Dieses Dokument ist der zentrale Einstieg fuer die Aufgabenverteilung in der aktuellen Kollaborationsphase. Die urspruengliche Aufteilung in 6 Module wird hier in kleinteilige, claimbare Tasks ueberfuehrt, ohne den aktuellen Projektfortschritt zu ignorieren.

Grundregeln fuer die Task-Arbeit:

- Keine kompletten Module claimen — nur einzelne Task-Eintraege.
- `★★★`-Tasks werden zuerst als Vertrags- oder Schnittstellenaufgabe abgestimmt und erst danach implementiert.
- Ein Task soll moeglichst in einem PR schliessbar sein.

Die Datenbasis fuer dieses Dokument ist fest priorisiert: `docs/project-status.md` → `docs/PRD.md` → `docs/architecture.md` → Code und Git-Historie nur zur Klaerung offener Punkte.

## 2. Aktueller Stand

Es gibt bereits einen funktionsfaehigen Phase-1-Skeleton mit `api-gateway`, `car-configurator`, `merch-shop`, `ai-feature`, `shopping-cart`, Docker Compose, MySQL, Redis und MinIO. Gateway, Configurator, Merch, AI, Cart und Route-Planning sind als Seiten erreichbar.

Aktuell akzeptierte Vereinfachungen bleiben bestehen:

- Gemeinsame Nutzung von `bmw_app`
- Direkte Frontend-Links aus `ai-feature`
- Bewusst flache Parametertiefe im Configurator

Fuer die naechste Phase sind vier Luecken bestaetigt:

- AI Prompt/Template plus Output-Schema
- Produkt-Detailansicht fuer Merch-Empfehlungen
- Quantity Update im Cart
- Destinationen aus `api-gateway` statt aus Frontend-Hardcoding

## 3. Modul-Aufteilung

### 3.1 `car-configurator`

Dieses Modul ist nicht "fehlend". Es schliesst bereits den vereinfachten Phase-1-Loop und ist kein Schwerpunkt der naechsten Phase, solange kein anderer Task reichere Konfigurationsdaten benoetigt.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Configurator-Seite laedt Modelle, wechselt Farben, zeigt Bilder und den vom Backend gelieferten Preis. | — | Ein Nutzer kann die aktuelle Konfigurationsschleife ohne Mock-Platzhalter durchspielen. |
| Page / UI | `Akzeptierte Vereinfachung` | `★` | Die aktuelle UI bleibt auf den vorhandenen flachen Parametersatz begrenzt. | — | Das Team behandelt die geringe Parametertiefe als bewusste Phasenentscheidung und nicht als Bug. |
| API / Contract | `Abgeschlossen` | `★★` | Die aktuelle Configurator-API liefert offizielle Bildlinks und einen serverseitig berechneten Endpreis fuer unterstuetzte Kombinationen. | — | Das Frontend kann den offiziellen Zustand ohne clientseitige Preislogik rendern. |
| API / Contract | `Spaetere Erweiterung` | `★★` | Den Response-Vertrag um Felder wie `configurationId`, `basePrice`, `optionAdjustments` und strukturiertes `rationale` erweitern. | Erst wenn Downstream-Consumer diese Felder wirklich brauchen. | Die im PRD beschriebenen Zielfelder existieren im API-Vertrag und koennen von AI, Cart oder erweiterten UIs genutzt werden. |
| Data / Storage | `Abgeschlossen` | `★★` | Konfigurationskombinationen sind ueber MySQL-Daten und Bildkeys hinterlegt. | — | Unterstuetzte Kombinationen werden aus gespeicherten Daten statt aus statischen Frontend-Mappings aufgeloest. |
| Data / Storage | `Spaetere Erweiterung` | `★★` | Das Datenmodell um echte zusaetzliche Optiondimensionen wie trim oder wheels erweitern. | Erst nach expliziter Scope-Entscheidung. | Eine neue Optiondimension existiert sowohl in den Daten als auch im offiziellen Ergebnisfluss. |
| Integration / Connectivity | `Abgeschlossen` | `★★` | Configurator ist bereits mit MinIO-basierten Bildreferenzen und dem Gateway-Fluss verbunden. | — | End-to-End-Ergebnisse enthalten funktionierende Bild-URLs und werden in der Seite angezeigt. |

### 3.2 `ai-feature`

Dieses Modul ist einer der Hauptschwerpunkte der naechsten Phase. Der Laufzeitfluss existiert bereits, aber Prompt/Template und Output-Vertrag sind noch unterdefiniert.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Die AI-Seite ist erreichbar und kann Natural-Language-Anfragen abschicken. | — | Ein Nutzer kann einen Prompt absenden und eine Antwort auf der Seite sehen. |
| Page / UI | `Spaetere Erweiterung` | `★★` | Den AI-Einstieg von einer Einzel-Seite in Richtung globales Widget oder geteiltes Interaktionsmuster weiterentwickeln. | Nach stabilem Prompt/Schema-Vertrag. | Nutzer koennen AI spaeter von mehr als einer Seite aus nutzen. |
| API / Contract | `Naechste Phase` | `★★★` | Das AI Prompt/Template als stabilen Vertrag statt als lose Prompt-Formulierung entwerfen. | — | Es gibt ein abgestimmtes Template mit Zweck, Context-Injection-Regeln und klaren Output-Erwartungen. |
| API / Contract | `Naechste Phase` | `★★★` | Das AI-Response-Schema definieren, das vom Frontend konsumiert wird. | Nach Prompt/Template-Entwurf. | Das Frontend ist nicht mehr von frei schwankender Modell-Ausgabeform abhaengig. |
| API / Contract | `Akzeptierte Vereinfachung` | `★` | AI liefert aktuell direkt Frontend-Links. | — | Dieses Verhalten bleibt in der aktuellen Phase bewusst unveraendert. |
| API / Contract | `Spaetere Erweiterung` | `★★` | Car Recommendations spaeter ueber einen reicheren Configurator-Resolution-Flow fuehren. | Nach reicheren Configurator-Feldern. | AI-Empfehlungen koennen mehr als den aktuellen flachen Parametersatz verwenden. |
| API / Contract | `Spaetere Erweiterung` | `★★` | Reichere Erklaerungsfelder oder Recommendation-Metadaten zurueckgeben. | Nach stabilem Schema. | Downstream-Seiten koennen mehr als einen generischen Erklaerungsblock rendern. |
| Data / Storage | `Abgeschlossen` | `★★` | AI liest bereits Kontext aus Configurator- und Merch-Diensten, bevor Gemini aufgerufen wird. | — | Empfehlungen basieren auf Live-Service-Kontext statt auf isolierten Hardcodings. |
| Integration / Connectivity | `Naechste Phase` | `★★★` | AI-Outputs mit Merch-Detail-Routing und Configurator-Empfehlungszielen in Einklang bringen. | Nach Response-Schema und Merch-Detail-Vertrag. | Jedes AI-Ziel landet sauber auf einer stabilen Frontend-Destination. |

### 3.3 `merch-shop`

Dieses Modul verkauft bereits Produkte, hat aber noch keine praezise Produkt-Detail-Landing-Strategie fuer AI und Deep Links.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Die Merch-Seite rendert Produktkarten mit Bild, Preis und Add-to-Cart-Aktion. | — | Ein Nutzer kann Produkte browsen und direkt aus der Liste in den Cart legen. |
| Page / UI | `Naechste Phase` | `★★` | Eine Produkt-Detailansicht oder einen klaren Detail-State fuer den Merch-Flow einfuehren. | Nach stabiler Entscheidung fuer das Produkt-Detail-Routing. | Ein Nutzer kann ein konkretes Produkt gezielt oeffnen und nicht nur im generischen Grid sehen. |
| Page / UI | `Spaetere Erweiterung` | `★` | Nach Einfuehrung der Detailansicht feinere Produkt-Metadaten sichtbar machen. | Nach Produkt-Detail-Erlebnis. | Reichere Produktinformationen lassen sich anzeigen, ohne die Listenansicht zu ueberladen. |
| API / Contract | `Abgeschlossen` | `★★` | Der Merch-Service liefert Produktlistendaten mit Preis- und Bildmetadaten. | — | Das Gateway kann die aktuelle Merch-Seite aus Backend-Daten rendern. |
| API / Contract | `Naechste Phase` | `★★★` | Den Merch-Recommendation-Landing-Vertrag fuer AI definieren. | Nach Entscheidung fuer Produkt-Detail-Route oder Detail-State. | AI kann auf ein stabiles Produktsziel zeigen statt nur zur generischen Liste zurueckzuspringen. |
| Data / Storage | `Abgeschlossen` | `★★` | Der Produktkatalog ist in MySQL hinterlegt und mit Bildobjekten verknuepft. | — | Merch-Daten bestehen nicht nur aus Mock-Content. |
| Integration / Connectivity | `Naechste Phase` | `★★` | Merch-Detail-Routing mit Gateway und AI-Recommendation-Zielen verbinden. | Nach Merch-Detail-Vertrag. | Direkte Merch-Links funktionieren konsistent aus Navigation und AI-Ausgabe. |

### 3.4 `shopping-cart`

Dieses Modul ist einer der Hauptschwerpunkte der naechsten Phase. Der Cart-Loop existiert, aber die Editierbarkeit ist fuer Merch-Flows noch zu schwach.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Die Cart-Seite kann Eintraege listen und Eintraege entfernen. | — | Aktuelle Cart-Inhalte werden gerendert und Deletions sind sichtbar wirksam. |
| Page / UI | `Naechste Phase` | `★★` | Quantity-Editing fuer Merchandise direkt in der Cart-Seite einfuehren. | Nach Quantity-Update-API. | Nutzer koennen die Merch-Menge aendern, ohne zu loeschen und neu hinzuzufuegen. |
| Page / UI | `Naechste Phase` | `★` | Die sichtbare Total-Preis-Aktualisierung nach Mengenanpassung absichern. | Nach Quantity-Update-API und UI-Interaktion. | Der gerenderte Gesamtpreis reagiert sofort und korrekt auf Quantity-Aenderungen. |
| API / Contract | `Abgeschlossen` | `★★` | Cart unterstuetzt bereits list, add und remove auf Redis-basiertem Session-State. | — | Das Gateway kann Cart-Eintraege im aktuellen Session-Kontext persistieren und wieder lesen. |
| API / Contract | `Naechste Phase` | `★★` | Eine dedizierte Quantity-Update-API fuer Merchandise einfuehren. | — | Mengenanpassungen laufen ueber eine definierte Cart-Operation statt ueber Delete-und-Readd. |
| API / Contract | `Akzeptierte Vereinfachung` | `★` | Car Items duerfen in der aktuellen Phase weiterhin als Snapshots gespeichert und angezeigt werden. | — | Das Team behandelt das Snapshot-Modell fuer Autos vorerst als ausreichend. |
| API / Contract | `Spaetere Erweiterung` | `★★` | Das Merge-Verhalten fuer identische Merch-Produkte festlegen. | Nach Quantity-Update-Verhalten. | Der Cart-Vertrag sagt explizit, ob wiederholte Adds verschmolzen oder getrennt bleiben. |
| API / Contract | `Spaetere Erweiterung` | `★★` | Die Quantity-Policy fuer Car Items explizit festlegen. | Nach Stabilisierung des Merch-Quantity-Flows. | Das Team kann klar beantworten, ob Car Items immer Quantity-1 bleiben oder anders behandelt werden. |
| Data / Storage | `Abgeschlossen` | `★★` | Cart-State ist bereits unter einem session-basierten Redis-Key gespeichert. | — | Cart-Persistenz ist nicht mehr nur in-memory. |
| Integration / Connectivity | `Naechste Phase` | `★★` | Cart-Item-Shape mit Quantity-Update-Verhalten und Total-Berechnung abgleichen. | Nach Quantity-Update-API. | Cart-UI, Gateway und Cart-Service haben das gleiche Verstaendnis von Mengenlogik und Total-Aenderung. |

### 3.5 `api-gateway`

Dieses Modul ist nicht mehr "Basis fuer spaeter", sondern bereits der produktive Einstiegspunkt und gleichzeitig die wichtigste Integrationsschicht der naechsten Phase.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Das Gateway stellt bereits Einstiegsrouten fuer alle Hauptseiten bereit. | — | Nutzer koennen ueber einen einheitlichen Einstieg durch die aktuelle Plattform navigieren. |
| API / Contract | `Abgeschlossen` | `★★` | Das Gateway proxyt bereits die benoetigten Service-APIs fuer die existierenden Seiten. | — | Frontend-Seiten muessen nicht direkt auf alle container-internen Services zugreifen. |
| API / Contract | `Naechste Phase` | `★★` | Einen `/api/destinations`-Endpoint oder eine gleichwertige interne Route fuer Route Targets einfuehren. | — | Route-Planning-Destinationen werden aus dem Gateway geladen statt aus dem Seitentemplate. |
| API / Contract | `Naechste Phase` | `★★` | Stabiles Routing oder stabiles Link-Handling fuer Merch-Detail-Landings und AI-Empfehlungsziele bereitstellen. | Nach Merch-Detail-Vertrag und AI-Output-Vertrag. | Gateway-seitige Routen tragen Deep Links in die beabsichtigte User Experience. |
| Data / Storage | `Spaetere Erweiterung` | `★` | Gemeinsame page-level Data-Helper nur dann weiter konsolidieren, wenn die Wiederholung real stoert. | Nur bei wachsendem Shared-Bedarf. | Wiederholte Verkabelungslogik sinkt, ohne eine schwere Framework-Schicht einzufuehren. |
| Integration / Connectivity | `Naechste Phase` | `★★` | Die Route-Planning-Seite an Gateway-gelieferte Destinationen anbinden. | Nach Destinations-Endpoint. | Die Route-Seite besitzt ihre Destination-Daten nicht mehr selbst. |
| Integration / Connectivity | `Naechste Phase` | `★★` | Gateway-Flows fuer Merch-Detail-Landing und AI-Target-Routing schliessen. | Nach Merch-Detail-Vertrag und AI-Output-Vertrag. | AI-Links und direkte Navigation landen auf stabilen Gateway-gesteuerten Experiences. |

### 3.6 `前端页面 + 路线规划`

Dieser Bereich ist kein reiner Styling-Block, sondern die Schicht, in der aus vorhandenen Backend-Funktionen vollstaendige Nutzerfluesse werden.

| Catalog | Status | Komplexitaet | Aufgabe | Abhaengigkeit | Sichtbares Ergebnis |
|---|---|---|---|---|---|
| Page / UI | `Abgeschlossen` | `★` | Die vorhandenen Seiten fuer Gateway, Configurator, Merch, AI, Cart und Route Planning sind erreichbar. | — | Das sichtbare Page-Skeleton fuer das aktuelle Produkt existiert end-to-end. |
| Page / UI | `Naechste Phase` | `★★` | Die Route-Seite so umbauen, dass Destinationen aus `api-gateway` geladen werden. | Nach Destinations-Endpoint. | Die Seite rendert Ziele aus Backend-Daten statt aus Hardcoding. |
| Page / UI | `Naechste Phase` | `★★` | Cart-Quantity-Interaktion in der Cart-Seite ergaenzen. | Nach Cart-Quantity-Update-API. | Ein Merch-Item kann auf der Seite in der Menge geaendert werden und das Total aktualisiert sich. |
| Page / UI | `Naechste Phase` | `★★` | Eine Merch-Detail-UI oder einen klaren Detail-State einfuehren. | Nach Entscheidung fuer Merch-Detail-Routing. | Nutzer koennen ein Produkterlebnis ueber einen stabilen Detail-Einstieg oeffnen. |
| Page / UI | `Spaetere Erweiterung` | `★★` | Den AI-Zugang von einer Einzel-Seite in Richtung globales Interaktionsmuster erweitern. | Nach Stabilisierung des AI-Vertrags. | Die AI wirkt spaeter produktweit integriert statt isoliert. |
| API / Contract | `Naechste Phase` | `★★` | Sicherstellen, dass Frontend-Verhalten auf abgestimmten Gateway- und AI-Vertraegen basiert statt auf lokalen Annahmen. | Nach AI-Schema, Merch-Detail-Vertrag und Destinations-Endpoint. | Seitenlogik kodiert keine instabilen Annahmen, die spaeter mit Backends kollidieren. |
| Data / Storage | `Abgeschlossen` | `★` | Die sichtbaren Seiten konsumieren in den aktuell unterstuetzten Flows bereits Live-Daten. | — | Die grossen sichtbaren Seiten laufen nicht mehr nur auf Platzhalter-Inhalten. |
| Integration / Connectivity | `Naechste Phase` | `★★` | Die verbleibenden Seitenschleifen fuer Route-Destinationen, Merch-Detail-Landing und Cart-Quantity schliessen. | Nach den entsprechenden Gateway- oder Service-Vertraegen. | Die bestaetigten sichtbaren Luecken der naechsten Phase sind in der aktuellen Seitensammlung geschlossen. |

## 5. Moduluebergreifende Vertragsaufgaben

| Vertragsthema | Status | Komplexitaet | Warum moduluebergreifend | Sichtbares Ergebnis |
|---|---|---|---|---|
| AI prompt/template + schema | `Naechste Phase` | `★★★` | Betrifft `ai-feature`, Frontend-Rendering, Merch-Landing und spaetere Configurator-Integration. | Das Team hat ein abgestimmtes Prompt/Template und genau ein Output-Schema, dem Downstream-Code vertrauen kann. |
| Merch recommendation link contract | `Naechste Phase` | `★★★` | Betrifft `ai-feature`, `merch-shop`, `api-gateway` und das Verhalten der Merch-Seiten. | Ein einheitliches Ziel-Format fuer Merch-Empfehlungen ist abgestimmt und funktioniert fuer direkte Oeffnung. |
| Cart item shape + quantity update contract | `Naechste Phase` | `★★★` | Betrifft Cart-Service, Gateway-Proxying, Cart-Seite und Total-Berechnung. | Alle Schichten verwenden das gleiche Modell fuer Mengenlogik und Aktualisierung. |
| Destination endpoint payload contract | `Naechste Phase` | `★★★` | Betrifft `api-gateway`, Route-Planning-Seite und die kuenftige Wartbarkeit der Destination-Daten. | Destination-Daten haben ein abgestimmtes internes Payload-Format und die Route-Seite konsumiert genau dieses Format. |

## 6. Next-Phase Key Path

Die naechste Phase beginnt nicht mit allgemeinen Refactorings. Die kritische Kette in Reihenfolge:

1. AI prompt/template + output schema
2. Merch-Detail-Landing + Gateway-Anschluss
3. Cart-Quantity-Update-API + Seiteninteraktion
4. `api-gateway` Destinations-Endpoint + Migration der Route-Seite

Nicht Teil dieser kritischen Kette:

- Erweiterung der Configurator-Parameter
- Aenderung der gemeinsamen Nutzung von `bmw_app`
- Das Prinzip direkter Frontend-Links aus AI (bleibt, solange das Zielformat praeziser wird)
- Bereits fertiggestellte Phase-1-Skeleton-Arbeit (wird nicht erneut als Startpunkt behandelt)
