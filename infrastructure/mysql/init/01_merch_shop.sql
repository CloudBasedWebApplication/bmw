USE bmw_app;

DROP TABLE IF EXISTS merch_shop;

CREATE TABLE merch_shop (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    color VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    gender VARCHAR(255),
    sizes VARCHAR(255),
    description VARCHAR(255),
    minioObject VARCHAR(255)
);

INSERT INTO merch_shop (
    id, name, category, color, price, gender, sizes, description, minioObject
) VALUES
(1, 'BMW Poloshirt', 'clothes', 'Schwarz', 45.50, 'Unisex', 'S,M,L,XL', 'Bequemes Poloshirt mit lockerer Passform.', 'merch-shop/BMW_Merchandise_Schwarz.avif'),
(2, 'BMW Poloshirt', 'clothes', 'Weiß', 45.50, 'Unisex', 'S,M,L,XL', 'Bequemes Poloshirt mit lockerer Passform.', 'merch-shop/BMW_Merchandise_weiß.avif'),
(3, 'BMW Isolierte Jacke', 'clothes', 'Schwarz', 258.30, 'Unisex', 'S,M,L,XL', 'Warme Jacke mit wasserabweisender Oberfläche.', 'merch-shop/BMW_Merchandise_Schwarz_Pullover.avif'),
(4, 'BMW Kapuzenjacke', 'clothes', 'Blau', 77.00, 'Unisex', 'S,M,L,XL', 'Sportliche Kapuzenjacke mit hohem Tragekomfort.', 'merch-shop/BMW_Merchandise_Blau_Pullover.avif'),
(5, 'BMW Sweatshirt', 'clothes', 'Schwarz', 70.00, 'Unisex', 'S,M,L,XL', 'Bequemes Sweatshirt mit weichem Material.', 'merch-shop/BMW_Merchandise_Sweatshirt.avif'),
(6, 'BMW Z1 Modellauto', 'accessoires', 'Grün', 139.00, NULL, NULL, 'Detailgetreues Modellauto im Maßstab 1:18.', 'merch-shop/BMW_Merchandise_Modellauto.avif'),
(7, 'BMW Smartphone-Hülle', 'accessoires', 'Blau', 84.00, NULL, 'iPhone 16 Pro Max, iPhone 16, iPhone 15 Pro Max, iPhone 15', 'Robuste Hülle mit Stoßschutz und MagSafe.', 'merch-shop/BMW_Merchandise_Iphone_Huelle.avif');
