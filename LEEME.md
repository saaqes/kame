# 🔥 EMPANADAS KAME

## Estructura
```
empanadas-kame/
├── src/
│   ├── server.js        ← Servidor principal (Express)
│   ├── config/          ← BD y SQL
│   ├── middleware/      ← Auth, Upload
│   ├── routes/          ← API REST
│   ├── uploads/         ← Archivos subidos
│   └── public/          ← Frontend (HTML/CSS/JS puro)
├── .env
└── package.json
```

## ⚡ Instalación y ejecución

### 1. Ejecutar la base de datos
Abre MySQL Workbench y ejecuta:
```
src/config/database.sql
```

### 2. Configurar contraseña
Edita `.env`:
```
DB_PASSWORD=tu_contraseña_mysql
```

### 3. Un solo comando
```bash
npm install
npm start
```

## ✅ Acceder
- **App:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

## 👤 Credenciales Admin
- Email: `admin@kame.com`
- Password: `admin123`
