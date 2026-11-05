# TuTelaGanas

# Para la entrega 4

# TuTelaGanas

Validador de tutelas de salud. La persona sube su tutela en PDF o copia el texto de la misma (por WhatsApp o por la Web) y recibe qué criterios del checklist jurídico cumple y cuáles le faltan, antes de radicarla. No redacta la tutela, no reemplaza a un
abogado y no garantiza el fallo.

## Enlaces
- Producto: https://health-doc-bot.lovable.app
- Estado del servicio (UptimeRobot): https://stats.uptimerobot.com/uqieDAPlM0

## Stack
- Frontend: React / TypeScript
- Base de datos: Supabase
- Autenticación: Clerk
- Modelo de IA: modelo de IA (haiku) vía API
- WhatsApp: Evolution API
- Despliegue: plataforma

### Requisitos

- Node.js y npm instalados.
- Una instancia de Clerk y un proyecto de Supabase para completar las variables de entorno.

### Instalación

```bash
git clone https://github.com/DanielEPardo/health-doc-bot.git
cd health-doc-bot
npm install
```

### Configuración

Crea `.env.local` a partir de `.env.example` y completa las claves de tu propio entorno.

En Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

En macOS o Linux:

```bash
cp .env.example .env.local
```

Consulta [.env.example](.env.example) para ver las variables disponibles. No subas `.env.local` al repositorio.

### Base de datos

No hay un comando de migraciones definido en `package.json`. Las migraciones de Supabase se aplican en Lovable Cloud/Supabase; consulta [INTEGRACION.md](INTEGRACION.md) si necesitas preparar la base de datos.

### Arrancar el servidor

```bash
npm run dev
```

Abre la URL que muestre Vite en la terminal.
​```

## Variables de entorno (solo nombres, sin valores)
- CLERK_PUBLISHABLE_KEY
- SUPABASE_PROJECT_ID
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_URL
- VITE_SUPABASE_PROJECT_ID
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_URL

## Cuenta de prueba
- Correo: tutelaganas@gmail.com
- Contraseña: tutela12345$
Cuenta con datos de uso y sin el límite de revisiones del growth loop.
También pueden crear una cuenta nueva desde cero.

## Funcionalidades del Alpha 0.2
- Revisión de la tutela contra un checklist jurídico, con un modelo de IA (mejorado frente a la Alpha 1.0).
- Lectura de PDF en la web y por WhatsApp.
- Growth loop: 2 revisiones gratis por cada persona nueva que completa su
  primera revisión.


Revisión orientativa de tutelas de salud antes de presentarlas al juzgado. Ver **[INTEGRACION.md](INTEGRACION.md)** (validador, revisión web y bot de WhatsApp) y **[docs/validador/](docs/validador/README.md)** (fundamentación constitucional, legal y jurisprudencial).

---

# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
