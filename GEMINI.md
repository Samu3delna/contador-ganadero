# GEMINI.md — Directrices y Uso Obligatorio de Skills (ContadorGanadero)

Todos los agentes y subagentes de Antigravity / Gemini en este workspace se rigen por las reglas arquitectónicas y la **Matriz Obligatoria de Skills** definida en [AGENTS.md](./AGENTS.md).

## Reglas de Oro para Agentes y Subagentes

1. **Enfoque Basado en Skills (Skill-First)**:
   Antes de modificar código o responder sobre un módulo del proyecto, consulta la skill correspondiente en `.agents/skills/<nombre-skill>/SKILL.md`:
   - **Facturación Electrónica Hacienda CR v4.4**: [`.agents/skills/hacienda-cr-v44/SKILL.md`](./.agents/skills/hacienda-cr-v44/SKILL.md)
   - **Impuestos REA 2026 (D-135-1, D-101, D-150) e IA Contable**: [`.agents/skills/rea-impuestos-cr/SKILL.md`](./.agents/skills/rea-impuestos-cr/SKILL.md)
   - **Multi-Tenancy (`tenantId`), Planes (`free`/`pro`) y ONVO Pay**: [`.agents/skills/multitenant-onvo-billing/SKILL.md`](./.agents/skills/multitenant-onvo-billing/SKILL.md)
   - **Ingesta de Facturas (Email/WhatsApp), Inventario Multiespecie y Costos**: [`.agents/skills/ingesta-facturas-agro-inventario/SKILL.md`](./.agents/skills/ingesta-facturas-agro-inventario/SKILL.md)
   - **Cloudflare Email Workers**: [`.agents/skills/cloudflare-email-service/SKILL.md`](./.agents/skills/cloudflare-email-service/SKILL.md) y [`.agents/skills/workers-best-practices/SKILL.md`](./.agents/skills/workers-best-practices/SKILL.md)
   - **Backend Node.js / Express**: [`.agents/skills/nodejs-backend-patterns/SKILL.md`](./.agents/skills/nodejs-backend-patterns/SKILL.md)
   - **MongoDB / Mongoose**: [`.agents/skills/mongodb-query-optimizer/SKILL.md`](./.agents/skills/mongodb-query-optimizer/SKILL.md) y [`.agents/skills/mongodb-connection/SKILL.md`](./.agents/skills/mongodb-connection/SKILL.md)
   - **Testing con Jest y Supertest**: [`.agents/skills/javascript-testing-patterns/SKILL.md`](./.agents/skills/javascript-testing-patterns/SKILL.md)
   - **Frontend React 19 + Vite 8 (Producción en Cloudflare)**: [`.agents/skills/vercel-react-best-practices/SKILL.md`](./.agents/skills/vercel-react-best-practices/SKILL.md), [`.agents/skills/vercel-composition-patterns/SKILL.md`](./.agents/skills/vercel-composition-patterns/SKILL.md), [`.agents/skills/vite/SKILL.md`](./.agents/skills/vite/SKILL.md) y [`.agents/skills/workers-best-practices/SKILL.md`](./.agents/skills/workers-best-practices/SKILL.md)
   - **Diseño UI/UX, Tailwind CSS 3 y shadcn/ui**: [`.agents/skills/tailwind-design-system/SKILL.md`](./.agents/skills/tailwind-design-system/SKILL.md), [`.agents/skills/frontend-design/SKILL.md`](./.agents/skills/frontend-design/SKILL.md) y [`.agents/skills/web-design-guidelines/SKILL.md`](./.agents/skills/web-design-guidelines/SKILL.md)

2. **Entorno en Producción (Cloudflare + Render)**:
   - **Frontend**: En producción sobre **Cloudflare** (`frontend/wrangler.toml`, directorio `./dist` con SPA routing) + **Cloudflare Email Worker** (`cloudflare-email-worker/worker.js`).
   - **Backend**: En producción sobre **Render** (`render.yaml`, API `contador-ganadero-api` y worker `contador-ganadero-imap-worker`).
   - Cualquier cambio debe preservar la compatibilidad cross-origin (CORS, cookies `httpOnly`, `VITE_API_URL`, webhooks) entre Cloudflare y Render.

3. **Delegación a Subagentes**:
   Cualquier subagente invocado debe recibir en su prompt las rutas de las skills aplicables a su tarea y el contexto de producción (Cloudflare Frontend + Render Backend) para que opere bajo los mismos estándares del proyecto.
