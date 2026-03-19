CREATE DATABASE IF NOT EXISTS empanadas_kame CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE empanadas_kame;

-- ── USUARIOS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  full_name           VARCHAR(150) NOT NULL,
  username            VARCHAR(80)  UNIQUE NOT NULL,
  email               VARCHAR(150) UNIQUE NOT NULL,
  password            VARCHAR(255) NOT NULL,
  phone               VARCHAR(20),
  role                ENUM('client','admin') DEFAULT 'client',
  avatar              VARCHAR(500),
  banner              VARCHAR(500),
  bio                 TEXT,
  is_active           BOOLEAN DEFAULT TRUE,
  ambiente_numero     VARCHAR(50),
  nombre_completo_real VARCHAR(200),
  celular             VARCHAR(20),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Admin se crea/actualiza automáticamente al arrancar el servidor
-- Credenciales: admin@kame.com / admin123

-- ── CONFIGURACIÓN DEL SITIO ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_config (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  config_key   VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO site_config(config_key,config_value) VALUES
('site_name','Empanadas Kame'),('site_logo',''),
('primary_color','#FF6B00'),('secondary_color','#FFD700'),('accent_color','#CC0000'),
('nequi_phone','3001234567'),('nequi_qr',''),('nequi_name','Empanadas Kame');

-- ── CARRUSEL ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carousel_slides (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  image_url   VARCHAR(500) NOT NULL,
  title       VARCHAR(200),
  subtitle    TEXT,
  button_text VARCHAR(100),
  button_link VARCHAR(255),
  is_active   BOOLEAN DEFAULT TRUE,
  order_index INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO carousel_slides(image_url,title,subtitle,button_text,button_link,order_index) VALUES
('https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1400','¡El Sabor del Guerrero!','Empanadas artesanales con el poder del Kame Sennin','Ver Menú','#productos',1),
('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400','Combos Épicos','Combinaciones que te llevarán al siguiente nivel','Ver Combos','#combos',2),
('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400','Entrega Express','Rápido como el Nimbo Volador','Pedir Ahora','#productos',3);

-- ── CATEGORÍAS Y PRODUCTOS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  icon      VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE
);
INSERT IGNORE INTO categories(id,name,icon) VALUES(1,'Empanadas','🥟'),(2,'Adiciones','🥤');

CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  category_id      INT,
  name             VARCHAR(150) NOT NULL,
  description      TEXT,
  price            DECIMAL(10,2) NOT NULL,
  discount_percent INT DEFAULT 0,
  images           JSON,
  stock            INT DEFAULT 999,
  is_active        BOOLEAN DEFAULT TRUE,
  is_featured      BOOLEAN DEFAULT FALSE,
  dragon_ball_ref  VARCHAR(150),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
INSERT IGNORE INTO products(id,category_id,name,description,price,images,is_featured,dragon_ball_ref) VALUES
(1,1,'Empanada de Carne','Rellena con carne molida sazonada al estilo Kame, cebolla caramelizada y especias secretas.',3500,'["https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600"]',TRUE,'Poder de Goku'),
(2,1,'Empanada de Pollo','Pollo desmenuzado marinado con hierbas ancestrales del Templo Kame.',3500,'["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600"]',TRUE,'Velocidad de Krilin'),
(3,1,'Empanada Mixta','La fusión perfecta: carne y pollo juntos con queso derretido.',4000,'["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600"]',TRUE,'Fusión Gogeta'),
(4,2,'Gaseosa Manzana','Refresco sabor manzana 350ml',2000,'["https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600"]',FALSE,'Esfera 1 Estrella'),
(5,2,'Gaseosa Uva','Refresco sabor uva 350ml',2000,'["https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=600"]',FALSE,'Esfera 2 Estrellas'),
(6,2,'Quatro','Quatro 350ml',2000,'["https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600"]',FALSE,'Esfera 4 Estrellas');

-- ── COMBOS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS combos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  price          DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  image_url      VARCHAR(500),
  is_active      BOOLEAN DEFAULT TRUE,
  is_featured    BOOLEAN DEFAULT FALSE,
  dragon_ball_ref VARCHAR(150),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO combos(id,name,description,price,original_price,image_url,is_featured,dragon_ball_ref) VALUES
(1,'Combo Kame x2','2 Empanadas + 1 Gaseosa',8000,9000,'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600',TRUE,'Kame Hame Ha'),
(2,'Combo Saiyan x4','4 Empanadas + 2 Gaseosas',15000,18000,'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600',TRUE,'Super Saiyan'),
(3,'Combo Namekiano x6','6 Empanadas + 3 Gaseosas',22000,27000,'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',FALSE,'Makankosappo');

-- ── PEDIDOS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT,
  order_number   VARCHAR(60) UNIQUE NOT NULL,
  status         ENUM('pending','payment_review','confirmed','preparing','delivered','cancelled') DEFAULT 'pending',
  total          DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2),
  discount       DECIMAL(10,2) DEFAULT 0,
  payment_method ENUM('cash','nequi','bancolombia','daviplata') DEFAULT 'cash',
  payment_status ENUM('pending','processing','approved','rejected') DEFAULT 'pending',
  payment_proof  VARCHAR(500),
  delivery_address TEXT,
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT,
  product_id INT,
  combo_id   INT,
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  extras     JSON,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

-- ── MENSAJES ADMIN ↔ USUARIO (va DESPUÉS de orders) ──────────────────────────
CREATE TABLE IF NOT EXISTS order_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  sender_role ENUM('admin','client') DEFAULT 'admin',
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

-- ── RESEÑAS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  product_id INT,
  rating     INT CHECK(rating BETWEEN 1 AND 5),
  comment    TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ── CLIENTES FELICES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS happy_clients (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_name    VARCHAR(150) NOT NULL,
  photo_url      VARCHAR(500),
  product_bought VARCHAR(200),
  description    TEXT,
  rating         INT DEFAULT 5,
  is_active      BOOLEAN DEFAULT TRUE,
  order_index    INT DEFAULT 0
);
INSERT IGNORE INTO happy_clients(client_name,photo_url,product_bought,description,rating,order_index) VALUES
('Carlos Vegeta','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300','Combo Saiyan x4','¡Estas empanadas superaron mis expectativas! El poder de la carne mixta es nivel dios.',5,1),
('Andrés Piccolo','https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300','Empanada de Pollo x3','El sabor penetrante de las especias me recuerda a Namek. Las mejores del universo 7.',5,2),
('María Bulma','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300','Combo Kame x2','Tan perfectas como mis inventos. Con mi Hoyacápsula vengo todos los días.',5,3),
('Juan Krilin','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300','Empanada Mixta','La empanada mixta es tan poderosa que casi me hace olvidar que no tengo nariz.',5,4);

-- ── OPINIONES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opinions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  email          VARCHAR(150),
  phone          VARCHAR(20),
  subject        VARCHAR(200),
  message        TEXT NOT NULL,
  type           ENUM('complaint','suggestion','compliment','question') DEFAULT 'suggestion',
  status         ENUM('new','read','responded') DEFAULT 'new',
  admin_response TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── CUPONES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(50) UNIQUE NOT NULL,
  description    VARCHAR(200),
  discount_type  ENUM('percent','fixed') DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase   DECIMAL(10,2) DEFAULT 0,
  max_uses       INT,
  used_count     INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  expires_at     TIMESTAMP NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO coupons(code,description,discount_type,discount_value,min_purchase) VALUES
('KAME10','10% descuento primera compra','percent',10,5000),
('SAIYAN20','20% en combos','percent',20,10000),
('ROSHI5K','$5.000 de descuento','fixed',5000,20000);

-- ── NOTIFICACIONES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT,
  title      VARCHAR(200),
  message    TEXT,
  type       VARCHAR(50) DEFAULT 'system',
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT '✅ Base de datos Empanadas Kame lista' AS resultado;
